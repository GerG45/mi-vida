# Mi Vida para Android

La APK incluye la interfaz dentro de la app: no necesita abrir la página en Chrome. La agenda, GTD y el diario usan la misma cuenta Firebase que la web. Las alarmas usan `AlarmManager` de Android y funcionan sin JavaScript ni conexión una vez programadas.

## Primera vez en el teléfono

1. Instalar `Mi-Vida-0.4.0-debug.apk` y abrir Mi Vida.
2. En **Ajustes**, entrar con la misma cuenta Google. Esperar a que aparezcan los horarios personales y el estado de la nube.
3. En **Alarmas**, permitir notificaciones y alarmas exactas. La pantalla completa es un permiso adicional; también se puede detener o posponer desde la notificación.
4. Revisar el volumen de alarmas y tocar **Probar alarma en 30 segundos**. Bloquear la pantalla y comprobar sonido, Detener y Posponer antes de usar el despertador de la agenda.
5. Activar el despertar calculado, los recordatorios elegidos o una alarma puntual. Revisar la próxima alarma y el estado confirmado por Android.

En Xiaomi/POCO, revisar el inicio automático y las restricciones de batería de Mi Vida si la prueba no funciona con la pantalla bloqueada. La app muestra los permisos que Android permite consultar; no afirma conocer el estado de los ajustes específicos de HyperOS.

## Alcance de las alarmas

La versión 0.4.0 incorpora la nueva presentación, horarios de cocina fijos y ensayo del lunes con regreso posterior. Instalarla encima de la versión anterior conserva los datos y ajustes locales porque mantiene el mismo paquete y certificado. La versión 0.3.0 necesita actualizarse para interpretar esos nuevos ajustes de agenda.

- El despertar suena por el canal de volumen de alarmas, con vibración, durante un máximo de 10 minutos. Se puede detener o posponer 10 minutos sin internet.
- Los recordatorios generan una notificación sonora breve. Respetan la configuración de sonido y No molestar de Android.
- La agenda se prepara para los siguientes 14 días. Abrir la app renueva ese período. Hasta 200 avisos por lote; las alarmas puntuales tienen prioridad y pueden quedar programadas más allá de los 14 días.
- Los ajustes y alarmas puntuales pertenecen al dispositivo y a la cuenta. No se copian a otros teléfonos. Al cambiar de cuenta se cancela la programación anterior.
- Los cambios hechos en la PC llegan cuando la app Android vuelve a abrirse con conexión. No hay un servicio de push que cambie alarmas con la app cerrada.
- Se restauran las alarmas futuras después de reiniciar o actualizar la app. Un teléfono apagado no reproduce sonido; forzar la detención desde Android puede suspender las alarmas hasta volver a abrir Mi Vida.
- No se cambia automáticamente el volumen, No molestar ni las restricciones de batería.

## Compilar

Requiere Node.js 22, JDK 21, SDK Android 36 y build-tools 35.0.0. La configuración nativa se sincroniza con Capacitor 8.

```powershell
npm ci
npm test
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
```

El script usa las herramientas locales ya instaladas en `APP GYM/.android-local` o la ruta indicada con `-AndroidToolsPath`. Por defecto Gradle trabaja sin red. Para descargar dependencias oficiales de Google Maven/Maven Central durante la primera compilación, usar `-OnlineGradle`. No descarga un SDK ni un JDK.

Entrega: `APK/Mi-Vida-0.4.0-debug.apk`. Es una compilación de prueba firmada con la clave debug local; no es una publicación en Google Play. Al usar una clave diferente hay que registrar su SHA-1 en Firebase y Android puede exigir reinstalar. No incluir claves de firma en Git.

El acceso Google usa Credential Manager nativo y canjea la credencial en Firebase Auth web. Ver [configuración del acceso Android](ANDROID-AUTH.md). El service worker de la web no se registra en la APK.

## Validación

Se comprueban la compilación TypeScript/Vite, los cálculos y las colas de programación, la compilación Android, su manifiesto y firma. La prueba real de sonido con pantalla bloqueada, reinicio y acceso Google requiere el teléfono del usuario; una compilación exitosa no confirma esos comportamientos físicos.

Referencias: [alarmas de Android](https://developer.android.com/develop/background-work/services/alarms), [servicios de audio](https://developer.android.com/develop/background-work/services/fgs/service-types), [inicio automático en HyperOS](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1624), [ahorro de batería del POCO X7](https://www.mi.com/global/support/faq/details/KA-524070/).
