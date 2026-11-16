# Auditoría inicial BioVolt

Base: `abeb8965ce09af5aa0891324edb77f60f97c6585` de feliperomerocarlos-crypto/bio.
Se revisaron los 12 archivos versionados, incluidos HTML/CSS/JS, cinco funciones, configuración, SQL y documentación. No se ejecutaron consultas ni migraciones en producción.

## Arquitectura y línea base

SPA por hash, 8 vistas, CSS y JavaScript inline, SVG originales. Netlify Functions v2, `mysql2/promise`, pools con TLS, Gemini REST con herramientas fijas. No framework ni compilación. README incompleto. No lockfile, tests ni scripts npm originales.

Sintaxis inicial: 5 funciones y 2 scripts inline aprobados mediante `node --check`. No se verificó conectividad real a TiDB/Gemini ni disponibilidad de los modelos. No hay esquema completo ni respaldo SQL de las aproximadamente 46 tablas; solo migración de seguimiento.

## Problemas confirmados

- GET tickets expone nombre, descripción y respuestas a todos; agente acepta ID sin acreditar acceso.
- PIN compartido, sin sesión ni roles individuales. Seguimiento usa comparación segura; tickets no.
- Agente puede cerrar tickets por su propia evaluación; búsqueda web también los marca resueltos.
- Límites en memoria por instancia: no son globales. Errores del proveedor retornados al cliente.
- `data.mjs` suma unidades mixtas; gráfico compara cantidades sin normalizar.
- `reduceMotion` y ambos `rm` retornan false. Reglas de accesibilidad bajo `@media not all` nunca se aplican.
- CSS oculta contenido antes de animarlo; un fallo puede dejarlo invisible.
- loadLive mezcla muestras con resultados parciales reales y conserva muestras si una consulta devuelve vacío.
- Inventario usa solo la primera fila por biomasa, sin filtros por almacén o categoría.
- Respaldo local del chat no identifica su origen; fetch del chat no tiene timeout.
- Backend de seguimiento existe sin controles frontend. Faltan filtros por fecha, simulación y exportaciones.
- `publish="."` permite publicar fuentes y documentación como estáticos. Hay que acotar el directorio publicado.

## Prioridad de intervención

1. Privacidad y autorización de tickets; cierre humano obligatorio; errores seguros.
2. Integridad de unidades, fuentes y respuestas parciales.
3. Filtros y reportes, simulación con supuestos explícitos, seguimiento.
4. Movimiento accesible y visible ante fallos, responsive y pruebas de navegador.

Conservar modelos `gemini-3.6-flash` y `gemini-3.5-flash-lite`, estructura visual y todas las vistas. Cambios solo en rama local `dev/biovolt-integral`. Sin push, despliegue o cambios de datos reales.
