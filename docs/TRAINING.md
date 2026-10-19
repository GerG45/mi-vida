# Gimnasio en Mi Vida.

Desde el bloque de entrenamiento de «Mi día» o la pestaña «Entrenar» se abre el gimnasio integrado. Incluye el plan original de cuatro semanas y tres rutinas, y permite crear rutinas propias.

## Registrar una sesión

Elegí rutina y semana, revisá la variante de cada ejercicio y empezá. La sesión conserva las series de aproximación indicadas por el plan. Registrá los kilos y las repeticiones o segundos que realmente hiciste y completá cada serie. Las aproximaciones se distinguen de las series efectivas.

Los descansos se calculan a partir de una hora de finalización, de manera que no se estiren si el teléfono suspende la web. Podés pausarlos, ajustar el tiempo y saltarlos. Al volver, el contador recupera el tiempo correspondiente; la web no garantiza sonido con la pantalla bloqueada. Los despertadores y recordatorios de la APK conservan su configuración.

Cada variante recupera sus propias cargas registradas. No se mezclan cargas entre máquina y mancuernas, ni se suben pesos automáticamente. La referencia anterior no se registra como una serie nueva hasta completarla. En los ejercicios con mancuernas, mantené siempre la misma convención de kilos al registrar para poder comparar.

La sesión permite guardar RPE, molestias, notas y estados de cada ejercicio, y conservar una sesión parcial. El historial conserva lo efectivamente registrado. Una marca genérica de «hecho» en la agenda no inventa series ni cargas.

## Datos y sincronización

Las secciones `gymSessions` y `gymRoutines` usan el mismo almacenamiento local y la misma colección privada por cuenta de Firebase que el diario y la agenda. Los borradores y registros se guardan durante la sesión. Iniciá sesión con la misma cuenta en PC y APK, y comprobá el estado de sincronización. Las reglas existentes sólo permiten leer y escribir al dueño de la cuenta.

El respaldo de Ajustes incluye todo el gimnasio. Se conservan las copias anteriores de Mi Vida: restaurar una copia que no incluya gimnasio deja los registros de gimnasio actuales sin cambios.

El almacenamiento privado de la antigua APK «Plan Gym» pertenece a otra aplicación: Android no permite leerlo automáticamente desde Mi Vida. La importación del formato original `gym-training-tracker:v1` permite migrar una copia JSON disponible sin reemplazar el resto de Mi Vida. Los registros antiguos no tienen repeticiones ni duración real, por lo que esos datos permanecen sin registrar y no se inventan en el reporte.

## Reporte semanal

El archivo descargable incluye las sesiones por fecha, sus series completadas, cargas, repeticiones o segundos registrados, aproximaciones, RPE, molestias y notas. Distingue sesiones finalizadas, parciales y antiguas importadas. Los bloques planificados y las marcas de agenda se presentan separados de estos registros reales.

Los tutoriales se abren al elegirlos. Las ilustraciones se incluyen en la app; los videos y sus miniaturas pertenecen a sus respectivos autores. El catálogo y sus fuentes están en [tutoriales](training-tutorials.md).
