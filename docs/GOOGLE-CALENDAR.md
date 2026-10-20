# Google Calendar · primera integración (0.7.0)

Mi Vida puede leer calendarios elegidos y publicar bloques en un calendario privado separado, «Mi Vida.». Firebase sigue guardando los registros personales. No requiere Functions, un servidor nuevo ni cambiar el plan de Firebase.

## Activación de la cuenta

1. En el proyecto Google Cloud **Mi Vida** (`mi-vida-bf920`), habilitar **Google Calendar API**. La consola informa las condiciones de uso del servicio: este paso debe completarlo o autorizarlo el titular.
2. Revisar Google Auth Platform → Acceso a los datos. La aplicación solicita `calendar.calendarlist.readonly`, `calendar.events.readonly` y `calendar.app.created`. El primer permiso permite elegir calendarios; el segundo leer compromisos; el tercero crear un calendario y administrar los eventos de los calendarios creados por esta aplicación. No se amplía la clave pública de Firebase.
3. En Mi Vida → Ajustes → Conectar Google Calendar, autorizar con la misma cuenta de Google que usa Firebase. En web conviene usar Chrome o Edge. La APK usa la autorización nativa de Google Play Services, separada del ingreso existente.
4. Seleccionar las fuentes y actualizar los compromisos. Elegir categorías, preparar la vista previa de 14 días y confirmar la publicación.

La aplicación OAuth existente está en producción, con usuarios externos. Si Google presenta una advertencia de aplicación sin verificar o solicita verificación adicional, la decisión corresponde al titular: el código no omite advertencias. La distribución pública a otros usuarios puede requerir verificar los permisos sensibles ante Google.

## Qué actualiza y qué conserva

- Lee hoy y los próximos 13 días, con todas las páginas y repeticiones expandidas. Sólo guarda título, fecha, horas, origen, disponibilidad y fecha de modificación. No copia descripciones, asistentes ni ubicaciones. Descarta invitaciones rechazadas.
- Los compromisos ocupados se consideran antes de ubicar trabajo y gimnasio y calcular despertar/acostarse. Los eventos de todo el día y los marcados «libre» son informativos. Los cruces con horarios fijos siguen visibles.
- Los eventos externos no tienen checks ni recordatorios propios en Mi Vida. El calendario de destino se excluye de las fuentes para evitar un bucle. La lectura no modifica diario, hábitos, series o cargas.
- Publicar y actualizar los bloques de Mi Vida requiere revisar y confirmar. No es edición bidireccional: los cambios hechos en Google se detectan y conservan, sin copiarlos sobre la planificación local. Un bloque que desaparece de la vista previa se retira sólo si no fue editado en Google; esto se informa antes de confirmar.
- Los bloques publicados incluyen sólo título y horario, sin invitados ni recordatorios de Google. Se excluyen cuidados familiares, jardín, comidas, traslados, descanso y márgenes automáticos. Los horarios estimados requieren activar su inclusión.
- Los identificadores deterministas evitan duplicar eventos al repetir una publicación desde PC o APK. Una transacción privada en Firebase coordina la creación del calendario entre dispositivos. Las modificaciones usan la versión de Google (`If-Match`) para detectar cambios simultáneos.
- Las copias pasadas permanecen cerradas. El reporte semanal distingue los compromisos externos como referencias de la última consulta, sin inventar cumplimiento.

## Frecuencia y límites

Los compromisos se consultan al conectar o volver a la aplicación y aproximadamente cada dos minutos mientras está visible y hay una autorización vigente. También existe «Actualizar compromisos». Los cambios de Mi Vida se publican con «Revisar antes de publicar» y «Confirmar publicación».

Los tokens de acceso viven sólo en memoria. Al recargar/cerrar la aplicación o vencer el acceso temporal hay que reconectar; el ingreso de Firebase y las copias consultadas se conservan. «Desconectar aquí» cierra este acceso temporal, sin borrar calendarios ni revocar el ingreso de Firebase. La revocación completa se realiza desde la cuenta de Google.

Con la aplicación cerrada no hay sincronización. Después de editar en PC, abrir la APK con conexión permite recibir Firebase y renovar la programación nativa. Las alarmas ya programadas conservan su funcionamiento; no se promete que un cambio remoto reprograme un teléfono cerrado.

## Verificación

Pruebas automatizadas de zonas horarias, eventos multidía, disponibilidad, cancelaciones, paginación, aislamiento de cuentas, expiración, historial cerrado, duplicados, conflictos y restauración de publicaciones. Compilación TypeScript y Java del plugin nativo verificadas. La conexión real con la cuenta y la comprobación en un teléfono físico requieren la activación y el consentimiento del titular.

Referencias: [permisos](https://developers.google.com/workspace/calendar/api/auth), [consulta de eventos](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [control de versiones](https://developers.google.com/workspace/calendar/api/guides/version-resources), [autorización Android](https://developers.google.com/identity/authorization/android/authorize-access).
