# Una misma escena de partículas en los ocho capítulos

## Alcance aprobado

El propietario aclaró que la transformación de partículas de la apertura debía ser el patrón de toda la página y autorizó adaptar tablas y paneles. Esta revisión parte de `8f4b579` en la rama local independiente `dev/biovolt-particulas-continuas`. Sustituye las figuras sólidas por una nube persistente; conserva las ocho secciones, todos sus contenidos, datos y acciones, la navegación continua y el HTML público autocontenido de la revisión anterior.

La inspección de la base confirmó que la apertura y las siete cabeceras tenían renderers separados. Se revisaron sus ciclos, los contenedores interactivos, los contratos, el generador de entrega y las pruebas antes de modificar. No se cambian funciones Netlify, librerías de backend, SQL, modelos Gemini, lógica de datos, cliente de tickets ni tiempos de espera.

## Funcionamiento

`assets/cinematic.js` contiene ahora un único renderer y un único objeto `THREE.Points`. Su mismo BufferGeometry permanece durante el scroll entre las ocho secciones. Se reutiliza sin cambios el generador original de nube, espiral, hoja y flujo, así como sus colores, brillo, semillas y transición inicial. Los nuevos destinos geométricos se añaden como atributos de esa geometría; los vértices se interpolan con una coordenada continua de scroll. No se sustituyen objetos al activar un enlace ni se recarga el motor por capítulo.

Después de la apertura, la nube pasa por energía, biomasa, anillo de plantas, red de conexiones, esfera analítica, comunicación de soporte y orbe del asistente. Son formas conceptuales; no se presentan como producción, eficiencia o datos científicos. La distribución de nodos de Plantas utiliza los registros cargados, con el límite visual de 60 ya documentado. Las cifras siguen en el DOM y conservan su fuente y unidades.

La coordenada de transformación es reversible. Entre capítulos existen estados intermedios reales; al subir se atraviesan esos mismos estados. El lienzo fijo permanece visible también durante la lectura de tablas y paneles. Los encabezados tienen un tramo de scroll con posición sticky, fundido de entrada/salida y desplazamiento corto, al igual que la apertura. No se captura ni reemplaza la rueda, el tacto o el teclado: el desplazamiento es nativo. Los accesos por hash y el botón existente de nueva solicitud permiten ir directamente al lugar necesario.

`assets/experience.js` conserva los controles de movimiento y las entradas de gráficos/datos, sin crear otro canvas ni modelos sólidos. Solo se solicita Three.js 0.160.0 desde cdnjs; GSAP/ScrollTrigger dejaron de ser necesarios para este render y no se solicitan ni se embeben en la copia nueva. Sus archivos históricos se conservan en el repositorio.

## Datos e interacción

`assets/particle-story.css` convierte los contenedores existentes en paneles de lectura con superficie translúcida y contraste controlado. En escritorio dejan espacio para las partículas; en tablet/móvil se amplían al ancho disponible. Las tablas mantienen su propio scroll horizontal. Formularios, validación, botones, ids, eventos, filtros, fuentes, conversaciones y docentes conservan el código funcional.

Al editar un campo visible o abrir un diálogo, el fondo se detiene y se atenúa. Al salir se reanuda. También se detiene con la pestaña oculta o fuera del área principal. La preferencia del sistema de movimiento reducido no lo apaga, conforme a la instrucción del propietario. La pausa manual expresa sigue disponible y se guarda como antes.

Si falta WebGL, el CDN falla, se pierde el contexto o la GPU tiene pocos atributos, las mismas formas se interpolan en Canvas 2D con menos partículas. El SVG original permanece como último respaldo. El contenido base sigue visible si una animación falla o si JavaScript no se ejecuta. No hay imágenes externas ni nuevas llamadas a Gemini/TiDB/SMTP para la presentación.

## Archivos modificados

- `assets/cinematic.js`: escena persistente, destinos geométricos, interpolación de capítulos, pausa, adaptación y respaldo.
- `assets/experience.js`: controles y animaciones de lectura; se retira el renderer independiente de cabeceras.
- `assets/particle-story.css`: cabeceras narrativas, paneles de lectura, capas, responsive y contraste.
- `assets/scroll-page.js`: una navegación inicial instantánea no conserva un bloqueo de scroll; las teclas de desplazamiento también liberan una navegación anterior.
- `assets/scene-cdn.js` y `scripts/build-review.mjs`: solo el motor realmente usado, con copia exacta embebida en revisión.
- `src/page.html`, `index.html`, `revision/index.html`: inclusión y entregas generadas.
- Pruebas visuales: se ajustan las expectativas antiguas que exigían objetos separados o detener el render fuera de una cabecera. Se añaden pruebas de identidad de geometría/canvas, continuidad, reversibilidad y lectura de paneles.

No se modifican `netlify/functions`, `lib`, `sql`, `netlify.toml`, `assets/core.js`, `assets/helpdesk.js` o `assets/enhancements.js` respecto de la base `8f4b579`.

## Validación

- Primera pasada específica: 10 pruebas nuevas aprobadas.
- La regresión detectó un desbordamiento de un adorno preexistente de Inicio a 1024 px al ampliar los contenedores. Se restauró el recorte del hero; se repitieron las pruebas de 1024 px y las comprobaciones principales de la nube.
- Pasada final completa: **67 pruebas de navegador aprobadas**, **36 de lógica aprobadas**, sintaxis/importaciones/cinco rutas Netlify aprobadas, build y `git diff --check` aprobados.
- Las pruebas gráficas comprueban que la misma geometría y el mismo canvas recorren los ocho capítulos, que la escena tiene solo Points, que existen poses intermedias y reversión, y que sigue dibujando debajo de las tablas. Se prueba además una GPU limitada, pérdida de contexto, falta de WebGL, movimiento con preferencia reducida y anchos 360/390/768/1024/1440.
- La pausa manual y la ausencia total de Canvas mantienen todos los encabezados visibles y los filtros/formularios utilizables.
- Se conservan las regresiones de datos normalizados, simulación, exportaciones, chat, cuotas, creación/confirmación/reapertura de tickets, privacidad, fuentes, docentes, notas internas, recuperación y contrato dosPasos.
- Capturas reales de Chromium en los siete capítulos posteriores y móvil: sin errores JavaScript o de compilación del shader.

Las integraciones se prueban con SQL y proveedores simulados; no se consumen servicios de producción ni se afirma validación de credenciales reales.

## Entrega y configuración

```bash
npm ci
npm run build:page
npm run build:review
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```

El archivo público sigue siendo `index.html` de la raíz. Contiene el CSS y JavaScript propios y usa las API existentes; Three.js se carga desde la versión fija de cdnjs. La copia `revision/index.html` incorpora también esa librería y datos/respuestas simulados, y no consume servicios. El servidor de desarrollo desactiva las API deliberadamente.

Para mantener una fuente reproducible, se conservan `src/page.html`, los módulos de `assets`, los generadores de `scripts`, pruebas y documentación. No se debe publicar la copia de revisión como producción. Las variables y funciones de Netlify continúan como estaban.

## Pendientes y límites

Falta revisión en hardware físico Android/iPhone y Safari. Chromium del entorno usa render por software cuando no hay GPU; sus resultados no garantizan FPS en un dispositivo físico. La apertura mediante `file://` está bloqueada por política del navegador del entorno: se prueba el mismo HTML por HTTP local. No se han probado conexiones reales de TiDB, Gemini o SMTP ni tiempos/cuotas remotas de Netlify. No hay migraciones, cambios de datos, push, merge o despliegue en esta entrega.
