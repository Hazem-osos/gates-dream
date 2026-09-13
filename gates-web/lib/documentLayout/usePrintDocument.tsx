'use client';

import { useCallback } from 'react';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import { PrintDocumentRenderer } from '@/components/documentLayout/PrintDocumentRenderer';
import { FONT_FAMILY_OPTIONS, type DocumentLayoutConfig } from './types';
import type { PreviewMockData } from './mockData';
import { buildQrDataUrl, buildQrPayload } from './qr';
import { generateDocumentHtml, generateDocumentPageInner, wrapDocumentHtml } from './templateEngine';
import { googleFontsLinkHref } from './presetStyles';

export async function preloadDocumentFonts(fontFamily: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const href = googleFontsLinkHref(fontFamily);
  if (href && !document.querySelector(`link[data-gdl-print-font="${fontFamily}"]`)) {
    await new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-gdl-print-font', fontFamily);
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  }
  const families = FONT_FAMILY_OPTIONS.map((f) => f.value);
  if (document.fonts?.ready) {
    try {
      await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]);
      if (families.includes(fontFamily)) {
        await document.fonts.load(`600 16px "${fontFamily}"`).catch(() => undefined);
      }
    } catch {
      /* ignore font load failures — print still proceeds */
    }
  }
}

async function printHtmlInIframe(html: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  try {
    if (doc.fonts?.ready) {
      await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    }
  } catch {
    /* ignore */
  }

  await new Promise((r) => setTimeout(r, 80));

  const cleanup = () => {
    win.removeEventListener('afterprint', cleanup);
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup);
  win.focus();
  win.print();
  window.setTimeout(cleanup, 60_000);
}

export function usePrintDocument() {
  const printDocument = useCallback(async (data: PreviewMockData, config: DocumentLayoutConfig) => {
    await preloadDocumentFonts(config.fontFamily);
    const qrDataUrl = config.showQrCode ? await buildQrDataUrl(buildQrPayload(data)) : null;
    const html = generateDocumentHtml(data, config, { qrDataUrl });
    await printHtmlInIframe(html);
  }, []);

  const printDocuments = useCallback(async (items: Array<{ data: PreviewMockData; config: DocumentLayoutConfig }>) => {
    if (!items.length) return;
    await preloadDocumentFonts(items[0].config.fontFamily);
    const pages = await Promise.all(
      items.map(async ({ data, config }) => {
        const qrDataUrl = config.showQrCode ? await buildQrDataUrl(buildQrPayload(data)) : null;
        return generateDocumentPageInner(data, config, { qrDataUrl });
      })
    );
    const html = wrapDocumentHtml(pages.join(''), items[0].config, 'مستندات');
    await printHtmlInIframe(html);
  }, []);

  const printReactDocument = useCallback(
    async (data: PreviewMockData, config: DocumentLayoutConfig) => {
      await preloadDocumentFonts(config.fontFamily);
      const qrDataUrl = config.showQrCode ? await buildQrDataUrl(buildQrPayload(data)) : null;
      renderPrintableAndOpen(() => (
        <PrintDocumentRenderer data={data} config={config} qrDataUrl={qrDataUrl} />
      ));
    },
    []
  );

  return { printDocument, printDocuments, printReactDocument, preloadDocumentFonts };
}
