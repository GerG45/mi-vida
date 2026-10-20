# Mi Vida para Android

La APK incluye la interfaz dentro de la app: no necesita abrir la página en Chrome. La agenda, GTD y el diario usan la misma cuenta Firebase que la web. Las alarmas usan `AlarmManager` de Android y funcionan sin JavaScript ni conexión una vez programadas.

## Primera vez en el teléfono

1. Instalar `Mi-Vida-0.7.1-debug.apk` encima de la versión anterior y abrir Mi Vida.
2. En **Ajustes**, entrar con la misma cuenta Google. Esperar a que aparezcan los horarios personales y el estado de la nube.
3. En **Alarmas**, permitir notificaciones y alarmas exactas. La pantalla completa es un permiso adicional; también se puede detener o posponer desde la notificación.
4. Revisar el volumen de alarmas y tocar **Probar alarma en 30 segundos**. Bloquear la pantalla y comprobar sonido, Detener y Posponer antes de usar el despertador de la agenda.
5. Activar el despertar calculado, los recordatorios elegidos o una alarma puntual. Revisar la próxima alarma y el estado confirmado por Android.

En Xiaomi/POCO, revisar el inicio automático y las restricciones de batería de Mi Vida si la prueba no funciona con la pantalla bloqueada. La app muestra los permisos que Android permite consultar; no afirma conocer el estado de los ajustes específicos de HyperOS.

## Descanso diario de la versión 0.7.1

Al actualizar y abrir la APK, se activa una vez «Prepararme y acostarme» para esa cuenta en ese teléfono. Conserva los demás avisos y el sonido del despertador. Si después desactivás la opción, se respeta al reiniciar. Requiere agenda activada y permisos de notificaciones y alarmas exactas.

La hora de prepararte también aparece junto al descanso en «Mi día», tanto en web como en Android. Ambos avisos se adaptan al próximo despertar, incluso si acostarse es después de medianoche. Los despertares y los dos avisos de descanso se reservan antes de llenar el límite de 200 con compromisos generales.

## Calendar y compras de la versión 0.7.0

Google Calendar se conecta desde Ajustes, con una autorización adicional de la misma cuenta de Google. Permite consultar compromisos y publicar bloques con revisión previa en un calendario separado. La consulta se renueva mientras la app está visible; no hay sincronización con la app cerrada. La API del proyecto y el consentimiento de la cuenta deben activarse antes de probar la conexión real. Ver [pasos y límites](GOOGLE-CALENDAR.md).

«Compras» es una lista de súper independiente del día y del meal prep. Se guarda en Firebase con los demás registros de la cuenta. El martes se prefiere entrenar a las 08:30, respetando los compromisos que ya ocupan ese horario.

## Bienvenida y movimiento de la versión 0.6.3

La APK y la web comparten una bienvenida con el brote y el logo de Mi Vida. El presupuesto habitual es de 2,2 segundos desde que comienza a cargar la página, más una salida de 240 ms; una carga lenta no suma otros dos segundos. Android mantiene su splash de sistema automático, sin una pausa nativa añadida. «Entrar ahora» o Escape omiten la espera, y Ajustes → «Ver bienvenida» permite repetirla. Con movimiento reducido el contenido se habilita directamente al estar listo.

Volver de Google, de los ajustes de Android o de segundo plano no vuelve a mostrar la bienvenida. Detener y posponer el despertador continúa en la actividad nativa, fuera del telón web. Las tarjetas, los controles, el contraste y los modales reciben las mismas mejoras visuales de la web. Se conservan la firma, los datos, el ícono y los sonidos. Ver [auditoría de interfaz](UI-AUDIT.md).

## Fechas protegidas de la versión 0.6.2

Hoy permite registrar actividad. Las fechas futuras permiten preparar agenda y listas, pero bloquean checks, diario, series y cronómetros. Las fechas pasadas conservan sus registros en modo de consulta. El bloqueo se actualiza al llegar medianoche y al volver a la app; también se verifica al guardar. Un contador abierto queda limitado al final de su fecha, sin modificar el registro histórico. Se mantienen los ajustes globales, la importación explícita y los reportes. Instalar encima de la versión anterior conserva la cuenta, los datos, la firma, el ícono y los sonidos.

## Listas de trabajo de la versión 0.6.1

Cada fecha y período de trabajo tiene una checklist propia, editable con anticipación. Los minutos por paso y el cronómetro con pausa son opcionales. Las listas se guardan con la misma cuenta y se incluyen en el reporte semanal. Ver [listas de trabajo](WORK-CHECKLISTS.md). La actualización conserva el gimnasio, los datos, el paquete, la firma, el ícono y los sonidos existentes.

## Gimnasio de la versión 0.6.0

Integra el gimnasio completo dentro de Mi Vida: sesión guiada, aproximaciones, cargas, repeticiones o segundos, descansos, RPE, molestias, notas, rutinas propias e historial. Se sincroniza con la misma cuenta Firebase y se incluye en el reporte semanal. Ver [uso del gimnasio](TRAINING.md). La actualización conserva el paquete, la firma, el ícono del brote y los sonidos de despertador y recordatorios.

## Ícono de la versión 0.5.2

El manifiesto de Android usa los recursos `ic_launcher` e `ic_launcher_round`, con el mismo brote del favicon web. Incluye ícono adaptable para Android 8+ y PNG para versiones anteriores. La pantalla de inicio también muestra el brote sobre fondo crema. La actualización conserva datos, firma y sonidos de la versión 0.5.1.

## Sonidos de la versión 0.5.1

- Despertador: mantiene el sonido de alarma predeterminado del móvil, por el volumen de alarmas.
- Recordatorios secundarios (incluidos creatina, hora de acostarse y alarmas puntuales de tipo recordatorio): usan el MP3 proporcionado, incluido en `res/raw/mi_vida_reminder_ding.mp3`, por el volumen de notificaciones.
- La actualización crea un canal nuevo para aplicar el tono. Conserva importancia, vibración y silencio del canal anterior; no modifica los tonos ni el volumen global del teléfono. Las elecciones posteriores del canal se respetan.
- Si Android impide iniciar el despertador continuo, su aviso de respaldo utiliza un canal separado con el tono de alarma del teléfono.
- Abrir la APK después de actualizar. Para comprobar el ding, crear una alarma puntual de tipo «Recordatorio»; «Probar alarma en 30 segundos» sigue probando el despertador.

## Alcance de las alarmas

La versión 0.5.0 incorpora excepciones para un lunes sin Pewen, colectivo al ensayo, creatina junto al desayuno, alternativas con licuadora/minipimer reporte semanal descargable, hora de acostarse para el próximo día y nueva identidad «Mi Vida.». Instalarla encima de la versión anterior conserva los datos y ajustes locales porque mantiene el mismo paquete y certificado. Las versiones anteriores necesitan actualizarse para interpretar estos ajustes y exportar el reporte desde Android.

- El despertar suena por el canal de volumen de alarmas, con vibración, durante un máximo de 10 minutos. Se puede detener o posponer 10 minutos sin internet.
- La opción «Creatina con el desayuno» programa un recordatorio independiente al comienzo de cada desayuno, incluso en días de descanso. Se activa en cada teléfono y requiere tener la rutina habilitada en Ajustes; no indica dosis.
- «Prepararme y acostarme» programa dos avisos diarios: uno 45 minutos antes para empezar a cerrar el día y otro a la hora propuesta para acostarte. Esa hora se calcula con el despertar del día siguiente y tus horas de descanso. Una sola opción activa o desactiva ambos avisos en este teléfono; la vista previa muestra las próximas dos fechas y horas para revisarlas.
- Los dos avisos para dormir usan el sonido breve de recordatorios y respetan el volumen de notificaciones. El despertador mantiene su sonido, volumen y controles de Detener y Posponer. Los avisos sonoros se programan desde la APK; la web explica la función, pero no reproduce estas alarmas con la página cerrada.
- Los recordatorios generan una notificación sonora breve. Respetan la configuración de sonido y No molestar de Android.
- La agenda se prepara para los siguientes 14 días. Abrir la app renueva ese período. Hasta 200 avisos por lote; las alarmas puntuales tienen prioridad y pueden quedar programadas más allá de los 14 días.
- Los ajustes y alarmas puntuales pertenecen al dispositivo y a la cuenta. No se copian a otros teléfonos. Al cambiar de cuenta se cancela la programación anterior.
- Los cambios hechos en la PC llegan cuando la app Android vuelve a abrirse con conexión. No hay un servicio de push que cambie alarmas con la app cerrada.
- Se restauran las alarmas futuras después de reiniciar o actualizar la app. Un teléfono apagado no reproduce sonido; forzar la detención desde Android puede suspender las alarmas hasta volver a abrir Mi Vida.
- No se cambia automáticamente el volumen, No molestar ni las restricciones de batería.

## Reporte semanal

En Mi día los domingos/lunes y en Mi diario se puede descargar un Markdown con los registros de una semana. El lunes ofrece la semana anterior. En Android abre el selector del sistema para elegir dónde guardarlo, sin permiso general sobre archivos. El reporte diferencia horarios propuestos de registros y no se envía a ningún servicio al descargarlo.

## Compilar

Requiere Node.js 22, JDK 21, SDK Android 36 y build-tools 35.0.0. La configuración nativa se sincroniza con Capacitor 8.

```powershell
npm ci
npm test
powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
```

El script usa las herramientas locales ya instaladas en `APP GYM/.android-local` o la ruta indicada con `-AndroidToolsPath`. Por defecto Gradle trabaja sin red. Para descargar dependencias oficiales de Google Maven/Maven Central durante la primera compilación, usar `-OnlineGradle`. No descarga un SDK ni un JDK.

Entrega: `APK/Mi-Vida-0.5.2-debug.apk`. Es una compilación de prueba firmada con la clave debug local; no es una publicación en Google Play. Al usar una clave diferente hay que registrar su SHA-1 en Firebase y Android puede exigir reinstalar. No incluir claves de firma en Git.

El acceso Google usa Credential Manager nativo y canjea la credencial en Firebase Auth web. Ver [configuración del acceso Android](ANDROID-AUTH.md). El service worker de la web no se registra en la APK.

## Validación

Se comprueban la compilación TypeScript/Vite, los cálculos y las colas de programación, la compilación Android, su manifiesto y firma. La prueba real de sonido con pantalla bloqueada, reinicio y acceso Google requiere el teléfono del usuario; una compilación exitosa no confirma esos comportamientos físicos.

Referencias: [alarmas de Android](https://developer.android.com/develop/background-work/services/alarms), [servicios de audio](https://developer.android.com/develop/background-work/services/fgs/service-types), [inicio automático en HyperOS](https://dev.mi.com/xiaomihyperos/documentation/detail?pId=1624), [ahorro de batería del POCO X7](https://www.mi.com/global/support/faq/details/KA-524070/).
