'use client';

import { useCallback } from 'react';
import { renderPrintableAndOpen } from '@/app/components/print/PrintDocumentButton';
import { PrintDocumentRenderer } from '@/components/documentLayout/PrintDocumentRenderer';
import { printHtml } from '@/lib/print/printHtml';
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

export function usePrintDocument() {
  const printDocument = useCallback(async (data: PreviewMockData, config: DocumentLayoutConfig) => {
    await preloadDocumentFonts(config.fontFamily);
    const qrDataUrl = config.showQrCode ? await buildQrDataUrl(buildQrPayload(data)) : null;
    const html = generateDocumentHtml(data, config, { qrDataUrl });
    await printHtml(html);
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
    await printHtml(html);
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
