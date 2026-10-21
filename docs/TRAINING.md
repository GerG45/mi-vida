# Gimnasio en Mi Vida.

Desde el bloque de entrenamiento de «Mi día» o la pestaña «Entrenar» se abre el gimnasio integrado. Incluye el plan original de cuatro semanas y tres rutinas, y permite crear rutinas propias.

## Registrar una sesión

Elegí rutina y semana, revisá la variante de cada ejercicio y empezá. La sesión conserva las series de aproximación indicadas por el plan. Registrá los kilos y las repeticiones o segundos que realmente hiciste y completá cada serie. Las aproximaciones se distinguen de las series efectivas.

Los descansos y las series cronometradas se calculan a partir de una hora de finalización. Podés pausarlos, ajustar el tiempo y saltarlos. Al volver, el contador recupera el tiempo correspondiente.

En la APK, los contadores que iniciás se programan también en Android para avisar con el celular bloqueado o Mi Vida en segundo plano. Usan el canal **Entrenamiento · tono suave**, con el ding de recordatorios. No usan el sonido de despertar. Pausar, saltar, cambiar variante o terminar la sesión cancela los contadores correspondientes; cambiar de ejercicio cancela el de serie, y explorar otra página no cancela el descanso. Los avisos nunca marcan series como realizadas.

Requieren notificaciones habilitadas, permiso de **Alarmas y recordatorios** y sonido en ese canal. La app muestra una ayuda si falta alguno. El volumen es el de alarmas del dispositivo y Android conserva los ajustes de sonido o No molestar elegidos por la persona. Una app detenida explícitamente desde los ajustes de Android necesita volver a abrirse. No se prometen avisos después de ese cierre forzado. La web conserva el bip de descanso mientras su pantalla permanece abierta.

También hay un aviso al **fin previsto del bloque de entrenamiento** de la agenda. Se activa por defecto al actualizar y se puede desactivar por separado en Alarmas → **Avisar al terminar el bloque de entrenamiento**. Programa hasta 14 días y se renueva al usar Mi Vida. Se omite cuando el bloque ya está marcado como completo. Es una referencia del plan, sin duración real inferida ni finalización automática de la sesión.

Los contadores activos corresponden a la fecha local de hoy; no se vuelven a hacer sonar al consultar registros vencidos ni después de medianoche. Los plazos del contador se guardan sólo en el dispositivo para la entrega del aviso. Las sesiones continúan usando Firebase como antes.

## Entrenamiento por la mañana

Miércoles y viernes buscan el primer hueco matutino a partir de las 08:30, después de las obligaciones del jardín. Con los traslados actuales y entrega propia: regreso a casa 08:20, ida al gimnasio 15 minutos y sesión **08:35–09:50**. Regreso y ducha terminan 10:20, antes de la cocina del viernes a las 10:30. Cuando otra persona se encarga de la entrega y los cuidados lo permiten, la sesión queda **08:30–09:45**.

Si un compromiso o el cuidado de Almendra impiden completar sesión, ida, regreso y ducha por la mañana, la agenda muestra el aviso y deja el bloque sin ubicar. No lo pasa a la tarde ni desplaza los horarios fijos. El despertar y el descanso propuestos se recalculan con esos compromisos.

Cada variante recupera sus propias cargas registradas. No se mezclan cargas entre máquina y mancuernas, ni se suben pesos automáticamente. La referencia anterior no se registra como una serie nueva hasta completarla. En los ejercicios con mancuernas, mantené siempre la misma convención de kilos al registrar para poder comparar.

La sesión permite guardar RPE, molestias, notas y estados de cada ejercicio, y conservar una sesión parcial. El historial conserva lo efectivamente registrado. Una marca genérica de «hecho» en la agenda no inventa series ni cargas.

## Datos y sincronización

Las secciones `gymSessions` y `gymRoutines` usan el mismo almacenamiento local y la misma colección privada por cuenta de Firebase que el diario y la agenda. Los borradores y registros se guardan durante la sesión. Iniciá sesión con la misma cuenta en PC y APK, y comprobá el estado de sincronización. Las reglas existentes sólo permiten leer y escribir al dueño de la cuenta.

El respaldo de Ajustes incluye todo el gimnasio. Se conservan las copias anteriores de Mi Vida: restaurar una copia que no incluya gimnasio deja los registros de gimnasio actuales sin cambios.

El almacenamiento privado de la antigua APK «Plan Gym» pertenece a otra aplicación: Android no permite leerlo automáticamente desde Mi Vida. La importación del formato original `gym-training-tracker:v1` permite migrar una copia JSON disponible sin reemplazar el resto de Mi Vida. Los registros antiguos no tienen repeticiones ni duración real, por lo que esos datos permanecen sin registrar y no se inventan en el reporte.

## Reporte semanal

El archivo descargable incluye las sesiones por fecha, sus series completadas, cargas, repeticiones o segundos registrados, aproximaciones, RPE, molestias y notas. Distingue sesiones finalizadas, parciales y antiguas importadas. Los bloques planificados y las marcas de agenda se presentan separados de estos registros reales.

Los tutoriales se abren al elegirlos. Las ilustraciones se incluyen en la app; los videos y sus miniaturas pertenecen a sus respectivos autores. El catálogo y sus fuentes están en [tutoriales](training-tutorials.md).
