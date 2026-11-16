# Validación y pendientes

Versión preparada en rama de revisión `dev/biovolt-integral`, sobre `abeb896`. Fecha de revisión: 15 de noviembre de 2026 (America/Bogota).

## Comprobado localmente

- `npm run check`: sintaxis de los scripts inline, assets, librerías y las cinco funciones.
- `npm test`: 19 pruebas aprobadas con MySQL y Gemini simulados. Firma, expiración y rotación de códigos; denegación de acceso ajeno; ausencia de secreto impide escribir; PIN; cierre humano; modelos originales; cuotas/timeouts; unidades/periodos; SQL parametrizado; consultas parciales; fórmulas y CSV.
- `npm run test:browser`: 15 pruebas aprobadas en Chromium con APIs simuladas. Ocho vistas, formulario, creación con código privado, recarga, notas internas, agente, fuentes de chat e historial, filtros, normalización MWh/kWh, simulador, CSV/PDF, responsive 360/390/768/1024/1440 px, animaciones y fallback sin observador. El movimiento sigue activo aunque el sistema solicite reducirlo, según instrucción final del propietario.
- `npm run build`: bundle estático `dist/`, únicamente HTML y assets; backend/SQL/docs no se copian a la carpeta pública.
- `git diff --check`: sin errores de espacios/conflictos.
- PDF de escenario simulado generado en Chromium: un A4 horizontal; leído con pdfinfo/pdftotext. No contiene datos reales.
- Se inspeccionaron capturas de escritorio y móvil. Se corrigieron desbordamientos de etiquetas sr-only y decoración del hero encontrados durante las pruebas.

Los logs de cuota, timeout y consultas fallidas de los tests son fallos simulados esperados y verifican que el cliente recibe errores seguros. No representan llamadas externas reales. Las pruebas no prueban el SQL contra un servidor TiDB real.

## Pendiente antes de publicar (no realizado)

- [ ] Revisar la rama y autorizar publicación; el propietario autorizó subir esta rama a GitHub; no autorizó merge ni despliegue. La rama de revisión cancela builds automáticos de Netlify y bloquea su build remoto.
- [ ] Configurar `TICKET_TOKEN_SECRET` aleatorio independiente (mínimo 32 caracteres), `AYUDA_PIN`, `DB_*` y `GEMINI_API_KEY` en Netlify.
- [ ] Verificar los valores actuales de los overrides Gemini sin cambiarlos automáticamente. Comprobar con documentación oficial y una prueba autorizada la disponibilidad real de los modelos.
- [ ] Revisar grants: SELECT limitado a tablas operativas; escritura exclusivamente en tablas de soporte necesarias. El código no puede garantizar los privilegios reales del usuario DB.
- [ ] Confirmar esquema de `solicitudes_ayuda` y sus columnas IA; el repositorio no contiene su migración de creación. Confirmar que `seguimiento_ayuda` existe; si falta, revisar y ejecutar manualmente la migración original no destructiva con autorización.
- [ ] Validar consultas de producción, mantenimiento y pruebas de eficiencia contra TiDB. Confirmar unidades del stock y moneda del mantenimiento. El coste se muestra sin asumir moneda.
- [ ] Confirmar zona horaria de fechas/TIMESTAMP en TiDB; la comparación SQL usa las fechas almacenadas. La fecha de generación del reporte usa America/Bogota.
- [ ] Confirmar bundle y rutas Netlify v2 en el entorno de hosting; la validación local comprueba código y contratos, no el runtime remoto de Netlify.
- [ ] Ensayo autorizado de acceso docente, consulta privada desde otro navegador, expiración, seguimiento y chat. Tickets previos requieren acceso docente; no hay recuperación por correo ni reemisión automática para solicitudes antiguas.
- [ ] Configurar, si se necesita, límites persistentes en la plataforma de hosting: los actuales son por instancia, no distribuidos.
- [ ] Probar Safari/iPhone y Android físicos. Se comprobaron anchos móviles con Chromium en Linux, no navegadores ni dispositivos físicos de esos sistemas.

## Límites de la entrega

Se conserva un PIN docente compartido: no equivale a cuentas con roles individuales o auditoría por persona. Códigos privados de portador por 30 días; sin revocación individual. No se conectaron datos privados de clientes/empleados al directorio ni a reportes. Historial del chat en la pestaña, no almacenamiento de conversaciones en el servidor. El simulador no valida científicamente rendimientos; exige supuestos del usuario y muestra fórmula y restricciones.

Filtros de periodo aplican a producción. Ambiente, mantenimiento y eficiencia de pruebas son acumulados globales claramente señalados: no se inventaron columnas de fechas ni relaciones del esquema ausente. Inventario informa límites de carga y no calcula capacidad disponible con unidades no verificadas. El PDF usa impresión del navegador; la apariencia puede variar entre navegadores.

## Entrega de revisión autorizada

El propietario autorizó subir los cambios a GitHub. Se incluye `revision/index.html`, autocontenido, para descargarlo y abrirlo con doble clic sin producción. Se conserva `main`; no se solicita ningún despliegue. Regla de Netlify verificada según https://docs.netlify.com/build/configure-builds/ignore-builds/ : exit 0 cancela builds automáticos. Como los build hooks pueden omitir ignore, el script de build también rechaza esta rama cuando `NETLIFY=true`.
