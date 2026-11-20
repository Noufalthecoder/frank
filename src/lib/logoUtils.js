// Turns an uploaded image into a small, bill-friendly logo (data URL).
// Resizes to fit 320x160, keeps transparency (PNG) unless that gets too large, then falls back to JPEG.
const MAX_W = 320;
const MAX_H = 160;
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_CHARS = 400000;

export async function fileToLogoDataUrl(file) {
  if (!file || !/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('type');
  if (file.size > MAX_INPUT_BYTES) throw new Error('size');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('read'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/png');
    if (out.length > MAX_OUTPUT_CHARS) {
      // Photographic logos: JPEG on white is far smaller than PNG
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      out = canvas.toDataURL('image/jpeg', 0.85);
    }
    if (out.length > MAX_OUTPUT_CHARS) throw new Error('size');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
