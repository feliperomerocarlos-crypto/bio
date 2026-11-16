# Validación de la revisión de la mesa de ayuda

Base publicada: `87a571c`. Rama local: `dev/mesa-ayuda-agente`. Se conserva la versión anterior publicada; no se han subido, fusionado ni desplegado estos cambios. El propietario pidió autorización al terminar antes de subir a GitHub.

## Resultado local final

- `npm run check`: aprobado; sintaxis, importaciones y cinco rutas Netlify.
- `npm test`: 36 pruebas aprobadas, 0 fallidas.
- `npm run test:browser`: 24 pruebas Chromium aprobadas, 0 fallidas.
- `npm run build:review` y `npm run build`: aprobados.
- `git diff --check`: aprobado.

Los servicios TiDB, Gemini y SMTP se sustituyeron durante las pruebas. Estos resultados no acreditan conexiones de producción.

## Alcance de las pruebas

- Sintaxis e importaciones reales de scripts inline, assets, librerías y cinco rutas Netlify.
- Unitarias y contratos sobre handlers reales; MySQL se sustituye por una base SQL de prueba con transacciones y restricciones únicas. Gemini y SMTP se simulan. Se prueban firma y caducidad, autorización, idempotencia, lease/concurrencia, historial y paginación, confirmación/reapertura, responsables, notas privadas, recuperación con expiración/cinco intentos/un solo uso, límites, cuotas y fallos.
- Chromium con frontend y handlers reales sobre el backend local simulado. Se comprueban creación y atención IA iniciada en servidor, conversación, cierre/reapertura, responsables, notas, recuperación, errores, cola paginada, copia sin conexión y responsive. También se conservan regresiones de navegación, inventario, unidades, chat, simulador, reportes, temas y animaciones activas.
- Build estático solo de HTML y assets. Se revisa que los archivos SQL, tests, nodemailer, configuración SMTP y backend no se copien al directorio público.
- Políticas locales de despliegue comprueban que se omiten ramas dev y Deploy Previews, incluso con referencias pull/1/head; un build hook que omita ignore encuentra el bloqueo adicional del build.

Los mensajes de error esperados de cuota, timeout, correo fallido o accesos denegados en los logs son simulaciones verificadas, no llamadas a servicios externos.

## Antes de subir y publicar

- [ ] Autorización del propietario para subir la rama a GitHub; no se ha pedido autorización para merge/despliegue.
- [ ] Revisar `sql/mesa_agente_v2.sql` y el esquema real de solicitudes_ayuda; aplicar la migración en un entorno autorizado. No se ejecutó DDL ni se leyó/escribió TiDB real.
- [ ] Confirmar que seguimiento_ayuda existe o aplicar la migración original con autorización.
- [ ] Conceder SELECT/INSERT/UPDATE sobre ayuda_control y ayuda_mensajes al usuario de runtime; no conceder DDL a las funciones.
- [ ] Mantener DB_*, GEMINI_API_KEY, AYUDA_PIN y TICKET_TOKEN_SECRET (mínimo obligatorio 32 caracteres). Los modelos Gemini permanecen sin cambios; su disponibilidad real debe verificarse sin sustituirlos.
- [ ] Configurar SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SUPPORT_FROM y puerto 465/587 en Functions del proyecto y contexto de Netlify correcto. No se envió correo real ni se verificó la entrega del proveedor.
- [ ] Ensayo autorizado de Gemini y waitUntil en Netlify, cuota, credenciales y tiempos del runtime. Los tests locales no prueban el runtime remoto.
- [ ] Verificación en Safari/iPhone y Android físicos. Chromium en Linux con anchos móviles no acredita esos dispositivos.

## Limitaciones explícitas

El doble SQL adapta funciones MySQL a SQLite: no acredita que la migración/SQL hayan sido ejecutados en TiDB. La recuperación necesita SMTP y falla de forma segura si falta. El PIN docente es compartido y no identifica individualmente a los tres responsables. Los límites por IP son por instancia; los leases, idempotencia y límites de recuperación por ticket sí se persisten. Los códigos privados no tienen revocación individual. waitUntil cuenta dentro del tiempo y facturación de la función; no se incorporó un worker periódico ni se garantiza una respuesta real si Gemini no está disponible. Los fallos se muestran como avisos del sistema y escalamiento, nunca como respuestas de IA inventadas.

La copia revision/index.html se puede probar sin conexiones; sus respuestas y correos son simulados y están etiquetados. El adaptador de demostración no se incluye en dist.
