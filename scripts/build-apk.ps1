param(
    [string]$AndroidToolsPath = "C:\Users\loren\Documents\APP GYM\.android-local",
    [switch]$SkipWebBuild,
    [switch]$OnlineGradle
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SdkPath = Join-Path $AndroidToolsPath "android-sdk"
$JdkRoot = Join-Path $AndroidToolsPath "jdk21"
$CapacitorCli = Join-Path $ProjectRoot "node_modules\@capacitor\cli\bin\capacitor"
$GradleWrapper = Join-Path $ProjectRoot "android\gradlew.bat"
$GradleCache = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $env:USERPROFILE ".gradle" }

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments, [string]$Step)
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Step falló (código $LASTEXITCODE). No se entregó un APK nuevo."
    }
}

if (-not (Test-Path -LiteralPath $CapacitorCli -PathType Leaf)) {
    throw "Faltan las dependencias locales. No se descargará ningún paquete automáticamente."
}
$CachedGradle = Get-ChildItem -LiteralPath (Join-Path $GradleCache "wrapper\dists\gradle-8.14.3-all") -Filter gradle.bat -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $CachedGradle) {
    throw "Falta Gradle 8.14.3 en la caché local $GradleCache. Este script no descarga herramientas."
}
if (-not (Test-Path -LiteralPath (Join-Path $SdkPath "platforms\android-36\android.jar") -PathType Leaf)) {
    throw "No está disponible Android SDK 36 en $SdkPath. Indicá -AndroidToolsPath con las herramientas instaladas."
}
if (-not (Test-Path -LiteralPath (Join-Path $SdkPath "build-tools\35.0.0\aapt2.exe") -PathType Leaf)) {
    throw "Faltan build-tools 35.0.0 en $SdkPath. Este script trabaja sin descargas."
}
$JavaExecutable = Get-ChildItem -LiteralPath $JdkRoot -Filter java.exe -File -Recurse | Where-Object {
    $_.FullName -like "*\bin\java.exe"
} | Select-Object -First 1
if (-not $JavaExecutable) { throw "No se encontró un JDK 21 portable en $JdkRoot." }
$NodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$NpmExecutable = (Get-Command npm.cmd -ErrorAction Stop).Source

$PreviousJava = $env:JAVA_HOME
$PreviousAndroid = $env:ANDROID_HOME
$PreviousAndroidRoot = $env:ANDROID_SDK_ROOT
$PreviousPath = $env:Path

try {
    $env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $JavaExecutable.FullName)
    $env:ANDROID_HOME = $SdkPath
    $env:ANDROID_SDK_ROOT = $SdkPath
    $env:Path = "$env:JAVA_HOME\bin;$SdkPath\platform-tools;$PreviousPath"
    Push-Location -LiteralPath $ProjectRoot
    try {
        if (-not $SkipWebBuild) {
            Invoke-Checked -Executable $NpmExecutable -Arguments @("run", "build") -Step "La compilación web"
        } elseif (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "dist\index.html"))) {
            throw "-SkipWebBuild requiere que exista dist\index.html."
        }
        Invoke-Checked -Executable $NodeExecutable -Arguments @($CapacitorCli, "sync", "android") -Step "La sincronización Android"
        Push-Location -LiteralPath (Join-Path $ProjectRoot "android")
        try {
            $GradleArguments = @("assembleDebug", "--no-daemon", "--console=plain", "-Pandroid.builder.sdkDownload=false")
            if (-not $OnlineGradle) { $GradleArguments += "--offline" }
            Invoke-Checked -Executable $GradleWrapper -Arguments $GradleArguments -Step "La compilación del APK"
        } finally {
            Pop-Location
        }
        $BuiltApk = Join-Path $ProjectRoot "android\app\build\outputs\apk\debug\app-debug.apk"
        if (-not (Test-Path -LiteralPath $BuiltApk -PathType Leaf)) { throw "Gradle terminó sin generar el APK esperado." }
        $DeliveryDirectory = Join-Path $ProjectRoot "APK"
        New-Item -ItemType Directory -Path $DeliveryDirectory -Force | Out-Null
        $DeliveryApk = Join-Path $DeliveryDirectory "Mi-Vida-0.3.0-debug.apk"
        Copy-Item -LiteralPath $BuiltApk -Destination $DeliveryApk -Force
        Write-Host "APK generado: $DeliveryApk"
    } finally {
        Pop-Location
    }
} finally {
    $env:JAVA_HOME = $PreviousJava
    $env:ANDROID_HOME = $PreviousAndroid
    $env:ANDROID_SDK_ROOT = $PreviousAndroidRoot
    $env:Path = $PreviousPath
}
