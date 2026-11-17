# Manrope y entrada suave de cifras

Rama local `dev/biovolt-tipografia-numeros`, basada en `52c7216`. El propietario pidió cambiar la tipografía y la animación numérica para ajustarlas a BioVolt. Se revisaron el bloque del tablero, bindings, lectores de pantalla, controles de movimiento, tipografía, generadores de HTML y pruebas antes de modificar.

## Cambio

Se sustituye la tipografía del sistema por **Manrope variable, 200–800**, con caracteres latinos para español. Las formas redondeadas y la jerarquía de pesos conservan el estilo negro/verde. Se elimina la cursiva decorativa de los textos destacados. El logo vectorial no se modifica. Los números usan cifras alineadas, con tamaño adaptado al contenedor y salto de línea para valores excepcionalmente largos.

La cifra final se escribe completa desde el principio. Se anima únicamente su opacidad y desplazamiento vertical durante 650 ms cuando entra en pantalla o se actualiza. No se sortean dígitos, no se muestran conteos intermedios, no se recalculan valores y no existen temporizadores que puedan restaurar una cifra anterior. Se preservan separadores, signos, decimales, unidades y etiquetas accesibles. La pausa manual cancela el efecto dejando la cifra correcta visible. Sin observador o Web Animations, el contenido sigue visible.

## Archivos

- `src/page.html`: reemplazo localizado del bloque numérico y eliminación de las reglas del tablero; inclusión del estilo nuevo.
- `assets/typography.css`: fuente, jerarquía, cifras y familia del PDF.
- `assets/fonts`: WOFF2 original, licencia SIL OFL 1.1 y procedencia/hash en `fuentes.json`. Descargada del catálogo oficial Google Fonts v23; el navegador no consulta Google Fonts.
- `assets/particle-story.css` y `scroll-page.css`: retirada de reglas obsoletas del tablero. Los paneles no cambian.
- `scripts/build-page.mjs`: incrusta WOFF2 como data URI al generar el HTML, igual que CSS/JS propios.
- `index.html`, `revision/index.html`: entregas generadas.
- `tests/browser/typography.spec.mjs`: carga real de la fuente sin red, animación sin alterar datos, actualizaciones rápidas y valores vacíos, cifras largas en móvil, y respaldo sin APIs de animación.

La fuente pesa 24.532 bytes. La licencia y la URL exacta de origen se conservan. La revisión y el HTML público incluyen la fuente para verse igual sin archivos adicionales. El modo público conserva sus API existentes y su carga fijada de Three.js.

## Validación

Las primeras cinco pruebas específicas aprobaron la carga real de Manrope, los valores exactos durante la animación, la actualización sin cifras antiguas, el ajuste de valores largos y el respaldo visible. La regresión completa aprobó **75 pruebas de navegador y 36 de lógica**, además de sintaxis/importaciones/rutas, build y `git diff --check`. La inspección de Chromium confirma paneles translúcidos y partículas activas, PDF con datos de demostración y fuente Manrope incrustada, y ajuste en ambos temas y anchos 360/390/768/1440. No se detectaron errores JavaScript ni peticiones externas en la revisión.

No se modifican funciones de Netlify, librerías de backend, SQL, conexión, lógica de datos/mesa, modelos Gemini ni motor de partículas. No hay migraciones, variables nuevas, llamadas de producción, push, merge ni despliegue. Falta comprobación en Safari y hardware físico; la revisión usa Chromium.

Abre `BioVolt_REVISION_tipografia.html` en Chrome o Edge fuera del visor de archivos. Baja a Operaciones o Analítica para ver las cifras. Los datos y respuestas de esta copia son simulados. No debe publicarse como producción. Las fuentes se generan con `npm run build:review`; se verifican con `npm run check`, `npm test`, `npm run test:browser` y `npm run build`.
