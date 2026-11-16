# Mesa de ayuda con agente de IA — revisión local

Base publicada: `87a571c72b0c3797a923ebcc3928f2657d4a0fd0`. Rama local: `dev/mesa-ayuda-agente`. El propietario autorizó implementar los seis puntos y pidió solicitar autorización antes de subir archivos a GitHub. Esta revisión no está subida ni desplegada.

## Los seis puntos

| Punto | Implementación |
|---|---|
| Conversación | Historial público persistente por ticket: solicitante, agente Gemini, intervenciones humanas y avisos del sistema. Paginación de 50 mensajes, carga de anteriores e idempotencia de mensajes. Las respuestas anteriores no se sobrescriben. |
| Confirmación | «Me sirvió» confirma humanamente la solución. «Sigo con el problema» reabre el mismo ticket, añade la inconformidad al historial y solicita una nueva respuesta de IA con escalamiento. El agente nunca marca Resuelto. Cierre docente exige verificación, explicación y revisión vigente. |
| Responsable y avance | José Montalvo, Cristopher Orozco y Carlos Romero. Asignación validada en backend, espera de agente/solicitante/persona/resuelto, última actividad y avisos de escalamiento. Notas internas separadas en seguimiento_ayuda. |
| Recuperación | Solicitud de código por ticket + correo registrado. Se envía un código de seis dígitos, vence en 10 minutos, máximo cinco intentos y un solo uso. Emitirlo no concede acceso; verificarlo entrega un código privado nuevo. Respuesta genérica ante datos inexistentes. Requiere configurar SMTP. |
| Fiabilidad de IA | Inicio en el servidor al crear o aportar información, contexto público, estados persistidos, lease entre instancias, caché por revisión, máximo tres intentos por revisión, esperas de reintento y errores visibles del sistema. Modelos y herramientas originales preservados. |
| Cola de atención | Filtros SQL parametrizados por categoría, prioridad, estado, fechas, responsable, escalamiento, estado del agente y búsqueda; orden por prioridad/antigüedad/actividad, paginación de 20 y conteos reales del conjunto filtrado. Filtro opcional de espera en horas elegido por el usuario; no hay un plazo operativo inventado. |

## Flujo con IA primero

1. El navegador genera un UUID para un envío. POST `/api/tickets` valida el formulario y guarda ticket, metadata y primer mensaje en una transacción.
2. El servidor emite el código privado y arranca el mismo agente mediante `context.waitUntil()`. La respuesta al navegador no depende de que mantenga abierta la pestaña. Fuera de un runtime con waitUntil, se espera el análisis antes de responder.
3. El agente reclama una lease persistida de 45 segundos. Las solicitudes concurrentes que encuentran una lease activa no llaman otra vez a Gemini.
4. Se conserva `gemini-3.5-flash-lite` como valor por defecto y los overrides originales. El agente decide entre consultar plantas, inventario, producción, ambiente, guía e internet. Recibe descripción e historial público acotado, nunca notas internas ni columnas de correo.
5. La respuesta de Gemini se guarda como un mensaje de la revisión correspondiente. Herramientas y fuentes HTTPS de búsqueda quedan junto al mensaje. El ticket queda En proceso, esperando al solicitante o a una persona si se escala.
6. Un nuevo mensaje del solicitante crea una revisión y vuelve a activar al agente. Una respuesta humana complementa la atención después de un intento de IA, no sustituye el inicio del agente.
7. El cierre requiere confirmación humana. Una pantalla antigua no puede cerrar una revisión nueva sin actualizarla.

Referencia del runtime: https://docs.netlify.com/build/functions/api/#waituntil . waitUntil prolonga la misma ejecución y cuenta dentro de sus límites/facturación; no es una cola externa ni una garantía de reintento ilimitado. La metadata permite detectar un intento interrumpido, recuperar una lease vencida y reintentar de forma explícita al volver a abrir el ticket. No se ha desplegado un worker periódico ni se promete procesamiento mientras la plataforma esté caída.

## Migración necesaria antes del despliegue

Aplicar manualmente y con autorización `sql/mesa_agente_v2.sql` en TiDB. Crea únicamente:

- `ayuda_control`: revisión, estado/lease/reintentos de IA, responsable, espera, confirmación, tiempos, idempotencia y recuperación.
- `ayuda_mensajes`: conversación pública, origen, herramientas y fuentes.

Ambas tablas usan `CREATE TABLE IF NOT EXISTS`, índices y UTF-8. No hay DROP, DELETE, ALTER sobre tablas existentes ni ejecución DDL en las funciones. Se reutilizan `solicitudes_ayuda` y `seguimiento_ayuda`. La migración original de seguimiento sigue siendo necesaria si esa tabla no existe.

Los tickets antiguos se incorporan de forma perezosa al abrirlos: se copia su descripción y su respuesta IA histórica, si la tenían (identificada como historial anterior, sin verificar retrospectivamente su origen), a las nuevas tablas. No se reescribe el contenido original. Los códigos privados válidos existentes siguen siendo válidos. El SQL conserva el tipo INT de la relación con solicitudes_ayuda asumido por la migración original; confirmar el esquema real antes de aplicar.

El usuario de runtime necesita SELECT, INSERT y UPDATE sobre las dos nuevas tablas; no necesita permisos de DDL. Los permisos ya usados sobre solicitudes_ayuda y seguimiento_ayuda se conservan. La eliminación original permanece restringida al docente con confirmación; no elimina conversaciones ni notas asociadas. Un ticket eliminado deja de ser consultable por la API.

## Configuración en Netlify

Mantener `DB_*`, `GEMINI_API_KEY`, `AYUDA_PIN` y los modelos. **TICKET_TOKEN_SECRET debe tener al menos 32 caracteres; es obligatorio.** Recomendado: 64 aleatorios. No compartirlo ni incluirlo en GitHub.

Para recuperación por correo se añaden:

| Variable | Requisito |
|---|---|
| `SMTP_HOST` | Host de un proveedor SMTP autorizado por el propietario. |
| `SMTP_USER` | Usuario SMTP. |
| `SMTP_PASSWORD` | Contraseña o credencial SMTP, solo backend. |
| `SUPPORT_FROM` | Remitente autorizado por el proveedor, por ejemplo BioVolt <soporte@tu-dominio>. |
| `SMTP_PORT` | Opcional; 465 por defecto con TLS directo. 587 exige STARTTLS. TLS no se desactiva. |

Configurar en Functions y contexto Production del proyecto correcto. El repositorio tiene dos proyectos Netlify conectados; las variables no se comparten automáticamente. Tras modificar variables, se requiere un despliegue autorizado para que las funciones las reciban. Esta preparación no configura un proveedor ni envía correos reales. Si falta SMTP, la recuperación devuelve un mensaje explícito y no concede acceso por conocer el correo.

El envío no revela el código por la API ni por logs. Se guarda un HMAC separado para recuperación, nunca el código en claro. Se limita a un envío por minuto y cinco por hora por ticket, además del límite por IP/instancia. El PIN docente sigue siendo compartido: seleccionar un responsable no equivale a autenticar individualmente a esa persona.

## Contratos ampliados, mismas rutas

- GET `/api/tickets`: PIN → cola paginada y métricas SQL; Bearer → ticket autorizado.
- GET `/api/tickets?id=BV-123[&before=…]`: Bearer correspondiente o PIN → conversación pública.
- POST `/api/tickets` sin action: creación; cabecera `x-idempotency-key` UUID obligatoria para el cliente actualizado. Un reenvío idéntico dentro de 15 minutos devuelve el mismo ticket. Un envío reutilizado con contenido distinto se rechaza.
- POST `/api/tickets` con `action: message`: mensaje público; UUID clientKey. El solicitante provoca atención IA; el docente responde como humano tras el intento del agente.
- POST `/api/tickets` con `action: feedback`, `value: helpful|unresolved` y version: requiere código del solicitante, no basta el PIN.
- POST `/api/tickets` con `action: recover|verify`: verifica correo con código de un solo uso. No acepta búsqueda de acceso solo por nombre/ID.
- PATCH `/api/tickets`: PIN para asignación o cambio de estado. Cerrar exige verified=true, resolución explicada y version vigente.
- DELETE `/api/tickets?id=…&confirm=yes`: PIN y sin análisis activo.
- POST `/api/agente`: acceso al ticket; reintento o reanudación idempotente. Ya no es necesario que el navegador lo llame después de crear.
- GET/POST `/api/seguimiento`: solo PIN, responsables de la lista autorizada y notas internas. No se envían al agente.

Errores de base o tabla ausente no se convierten en tickets de demostración ni respuestas IA ficticias. Una cuota/timeout genera un aviso del sistema y escalamiento; nunca se presenta una plantilla local como Gemini. Si el servicio de IA no está disponible no se puede garantizar una respuesta real: el estado lo explica y permite revisión humana/reintento.

## Pruebas y límites

Pruebas Node sobre funciones reales con un doble SQL transaccional en SQLite, Gemini/SMTP simulados. El adaptador convierte funciones de fecha MySQL; no prueba compatibilidad real del dialecto con TiDB. Pruebas Chromium usan la interfaz y los handlers reales sobre ese backend local y comprueban creación, atención IA, historial, asignación, privacidad, confirmación/reapertura, recuperación, filtros, cuotas y responsive. Se conserva la regresión de las otras siete vistas, simulador, exportaciones y animaciones.

No se usaron credenciales de producción, Gemini real, SMTP real ni TiDB real. Falta comprobar esquema/grants/migración en un entorno autorizado, disponibilidad de los modelos sin cambiarlos, entrega del proveedor SMTP y waitUntil en Netlify. Los límites IP siguen siendo por instancia; no se incorporó CAPTCHA ni un limitador distribuido. Los códigos privados de 30 días siguen siendo de portador y no tienen revocación individual; la recuperación emite uno nuevo pero no invalida los anteriores antes de su vencimiento.

## Vista de revisión

`npm run build:review` regenera `revision/index.html` con estilos y scripts incluidos y un adaptador exclusivamente local. En esa copia se puede crear y conversar sobre tickets de muestra; cada respuesta lleva la marca «simulada», el PIN docente de demostración es DEMO y la recuperación usa un código de prueba explícito. No hay consultas de red ni correos reales y los tickets de muestra se pierden al recargar. El adaptador no se copia a dist.

## Protección del despliegue

`netlify.toml` ejecuta `scripts/ignore-build.mjs`: omite cualquier rama/contexto distinto de main/production, incluidos nombres pull/1/head. El script de build bloquea también esos contextos en Netlify si un build hook omite ignore. No se ejecutó ningún despliegue para probarlo.

Las comprobaciones de Netlify de una rama o PR pueden aparecer omitidas/canceladas por la protección de despliegue. Esto no sustituye las pruebas locales ni requiere publicar para revisarlas.
