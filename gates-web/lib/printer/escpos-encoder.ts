const ESC = 0x1b;
const GS = 0x1d;
const BAND_HEIGHT = 256;

function concat(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function luminance(r: number, g: number, b: number, a: number): number {
  if (a < 16) return 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Packs a canvas band into ESC/POS `GS v 0` raster bytes (1 = black).
 * Width is padded to a multiple of 8 dots.
 */
function rasterBand(
  image: ImageData,
  width: number,
  startY: number,
  bandHeight: number
): Uint8Array {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * bandHeight);
  for (let y = 0; y < bandHeight; y += 1) {
    const srcY = startY + y;
    for (let x = 0; x < width; x += 1) {
      const i = (srcY * width + x) * 4;
      const dark = luminance(image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]) < 168;
      if (!dark) continue;
      const byteIndex = y * widthBytes + (x >> 3);
      data[byteIndex] |= 0x80 >> (x & 7);
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = bandHeight & 0xff;
  const yH = (bandHeight >> 8) & 0xff;
  const header = new Uint8Array([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return concat([header, data]);
}

/**
 * Converts a receipt canvas to raw ESC/POS bytes:
 * init, zero line spacing, raster image bands, feed, partial cut.
 */
export function canvasToEscPos(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر قراءة صورة الإيصال.');
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);

  const parts: Uint8Array[] = [
    new Uint8Array([ESC, 0x40]),
    new Uint8Array([ESC, 0x33, 0x00]),
  ];

  for (let y = 0; y < height; y += BAND_HEIGHT) {
    const bandH = Math.min(BAND_HEIGHT, height - y);
    parts.push(rasterBand(image, width, y, bandH));
  }

  parts.push(new Uint8Array([ESC, 0x64, 0x04]));
  parts.push(new Uint8Array([GS, 0x56, 0x41, 0x00]));
  return concat(parts);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
