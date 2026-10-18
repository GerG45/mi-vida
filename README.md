# Mi Vida

Un espacio personal para organizar el día, capturar pendientes, escribir y hacer lugar para lo importante. Web adaptable a PC y celular, preparada para GitHub Pages y Firebase.

También incluye una APK Android con despertador y recordatorios locales. Ver [instalación, prueba y compilación de Android](docs/ANDROID.md).

[Código en GitHub](https://github.com/GerG45/mi-vida) · [Dirección de la web](https://gerg45.github.io/mi-vida/)

## Qué incluye

- Agenda que calcula el despertar a partir del primer compromiso, la preparación y los viajes. Alternancia familiar de dos semanas, excepciones por fecha y detección de cruces.
- Bandeja GTD, próximas acciones, proyectos, esperas, algún día, referencia y revisión semanal. Sólo se agenda una acción cuando elegís fecha y hora.
- Diario de mañana, cierre y escritura libre, con historial y búsqueda.
- Hábitos con señal y versión mínima, sin penalizar una pausa.
- Ideas y reflexiones inspiradas en cuatro libros de James Clear y Robin Sharma, identificadas como redacción original; fuentes y páginas en la web.
- Cocina por tandas, compras y rutina de entrenamiento de referencia.
- Copia local, respaldo JSON y calendario ICS. Sincronización privada por cuenta con Firebase.

## Usar en otro dispositivo

Abrí la misma dirección y entrá con la misma cuenta Google en Ajustes. El estado debe indicar **Sincronizado con tu cuenta**. Si no iniciaste sesión, los cambios pertenecen solamente a ese navegador.

La primera conexión lee los datos existentes antes de escribir. Los datos locales se pueden subir explícitamente a una cuenta vacía. Los cambios se guardan por entrada, tarea o ajuste; si se edita el mismo registro en dos dispositivos, prevalece la última escritura que acepta Firebase.

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
