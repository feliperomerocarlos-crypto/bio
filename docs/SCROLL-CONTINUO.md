# BioVolt — una sola página con scroll narrativo

## Base y alcance

Rama local `dev/biovolt-scroll-continuo`, basada en la revisión local `f72037a` y la rama main `6549abe`. La instrucción recibida en Texto pegado.txt autoriza cambiar el diseño, reunir las ocho vistas en una página larga y mantener el movimiento activo aunque el sistema solicite reducirlo. Esa instrucción sustituye la navegación y la preferencia visual de la revisión anterior.

Se revisaron la estructura, el router, el ciclo de datos, los contadores, los modelos decorativos y los contratos frontend/backend antes de editar. La revisión anterior había aprobado 36 pruebas de lógica y 49 de navegador. No se modifican `netlify/functions`, `lib`, `sql` ni `netlify.toml`; no se consultan ni alteran registros reales.

## Resultado visual y navegación

Las ocho secciones permanecen en el mismo DOM, visibles y en el orden Inicio, Operaciones, Inventario, Plantas, Directorio, Analítica, Mesa de ayuda y Asistente IA. La barra mínima, los enlaces laterales y los enlaces internos llevan a la sección mediante scroll normal y suave. El desplazamiento manual resalta la sección actual y actualiza hashes como `#inventario`. Se admiten enlaces anteriores como `#/inventario` y los accesos a módulos/FAQ. La navegación conserva atrás/adelante y no desvía el scroll cuando se escribe.

Las cabeceras combinan el fondo negro BioVolt, títulos por palabras, párrafos originales, divisoria fina y cifras existentes con giro de dígitos. Se conserva el logo SVG original y su adaptación al tema. Las figuras son visuales conceptuales de marca y no se presentan como indicadores científicos ni producción real. El anillo de Plantas usa los registros cargados, con un máximo visual de 60 nodos; los valores numéricos y la fuente siguen indicándose aparte.

Las escenas se activan solo con su cabecera en pantalla. Se pausan fuera de pantalla, con pestaña oculta o al editar un campo visible/abrir un diálogo. El sistema de reducción de movimiento no las desactiva. Se conserva una pausa manual, explícita, en la barra y en Inicio. Las figuras tienen alternativa Canvas 2D y SVG; los textos son visibles si falla la animación o si no se ejecuta JavaScript. Las tablas conservan desplazamiento horizontal propio en móvil.

## Archivo único y librerías

`index.html` es el archivo público generado: contiene el CSS y JavaScript propios; no depende de archivos locales para mostrar el frontend. Las únicas librerías solicitadas se cargan desde cdnjs en versiones fijas, de 2023/2024:

- Three.js 0.160.0: `https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js`
- GSAP 3.12.5: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
- ScrollTrigger 3.12.5: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js`

No hay imágenes externas ni fuentes remotas. Si el CDN falla, se utiliza el render ligero. `revision/index.html` incorpora copias exactas de esas mismas librerías para revisar sin red, junto con el adaptador de API simulado. Fuentes, licencias y SHA-256 de las copias se registran en `assets/vendor`.

La fuente editable se conserva en `src/page.html`, los módulos de presentación en `assets` y el generador en `scripts/build-page.mjs`. No se debe editar solamente el HTML generado si después se va a regenerar desde las fuentes.

## Contratos de datos, chat y soporte

Se conservan rutas, modelos Gemini, datos normalizados, comparación de periodos, filtros, simulador, exportaciones, validación, historial, privacidad, docentes, responsables y fuentes. Las cifras repetidas en cabecera proceden de los mismos datos; los conteos de soporte respetan el alcance de los tickets autorizados de la pestaña o docente.

La versión base inicia la IA desde el servidor al guardar una solicitud, a diferencia del mecanismo antiguo de dos pasos citado en las instrucciones. Se conserva ese flujo. Si una respuesta indica explícitamente `dosPasos: true`, el cliente admite el contrato anterior e invoca `/api/agente` una sola vez con el código privado. Sin esa bandera no realiza una segunda llamada. No se crea otro agente ni se cambia su modelo.

El límite de espera de las solicitudes del cliente se ajusta a 25 segundos, incluido el envío de tickets. Esto no amplía los tiempos de ejecución o cuotas de Netlify/Gemini: esos servicios pueden fallar antes. Los errores y respaldos siguen identificados; no se presentan respuestas locales como Gemini.

## Trabajo por fases y comprobaciones

1. Estructura, enlaces directos, navegación, historial y menú móvil: navegador automatizado aprobado antes de continuar.
2. Modelos por sección, pausa fuera de pantalla y movimiento con preferencia reducida: navegador aprobado.
3. Titulares por palabras y cifras finales con aria-label, fuente y unidades intactas: navegador aprobado.
4. Diseño responsive entre 360 y 1440 px, tablas, chat, creación de tickets, conversación, confirmación/reapertura, docentes y recuperación: 20 pruebas de fase aprobadas.
5. Contratos `dosPasos` activo/inactivo, autenticación privada, fuentes seguras y timeout cliente: aprobados. Se corrigió una pausa residual causada por un campo que conservaba el foco fuera de pantalla; las 21 comprobaciones afectadas se repitieron y aprobaron.

Pasada final completa: 54 pruebas Chromium aprobadas, 36 pruebas de lógica aprobadas, sintaxis/importaciones y cinco rutas Netlify aprobadas, build de producción aprobado y git diff --check sin errores. Se inspeccionaron capturas de las siete cabeceras operativas en escritorio y una captura móvil, sin errores de JavaScript. Las APIs de integración usan funciones reales con SQL de prueba y Gemini/SMTP simulados; las pruebas de datos usan respuestas TiDB de prueba y verifican que no se mezclen muestras con lecturas vacías reales. No son una comprobación de conectividad de producción.

## Comandos y configuración

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

Abrir el servidor local en `http://127.0.0.1:4173`. Sus API están desactivadas deliberadamente. Para revisar chat y solicitudes sin servicios, abrir la copia `revision/index.html`: el PIN docente es DEMO y toda atención está marcada como simulación. Los tickets ficticios desaparecen al recargar. La prueba del entorno sirve ese HTML por HTTP; no se afirma haber probado `file://`, bloqueado por política del navegador del entorno.

## Qué subir a GitHub y cómo desplegar después

- Para sustituir solo el frontend sobre la plataforma existente, el archivo público es **`index.html` de la raíz**, no `revision/index.html`. Está autocontenido salvo las librerías CDN y usa las rutas de API existentes. Se mantienen las funciones/configuración y las variables actuales de Netlify.
- Para conservar fuentes y una compilación reproducible, conviene subir la rama completa: `src/page.html`, los cambios de `assets`, generadores de `scripts`, `package.json`, pruebas, documentación y ambos HTML generados. El ZIP de entrega contiene el proyecto organizado y excluye secretos, node_modules y builds.
- `npm run build` regenera el HTML y publica únicamente `dist`. La defensa de despliegue de ramas de revisión se mantiene.
- No se sube a main, no se fusiona ni se despliega automáticamente. La decisión de publicar corresponde al propietario.

## Límites pendientes

No se consumieron TiDB, Gemini ni SMTP reales. No se prueba aquí el runtime remoto de Netlify ni la disponibilidad/cuota de los modelos. Falta revisar rendimiento y funcionamiento en Safari/iPhone y Android físicos; las comprobaciones gráficas usan Chromium y, cuando no hay GPU, WebGL por software. El aspecto de una captura no acredita FPS en un dispositivo físico. Las conexiones de IA reales requieren el despliegue y las variables existentes; no se incluyen credenciales en el frontend.
