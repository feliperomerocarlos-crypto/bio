# BioVolt AI

## Paneles de lectura y avatar

Las tarjetas, tablas y filtros recuperan superficies sólidas sobre el fondo animado. En Asistente, **Hablar** dicta una pregunta en español y la envía al chat. El navegador puede leer la respuesta en voz alta. **Escuchar respuesta** también funciona después de escribir si hay síntesis de voz disponible. El micrófono requiere permiso y un navegador compatible. El avatar del asistente se guarda en `assets/asistente.webp` y se incluye en las dos versiones del HTML. El estudio externo de Vivora solo aparece si se configura su URL en `data-vivora-url` de `src/page.html`. La revisión descargable usa datos de demostración. [Configurar Vivora y verificar el micrófono](docs/VIVORA.md).

## Revisión anterior de tipografía y cifras

`dev/biovolt-tipografia-numeros` incorpora Manrope variable, alojada localmente y embebida también en la copia descargable. Sustituye el tablero de dígitos por una entrada suave de la cifra completa, sin valores aleatorios ni cambios de formato/unidad. Mantiene los paneles translúcidos selectivos y el movimiento de partículas. Fuente bajo SIL OFL 1.1, incluida en `assets/fonts`. Validación: 75 pruebas de navegador y 36 de lógica aprobadas; Manrope incrustada en el PDF de prueba. Detalles y validación en [docs/TIPOGRAFIA-NUMEROS.md](docs/TIPOGRAFIA-NUMEROS.md). Esta revisión sigue local, sin subida ni publicación.

## Revisión anterior: paneles translúcidos donde hacen falta

En `dev/biovolt-paneles-translucidos`, la mesa de ayuda, la conversación del asistente y los controles de reportes/PDF recuperan superficies discretas y translúcidas. El resto mantiene la presentación transparente y las partículas continúan moviéndose. Cambio limitado a estilos y HTML generado; lógica, API y modelos sin cambios. Validación: 27 pruebas de navegador, revisión en ambos temas y PDF de demostración generado. Detalles en [docs/PANELES-TRANSLUCIDOS.md](docs/PANELES-TRANSLUCIDOS.md). Esta revisión nueva se entrega localmente, sin subida ni despliegue.

## Revisión anterior: movimiento perceptible sin scroll

La rama local `dev/biovolt-movimiento-permanente` conserva la interfaz transparente y añade movimiento autónomo visible a las partículas: giro, inclinación, expansión y desplazamiento. El scroll sigue eligiendo la forma, pero la escena continúa al detenerse bajo tablas, formularios y hasta el pie. WebGL y Canvas 2D comparten la misma trayectoria temporal. Se conserva la pausa manual y la suspensión de pestaña oculta. No cambian API, datos ni modelos. Validación: 70 pruebas de navegador y 36 de lógica aprobadas. Detalles en [docs/MOVIMIENTO-PERMANENTE.md](docs/MOVIMIENTO-PERMANENTE.md). Sin push ni publicación.

## Revisión anterior: interfaz minimalista transparente

La rama local `dev/biovolt-minimal-transparente` retira superficies, bordes, brillos, tarjetas de vidrio, bloques de métricas y burbujas del contenido de las ocho secciones. Tablas y mensajes quedan como texto sobre las mismas partículas. Los campos conservan una línea y foco visible; los filtros, formularios, gráficos, fuentes y estados se mantienen. El fondo continúa al escribir y al abrir solicitudes, con atenuación suave. Solo se detiene por pausa manual o pestaña oculta. Las API y modelos no cambian. Validación: 67 pruebas de navegador y 36 de lógica aprobadas, además de revisión visual en ambos temas. Sin push ni publicación. Detalles en [docs/MINIMAL-TRANSPARENTE.md](docs/MINIMAL-TRANSPARENTE.md).

## Revisión anterior: partículas continuas en toda la página

La rama local `dev/biovolt-particulas-continuas` extiende la misma nube de partículas de la apertura a los ocho capítulos. Un solo canvas y una sola geometría se transforman con el scroll, con estados intermedios y reversión al subir. Los textos tienen tramos narrativos y los datos se presentan en paneles integrados. La nube continúa tras las tablas; las revisiones siguientes mantienen el movimiento también al escribir o abrir un diálogo. No se cambian backend, modelos ni lógica de datos/soporte. Validación: 67 pruebas de navegador y 36 de lógica aprobadas. Sin push ni publicación. Detalles, archivos y límites en [docs/PARTICULAS-CONTINUAS.md](docs/PARTICULAS-CONTINUAS.md).

## Revisión anterior: una sola página con scroll continuo

La rama local `dev/biovolt-scroll-continuo` reúne los ocho módulos, en su orden original, en una página larga. El archivo público `index.html` contiene los estilos y scripts propios; solo las librerías opcionales se cargan desde cdnjs en versiones fijas de 2023/2024. Se incorporan navegación con hashes, indicador lateral, objetos 3D por sección, titulares por palabras y cifras giratorias. El movimiento permanece activo con independencia de la preferencia del sistema y admite pausa manual.

La mesa, los datos y el chat conservan sus contratos; el cliente acepta `dosPasos` explícito y espera hasta 25 segundos. Las funciones y modelos Gemini no cambian. Para editar, usar `src/page.html` y `assets`; generar con `npm run build:page`. Para una revisión sin red, usar `revision/index.html`, con datos e IA simulados. Detalles, pruebas, configuración, archivos para GitHub y límites: [docs/SCROLL-CONTINUO.md](docs/SCROLL-CONTINUO.md). Esta revisión no se ha subido ni publicado.

## Experiencia visual en todas las vistas — revisión local

La rama `dev/biovolt-experiencia-completa`, basada en main `6549abe`, extiende el recorrido cinematográfico a los ocho módulos. Incluye objetos 3D propios por vista, fondo con profundidad durante el scroll, entrada de títulos y gráficos, alternativa animada sin WebGL y control de movimiento en la barra. El fondo se pausa al escribir o abrir un diálogo. Se conservan la identidad, la navegación, los datos, la mesa y ambos modelos Gemini. Validación local: 36 pruebas de lógica y 49 de navegador aprobadas. Revisión sin push ni despliegue. Arquitectura, archivos, comprobaciones y límites en [docs/EXPERIENCIA-COMPLETA.md](docs/EXPERIENCIA-COMPLETA.md).

## Antecedente: revisión cinematográfica de Inicio

La rama de revisión `dev/biovolt-cinematica` incorpora una escena Three.js + GSAP/ScrollTrigger en Inicio, sin cambios de backend. Espiral, hoja y flujo energético responden al scroll y a su retroceso. Incluye calidad adaptativa, alternativa animada Canvas 2D sin WebGL y SVG estático como último respaldo. El selector Movimiento permite activar o pausar explícitamente; sin elección propia respeta el movimiento reducido del sistema. Consulta `docs/CINEMATICA.md` para arquitectura, comandos, pruebas y límites. La fusión de esta revisión visual a main y su despliegue requieren autorización del propietario.

Mejoras incrementales sobre `feliperomerocarlos-crypto/bio`. Esta revisión parte de la versión publicada `87a571c`; se conservan las ocho vistas, identidad visual, TiDB, Netlify Functions y ambos sistemas Gemini. La revisión nueva no está publicada.

## Mesa de ayuda: nueva revisión local

Los seis puntos autorizados están implementados en la rama local `dev/mesa-ayuda-agente`: atención del agente iniciada en servidor, conversación, confirmación/reapertura, responsables, recuperación por correo y cola con métricas SQL. **Antes de desplegar se requiere revisar/aplicar `sql/mesa_agente_v2.sql`**; la recuperación real exige configurar SMTP. No se ha ejecutado la migración ni subido esta revisión a GitHub. Detalles y limitaciones en `docs/MESA-AYUDA.md`.

## Ver el diseño sin publicar

Selecciona esta rama en GitHub, pulsa **Code → Download ZIP**, extrae el archivo y abre **revision/index.html** con doble clic. Es una copia autocontenida de revisión, con respuestas de agente simuladas y claramente identificadas; sin llamadas de red ni conexión a las API. Para explorar la mesa local puedes crear tickets de prueba y usar el acceso docente de demostración DEMO. Instrucciones en `revision/LEEME.md`.

La configuración omite builds de Netlify fuera de main/production y tiene un bloqueo adicional en el build remoto, incluidos Deploy Previews con referencias pull/1/head. Para publicar posteriormente, el propietario debe autorizarlo expresamente y revisar esta protección.

## Desarrollo y verificación

Node.js 24 y npm. Instalar con `npm ci`. Comandos:

```sh
npm run check
npm test
npm run test:browser
npm run build
npm run dev
```

`npm run dev` sirve la web en http://127.0.0.1:4173. Las APIs locales responden 503 de forma deliberada: permite explorar la demostración sin consumir recursos de producción. Los tests de navegador simulan respuestas. No introduzcas datos personales reales en este modo.

Las pruebas de navegador usan Chromium instalado en `/usr/bin/chromium`. En otro equipo, configura `CHROMIUM_PATH` con la ruta de Chrome/Chromium. Las pruebas de funciones sustituyen MySQL y fetch; no requieren credenciales.

## Estructura

- `index.html`: SPA original, ocho vistas y CSS/JS existentes con cambios localizados.
- `assets/core.js`: unidades, simulación, CSV y cliente JSON con timeout.
- `assets/enhancements.js` y `.css`: controles sobre las vistas existentes; `assets/helpdesk.js` y `.css`: conversación y cola de la mesa.
- `netlify/functions/{data,chat,tickets,agente,seguimiento}.mjs`: backend existente ampliado.
- `lib/access.mjs`: autorización y códigos privados; `lib/analytics.mjs`: periodos y normalización SQL; `lib/helpdesk-*`: agente original con herramientas, persistencia, coordinación y recuperación.
- `sql/seguimiento_ayuda.sql`: migración original idempotente de seguimiento, sin ejecutar.
- `tests/`: pruebas unitarias, contratos de funciones y navegador.
- `scripts/`: comprobación, compilación estática y servidor local sin acceso a producción.
- `docs/`: auditoría, autenticación, cambios y validación.

## Variables de entorno de Netlify

| Variable | Uso |
|---|---|
| `GEMINI_API_KEY` | Clave de Google; únicamente backend. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión TiDB original (`DB_PORT` por defecto 4000), TLS mínimo 1.2. |
| `AYUDA_PIN` | Clave compartida de docente para consultar la cola paginada, asignar responsables, responder después del agente y cerrar con verificación, eliminar y gestionar notas internas. |
| `TICKET_TOKEN_SECRET` | **Nueva y obligatoria para crear tickets**: secreto aleatorio independiente, al menos 32 caracteres; firma códigos de consulta por ticket. No reutilizar el PIN. |
| `GEMINI_MODEL_AGENTE` | Override existente; por defecto `gemini-3.5-flash-lite`. Conservar configuración autorizada. |
| `GEMINI_SEARCH_MODEL` | Override existente de búsqueda; por defecto el mismo modelo del agente. No cambiar sin autorización. |

Assistant conserva `gemini-3.6-flash`. No se comprobó la disponibilidad externa de estos nombres ni se sustituyeron. Genera los secretos mediante un gestor de contraseñas y configúralos en Netlify, nunca en HTML ni en un commit. La creación de tickets responde 503 antes de escribir si no está configurado el secreto privado.

El usuario de TiDB necesita SELECT sobre las tablas consultadas, los permisos existentes sobre `solicitudes_ayuda` y `seguimiento_ayuda`, y SELECT/INSERT/UPDATE sobre las nuevas `ayuda_control` y `ayuda_mensajes`. No conceder DDL ni permisos administrativos al runtime. El código conserva las variables y la configuración de conexión; los permisos reales deben verificarse por el propietario.

## Configuración y despliegue posterior

1. Revisar los cambios y completar la lista de `docs/VALIDACION.md`.
2. Configurar las variables anteriores; no copiar credenciales a GitHub.
3. Si falta `seguimiento_ayuda`, revisar y ejecutar manualmente `sql/seguimiento_ayuda.sql` con respaldo y autorización. No se requieren tablas nuevas para los códigos privados.
4. En Netlify: Node 24, build `npm run build`, publish `dist`, functions `netlify/functions`. El build copia solo HTML y assets, evitando servir SQL y fuentes del backend como estáticos. Aplicar también la migración nueva de la mesa y verificar grants de las tablas ayuda_control y ayuda_mensajes antes de publicar.
5. Solo tras autorización del propietario: publicar una versión y comprobar rutas `/api/data`, `/api/chat`, `/api/tickets`, `/api/agente` y `/api/seguimiento`.

La rama de la fase anterior ya fue entregada. Para subir esta revisión nueva se requiere la autorización final solicitada por el propietario. No se ejecutaron despliegues, merges, migraciones ni cambios de datos reales en esta fase.

## Correo de recuperación

Mantén las variables actuales. Añade en Functions del proyecto/contexto correcto: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` y `SUPPORT_FROM` autorizado por el proveedor. `SMTP_PORT` es opcional: 465 (TLS directo) por defecto, o 587 con STARTTLS obligatorio. **No enviar esos secretos al chat ni a GitHub.** Sin SMTP, la mesa sigue atendiendo con IA y el código privado, pero explica que la recuperación por correo no está configurada. La plantilla `.env.example` no contiene valores reales.

## Uso de las mejoras

- **Mesa de ayuda:** al crear una solicitud se entrega un código privado válido por 30 días. Se conserva en `sessionStorage` de esa pestaña; copiarlo permite consultar en otro equipo. Si se pierde, puede recuperarse verificando el correo registrado cuando SMTP esté configurado; el docente también conserva su acceso de soporte. Los tickets anteriores quedan accesibles al docente. El código autoriza conversación y revisión IA de un solo ticket, y confirmar solución o reabrirlo mediante los botones correspondientes; no permite borrarlo ni leer notas internas.
- **IA:** conserva herramientas y búsqueda. La respuesta no cierra el ticket: una persona debe verificar la resolución. El chat distingue Gemini y respaldo local; su historial permanece en la pestaña hasta limpiar o cerrar la sesión del navegador.
- **Dashboard/analítica:** filtros de hasta 366 días y planta; comparación con un periodo anterior de igual longitud. SQL agrega en servidor y convierte MWh a kWh. Las unidades desconocidas se excluyen e informan. Ambiente, mantenimiento y eficiencia de pruebas son acumulados globales, no usan el filtro de producción.
- **Inventario:** búsqueda, tipo y almacén. Se muestran todas las filas material/almacén del conjunto cargado. Umbral configurable por unidad y local a la sesión de página, sin persistir límites operativos en TiDB. No se calcula capacidad disponible si no hay unidades comparables verificadas.
- **Simulador:** todos los parámetros los introduce el usuario, junto con su fuente. Fórmulas y límites visibles; ingreso bruto orientativo en COP, sin afirmar rentabilidad ni validez científica.
- **Reportes:** CSV con BOM, separador `;` y defensa contra fórmulas de Excel. PDF mediante «Imprimir / Guardar PDF» del navegador, sin servicio externo. Tickets exporta solo conteos del conjunto autorizado, sin datos personales. Inventario exporta solo el conjunto cargado y filtrado.
- **Movimiento:** una misma nube de partículas recorre los ocho capítulos con Three.js o Canvas 2D, interpolación continua y reversible por scroll nativo. Se conserva IntersectionObserver para las entradas de datos y gráficos. Conforme a la instrucción actual del propietario, la preferencia reducida del sistema no detiene la animación; sí lo hace la pausa manual. El fondo sigue animado al editar o abrir un diálogo, con atenuación suave. El contenido permanece visible si falla el render.

Los límites de uso son por instancia serverless. Esta versión no incorpora cuentas individuales, revocación individual de códigos ni un límite distribuido; la recuperación por correo está implementada y requiere SMTP; véase `docs/AUTENTICACION.md`.
