# Autenticación y flujo de credenciales

## Componentes

La plataforma no usa JWT, OAuth, cookies de sesión ni cuentas individuales. Conserva un PIN docente y añade una capacidad firmada por ticket. Código: `lib/access.mjs`, `index.html` (accessHeaders/adminCall/loadRemote), `assets/enhancements.js` (acceso y seguimiento).

| Ruta | Método | Autorización |
|---|---|---|
| `/api/data` | GET | Público, consultas fijas y agregadas. |
| `/api/chat` | POST | Público; límite por IP e instancia. |
| `/api/tickets` | POST | Público con validación; requiere secreto de firma configurado en backend. |
| `/api/tickets` | GET | PIN: hasta 100 tickets. Bearer: solo ticket de la firma. Sin credenciales: 403. |
| `/api/tickets?id=…` | PATCH/DELETE | PIN docente. |
| `/api/agente` | POST | PIN o Bearer válido correspondiente al ID solicitado. |
| `/api/seguimiento?id=…` | GET/POST | PIN docente; nunca un código del solicitante. |

## Solicitud nueva y seguimiento

1. Navegador → POST `/api/tickets` con formulario validado; nunca envía credenciales TiDB/Gemini.
2. Backend → INSERT parametrizado en TiDB. Se devuelve ticket y `accessToken`.
3. El código contiene payload base64url `{id,exp,nonce}` y HMAC-SHA256, con dominio `biovolt-ticket-v1:`. No contiene correo, nombre ni credenciales. Caduca a los 30 días. La firma usa exclusivamente `TICKET_TOKEN_SECRET`, independiente del PIN.
4. Se almacena solo el mapa ID/código en `sessionStorage`. El solicitante lo puede copiar; no se pone en URLs, query strings, logs o CSV.
5. Navegador → GET `/api/tickets` con `Authorization: Bearer …`. El backend valida firma y fecha antes de ejecutar SELECT limitado a ese ID.
6. POST `/api/agente` debe acreditar ese mismo ticket. Gemini recibe asunto/descripción/categoría/prioridad, no las columnas de nombre o correo. El texto libre puede incluir información escrita por el solicitante; no debe introducirse información sensible.
7. El agente conserva herramientas de lectura y búsqueda. Guarda su respuesta/clasificación; mantiene «En proceso» o conserva un cierre humano previo. Solo PATCH docente puede cerrar.

Un código es una credencial de portador: quien lo posea accede al ticket. Su pérdida no habilita recuperación por email ni por ID. El docente puede revisar solicitudes antiguas o cuyo código venció. La rotación del secreto invalida todos los códigos anteriores; no hay revocación individual sin persistencia adicional.

## Acceso docente

Se solicita el PIN y se envía en `x-admin-pin` bajo HTTPS. El navegador lo conserva solo en `adminPinCache` (memoria); salir o recargar lo elimina. El backend compara usando `timingSafeEqual`; seguimiento mantiene la comparación segura original. Un 403 elimina el PIN cacheado en las operaciones de tickets. No hay roles separados ni trazabilidad de personas que comparten un PIN.

## Servicios externos

- TiDB: credenciales `DB_*` solo en Netlify; `mysql2/promise`, TLS mínimo 1.2, consultas fijas con parámetros para entradas.
- Gemini: `GEMINI_API_KEY` solo en backend; cabecera `x-goog-api-key` al endpoint oficial REST. No se devuelve la clave al cliente. Los modelos originales se conservan.
- El chat envía un resumen acotado de tablas operativas, sin clientes/empleados. Historial enviado por el cliente se limita a 12 entradas; no es historial firmado ni prueba de identidad.
- Respuestas privadas usan `Cache-Control: no-store`. Los errores públicos no devuelven detalles internos del proveedor.

## Alcance real de seguridad

Los límites de IP son contadores en memoria de cada instancia; no sustituyen controles distribuidos del proveedor. La búsqueda de internet conserva la instrucción original de usar consultas técnicas sin datos personales, pero no constituye un sistema verificado de prevención de filtraciones por texto libre. No se verificaron grants reales, variables de Netlify ni configuración de caché externa. La web pública sirve solo `dist/`, no la raíz del repositorio.
