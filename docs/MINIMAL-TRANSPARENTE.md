# BioVolt: tipografía sobre partículas

## Alcance

Rama local `dev/biovolt-minimal-transparente`, basada en `e7fd5ef`. El propietario pidió eliminar el aspecto de tarjetas y dejar las tablas como letras sobre el fondo animado en las ocho secciones. Se inspeccionaron las reglas del HTML, estilos de partículas, métricas, chat, mesa y sus pruebas antes de editar.

## Cambios

- `assets/particle-story.css`: paneles, tablas y celdas sin superficies, bordes ni sombras; se retiran también los pseudo-elementos de brillo. Jerarquía mediante espacio, títulos y cabeceras de tabla. No se ocultan columnas ni filas. Se conserva el scroll horizontal de tablas en móvil.
- Las métricas ya no tienen casillas opacas; las cifras conservan su contenido y animación. Los módulos, avisos, estados y chat prescinden de recuadros. Los estados mantienen texto e indicadores. Los campos tienen línea inferior, etiqueta y foco visible; los menús nativos de selección conservan una superficie legible. Los diálogos de solicitudes conservan una superficie de lectura.
- `src/page.html`: se elimina únicamente el bloque de reglas antiguas que forzaba dos tarjetas verdes con texto negro, porque anulaba la transparencia y el contraste. Los ids, elementos, eventos y funciones del HTML permanecen.
- `assets/cinematic.js`: se elimina la pausa por foco/diálogo. La misma geometría sigue dibujando; el foco atenúa el lienzo al 70 % sin detenerlo. Continúan la pausa manual, la suspensión de pestaña oculta y fuera del área principal, y los respaldos Canvas 2D/SVG.
- `tests/browser/experience.spec.mjs` y `particle-story.spec.mjs`: se actualiza el comportamiento esperado de foco; se comprueba avance real de frames al filtrar y en el diálogo. No se modifican las pruebas funcionales de datos o soporte.
- `index.html` y `revision/index.html`: archivos generados desde las fuentes mediante `npm run build:review`.

No se modifican funciones de Netlify, librerías de backend, SQL, configuración de conexión, cliente de datos, lógica de mesa o modelos Gemini. Se conservan `gemini-3.6-flash` y `gemini-3.5-flash-lite`. No se ejecutan migraciones, conexiones a producción, push, merge ni despliegue.

## Revisión

La inspección en Chromium comprueba transparencia efectiva y ausencia de blur/sombras en las tablas, tarjetas y métricas, tanto en tema oscuro como claro; incluye las tarjetas que tenían estilos específicos por id. Las burbujas de ambos interlocutores se comprueban transparentes tras enviar una pregunta simulada. Se capturan inventario, producción, formulario, chat y móvil de 390 px. Se comprueba el avance de frames bajo las tablas, sin errores JavaScript ni peticiones externas desde la revisión.

Resultado final: **67 pruebas de navegador aprobadas y 36 de lógica aprobadas**, además de sintaxis/importaciones/rutas, build y `git diff --check`. Se adjuntan los registros y la comprobación visual de transparencia en ambos temas, incluyendo hover. No se afirma conexión real con TiDB, Gemini o SMTP. Falta revisión en hardware físico y Safari; el entorno ejecuta Chromium.

## Abrir y generar

Descarga `BioVolt_REVISION_minimalista.html` y ábrelo en Chrome o Edge, fuera del visor de archivos. Es una copia autocontenida y sin servicios reales; sus datos y respuestas son de demostración. No debe publicarse como producción. El ZIP completo conserva `index.html` público, fuentes, backend y documentación.

```sh
npm ci
npm run build:review
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```

No se requieren variables nuevas. La configuración de publicación existente se conserva.
