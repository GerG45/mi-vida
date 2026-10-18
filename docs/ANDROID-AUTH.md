# Acceso de Google en Android

La APK usa Credential Manager de Android para elegir la cuenta. El puente nativo devuelve un ID token de Google a la capa web; `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))` lo canjea en Firebase Authentication. Firestore mantiene las mismas reglas privadas por UID. No hace falta agregar el SDK de Firebase para Android ni mantener dos sesiones de Firebase.

## Configuración

1. Registrar en el proyecto Firebase correspondiente una aplicación Android con el paquete `com.mivida.guia` y la huella SHA-1 del certificado que firma la APK.
2. Habilitar Google en Firebase Authentication.
3. Obtener el OAuth client ID de tipo **Web**, del mismo proyecto. El ID de tipo Android y el `appId` de Firebase no sirven para este parámetro.
4. Guardar ese ID público en un recurso Android llamado `default_web_client_id`, o aplicar el complemento `google-services` con el archivo actualizado `google-services.json`. Se usa una sola de estas alternativas.
5. Agregar las dependencias y registrar `LifeGoogleAuthPlugin.class` en `MainActivity`, antes de `super.onCreate`.

```groovy
implementation 'androidx.credentials:credentials:1.3.0'
implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'
implementation 'com.google.android.libraries.identity.googleid:googleid:1.1.1'
```

Son versiones estables utilizadas en la guía de Firebase consultada. El inicio de sesión requiere un teléfono con Servicios de Google Play disponibles. Una nueva firma de distribución necesita registrar su propia huella; no se debe reemplazar el certificado entre actualizaciones de una misma instalación.

## Contrato del puente

- Plugin: `LifeGoogleAuth`.
- `signIn(): Promise<{idToken: string}>`: abre el selector nativo sólo cuando se pulsa el botón de acceso. Rechaza otra solicitud mientras el selector esté abierto.
- `signOut(): Promise<void>`: limpia la preferencia de cuenta de Credential Manager. La capa web debe cerrar su sesión Firebase con `signOut(auth)` antes de invocarlo.
- El token no se guarda ni se imprime en el lado nativo. Su recepción no confirma el ingreso: únicamente el observador de Firebase Authentication determina la cuenta activa.
- El cierre de la pantalla cancela la solicitud pendiente. La cancelación del usuario muestra un mensaje propio, sin marcar la cuenta como conectada.

La web conserva su acceso mediante ventana de Google. La APK utiliza el puente en lugar de abrir una ventana dentro del WebView.

## Verificación necesaria

Además de compilar, probar en un teléfono Android: selección de cuenta, cancelación, recarga con sesión persistida, lectura de la misma agenda que en la web y cierre de sesión seguido de selección de otra cuenta. Una compilación exitosa no demuestra el acceso a Google en un teléfono real.

Fuentes oficiales: [Firebase: Google en Android](https://firebase.google.com/docs/auth/android/google-signin), [Credential Manager: botón de Google y cierre de sesión](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation) y [Firebase: canje manual de credenciales Google en web](https://firebase.google.com/docs/auth/web/google-signin#advanced-handle-the-sign-in-flow-manually).
