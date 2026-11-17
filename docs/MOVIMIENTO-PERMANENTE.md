# Movimiento perceptible durante toda la lectura

## Causa confirmada

La revisión `68fd64d` mantenía el renderer activo bajo las tablas, pero la transformación principal dependía de entrar en la cabecera siguiente. El giro temporal era una oscilación de apenas 0,06 radianes con un periodo aproximado de 79 segundos; la deriva local era muy pequeña. Además, la intensidad descendía al 42 % durante la lectura y al 70 % al editar. La escena podía parecer inmóvil aunque avanzara el contador de fotogramas. El renderer también se detenía al dejar atrás el área principal.

## Cambio localizado

Rama `dev/biovolt-movimiento-permanente`, basada en `68fd64d`. No se cambian tablas, formularios, módulos ni su funcionamiento.

- `assets/cinematic.js`: una trayectoria temporal compartida añade giro de 0,075 rad/s, inclinación oscilante de hasta 0,28 rad, variación de escala de ±3,5 % y deriva corta en ambos ejes. Se introduce progresivamente desde la fase de hoja de la apertura; el scroll continúa seleccionando la forma y su reversión. Los mismos valores alimentan WebGL y Canvas 2D. El texto y los controles no giran.
- El reloj permite intervalos de hasta 250 ms por frame, en vez de ralentizar mucho la animación cuando un equipo tarda más de 80 ms en dibujar. Se reinicia la referencia temporal al reanudar la pestaña o la pausa, sin acumular el tiempo oculto.
- La intensidad de lectura pasa a 62 %, y la opacidad al editar a 85 %. Se mantienen tablas y mensajes transparentes y su protección tipográfica de contraste. No se superponen nuevas superficies a las partículas.
- El fondo permanece activo hasta el pie de página; solo se suspende si se elige pausa manual, se oculta la pestaña o se abandona la página. El último respaldo estático sigue disponible cuando no existe Canvas.
- `assets/particle-story.css`: ajuste de opacidad y eliminación de la regla que ocultaba el fondo fuera del área principal.
- `tests/browser/ambient-motion.spec.mjs`: dos pruebas sobre píxeles reales de WebGL/Canvas 2D y una de continuidad en el pie. Se mide cambio de orientación a scroll fijo, con la misma forma y geometría, para distinguir movimiento visible de un contador que simplemente avanza.
- `index.html` y `revision/index.html`: entregas generadas desde las fuentes. README e instrucciones de revisión actualizados.

No se modifican `netlify`, `lib`, `sql`, `netlify.toml`, `assets/core.js`, `assets/helpdesk.js` ni `assets/enhancements.js`. Se conservan `gemini-3.6-flash` y `gemini-3.5-flash-lite`. No hay variables nuevas, migraciones, conexiones de producción, push, merge ni despliegue.

## Verificación y entrega

Las primeras tres pruebas específicas aprobaron movimiento visible en ambos motores y continuidad en el pie. La regresión completa aprobó **70 pruebas de navegador y 36 de lógica**, junto con sintaxis/importaciones/rutas, build y `git diff --check`. Se adjuntan los registros finales. Una grabación real de seis segundos comprueba movimiento de la figura con el scroll fijo y sin errores JavaScript ni peticiones externas. Se conservan las comprobaciones de pausa manual, preferencias del sistema, responsive, pérdida de contexto y formularios/tickets. Los servicios se simulan: no se afirman conexiones reales con TiDB/Gemini/SMTP ni FPS garantizados en hardware físico. Falta revisión en Safari y equipos físicos.

Abre `BioVolt_REVISION_movimiento.html` en Chrome o Edge. Ve al inventario, baja hasta las filas y deja quieta la página: la figura debe seguir girando y respirando. Prueba también un campo y el pie. El HTML de revisión es autocontenido, con datos/respuestas simulados y sin llamadas de servicios; no debe publicarse como producción. El ZIP completo incluye el `index.html` público con las API existentes.

```sh
npm ci
npm run build:review
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```
