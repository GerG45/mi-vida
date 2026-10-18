# Firebase para Mi Vida

El frontend puede publicarse en GitHub Pages. Firebase conserva los datos privados por cuenta. Sin configuración o sin iniciar sesión, Mi Vida guarda en este navegador.

## Proyecto nuevo

1. Crear en [Firebase Console](https://console.firebase.google.com/) un proyecto nuevo llamado **Mi Vida**. El identificador real es único y puede diferir del nombre.
2. Registrar una aplicación web. Copiar su objeto `firebaseConfig` público (no una cuenta de servicio).
3. En Authentication → Sign-in method, habilitar Email/Password. El usuario puede crear su propia cuenta desde Authentication → Users → Add user. La app no crea cuentas por sí sola. Para permitir registro desde la app, agregar `"allowRegistration": true` al JSON público.
4. En Authentication → Settings → Authorized domains, agregar el dominio de GitHub Pages, por ejemplo `usuario.github.io`. No se agrega la ruta del repositorio. Para pruebas locales, agregar `localhost` o `127.0.0.1` según corresponda.
5. Crear **Cloud Firestore**, edición Standard, base `(default)`, en la región elegida por el usuario. Publicar el contenido de `firestore.rules` desde Rules. No usar reglas de prueba abiertas.
6. Guardar el JSON web en `public/firebase-config.json` antes de compilar/publicar, o pegarlo en Ajustes → Configurar conexión Firebase. La configuración pegada se conserva sólo en ese navegador.

Ejemplo (completar con el proyecto real):

```json
{
  "apiKey": "clave-web-publica-del-proyecto",
  "authDomain": "mi-vida-id.firebaseapp.com",
  "projectId": "mi-vida-id",
  "appId": "1:numero:web:identificador",
  "messagingSenderId": "numero",
  "allowRegistration": false,
  "googleSignIn": false
}
```

Para Google, habilitar ese proveedor en Authentication, completar su correo de soporte y agregar `"googleSignIn": true`. La app usa popup; correo y contraseña siguen disponibles si el navegador bloquea popups.

`allowedEmail` puede limitar el formulario y rechazar otra cuenta en esta instalación. **No es una frontera de seguridad:** es configuración pública. Las reglas entregadas aíslan por `request.auth.uid == uid`. Si se necesita permitir un solo correo para todo el proyecto, agregar también esa condición a `owner()` en las reglas y publicarlas; no alcanza con editar el JSON del cliente.

## Cómo sincroniza

- Ruta: `users/{uid}/miVidaRecords/{id}`. El id codifica la sección y su clave. Cada documento tiene `value`, `deleted` y `updatedAt` del servidor.
- Ajustes y perfil se sincronizan por propiedad; mapas, por entrada; listas con `id`, por elemento. Editar una fecha o una tarea no reemplaza las demás. Si dos dispositivos cambian la misma entrada, prevalece la última escritura que confirma Firestore.
- Borrar crea un registro `deleted: true`. Se conservan tombstones para que la eliminación llegue a otros dispositivos.
- Al ingresar, espera el primer snapshot del servidor. No sube valores iniciales ni el espacio local. Si la cuenta está vacía, el botón **Subir datos de este dispositivo** permite copiar los datos locales explícitamente.
- Cada cuenta tiene su propia copia local y cola de cambios, separadas también por proyecto Firebase. Cerrar sesión vuelve al espacio local anterior; no muestra datos de la cuenta cerrada.
- Sin conexión los cambios se guardan en el navegador y quedan pendientes. La primera conexión de una cuenta necesita leer el servidor antes de publicar. **Sincronizado** sólo aparece después de un snapshot del servidor sin escrituras pendientes y una cola local vacía.
- No guarda contraseñas en las secciones ni en los respaldos. Firebase Authentication administra la sesión. Limpiar datos del navegador puede borrar cambios todavía no confirmados; exportar respaldo conserva una copia.

## Publicar reglas con CLI (opcional)

Si Firebase CLI ya está instalado y autenticado:

```powershell
firebase deploy --only firestore:rules --project ID_REAL_DEL_PROYECTO
```

No se necesita Firebase Hosting: GitHub Pages sirve el frontend y Firebase Auth/Firestore sirven la cuenta y los datos. Después de publicar el JSON, volver a compilar y desplegar la web.

## Verificación entre dispositivos

1. Ingresar con la cuenta propia en el primer navegador. Si está vacía, copiar los datos locales con el botón explícito.
2. Esperar **Sincronizado con tu cuenta**. Ingresar con la misma cuenta en otro navegador/dispositivo: deben aparecer los mismos registros sin publicar sus valores iniciales.
3. Editar fechas distintas en cada uno y comprobar ambas. Borrar una tarea y comprobar que desaparece también en el otro.
4. Sin conexión, editar una entrada: debe mostrar estado local pendiente/offline. Recuperar conexión y esperar confirmación antes de comprobarla en el otro dispositivo.
5. Cerrar sesión y comprobar que vuelve el espacio local separado. Ingresar con otra cuenta no debe mostrar los datos de la anterior.

Fuentes oficiales verificadas: [instalación web](https://firebase.google.com/docs/web/setup), [Auth con correo](https://firebase.google.com/docs/auth/web/password-auth), [Google](https://firebase.google.com/docs/auth/web/google-signin), [listeners y metadatos](https://firebase.google.com/docs/firestore/query-data/listen), [datos offline](https://firebase.google.com/docs/firestore/manage-data/enable-offline), [reglas por usuario](https://firebase.google.com/docs/firestore/security/rules-conditions).
