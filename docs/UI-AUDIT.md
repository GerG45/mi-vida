# Auditoría de interfaz · Mi Vida.

Fecha: 20 de octubre de 2026. Versión: 0.6.3.

## Cómo viene la app

La identidad visual ya es coherente: verde profundo, crema, pasteles, títulos serif y superficies con aire. «Tu próximo paso» ofrece una buena prioridad cotidiana. El gimnasio, las listas de trabajo, el diario y los reportes están integrados. Las restricciones por fecha y el guardado se conservan en esta actualización.

La oportunidad principal es darle continuidad a la experiencia: un arranque reconocible, respuestas táctiles consistentes y contenido que se descubra con calma. La app ya tenía transiciones; se completaron y ordenaron para que no se superpongan.

## Hallazgos y cambios aplicados

| Hallazgo | Mejora de esta versión |
| --- | --- |
| La web entraba directamente; Android sólo tenía el splash del sistema. | Bienvenida común con el favicon del brote, el logo SVG y «Un día a la vez». Presupuesto de 2200 ms desde el inicio de navegación y salida de 240 ms. |
| Las tarjetas inferiores terminaban su animación antes de llegar a verse. | Aparición única al entrar en pantalla, con desplazamiento de 9 px y opacidad durante 280 ms. Las tarjetas nunca quedan ocultas esperando JavaScript. |
| Algunos botones propios del gimnasio y de otras secciones tenían un feedback distinto. | Pulsación leve y breve en controles habilitados, y flechas concretas que avanzan 2 px al pasar el puntero. |
| Parte de los textos de ayuda eran demasiado claros o pequeños. | Se oscurecieron las descripciones esenciales y se aumentaron a 12 px en móvil; las etiquetas de navegación ganaron tamaño y contraste. |
| Los accesos de gimnasio y trabajo comprimían texto y CTA en tres columnas en un celular angosto. | Dos columnas para icono y contenido; la acción queda en su propia línea, debajo del texto. |
| La barra móvil podía dejar fuera de vista la sección elegida desde otra herramienta. | Marcación accesible de la sección y desplazamiento horizontal sólo cuando hace falta, también al redimensionar. |
| Los modales de agenda no tenían el mismo manejo de teclado que las listas. | Foco inicial en el formulario, Tab contenido, Escape, restauración del foco y bloqueo del scroll de fondo. |

## Límites y accesibilidad

- La bienvenida se muestra al cargar un documento nuevo. No se dispara por cambios de sección, de fecha, de foco ni al volver de Google o del segundo plano. «Ver bienvenida» es una repetición explícita.
- La interfaz y Firebase arrancan detrás; la bienvenida no espera a la red ni retrasa la sincronización. Una carga que ya superó los 2200 ms no añade otra espera completa.
- «Entrar ahora» y Escape permiten omitirla. Un fallo de arranque tiene una salida de recuperación a los 8 segundos que libera teclado, scroll e interacción.
- Con `prefers-reduced-motion` se eliminan desplazamientos, presión y transiciones; la bienvenida se retira inmediatamente al estar lista la app.
- Se usan CSS, `IntersectionObserver` y un observador de nodos nuevos. No se agregaron bibliotecas, fuentes, videos ni solicitudes externas para los efectos. No se observa el scroll en cada frame ni se vuelven a animar filas cuando cambia un contador.
- Los controles nativos de detener y posponer alarmas quedan fuera del telón. No se cambiaron Java, permisos, sonidos, sincronización ni formatos de datos.

## Próxima vuelta recomendada

1. **Navegación móvil:** considerar cuatro destinos principales y «Más», manteniendo todas las herramientas. La tira actual conserva sus nueve destinos; reorganizarlos merece una decisión de uso propia.
2. **Recorrido diario más compacto:** evaluar un modo que deje hora, título y check a la vista y permita abrir los detalles. Hoy se conservan todas las descripciones para mantener la operación conocida.
3. **Ajustes más fáciles de recorrer:** agrupar las secciones largas en bloques desplegables, con un resumen de lo ya configurado.
4. **Primera carga:** el paquete principal todavía concentra Firebase y las herramientas base. La siguiente optimización requiere medir carga real y caché antes de dividir más módulos. El telón es una bienvenida, no una mejora artificial de esas métricas.

## Verificación

143 pruebas automáticas aprobadas, incluyendo restricciones por fecha, almacenamiento, listas, gimnasio y nueve escenarios del telón: carga normal/lenta, doble efecto de StrictMode, omisión, foco, movimiento reducido, repetición explícita y recuperación ante fallos. Se revisó la interfaz en navegador de PC y a 390 px, con controles de teclado reales. Compilación web y APK verificadas por separado al preparar la entrega.

La revisión de Android incluye código, recursos y compilación; no sustituye una prueba física en el POCO X7. Tampoco constituye una certificación completa de accesibilidad o rendimiento.

Referencias técnicas: [animaciones CSS y rendimiento](https://web.dev/articles/animations-guide), [preferencia de movimiento reducido](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion).
