# Listas de Trabajo / proyectos

En «Mi día», elegí la fecha y abrí «Armar lista» en la tarjeta de trabajo, o «Abrir mi lista» en el recorrido del día. Podés preparar una fecha futura desde el calendario o escribir los pasos al empezar el bloque. La lista empieza vacía y se completa con tus propias tareas.

Cada tarea tiene un check y minutos previstos opcionales. Podés usar la lista sin tiempos, editar títulos y estimaciones, ordenar los pasos y deshacer una eliminación. El cronómetro es opcional: se inicia y pausa explícitamente. Completar un paso detiene su contador; volverlo a pendiente conserva el tiempo registrado.

Las listas pertenecen a una fecha y un período de trabajo. Si el planificador divide Trabajo / proyectos en dos huecos, ambos muestran la misma lista de ese día; el almuerzo tampoco divide en dos la lista del trabajo fijo. Los proyectos agregados manualmente tienen su propia lista. Los ensayos conservan su funcionamiento actual.

La suma de estimaciones se compara con los minutos efectivamente reservados en esos bloques, sin contar las pausas entre ellos. Un exceso se muestra como aviso y no mueve los compromisos. Los checks de tareas y la marca general del bloque son controles separados. Las listas no se copian a otros días ni modifican los pendientes GTD.

Si el bloque desaparece al cambiar un horario, la lista guardada sigue visible para esa fecha, señalada como «Sin bloque reservado hoy». Sus tareas se conservan. Cambiar de cuenta mantiene separados los datos.

El almacenamiento `workItems` guarda cada tarea por separado en la misma colección privada Firebase y en el respaldo JSON de Mi Vida. Se puede editar sin conexión y sincronizar después. Conviene evitar editar la misma tarea simultáneamente en dos dispositivos: se aplica la última escritura aceptada por Firebase.

Al cerrar la lista el contador en marcha sigue contando; se recupera al volver a abrir. No genera alarmas ni modifica los sonidos del teléfono. Las estimaciones y los checks nunca generan tiempo trabajado. En el reporte semanal, las fechas son las asignadas a cada lista y los checks son su estado al exportar; el cronómetro registra el tiempo iniciado por vos, incluidas las distracciones si se deja encendido.
