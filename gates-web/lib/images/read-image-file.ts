const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 900;
const JPEG_QUALITY = 0.82;
const MAX_DATA_URL_CHARS = 700_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    image.src = src;
  });
}

function canvasToJpeg(image: HTMLImageElement): string {
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذر تجهيز الصورة');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('ارفع ملف صورة فقط (JPG أو PNG)');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('الصورة أكبر من 4 ميجا. صغّرها أو استخدم رابطاً.');
  }

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('تعذر قراءة الصورة'));
    };
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.readAsDataURL(file);
  });

  try {
    const image = await loadImage(raw);
    const compressed = canvasToJpeg(image);
    if (compressed.length > MAX_DATA_URL_CHARS) {
      throw new Error('الصورة كبيرة بعد الضغط. استخدم صورة أوضح وأصغر.');
    }
    return compressed;
  } catch (error) {
    if (raw.startsWith('data:image/') && raw.length <= MAX_DATA_URL_CHARS) return raw;
    throw error instanceof Error ? error : new Error('تعذر تجهيز الصورة');
  }
}
