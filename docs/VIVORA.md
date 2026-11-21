# Avatar de voz en BioVolt

En Asistente, el chat de texto sigue disponible y el panel **Habla con el avatar** abre Vivora dentro de la página. El estudio pide su propia sesión y usa sus propios servicios de voz. La página padre no recibe audio, credenciales ni conversaciones del estudio. Cerrar el panel retira el iframe. Para conversar basta el micrófono. El visitante puede seleccionar un avatar disponible para su cuenta o subir una imagen en Vivora.

## Conectar la instancia

En `src/page.html`, busca el único atributo `data-vivora-url=""` y coloca entre las comillas la URL HTTPS de tu estudio, por ejemplo `https://avatar.example.org/studio`. Sustituye el dominio de ejemplo por el tuyo. Es una dirección pública sin tokens ni contraseñas. El panel vacío muestra un aviso y no inicia conexiones. Localmente puedes usar `http://localhost:3000/studio` si BioVolt también se sirve desde loopback.

Desde la raíz de BioVolt ejecuta `npm run build:review` y `npm run build`. Para probar la conexión local, ejecuta `npm run dev` y abre `http://127.0.0.1:4173/#asistente` (para pruebas de cookies en el mismo sitio, abre BioVolt y Vivora usando ambos el nombre localhost). La copia descargable `revision/index.html` siempre mantiene el avatar desconectado.

## Vivora local con Docker Compose

1. Instala Docker con Compose v2 reciente. Clona el repositorio y prepara su entorno dentro de la carpeta de Vivora.

   ```sh
   git clone https://github.com/sur950/vivora.git
   cd vivora
   cp .env.example .env
   ```

2. Configura en `.env` el proveedor de Vivora y sus credenciales o usa Ollama local. Para Ollama establece `LLM_PROVIDER=ollama`, `LLM_MODEL` al modelo que hayas descargado y `OPENAI_BASE_URL=http://host.docker.internal:11434/v1`. El servidor Ollama debe ser alcanzable desde el contenedor. Elige `AVATAR_ENGINE=simple` para probar audio, sesión y una imagen estática en CPU. El Compose de desarrollo incluye PostgreSQL, Redis y almacenamiento MinIO.
3. Arranca y comprueba los servicios.

   ```sh
   docker compose up -d --build
   docker compose ps
   curl -fsS http://localhost:8000/health
   ```

4. Abre el panel desde BioVolt. En desarrollo, el upstream incluye un usuario de demostración. Entra al estudio, selecciona o crea un avatar para esa cuenta, inicia una sesión y usa el control de voz. El puerto 3000 sirve Next.js y el 8000 sirve FastAPI y WebSocket.

## Producción con sincronización labial

Vivora necesita servicios persistentes aparte del alojamiento estático de BioVolt. El proyecto documenta MuseTalk V1.5 con NVIDIA y menciona GPU de 16 GB o más. La latencia real depende del hardware, los pesos y los proveedores.

1. Prepara un host con controlador NVIDIA, NVIDIA Container Toolkit y Compose v2.24.4 o posterior. Comprueba `nvidia-smi`. Apunta el DNS del dominio del avatar al servidor y emite un certificado TLS para ese nombre. Expón únicamente los puertos públicos 80 y 443 del proxy.
2. En un clon de Vivora, prepara `.env` para el Compose base y copia `.env.prod.example` a `.env.prod`. Define contraseñas propias para PostgreSQL, los secretos de firma, el bucket S3 y el proveedor de conversación. En producción el overlay usa S3 y desactiva MinIO. El arranque de backend ejecuta `seed_user.py` de forma incondicional en la revisión consultada. Antes de abrir el servicio al público, condiciona esa llamada al entorno de desarrollo, retira las credenciales demo del formulario y deshabilita cualquier cuenta demo preexistente. Usa cuentas individuales para mantener separados los historiales y avatares.
3. Define en `.env.prod` los valores siguientes con tu dominio. Compose usa los tres primeros al **construir** el frontend. Reconstruye la imagen si cambian.

   ```dotenv
   BACKEND_URL=https://avatar.example.org
   WS_URL=wss://avatar.example.org
   FRONTEND_URL=https://avatar.example.org
   CORS_ORIGINS=https://avatar.example.org
   AUTH_COOKIE_SECURE=true
   AVATAR_ENGINE=musetalk
   MUSETALK_PATH=models/MuseTalk
   ```

4. Desde el clon ejecuta `bash scripts/setup_musetalk.sh` en un entorno Python dedicado. Descarga el motor y sus pesos en `backend/models/MuseTalk`. Sirve esos mismos archivos en `/app/models` para los servicios `backend` y `celery-worker`. Por ejemplo, añade este archivo **en el clon de Vivora** como `compose.host.yml`. Sustituye las publicaciones de puertos del Compose base y monta los modelos descargados. Mantén la gestión de certificados en el host.

   ```yaml
   services:
     frontend:
       ports: !reset []
       volumes: !reset []
     backend:
       ports: !reset []
       volumes:
         - ./backend/models:/app/models:ro
     celery-worker:
       volumes:
         - ./backend/models:/app/models:ro
     postgres:
       ports: !reset []
     redis:
       ports: !reset []
   ```

5. En `nginx/nginx.conf` conserva los upstreams y las ubicaciones existentes para Next.js, `/api/`, `/health` y `/ws/`. El archivo original solo escucha HTTP. Convierte su bloque de aplicación en un servidor TLS, sustituyendo `listen 80` y `server_name localhost` por este fragmento. Coloca los archivos de certificado y clave en `nginx/ssl/`, ya montado en el contenedor, y programa su renovación y recarga.

   ```nginx
   listen 443 ssl;
   server_name avatar.example.org;
   ssl_certificate /etc/nginx/ssl/fullchain.pem;
   ssl_certificate_key /etc/nginx/ssl/privkey.pem;
   ```

   Añade dentro de `http` un segundo bloque para la redirección. Conserva en `location /ws/` el `proxy_pass http://backend`, HTTP/1.1, las cabeceras `Upgrade` y `Connection "upgrade"`, y el tiempo de lectura que ya trae el repositorio. En el frontend usa la base WSS sin añadir `/ws`, porque Vivora construye la ruta `/ws/session/<id>`. Configura el registro de acceso del proxy a esa ubicación sin la cadena de consulta, ya que el cliente puede incluir un token.

   ```nginx
   server {
       listen 80;
       server_name avatar.example.org;
       return 301 https://avatar.example.org$request_uri;
   }
   ```

6. En el bloque `location /` que sirve el **frontend de Vivora**, configura el origen padre autorizado.

   ```nginx
   add_header Content-Security-Policy "frame-ancestors https://biovol.netlify.app" always;
   ```

   Si ese HTML ya tiene CSP en el CDN o en Next.js, edita la directiva en la política original preservando el resto. Si el mismo documento tiene `X-Frame-Options: DENY` o `SAMEORIGIN`, retíralo para ese frontend y conserva la CSP restringida. El middleware FastAPI del repositorio tiene su propia protección contra marcos. Las respuestas JSON de FastAPI pueden conservarla. Si BioVolt aplica una CSP con `frame-src`, incluye el origen HTTPS exacto de Vivora en esa directiva. Si el padre restringe micrófonos con Permissions Policy, permite `microphone=(self "https://avatar.example.org")` en la política existente de BioVolt. Cambia el dominio de ejemplo por el definitivo.

7. Valida y arranca en el host GPU.

   ```sh
   prod() { docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml -f compose.host.yml "$@"; }
   prod config --quiet
   prod up -d --build
   prod ps
   prod exec nginx nginx -t
   prod exec backend python -c 'import torch; print(torch.cuda.is_available())'
   prod exec celery-worker python -c 'import torch; print(torch.cuda.is_available())'
   prod exec celery-worker test -r /app/models/MuseTalk/models/musetalkV15/unet.pth
   curl -fsS https://avatar.example.org/health
   ```

## Verificación desde BioVolt

| Síntoma | Qué comprobar |
| --- | --- |
| El navegador rechaza el marco | En Red, abre la respuesta HTML final de `/studio` y cualquier redirección de acceso. Revisa `frame-ancestors`, `X-Frame-Options` y la CSP de BioVolt. El evento de carga del iframe por sí solo no demuestra que el estudio se muestre. |
| Vivora repite el inicio de sesión | En el marco, verifica el login y la siguiente petición autenticada. Vivora envía cookie HttpOnly con credenciales y también admite bearer persistido por su cliente. Si BioVolt y Vivora están en sitios distintos, una cookie `Lax` puede quedar excluida. Para ese caso se requieren `AUTH_COOKIE_SAMESITE=none`, `AUTH_COOKIE_SECURE=true` y HTTPS. Algunos navegadores bloquean incluso esas cookies o restringen el almacenamiento. Usar dominios hermanos propios como `www.example.org` y `avatar.example.org` permite una configuración same-site. Actualiza entonces el origen permitido en `frame-ancestors`. |
| No aparece el micrófono | Comprueba HTTPS en padre e hijo, permiso del navegador y del sistema operativo, y política de permisos en ambas respuestas. Pulsa el control de voz dentro del estudio. |
| Se ve el avatar, pero no responde | En la pestaña Red, verifica que el WebSocket de sesión devuelve 101 y recibe mensajes. Revisa los servicios de transcripción, modelo y síntesis. Para los labios verifica CUDA, los pesos y el acceso del navegador al vídeo generado. |

La prueba final consiste en entrar desde BioVolt con una cuenta individual, abrir el avatar, enviar voz, escuchar una respuesta coherente, ver la sincronización en GPU, hacer una segunda pregunta y cerrar el panel. Comprueba que el navegador libera el micrófono. Repite en escritorio y móvil con la configuración de privacidad habitual. La guía se basa en la revisión 1a87b77 de [Vivora](https://github.com/sur950/vivora/tree/1a87b770b0e07d2670af61f5aa035f5829e5545d).
