# Registro de cambios

Base original: `abeb896`. Rama local: `dev/biovolt-integral`.

| Archivo | Motivo |
|---|---|
| `index.html` | Conserva ocho vistas y estilos; corrige unidades, fuentes parciales, historial y fallback de chat, consulta privada y filtros de tickets, movimiento continuo solicitado por el propietario y visibilidad. |
| `assets/core.js` (nuevo) | Utilidades sin dependencias para kWh, CSV seguro, escenarios y JSON con timeout. |
| `assets/enhancements.js` (nuevo) | Añade controles sobre vistas existentes: acceso docente/privado, seguimiento, filtros por almacén/tipo/fecha/categoría/escalado, periodos, mantenimiento, simulador, reportes. |
| `assets/enhancements.css` (nuevo) | Reglas acotadas de responsive, impresión; mantiene animaciones activas por petición del propietario. |
| `netlify/functions/tickets.mjs` | Bloquea listado público, limita consultas por capacidad, firma códigos después de crear; PIN con comparación segura e IDs estrictos. |
| `netlify/functions/agente.mjs` | Verifica acceso por ticket; evita cierre automático, conserva cierre humano concurrente y sanitiza errores públicos. Modelos y herramientas conservados. |
| `netlify/functions/chat.mjs` | Timeout, JSON de resumen válido, origen explícito y errores públicos genéricos; modelo conservado. |
| `netlify/functions/data.mjs` | Normaliza energía, informa consultas parciales, agrega periodos/plantas y datos globales de mantenimiento y eficiencia. |
| `lib/access.mjs` (nuevo) | HMAC-SHA256 por ticket, expiración, PIN seguro y límites por instancia. |
| `lib/analytics.mjs` (nuevo) | Periodos estrictos y expresión SQL de conversión. |
| `netlify.toml` | Build a `dist`, Node 24 y cabeceras básicas; evita publicar fuentes privadas como estáticos. |
| `package.json`, `package-lock.json` | Comandos reproducibles, dependencia de pruebas de navegador y versiones fijadas. `mysql2` se conserva. |
| `scripts/*`, `playwright.config.mjs`, `tests/*` (nuevos) | Sintaxis/build, servidor sin producción, pruebas de cálculos, autorización, contratos y navegador. |
| `.gitignore` | Excluye build, resultados y archivos de entorno. |
| `README.md`, `docs/*` | Configuración, auditoría, autenticación, alcance y validación. |

Sin cambios en `netlify/functions/seguimiento.mjs`, `sql/seguimiento_ayuda.sql` ni `gitignore` original. No hay tablas nuevas ni migraciones ejecutadas. No se reemplazaron los modelos, el directorio, módulos, navegación, paleta, tipografía o SVG originales. Los módulos que originalmente indicaban «Próximamente» conservan ese estado.

## Límites funcionales conservadores

No se inventaron fechas ambientales, monedas de mantenimiento ni capacidad disponible: el esquema completo no está en el repositorio. Ambiente y mantenimiento son acumulados globales; su filtrado temporal requiere confirmar columnas y unidades. La eficiencia por tipo procede de las pruebas existentes, no de un cálculo supuesto de consumo operativo. Las listas mantienen límites de carga explícitos; no se promete un inventario completo si excede esos límites. La comparación porcentual es descriptiva, no una valoración automática de si la variación es beneficiosa.

## Cambio de preferencia

El propietario pidió explícitamente «no actives el movimiento reducido; que se mueva siempre». Esa instrucción posterior sustituye su requisito inicial sobre `prefers-reduced-motion`. La versión final conserva las animaciones activas independientemente de esa preferencia del sistema; las pruebas verifican este comportamiento y la visibilidad cuando falta IntersectionObserver.

## Entrega en GitHub autorizada por el propietario

- `revision/index.html` y `revision/LEEME.md`: copia de revisión sin API para abrir con doble clic, sin depender de la vista incrustada del chat.
- `netlify.toml`: omite el build automático solo de `dev/biovolt-integral`.
- `scripts/build.mjs`: bloqueo adicional de deploy de esta rama cuando se ejecuta en Netlify, incluso si un build hook ignora la regla ignore.
- README y validación: instrucciones de descarga y revisión, sin tocar main ni solicitar despliegues.
