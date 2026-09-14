/**
 * Single print engine for the whole app.
 * Hidden 0×0 iframes print blank in Chrome; this uses a real-size off-screen frame.
 */

const FRAME_ID = 'gates-print-frame';

const BASE_PRINT_CSS = `
html, body { margin: 0; padding: 0; background: #fff; color: #111; }
body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; }
@page { margin: 12mm; }
.no-print, .print-hide-screen, nav, aside, [data-app-sidebar], [data-app-tabs], .print\\:hidden { display: none !important; }
.report-print-only { display: block !important; }
`;

const DOCUMENT_PRINT_CSS = `
.print-page { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #111; background: #fff; }
.print-a4 { width: 210mm; min-height: 297mm; padding: 12mm 14mm; margin: 0 auto; box-sizing: border-box; }
.print-thermal { width: 80mm; max-width: 80mm; padding: 4mm 3mm; font-size: 11px; line-height: 1.35; margin: 0 auto; }
.print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.print-table th, .print-table td { border: 1px solid #ccc; padding: 4px 6px; text-align: right; }
.print-table th { background: #f0f7fb; font-weight: 700; }
.print-muted { color: #555; font-size: 10px; }
.print-title { font-size: 18px; font-weight: 800; color: #0e78aa; margin: 0; }
.print-signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 24px; text-align: center; font-size: 11px; }
.print-signature-box { border-top: 1px solid #333; padding-top: 8px; min-height: 48px; }
.thermal-line { display: flex; justify-content: space-between; gap: 4px; }
.thermal-divider { border-top: 1px dashed #999; margin: 6px 0; }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isFullDocument(html: string): boolean {
  const start = html.trimStart().slice(0, 200).toLowerCase();
  return start.startsWith('<!doctype') || start.startsWith('<html');
}

export function wrapPrintHtml(bodyInner: string, title = 'طباعة', extraCss = ''): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${BASE_PRINT_CSS}${DOCUMENT_PRINT_CSS}${extraCss}</style>
</head>
<body>${bodyInner}</body>
</html>`;
}

function collectedPageStyles(): string {
  if (typeof document === 'undefined') return '';
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');
}

function removeOldFrame() {
  document.getElementById(FRAME_ID)?.remove();
}

async function waitForFrameDocument(iframe: HTMLIFrameElement): Promise<Document> {
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    iframe.addEventListener('load', done, { once: true });
    window.setTimeout(done, 800);
  });

  const doc = iframe.contentDocument;
  if (!doc) throw new Error('تعذر تجهيز صفحة الطباعة');

  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              window.setTimeout(resolve, 1200);
            })
    )
  );

  try {
    if (doc.fonts?.ready) {
      await Promise.race([doc.fonts.ready, new Promise((resolve) => setTimeout(resolve, 1500))]);
    }
  } catch {
    /* ignore */
  }

  await new Promise((resolve) => setTimeout(resolve, 60));
  return doc;
}

export async function printHtml(html: string): Promise<void> {
  if (typeof document === 'undefined') return;

  const src = isFullDocument(html) ? html : wrapPrintHtml(html);
  if (!src.replace(/<[^>]+>/g, '').trim()) {
    throw new Error('لا يوجد محتوى للطباعة');
  }

  removeOldFrame();

  const iframe = document.createElement('iframe');
  iframe.id = FRAME_ID;
  iframe.setAttribute('title', 'طباعة');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    'width:210mm',
    'height:297mm',
    'border:0',
    'margin:0',
    'padding:0',
    'background:#fff',
  ].join(';');

  document.body.appendChild(iframe);
  iframe.srcdoc = src;

  const doc = await waitForFrameDocument(iframe);
  const win = iframe.contentWindow;
  if (!win || !doc.body) {
    iframe.remove();
    throw new Error('تعذر تجهيز صفحة الطباعة');
  }

  const cleanup = () => {
    win.removeEventListener('afterprint', cleanup);
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup);

  try {
    win.focus();
    win.print();
  } catch {
    iframe.remove();
    throw new Error('تعذر فتح نافذة الطباعة');
  }

  window.setTimeout(cleanup, 60_000);
}

export async function printDom(element: Element, title?: string): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print, .print-hide-screen, [data-print-ignore]').forEach((node) => node.remove());
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || document.title || 'طباعة')}</title>
${collectedPageStyles()}
<style>${BASE_PRINT_CSS}</style>
</head>
<body>${clone.outerHTML}</body>
</html>`;
  await printHtml(html);
}

export async function printPageContent(title?: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const root =
    document.querySelector('[data-print-root]') ||
    document.getElementById('report-print-root') ||
    document.querySelector('main') ||
    document.querySelector('.erp-contain') ||
    document.querySelector('.coa-page') ||
    document.body;
  try {
    await printDom(root, title);
  } catch (error) {
    const { toast } = await import('@/lib/feedback/toast');
    toast.error('تعذر الطباعة', {
      description: error instanceof Error ? error.message : 'جرّب تاني.',
    });
  }
}
