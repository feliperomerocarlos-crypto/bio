# BioVolt — escena cinematográfica de Inicio

Base: `origin/main` en `23f27f2ed0f4c826dcc6de77a3d2485ab74ca87c`. Rama de trabajo independiente: `dev/biovolt-cinematica`. La entrega se prepara para revisión en GitHub; la fusión a main y el despliegue requieren autorización independiente.

## Qué cambia

Se añade una introducción en Inicio, delante de la portada original. Una única nube de puntos 3D se reorganiza en espiral, hoja abstracta y líneas de energía. Cámara, estructura y textos comparten un progreso continuo, reversible y vinculado al desplazamiento. El mensaje final es «Transformamos biomasa en energía para el futuro». Un botón permite saltar directamente a la plataforma.

No se usa un video como fondo. La referencia audiovisual se interpreta como dirección de movimiento, profundidad y composición; sus imágenes y marcas no se incorporan a la página ni al nuevo anuncio. Las ocho vistas, gráficos, inventario, simulador, reportes, asistente y mesa de ayuda se conservan. El backend, SQL, credenciales y modelos Gemini no cambian.

La navegación adopta un tono oscuro solo mientras la introducción ocupa la pantalla; al entrar en las otras secciones conserva el tema elegido por el usuario. No se añade una transición que bloquee formularios ni capture el scroll de la página.

## Arquitectura

- `assets/cinematic.js`: ciclo de vida, geometrías, shaders GLSL, cámara, progreso, calidad adaptativa y alternativa visual.
- `assets/cinematic.css`: composición, sticky, textos, móvil, navegación de la escena y movimiento reducido.
- `src/cinematic-engine.mjs`: importaciones concretas de Three.js y GSAP/ScrollTrigger.
- `scripts/build-cinematic-engine.mjs`: genera el paquete de navegador con versiones fijadas, esbuild y licencias.
- `assets/cinematic-engine.js`: paquete local generado y versionado; no se debe editar manualmente.
- `assets/cinematic-licenses.txt`: licencia MIT de Three.js y referencia a la licencia estándar de GSAP.
- `index.html`: integración de la nueva sección y enlaces a sus assets; portada y módulos anteriores conservados.
- `scripts/build-review.mjs`: incluye también motor, estilos y escena en la copia autocontenida.
- `scripts/check.mjs`: comprueba scripts inline tanto del sitio como de su copia de revisión.
- `tests/browser/cinematic.spec.mjs`: integración real con WebGL y regresiones del ciclo de vida.
- `tests/browser/site.spec.mjs`: actualiza dos expectativas de movimiento según la instrucción más reciente.
- `playwright.config.mjs`: permite SwiftShader para verificar shaders en el entorno de pruebas sin GPU física.
- `package.json` y lock: Three.js 0.180.0, GSAP 3.13.0 y esbuild 0.25.9 fijados.

GSAP utiliza un solo ScrollTrigger con scrub de 0,65 s. El anclaje es CSS `position: sticky` dentro de la sección, sin un segundo pin de JavaScript ni contenedores que intercepten el desplazamiento. Esto conserva el router por hash, la navegación móvil y los formularios. No se cambia el proyecto de framework.

Las cuatro posiciones de cada partícula se precalculan una vez. El shader interpola sus posiciones y añade deriva, brillo suave y atenuación por profundidad; no se actualizan miles de posiciones desde JavaScript en cada cuadro. Los textos muestran fases distintas del mismo progreso y no reinician una animación independiente al retroceder.

## Rendimiento y recursos

El motor se pide al visitar Inicio; no se carga por red cuando la primera vista es Mesa de ayuda. El paquete mide aproximadamente 599 kB sin compresión y 166 kB con gzip en la medición local; la transferencia real depende de la compresión del hosting. Todos los archivos son locales, sin CDN.

Según ancho y capacidad declarada se crean 1800/3000 puntos en móvil y 5500/10500 en escritorio. Se limita el pixel ratio a 1,25 en móvil y 1,65 en escritorio. El render móvil tiene un máximo previsto de unos 30 cuadros/s; una medición inicial de cuadros lentos reduce resolución y cantidad de puntos. Esto es una estrategia adaptativa, no una garantía de FPS en todos los equipos. Al reducir una ventana al ancho móvil también se limita su densidad.

El render se pausa fuera de la escena o con la pestaña oculta. Al salir de Inicio se eliminan ScrollTrigger, geometría, material, renderer, contexto y listeners de esa instancia. Al volver se crea una instancia nueva y se reutiliza el motor ya cargado. La pérdida de contexto WebGL vuelve a la alternativa SVG en vez de bloquear la plataforma.

## Preferencia de movimiento

El texto nuevo del propietario solicita expresamente respetar `prefers-reduced-motion`; sustituye su preferencia anterior de mantener siempre las animaciones. Con movimiento reducido no se crea WebGL ni se ejecuta la secuencia larga. Se muestra una composición SVG estática, el nombre BioVolt, el mensaje y el botón de entrada. Se detienen las animaciones CSS y SVG existentes, y el helper original de movimiento vuelve a consultar la preferencia del sistema. Los cambios de preferencia durante la sesión también se aplican.

## Verificación local

La línea base conservada tenía 36 pruebas Node y 24 pruebas de navegador. Esta revisión añade once casos de navegador: compilación/dibujo WebGL; progreso y retroceso; carga diferida y liberación al navegar; límites móviles; movimiento reducido inicial; cambio de preferencia; motor no disponible; pérdida de contexto; copia autocontenida sin solicitudes de dependencias; WebGL denegado; pausa fuera de pantalla (algunos controles comparten un mismo caso).

Los resultados finales deben consultarse en el registro de entrega. Las pruebas de las APIs siguen utilizando TiDB/Gemini/SMTP simulados. La prueba gráfica utiliza Chromium con WebGL real sobre SwiftShader: verifica ejecución de shaders y cambios de imagen, no mide una GPU física ni certifica Safari/iPhone o Android. El entorno bloquea `file://` por política del navegador; la copia autocontenida se verifica servida por HTTP local y sin solicitudes externas, sin afirmar que se probó aquí su apertura por doble clic.

## Cómo revisar

```sh
npm ci
npm run build:scene
npm run build:review
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```

Abrir `http://127.0.0.1:4173/#/inicio` con el servidor de desarrollo. Las APIs de `npm run dev` siguen desactivadas deliberadamente. También puede servirse `revision/index.html`, que incluye sus dependencias y usa datos/IA de demostración claramente identificados. La copia de revisión no consume servicios de producción.

Desplazarse hasta pasar por las cuatro fases, volver hacia arriba, probar el botón de entrada, abrir la mesa y el asistente, regresar a Inicio, cambiar el tamaño y activar la preferencia de movimiento reducido. Para revisar una animación normal, el sistema debe tener la preferencia de movimiento sin reducción.

Las comprobaciones de backend y modelos se complementan con un diff contra la base: no se modifican `netlify/functions`, `lib`, `sql`, `assets/core.js` ni los assets de la mesa. La política anterior que evita desplegar ramas de revisión se conserva.

## Video solicitado

Se prepara un montaje separado de la página, con la misma escena 3D grabada localmente y vistas de las funciones de BioVolt. Los datos y respuestas IA se identifican como simulados. Se conserva una pista minimalista instrumental y un master visual para incorporar la narración femenina más adelante. No se utiliza la grabación de referencia ni se presenta la voz pendiente como si ya estuviese generada.

## Limitaciones pendientes

- Revisión visual y de rendimiento en dispositivos físicos y navegadores adicionales.
- Latencia de primera carga en redes móviles reales y configuración de compresión del hosting.
- Apertura del HTML autocontenido mediante doble clic en el equipo del usuario.
- Validación del despliegue real únicamente cuando el propietario lo autorice.
- La integración no convierte las ocho rutas en una página única de scroll: la secuencia conecta la introducción con la portada existente, y los módulos conservan su navegación actual.

## Registro final de validación

- `npm run check`: aprobado, incluidos scripts inline de la copia de revisión.
- `npm test`: 36 pruebas aprobadas; proveedores externos simulados.
- `npm run test:browser`: 35 pruebas aprobadas en la pasada completa.
- Los once casos gráficos incluyen además una verificación de legibilidad: ningún punto del recorrido presenta dos títulos visibles superpuestos.
- `npm run build:scene`, `npm run build:review` y `npm run build`: aprobados.
- Comparación de backend, SQL, lógica de datos y mesa contra `origin/main`: sin diferencias.
- La navegación por `file://` está bloqueada por política del navegador del entorno; no se intentó desactivar esa política. La copia se verificó por HTTP local, sin peticiones de dependencias o servicios.
- Video: exportación de 288 cuadros de WebGL a 24 fps, seguida de interfaz local con datos simulados, cierre de marca y música minimalista. No incluye voz. La captura de interfaz no produjo errores JavaScript.
