# Acceso y privacidad de BioVolt

La plataforma mantiene un PIN docente compartido y capacidades firmadas por ticket. No incorpora cuentas personales, JWT, OAuth ni una sesión autenticada por cada responsable. Seleccionar José Montalvo, Cristopher Orozco o Carlos Romero asigna responsabilidad; no acredita quién escribió usando el PIN compartido.

`TICKET_TOKEN_SECRET` vive solo en backend y requiere **mínimo obligatorio 32 caracteres** (64 aleatorios recomendado). Los códigos de ticket usan HMAC-SHA256, ámbito `biovolt-ticket-v1`, ID, caducidad de 30 días y nonce. Se almacenan en sessionStorage de la pestaña; no se ponen en URLs. Los códigos anteriores válidos conservan compatibilidad.

| Acceso | Facultades |
|---|---|
| Visitante | Crear solicitud validada; iniciar recuperación con ticket/correo, sin obtener datos hasta verificar el código recibido. |
| Código privado | Ver y continuar la conversación de su ticket, reintentar IA, confirmar solución o reabrir el mismo caso. No lee notas internas ni otras solicitudes. |
| PIN docente | Cola completa filtrada y paginada, responsables, respuestas humanas después del intento IA, notas internas y cierre verificado. El PIN no sustituye la confirmación del solicitante. |

El código es de portador: quien lo tenga puede acceder al ticket. No se revoca individualmente. Rotar TICKET_TOKEN_SECRET invalida todos los códigos; recuperar por correo emite uno nuevo sin invalidar los anteriores antes de su vencimiento. No se permite acceder solo por conocer un ID, un nombre o un correo.

La recuperación compara el correo guardado y envía un código aleatorio de seis dígitos al destinatario registrado. Solo se guarda su HMAC (`biovolt-recovery-v1`), caduca en 10 minutos, permite cinco intentos y un solo uso. Hay límite persistente por ticket de un envío/minuto y cinco/hora. La respuesta a la solicitud es genérica para no revelar si el ticket/correo existen. SMTP debe configurarse en Netlify; no se registran códigos ni destinatarios en los logs de la aplicación.

La autorización se comprueba en las funciones, no solo en la interfaz. GET de detalle devuelve únicamente mensajes públicos; seguimiento_ayuda permanece en la ruta docente separada. El agente recibe asunto, descripción y hasta 12 mensajes públicos acotados; nunca se añade el correo ni las notas internas. El texto libre puede contener datos escritos por el usuario, por lo que el formulario pide no introducir contraseñas ni claves. La búsqueda técnica filtra patrones obvios de datos privados, pero no se presenta como prevención infalible de filtraciones.

Las respuestas privadas llevan `Cache-Control: no-store`. El PIN solo vive en memoria y se introduce en un campo de contraseña. Los secretos `DB_*`, `GEMINI_API_KEY`, TICKET_TOKEN_SECRET y SMTP_* no están en el frontend. TiDB conserva mysql2/promise y TLS mínimo 1.2; Gemini recibe su clave en x-goog-api-key desde el backend.

Los límites IP son por instancia serverless, no globales. Concurrencia y reintentos de IA se coordinan en TiDB mediante una lease y revisión; los duplicados no se confían a un Map de una instancia. La creación usa UUID de idempotencia y fingerprint, con reenvío idéntico durante 15 minutos. No se usa ese UUID como acceso general al ticket.

Detalles de configuración, rutas y migración en `MESA-AYUDA.md`. No se han probado credenciales, grants, entrega SMTP ni conexiones reales durante esta revisión.
