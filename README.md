# Mi Vida.

Un espacio personal para organizar el día, capturar pendientes, escribir y hacer lugar para lo importante. Web adaptable a PC y celular, preparada para GitHub Pages y Firebase.

También incluye una APK Android con despertador y recordatorios locales. Ver [instalación, prueba y compilación de Android](docs/ANDROID.md).

[Código en GitHub](https://github.com/GerG45/mi-vida) · [Dirección de la web](https://gerg45.github.io/mi-vida/)

## Qué incluye

- Agenda que calcula el despertar a partir del primer compromiso, la preparación y los viajes, y cuándo acostarse para despertar al día siguiente. Alternancia familiar de dos semanas, excepciones por fecha y detección de cruces.
- Bandeja GTD, próximas acciones, proyectos, esperas, algún día, referencia y revisión semanal. Sólo se agenda una acción cuando elegís fecha y hora.
- Listas de Trabajo / proyectos por fecha: prepararlas con anticipación o durante el bloque, completar checks y asignar minutos opcionales a cada paso. Cronómetro con pausa, edición, orden y recuperación de tareas quitadas. Los registros se sincronizan y entran en el reporte semanal.
- Diario de mañana, cierre y escritura libre, con historial, búsqueda y reporte semanal descargable para revisar tus registros.
- Hábitos con señal y versión mínima, sin penalizar una pausa.
- Ideas y reflexiones inspiradas en cuatro libros de James Clear y Robin Sharma, identificadas como redacción original; fuentes y páginas en la web.
- Cocina por tandas y compras. Gimnasio integrado: las tres rutinas originales y sus cuatro semanas, sesiones guiadas, aproximaciones, cargas, repeticiones, tiempos y descansos; historial, RPE, molestias, notas y rutinas personalizadas.
- Videos por variante de ejercicio, ilustraciones locales y seguimiento de cargas que recupera el último registro de la misma variante. Los entrenamientos registrados se incluyen en el reporte semanal.
- Horarios fijos opcionales para las tandas del martes y viernes, y ensayo del lunes con regreso posterior configurable.
- Excepción por fecha para un lunes sin trabajo: entrenamiento por la mañana, ida en colectivo al ensayo y regreso habitual; miércoles y viernes se mantienen.
- Creatina junto al desayuno como recordatorio personal, opciones con licuadora/minipimer y enlaces privados a tus lugares.
- Copia local, respaldo JSON y calendario ICS. Sincronización privada por cuenta con Firebase.
- Conexión opcional con Google Calendar: consultar compromisos y publicar bloques en un calendario separado, con revisión previa. Ver [activación y límites](docs/GOOGLE-CALENDAR.md).
- Compras de súper en una sección independiente: productos, cantidades, categorías y checks, guardados por cuenta sin depender de la fecha explorada ni del meal prep.

La interfaz usa tipografías del dispositivo, colores cálidos y animaciones CSS breves. La preferencia del sistema de reducir movimiento desactiva las animaciones y transiciones. Los cambios visuales conservan las herramientas y los datos existentes.

La versión 0.6.3 incorpora una bienvenida compartida por web y APK: brote, logo y una salida suave en aproximadamente 2,4 segundos desde el inicio de carga. Se puede omitir con «Entrar ahora» o Escape y repetir desde «Ver bienvenida» en Ajustes. Con movimiento reducido se abre directamente. Las tarjetas inferiores aparecen al descubrirlas con scroll; los botones habilitados responden con una presión leve. También mejora la lectura de ayudas, la navegación móvil y el foco de los modales. Ver [auditoría de interfaz](docs/UI-AUDIT.md).

El calendario permite explorar cualquier fecha. Hoy habilita checks, diario, series y cronómetros. En días futuros se pueden preparar compromisos y listas de trabajo, pero no registrar actividad; los días pasados quedan en modo de consulta, con sus datos y reportes disponibles. El bloqueo se comprueba también al guardar y se actualiza al cambiar el día. Los cronómetros abiertos dejan de acumular tiempo al terminar su fecha, sin reescribir el registro original. Los ajustes, las definiciones globales y la recuperación explícita de respaldos se conservan.

## Usar en otro dispositivo

Abrí la misma dirección y entrá con la misma cuenta Google en Ajustes. El estado debe indicar **Sincronizado con tu cuenta**. Si no iniciaste sesión, los cambios pertenecen solamente a ese navegador.

La primera conexión lee los datos existentes antes de escribir. Los datos locales se pueden subir explícitamente a una cuenta vacía. Los cambios se guardan por entrada, tarea o ajuste; si se edita el mismo registro en dos dispositivos, prevalece la última escritura que acepta Firebase.

Los entrenamientos y rutinas también se guardan por cuenta, funcionan sin conexión y forman parte del respaldo JSON. Conviene registrar cada sesión desde un solo dispositivo a la vez para evitar que dos ediciones de la misma sesión se reemplacen. Los videos externos necesitan conexión; la rutina, las ilustraciones y los registros funcionan sin ellos. Ver [gimnasio integrado](docs/TRAINING.md).

## Desarrollo

Requiere Node.js 22 y npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

La carpeta `dist/` contiene la web publicable. El service worker guarda los archivos de la web después de la primera visita; las escrituras pendientes se conservan en el navegador. Para sincronizar necesitás conexión. Los datos de una cuenta se mantienen separados del espacio local y de otras cuentas del mismo navegador.

## Firebase

La configuración web pública está en `public/firebase-config.json`. No es una clave de administrador. La protección de los registros la establecen Firebase Authentication y las reglas de Firestore, que permiten acceder únicamente al UID autenticado correspondiente. No incluyas cuentas de servicio, contraseñas, copias personales ni PDFs en este repositorio.

Ver [la guía de Firebase](docs/FIREBASE.md). El proyecto necesita Google como proveedor de acceso, Firestore en modo de producción y las reglas de `firestore.rules`. Agregá el dominio de GitHub Pages a los dominios autorizados.

## GitHub Pages

En **Settings → Pages → Source**, elegí **GitHub Actions**. El workflow incluido prueba, compila y publica `dist/` al subir cambios a `main`. Las rutas relativas permiten alojar la web dentro de `/mi-vida/`.

El repositorio contiene el código de la herramienta. El diario y la agenda personal no se incluyen en el código ni en el sitio compilado. La agenda viene desactivada hasta configurar los propios horarios o importar una copia privada.

## Ideas de referencia

- *Hábitos atómicos*, James Clear: identidad, entorno, señales y pasos pequeños.
- *El monje que vendió su Ferrari*, Robin Sharma: propósito, atención y cuidado personal.
- *La riqueza que el dinero no puede comprar*, Robin Sharma: salud, vínculos, aprendizaje y contribución.
- *El club de las 5 de la mañana*, Robin Sharma: reservar tiempo para uno mismo; el horario de despertar se adapta a los compromisos reales.
- [Los cinco pasos de GTD](https://gettingthingsdone.com/what-is-gtd/), David Allen Company. Esta web es una implementación independiente y no está afiliada a los autores.

Las comidas y los ejercicios son contenido de referencia. Agendar un entrenamiento diario no equivale a prescribir siete sesiones de fuerza.
