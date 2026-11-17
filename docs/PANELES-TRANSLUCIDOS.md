# Paneles translúcidos en zonas de trabajo

Rama local `dev/biovolt-paneles-translucidos`, basada en `ad2a75c`. El propietario pidió recuperar paneles únicamente en mesa de ayuda, asistente y generación de PDF, con un acabado visible y parcialmente transparente.

Se inspeccionaron los contenedores, controles dinámicos, exportación y estilos antes de editar. El cambio se limita a `assets/particle-story.css`, `index.html` y `revision/index.html` generados, README e instrucciones. No cambia el JavaScript funcional ni el motor de partículas.

## Presentación

- Mesa: superficies para el acceso privado, el listado/filtros y el formulario. Separadores suaves entre tickets; métricas y avisos siguen sin recuadros.
- Asistente: un solo panel de conversación, con cabecera y zona de escritura delimitadas.
- Reportes: superficie únicamente alrededor de la selección de reporte y botones CSV/PDF. Los gráficos, el simulador y demás tablas conservan su transparencia.
- Fondo oscuro al 72 % y claro al 80 %, borde fino y esquinas discretas. Sin brillos ni desenfoque que oculte el movimiento detrás. Espaciado adaptado a móvil.
- El PDF impreso mantiene fondo blanco y texto oscuro. Los nuevos estilos de paneles solo se aplican en pantalla.

## Validación

27 pruebas de navegador aprobadas: mesa, privacidad, respuestas IA simuladas, estados, formularios, CSV/PDF, inventario, temas, responsive y movimiento real de píxeles sin scroll en WebGL/Canvas 2D. Sintaxis, importaciones/rutas, build y `git diff --check` aprobados.

Inspección adicional en Chromium: opacidad entre 0 y 1 en todos los paneles elegidos, con borde visible en ambos temas; el inventario continúa transparente. Partículas activas bajo los tres módulos. Sin errores JavaScript ni peticiones externas. Anchos 360/390/768/1440 comprobados. Se genera un PDF de inventario con datos de demostración y se verifica su texto, fondo blanco y ausencia de correos.

No se crean variables ni migraciones. Funciones Netlify, TiDB, SMTP y modelos Gemini permanecen sin cambios y no se consultan servicios de producción. Falta revisión en Safari y hardware físico. Esta revisión se prepara localmente; la rama anterior de movimiento permanente ya está en GitHub. No hay push, merge ni despliegue de esta revisión nueva.

Para revisar, abre `BioVolt_REVISION_paneles.html` en Chrome o Edge fuera del visor de archivos. Usa datos ficticios: el HTML de revisión tiene API y respuestas simuladas. El ZIP contiene las fuentes y el `index.html` público con sus conexiones existentes. No publiques el HTML de demostración como producción. Genera de nuevo con `npm run build:review`; usa `npm run check`, `npm run test:browser` y `npm run build` para verificar.
