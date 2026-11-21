(() => {
  const panel = document.querySelector('[data-vivora-url]');
  if (!panel?.dataset.vivoraUrl.trim()) return;
  const button = panel.querySelector('#vivora-toggle');
  const studio = panel.querySelector('#vivora-studio');
  const status = panel.querySelector('#vivora-status');
  let url;
  try {
    url = new URL(panel.dataset.vivoraUrl);
  } catch {
    return;
  }

  const local = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const localTest = url.protocol === 'http:' && local(url.hostname) && local(location.hostname);
  if ((!localTest && url.protocol !== 'https:') || url.username || url.password) return;

  status.textContent = 'Abre Vivora e inicia sesión para hablar con el avatar. El navegador te pedirá permiso al usar el micrófono.';
  panel.hidden = false;
  button.hidden = false;
  button.addEventListener('click', () => {
    const open = studio.hidden;
    if (open) {
      const frame = document.createElement('iframe');
      frame.title = 'Vivora · Conversación por voz con el avatar';
      frame.className = 'vivora-frame';
      frame.allow = "microphone 'src'; camera 'none'";
      frame.referrerPolicy = 'strict-origin';
      frame.src = url.href;
      studio.append(frame);
    } else {
      studio.replaceChildren();
    }
    studio.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Cerrar avatar' : 'Abrir avatar';
  });
})();
