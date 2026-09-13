'use client';

import { generateDocumentPageInner } from '@/lib/documentLayout/templateEngine';
import { buildDocumentStyles, googleFontsLinkHref } from '@/lib/documentLayout/presetStyles';
import type { DocumentLayoutConfig } from '@/lib/documentLayout/types';
import type { PreviewMockData } from '@/lib/documentLayout/mockData';

export interface PrintDocumentRendererProps {
  data: PreviewMockData;
  config: DocumentLayoutConfig;
  qrDataUrl?: string | null;
}

/**
 * React wrapper around the HTML/CSS print engine. Preview iframe and print
 * output share `generateDocumentHtml` / `generateDocumentPageInner` so they
 * stay pixel-identical.
 */
export function PrintDocumentRenderer({ data, config, qrDataUrl }: PrintDocumentRendererProps) {
  const html = generateDocumentPageInner(data, config, { qrDataUrl });
  const styles = buildDocumentStyles(config);
  const fontHref = googleFontsLinkHref(config.fontFamily);

  return (
    <div className="gdl-print-root" dir="rtl">
      {fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
