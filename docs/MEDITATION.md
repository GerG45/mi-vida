# Meditación diaria

La tarjeta **Un momento de paz** aparece en **Mi día** y **Hábitos**, tanto en la web como en la APK. Es una práctica sin horario: no agrega bloques a la agenda, eventos a Google Calendar ni alarmas.

- **Meditar ahora** abre la Experiencia de Paz en seis pasos. Cada paso avanza cuando la persona lo decide; se puede volver o salir en cualquier momento. Los 10–15 minutos son una sugerencia, sin contador ni finalización automática.
- **Finalizar y registrar**, al cerrar el sexto paso, registra la práctica de hoy. Abrir, recorrer o abandonar la guía no guarda una marca.
- **Ya medité** permite registrar una práctica realizada fuera de la guía. Ambas opciones guardan la misma marca diaria, sin duplicar sesiones.
- **Deshacer registro** quita la marca de hoy. No hay rachas, penalizaciones ni deuda por días sin registro.
- La pregunta final es opcional. Abrir el diario conserva la escritura existente y no agrega respuestas automáticamente.

Las otras fechas permiten leer la guía y consultar las marcas. No permiten completar ni deshacer. Si cambia el día con la guía abierta, el cierre deja de estar habilitado: la práctica no se traslada automáticamente a otra fecha.

## Datos y reporte

Se reutiliza `habitChecks`, con la clave `YYYY-MM-DD:meditation` y valor booleano. La fecha corresponde al calendario local del dispositivo. No se guardan duración real, hora de inicio o fin, respuestas, efectos ni una distinción entre práctica guiada y registro manual.

El guardado local, la cola de sincronización Firebase, la separación por cuenta y las copias JSON usan el mecanismo existente. Para compartir las marcas entre PC y móvil hay que iniciar sesión con la misma cuenta y comprobar el estado de sincronización. No cambia el esquema de Firestore ni sus permisos.

Cuando existen marcas de meditación, el reporte semanal incluye las siete fechas y el número de días registrados. «Sin registro» no afirma que la persona no haya meditado. Las copias antiguas sin esta información no producen un historial ficticio.

## Fuentes y adaptación

La guía es una **adaptación con redacción propia**, contrastada con *Obras completas*, volumen I, de Silo: *Humanizar la Tierra → La mirada interna → XV. La experiencia de paz y el pasaje de la Fuerza*, fragmentos 1–2, **página 26 del PDF aportado** (514 páginas). Se toma la experiencia de paz, sin desarrollar el pasaje de la Fuerza de los fragmentos posteriores.

La secuencia conserva la relajación, la esfera luminosa hacia el pecho, su paso de imagen a sensación, la expansión suave por el cuerpo, la permanencia y el cierre. No pauta respiraciones ni promete resultados terapéuticos.

Las citas breves literales se distinguen visualmente de las reflexiones originales. Se verificaron en las siguientes páginas del archivo, contadas desde 1:

| Libro | Sección | Páginas PDF |
| --- | --- | --- |
| Obras completas I | La mirada interna · XIII. Los Principios | 23 |
| Obras completas I | La mirada interna · XV, fragmento 2 | 26 |
| Obras completas II | Apuntes de Psicología · Psicología I · Atención, presencia y copresencia | 18 |
| Obras completas II | Apuntes de Psicología · Psicología III · La acción en el mundo como forma transferencial | 126 |

Las seis nuevas reflexiones de Silo se basan en volumen I, páginas 23 y 26, y volumen II, páginas 17–18, 90 y 125–126. Cada una muestra su contexto y páginas en las fuentes del diario. Se mantienen las ideas y citas de James Clear y Robin Sharma en la rotación.

Los dos PDF y el ZIP adjuntos permanecen fuera del repositorio y del paquete distribuido. La app incluye únicamente la guía adaptada, las reflexiones originales y las citas breves atribuidas.

## Accesibilidad

La guía conserva foco dentro del diálogo, admite Escape y devuelve el foco al salir. Los controles son táctiles, el contenido central se desplaza en pantallas pequeñas y las animaciones CSS se desactivan con `prefers-reduced-motion`.
