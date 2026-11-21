// Poses del retrato de BioVolt. Las coordenadas corresponden a su recorte cuadrado.
function createAvatarMouth(portrait) {
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.setAttribute('aria-hidden', 'true');
  let brush;
  let poses;
  let timer;
  let beat = 0;
  const rhythm = [1, 3, 5, 2, 0, 2, 4, 3, 1, 0, 3, 5, 4, 2, 0];

  function prepare() {
    if (poses) return true;
    const image = portrait.querySelector('img');
    if (!image.naturalWidth) return false;
    brush = canvas.getContext('2d');
    if (!brush) return false;
    const original = document.createElement('canvas');
    original.width = original.height = size;
    const ctx = original.getContext('2d');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, size, size);
    poses = [original];
    // Comprime solo los labios y estira la piel contigua hacia el mentón.
    const left = Math.round(size * .405);
    const right = Math.round(size * .644);
    const lowerLip = Math.round(size * .595);
    const chin = Math.round(size * .654);
    for (let level = 1; level <= 5; level++) {
      const frame = original.cloneNode();
      const paint = frame.getContext('2d');
      paint.drawImage(original, 0, 0);
      for (let x = left; x < right; x++) {
        const t = (x - left) / (right - left);
        const upperLip = Math.round(size * (.458 + .041 * t));
        const height = lowerLip - upperLip;
        const taper = Math.min(1, t * 6, (1 - t) * 6);
        const shift = Math.round(height * .82 * level / 5 * taper);
        paint.drawImage(original, x, upperLip, 1, height, x, upperLip, 1, height - shift);
        paint.drawImage(original, x, lowerLip, 1, chin - lowerLip, x, lowerLip - shift, 1, chin - lowerLip + shift);
      }
      poses.push(frame);
    }
    portrait.append(canvas);
    return true;
  }

  function draw() {
    if (document.documentElement.dataset.bvMotion === 'off') return;
    brush.drawImage(poses[rhythm[beat]], 0, 0);
    beat = (beat + 1) % rhythm.length;
  }

  return {
    start() {
      if (timer || !prepare()) return;
      beat = 0;
      canvas.hidden = false;
      draw();
      timer = setInterval(draw, 80);
    },
    word() { beat = 0; },
    stop() {
      clearInterval(timer);
      timer = undefined;
      canvas.hidden = true;
    }
  };
}
