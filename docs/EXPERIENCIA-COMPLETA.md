# Experiencia visual en todas las vistas

## Auditoría y base

Rama local `dev/biovolt-experiencia-completa`, creada desde `origin/main` en `6549abe404bb416221a4055e152b3006db5ca357`. La revisión de la arquitectura conserva las ocho vistas por hash, los SVG, los datos, el selector de tema, las funciones Netlify y los dos sistemas Gemini. El árbol de archivos previo coincide con la corrección cinematográfica ya fusionada en main. Se revisaron además el video de referencia, los estilos y animaciones existentes, la integración del motor local, el generador de la copia autocontenida y las pruebas de navegación y de soporte.

Línea base antes de editar: sintaxis/importaciones aprobadas, 36 pruebas de lógica y 37 pruebas Chromium aprobadas. Servicios externos simulados; no se consume producción.

La referencia muestra objetos tridimensionales, profundidad, cambios de cámara y continuidad entre apartados. Se adapta ese lenguaje a BioVolt sin copiar sus objetos ni reemplazar la navegación existente. No se convierte la plataforma en un video ni se bloquea el desplazamiento.

## Cambios

- `assets/experience.js`: una escena decorativa compartida entre vistas. Modelos 3D de producción, biomasa, plantas, directorio, analítica, soporte y asistente; rotación y profundidad ligadas al scroll, entrada suave por módulo y movimiento continuo de baja intensidad detrás del contenido. Todos son visuales conceptuales: no codifican indicadores operativos ni se presentan como datos reales.
- `assets/experience.css`: composición de cabeceras, adaptación móvil, capas sin eventos de puntero y presentación del control de movimiento. Conserva fuentes, colores y contenido. La escena inicial permanece.
- `src/cinematic-engine.mjs` y su bundle: se amplían los exports de Three.js ya instalado. No se agregan dependencias, CDN ni modelos IA. Todas las vistas comparten la descarga del motor.
- `assets/cinematic.js`: coordina la carga compartida y el mismo estado de movimiento con el resto de la página. No se sustituye su animación de apertura.
- `index.html`: enlaza los dos nuevos archivos de presentación.
- `scripts/build-review.mjs` y `revision/index.html`: incorporan la experiencia en la copia autocontenida con datos/respuestas simulados.
- `tests/browser/experience.spec.mjs`: cobertura de render real, scroll fuera de la cabecera, controles, foco, diálogos, context loss, alternativa Canvas 2D, responsive y copia sin red. Se actualiza una prueba anterior: entrar directamente en Ayuda ahora carga el motor de su propio visual, mientras la escena de Inicio permanece inactiva y el motor se descarga una sola vez.

## Funcionamiento y accesibilidad

La capa visual usa un solo canvas global y recicla los modelos al cambiar de vista. El render de la apertura y el del resto de la página no se ejecutan simultáneamente en pantalla. El canvas no recibe clics ni foco y está excluido de lectores de pantalla. Las entradas, tablas, botones, tickets y mensajes conservan su posición: no se les aplica paralaje continuo.

Al escribir en un campo o abrir un diálogo, se pausa el fondo. Se reanuda al salir. También se suspende con la pestaña oculta. El render se limita aproximadamente a 30 fps, con resolución acotada y adaptación a render lento. El renderizado 2D está disponible si falla el motor o WebGL. El SVG original queda como alternativa estática si tampoco hay Canvas.

El botón de pausa/reproducción de la barra sincroniza toda la plataforma con el selector de Inicio y guarda `bvMotionPreference`. Se mantiene el comportamiento accesible de la versión base: sin elección expresa se respeta el sistema; elegir Activado permite movimiento incluso con reducción solicitada por el dispositivo. No se cambia la preferencia del usuario automáticamente.

Los títulos y barras entran mediante animaciones nativas que no modifican valores, unidades ni dimensiones de los datos. El estilo base es visible; si falla una animación el contenido sigue disponible. No se publican medidas conceptuales como información de TiDB.

## Revisión local

```bash
npm ci
npm run build:scene
npm run build:review
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```

Abrir `http://127.0.0.1:4173/`. Las API del servidor de desarrollo responden sin conectar a producción. Para probar formularios completos con simulación explícita, abrir `revision/index.html` extraído del ZIP en un navegador que permita JavaScript. La copia no envía peticiones a TiDB, Gemini ni SMTP. La prueba del entorno sirve ese mismo HTML por HTTP local; la política del navegador impide comprobar aquí su apertura mediante `file://`.

Recorrer las ocho vistas, bajar hasta los apartados inferiores, volver hacia arriba, probar el botón de movimiento, escribir en la mesa de ayuda y abrir/cerrar una solicitud ficticia. El selector de tema sigue disponible. La copia es una demostración, no una confirmación de conectividad real.

## Validación final

- `npm run check`: aprobado, scripts inline y externos, imports y cinco rutas Netlify.
- `npm test`: 36 pruebas aprobadas, cero fallidas.
- `npm run test:browser`: 49 pruebas aprobadas, cero fallidas, en la pasada completa (37 regresiones previas y 12 casos nuevos).
- `npm run build:scene`, `npm run build:review`, `npm run build` y `git diff --check`: aprobados.
- Inspección con capturas en escritorio oscuro, escritorio claro y móvil: sin errores JavaScript ni errores de shaders.
- Comparación con la base: sin cambios en funciones, librerías de backend, SQL, utilidades de datos, lógica de mejoras, módulo de la mesa, modelos Gemini, dependencias o configuración Netlify.
- Pruebas con APIs simuladas; no se verificaron servicios reales.

## Límites

No se ha probado hardware físico Android/iPhone ni Safari. Las pruebas gráficas usan Chromium con WebGL por software cuando el entorno no tiene GPU. No se garantiza un rendimiento físico a partir de esas mediciones. La ausencia de credenciales y autorización de consumo de producción impide afirmar pruebas reales de TiDB/Gemini/SMTP. No se modifican los tiempos, cuotas ni el backend de la IA.

Sin migraciones, cambios de registros, push, merge ni despliegue. La política que impide desplegar ramas de revisión permanece intacta.
