import { uint8ToBase64 } from '@/lib/printer/escpos-encoder';
import type { ThermalInvoiceData, ThermalRollWidth } from '@/lib/printer/types';
import { formatThermalMoney } from '@/lib/printer/from-invoice-print-model';

export function printViaRawBT(base64Data: string): void {
  const rawBtUrl = `rawbt:base64,${base64Data}`;
  window.location.href = rawBtUrl;
}

export function printEscPosViaRawBT(bytes: Uint8Array): void {
  printViaRawBT(uint8ToBase64(bytes));
}

export function isLikelyIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildThermalReceiptHtml(
  data: ThermalInvoiceData,
  widthMm: ThermalRollWidth
): string {
  const items = data.items
    .map(
      (item) => `
      <div class="gates-thermal-item">
        <div class="gates-thermal-item-name">${escapeHtml(item.name || '—')}</div>
        <div class="gates-thermal-item-row">
          <span>${escapeHtml(String(item.quantity))} × ${escapeHtml(formatThermalMoney(item.unitPrice))}</span>
          <span>${escapeHtml(formatThermalMoney(item.total))}</span>
        </div>
      </div>`
    )
    .join('');

  return `
    <article class="gates-thermal-receipt" data-width="${widthMm}" dir="rtl">
      <h1>${escapeHtml(data.companyName)}</h1>
      ${data.branch ? `<p>${escapeHtml(data.branch)}</p>` : ''}
      ${data.phone ? `<p>هاتف: ${escapeHtml(data.phone)}</p>` : ''}
      ${data.taxRegistrationNumber ? `<p>الرقم الضريبي: ${escapeHtml(data.taxRegistrationNumber)}</p>` : ''}
      <hr />
      <h2>${escapeHtml(data.title)}</h2>
      <p>رقم ${escapeHtml(data.invoiceNumber)}</p>
      <p>${escapeHtml(data.dateTime)}</p>
      <hr />
      ${data.customerName ? `<p>العميل: ${escapeHtml(data.customerName)}</p>` : ''}
      ${
        data.customerBalance != null
          ? `<p>الرصيد: ${escapeHtml(formatThermalMoney(data.customerBalance))}</p>`
          : ''
      }
      <div class="gates-thermal-cols">
        <span>الصنف</span><span>الكمية × السعر</span><span>الإجمالي</span>
      </div>
      <hr />
      ${items}
      <hr />
      <div class="gates-thermal-total"><span>الإجمالي قبل الضريبة</span><span>${escapeHtml(formatThermalMoney(data.subtotal))}</span></div>
      <div class="gates-thermal-total"><span>ضريبة القيمة المضافة (${escapeHtml(data.vatRateLabel ?? '14%')})</span><span>${escapeHtml(formatThermalMoney(data.vatAmount))}</span></div>
      ${
        data.discount > 0
          ? `<div class="gates-thermal-total"><span>الخصم</span><span>${escapeHtml(formatThermalMoney(data.discount))}</span></div>`
          : ''
      }
      <div class="gates-thermal-total gates-thermal-net"><span>الصافي النهائي</span><span>${escapeHtml(formatThermalMoney(data.net))}</span></div>
      ${data.notes ? `<p class="gates-thermal-notes">${escapeHtml(data.notes)}</p>` : ''}
      <p class="gates-thermal-footer">${escapeHtml(data.footer || 'شكراً لتعاملكم معنا - Gates ERP')}</p>
    </article>
  `;
}

export function printThermalViaBrowser(
  data: ThermalInvoiceData,
  widthMm: ThermalRollWidth
): void {
  const html = buildThermalReceiptHtml(data, widthMm);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error('تعذّر فتح نافذة الطباعة.');
  }
  doc.open();
  doc.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" />
    <style>
      @page { size: ${widthMm}mm auto; margin: 0; }
      body { margin: 0; background: #fff; }
    </style>
    <link rel="stylesheet" href="/printer/thermal-receipt.css" />
    <style>
      .gates-thermal-receipt { width: ${widthMm}mm; max-width: ${widthMm}mm; }
    </style>
  </head><body>${html}</body></html>`);
  doc.close();
  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 400);
  };
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
  window.setTimeout(() => {
    try {
      frame.contentWindow?.print();
    } finally {
      cleanup();
    }
  }, 400);
}
