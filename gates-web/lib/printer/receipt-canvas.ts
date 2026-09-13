import type { ReceiptCanvasOptions, ThermalInvoiceData, ThermalRollWidth } from '@/lib/printer/types';
import { formatThermalMoney } from '@/lib/printer/from-invoice-print-model';

export const THERMAL_PX: Record<ThermalRollWidth, number> = {
  58: 384,
  80: 576,
};

const FONT_STACK = '"Cairo", "Tahoma", "Arial", sans-serif';

async function ensureCairoFont(): Promise<void> {
  if (typeof document === 'undefined') return;
  const id = 'gates-cairo-thermal-font';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  try {
    await document.fonts.load(`700 22px ${FONT_STACK}`);
    await document.fonts.ready;
  } catch {
    /* system fallbacks still print Arabic */
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const raw = text.trim();
  if (!raw) return [];
  if (ctx.measureText(raw).width <= maxWidth) return [raw];

  const lines: string[] = [];
  let current = '';
  for (const word of raw.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      const trial = chunk + ch;
      if (ctx.measureText(trial).width <= maxWidth) {
        chunk = trial;
      } else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines;
}

function drawDashedRule(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  pad: number
): number {
  ctx.save();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  ctx.restore();
  return y + 10;
}

function loadQrImage(payload: string, size: number): Promise<HTMLImageElement | null> {
  return import(/* webpackChunkName: "qrcode" */ 'qrcode')
    .then(({ default: QRCode }) =>
      QRCode.toDataURL(payload, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      })
    )
    .then(
      (url) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        })
    )
    .catch(() => null);
}

/**
 * Rasterizes a receipt to an off-screen canvas so cheap ESC/POS printers
 * receive shaped RTL Arabic as a monochrome bitmap.
 */
export async function renderReceiptToCanvas(
  invoiceData: ThermalInvoiceData,
  options: ReceiptCanvasOptions
): Promise<HTMLCanvasElement> {
  await ensureCairoFont();

  const width = THERMAL_PX[options.widthMm];
  const pad = options.widthMm === 58 ? 10 : 14;
  const contentW = width - pad * 2;
  const estimated =
    420 + invoiceData.items.length * 64 + 280 + (invoiceData.qrPayload ? 200 : 0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(estimated, 480);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر تجهيز معاينة الإيصال.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.direction = 'rtl';
  ctx.textBaseline = 'top';

  let y = 14;

  const paint = (
    text: string,
    size: number,
    weight: string,
    align: CanvasTextAlign,
    x: number,
    maxW = contentW
  ) => {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    ctx.textAlign = align;
    const lines = wrapText(ctx, text, maxW);
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += size + 4;
    }
  };

  paint(invoiceData.companyName, 22, '800', 'center', width / 2);
  if (invoiceData.branch) {
    paint(invoiceData.branch, 13, '600', 'center', width / 2);
  }
  if (invoiceData.phone) {
    paint(`هاتف: ${invoiceData.phone}`, 12, '400', 'center', width / 2);
  }
  if (invoiceData.taxRegistrationNumber) {
    paint(`الرقم الضريبي: ${invoiceData.taxRegistrationNumber}`, 12, '600', 'center', width / 2);
  }

  y += 4;
  y = drawDashedRule(ctx, y, width, pad);
  paint(invoiceData.title, 16, '800', 'center', width / 2);
  paint(`رقم ${invoiceData.invoiceNumber}`, 13, '700', 'center', width / 2);
  paint(invoiceData.dateTime, 12, '400', 'center', width / 2);
  y = drawDashedRule(ctx, y, width, pad);

  if (invoiceData.customerName) {
    paint(`العميل: ${invoiceData.customerName}`, 13, '600', 'right', width - pad);
  }
  if (invoiceData.customerBalance != null && Number.isFinite(invoiceData.customerBalance)) {
    paint(
      `الرصيد: ${formatThermalMoney(invoiceData.customerBalance)}`,
      12,
      '400',
      'right',
      width - pad
    );
  }
  if (invoiceData.customerName || invoiceData.customerBalance != null) {
    y = drawDashedRule(ctx, y + 2, width, pad);
  }

  const colItem = Math.floor(contentW * 0.46);
  const colQty = Math.floor(contentW * 0.32);
  const xRight = width - pad;
  const xMid = pad + colQty + colItem;
  const xLeft = pad;

  ctx.font = `700 11px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.fillText('الصنف', xRight, y);
  ctx.textAlign = 'center';
  ctx.fillText('الكمية × السعر', xMid - colItem / 2, y);
  ctx.textAlign = 'left';
  ctx.fillText('الإجمالي', xLeft, y);
  y += 18;
  y = drawDashedRule(ctx, y, width, pad);

  for (const item of invoiceData.items) {
    const startY = y;
    ctx.font = `600 12px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    const nameLines = wrapText(ctx, item.name || '—', colItem);
    for (const line of nameLines) {
      ctx.fillText(line, xRight, y);
      y += 16;
    }
    const qtyLine = `${item.quantity} × ${formatThermalMoney(item.unitPrice)}`;
    ctx.font = `400 11px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText(qtyLine, xMid - colItem / 2, startY);
    ctx.textAlign = 'left';
    ctx.font = `700 12px ${FONT_STACK}`;
    ctx.fillText(formatThermalMoney(item.total), xLeft, startY);
    y = Math.max(y, startY + 18) + 4;
  }

  y = drawDashedRule(ctx, y + 2, width, pad);

  const row = (label: string, value: string, bold = false, size = 13) => {
    ctx.font = `${bold ? '800' : '600'} ${size}px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillText(label, xRight, y);
    ctx.textAlign = 'left';
    ctx.fillText(value, xLeft, y);
    y += size + 8;
  };

  row('الإجمالي قبل الضريبة', formatThermalMoney(invoiceData.subtotal));
  row(
    `ضريبة القيمة المضافة (${invoiceData.vatRateLabel ?? '14%'})`,
    formatThermalMoney(invoiceData.vatAmount)
  );
  if (invoiceData.discount > 0) {
    row('الخصم', formatThermalMoney(invoiceData.discount));
  }
  if ((invoiceData.developmentFee ?? 0) > 0) {
    row('رسم التنمية', formatThermalMoney(invoiceData.developmentFee ?? 0));
  }
  if ((invoiceData.withholding ?? 0) > 0) {
    row('الضريبة المخصومة', formatThermalMoney(invoiceData.withholding ?? 0));
  }
  y += 2;
  row('الصافي النهائي', formatThermalMoney(invoiceData.net), true, 18);

  const qrPayload =
    invoiceData.qrPayload?.trim() ||
    [
      invoiceData.companyName,
      invoiceData.invoiceNumber,
      invoiceData.dateTime,
      formatThermalMoney(invoiceData.net),
    ].join('|');

  const qrSize = options.widthMm === 58 ? 128 : 152;
  const qrImg = await loadQrImage(qrPayload, qrSize);
  if (qrImg) {
    y += 8;
    ctx.drawImage(qrImg, (width - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 8;
    ctx.font = `400 10px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.fillText('فاتورة إلكترونية — مصلحة الضرائب', width / 2, y);
    y += 16;
  }

  if (invoiceData.notes) {
    paint(invoiceData.notes, 11, '400', 'center', width / 2);
  }
  paint(invoiceData.footer || 'شكراً لتعاملكم معنا - Gates ERP', 12, '700', 'center', width / 2);

  y += 52;

  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = Math.max(y, 200);
  const out = cropped.getContext('2d');
  if (!out) return canvas;
  out.fillStyle = '#ffffff';
  out.fillRect(0, 0, cropped.width, cropped.height);
  out.drawImage(canvas, 0, 0);
  return cropped;
}
