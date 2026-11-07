# BioVolt AI

Sitio estático (index.html) + Netlify Function que conecta el asistente con la API de Gemini.

## Estructura
- `index.html` — la página completa
- `netlify/functions/chat.mjs` — función que llama a Gemini (ruta pública: `/api/chat`)
- `netlify.toml` — configuración de Netlify

## Despliegue
1. Sube estos archivos a un repositorio nuevo de GitHub.
2. En Netlify: Add new site -> Import an existing project -> elige el repositorio.
3. Antes de desplegar: Site configuration -> Environment variables -> agrega `GEMINI_API_KEY`.
4. Despliega. Si agregas o cambias la variable después, haz un nuevo deploy.

La clave de API vive solo en Netlify; nunca va en el HTML.
