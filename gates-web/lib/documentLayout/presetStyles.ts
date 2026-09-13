import type { DocumentLayoutConfig } from './types';
import { FONT_FAMILY_OPTIONS } from './types';

const MARGIN_MM: Record<DocumentLayoutConfig['marginSize'], number> = {
  COMPACT_8MM: 8,
  NORMAL_15MM: 15,
  WIDE_20MM: 20,
};

const PAGE_SIZE_CSS: Record<DocumentLayoutConfig['paperSize'], string> = {
  A4: 'A4',
  LETTER: 'letter',
  A5_LANDSCAPE: 'A5 landscape',
};

/** Approximate on-screen page box dimensions (px @96dpi) used for the live preview only. */
export const PAGE_BOX_PX: Record<DocumentLayoutConfig['paperSize'], { width: number; height: number }> = {
  A4: { width: 794, height: 1123 },
  LETTER: { width: 816, height: 1056 },
  A5_LANDSCAPE: { width: 794, height: 559 },
};

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function fontStackFor(fontFamily: string): string {
  const match = FONT_FAMILY_OPTIONS.find((f) => f.value === fontFamily);
  return match?.stack ?? `'${fontFamily}', 'Segoe UI', sans-serif`;
}

export function googleFontsLinkHref(fontFamily: string): string | null {
  const match = FONT_FAMILY_OPTIONS.find((f) => f.value === fontFamily);
  if (!match?.googleFont) return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(match.googleFont)}&display=swap`;
}

/** Header/decoration CSS driven by `layoutPreset`. Returns a `<style>`-ready fragment. */
function headerPresetCss(config: DocumentLayoutConfig): string {
  const { layoutPreset, primaryColor, secondaryColor } = config;
  switch (layoutPreset) {
    case 'BUBBLE':
      return `
        .gdl-header { background: ${hexToRgba(secondaryColor, 0.08)}; border-radius: 18px; padding: 16px 20px; }
        .gdl-doc-title-badge { background: ${primaryColor}; color: #fff; border-radius: 999px; padding: 4px 16px; display: inline-block; font-weight: 700; }
        .gdl-meta-box { border-radius: 14px; }
      `;
    case 'WAVE':
      return `
        .gdl-header { padding-bottom: 22px; position: relative; }
        .gdl-header::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 14px;
          background: ${primaryColor};
          border-radius: 0 0 50% 50% / 0 0 100% 100%;
        }
        .gdl-doc-title-badge { color: ${primaryColor}; font-weight: 800; border-bottom: 3px solid ${primaryColor}; padding-bottom: 2px; }
      `;
    case 'CORPORATE_DUAL':
      return `
        .gdl-header { border-top: 6px solid ${primaryColor}; border-bottom: 2px solid ${secondaryColor}; padding: 14px 4px 12px; }
        .gdl-doc-title-badge { background: ${secondaryColor}; color: #fff; padding: 3px 14px; font-weight: 700; }
      `;
    case 'MINIMAL_BORDER':
      return `
        .gdl-page { border: 1px solid ${hexToRgba(secondaryColor, 0.45)}; }
        .gdl-header { border-bottom: 1px solid ${hexToRgba(secondaryColor, 0.45)}; padding-bottom: 10px; }
        .gdl-doc-title-badge { color: ${primaryColor}; font-weight: 700; }
      `;
    case 'ARCHITECTURAL_GRID':
      return `
        .gdl-page {
          background-image:
            linear-gradient(${hexToRgba(secondaryColor, 0.16)} 1px, transparent 1px),
            linear-gradient(90deg, ${hexToRgba(secondaryColor, 0.16)} 1px, transparent 1px);
          background-size: 18px 18px;
        }
        .gdl-header { border: 1.5px solid ${primaryColor}; padding: 12px 16px; background: #fff; }
        .gdl-doc-title-badge { color: ${primaryColor}; font-weight: 800; letter-spacing: 0.5px; }
        .gdl-meta-box { border: 1.5px solid ${primaryColor} !important; background: #fff; }
        .gdl-meta-box td, .gdl-meta-box th { border: 1px solid ${hexToRgba(primaryColor, 0.55)} !important; }
      `;
    case 'LIGHT':
    default:
      return `
        .gdl-header { border-bottom: 2px solid ${primaryColor}; padding-bottom: 10px; }
        .gdl-doc-title-badge { color: ${primaryColor}; font-weight: 700; }
      `;
  }
}

/** Table CSS driven by `tableStyle`. */
function tableStyleCss(config: DocumentLayoutConfig): string {
  const { tableStyle, primaryColor, secondaryColor } = config;
  const base = `
    .gdl-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    .gdl-table th { background: ${primaryColor}; color: #fff; font-weight: 600; text-align: center; }
    .gdl-table th, .gdl-table td { padding: 6px 8px; text-align: center; }
    .gdl-table td:nth-child(2), .gdl-table th:nth-child(2) { text-align: right; }
  `;
  switch (tableStyle) {
    case 'BOXED':
      return `${base}
        .gdl-table th, .gdl-table td { border: 1px solid ${hexToRgba(secondaryColor, 0.55)}; }
      `;
    case 'STRIPED':
      return `${base}
        .gdl-table tbody tr:nth-child(even) { background: ${hexToRgba(secondaryColor, 0.08)}; }
        .gdl-table td { border-bottom: 1px solid ${hexToRgba(secondaryColor, 0.25)}; }
      `;
    case 'BUBBLE':
      return `${base}
        .gdl-table { border-collapse: separate; border-spacing: 0 5px; }
        .gdl-table th:first-child { border-radius: 8px 0 0 8px; }
        .gdl-table th:last-child { border-radius: 0 8px 8px 0; }
        .gdl-table tbody tr { background: ${hexToRgba(secondaryColor, 0.07)}; }
        .gdl-table tbody td:first-child { border-radius: 8px 0 0 8px; }
        .gdl-table tbody td:last-child { border-radius: 0 8px 8px 0; }
      `;
    case 'COMPACT':
      return `${base}
        .gdl-table th, .gdl-table td { padding: 3px 5px; font-size: 9.5px; }
        .gdl-table td { border-bottom: 1px solid ${hexToRgba(secondaryColor, 0.25)}; }
      `;
    case 'BORDERLESS':
      return `${base}
        .gdl-table th { background: transparent; color: ${primaryColor}; border-bottom: 2px solid ${primaryColor}; }
        .gdl-table td { border: none; }
        .gdl-table tbody tr:nth-child(even) { background: ${hexToRgba(secondaryColor, 0.05)}; }
      `;
    case 'LIGHT':
    default:
      return `${base}
        .gdl-table td { border-bottom: 1px solid ${hexToRgba(secondaryColor, 0.3)}; }
      `;
  }
}

/** Full <style> body for a printable document, purely derived from config. */
export function buildDocumentStyles(config: DocumentLayoutConfig): string {
  const marginMm = MARGIN_MM[config.marginSize] ?? 15;
  const pageSize = PAGE_SIZE_CSS[config.paperSize] ?? 'A4';
  const fontStack = fontStackFor(config.fontFamily);

  return `
    @page { size: ${pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${fontStack};
      color: ${config.textColor};
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .gdl-page {
      position: relative;
      background: #fff;
      width: 100%;
      min-height: 100%;
      overflow: hidden;
      padding: ${marginMm}mm;
    }
    .gdl-ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; }
    .gdl-header { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; z-index: 1; position: relative; }
    .gdl-header.logo-center { flex-direction: column; text-align: center; }
    .gdl-header.logo-right { flex-direction: row-reverse; }
    .gdl-logo { object-fit: contain; max-height: 90px; }
    .gdl-company-name-ar { font-size: 17px; font-weight: 800; margin: 0; }
    .gdl-company-name-en { font-size: 11px; color: ${config.secondaryColor}; margin: 2px 0 0; }
    .gdl-tagline { font-size: 10.5px; color: ${config.secondaryColor}; margin: 2px 0 0; }
    .gdl-header-ids { font-size: 10px; color: ${config.secondaryColor}; margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
    .gdl-doc-title-badge { font-size: 13px; display: inline-block; margin: 0 0 6px; }
    .gdl-meta-box { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 12px; border-radius: 8px; overflow: hidden; }
    .gdl-meta-box td { padding: 5px 9px; border-bottom: 1px solid ${hexToRgba(config.secondaryColor, 0.25)}; }
    .gdl-meta-box td.gdl-meta-label { color: ${config.secondaryColor}; font-weight: 600; white-space: nowrap; width: 1%; }
    .gdl-section-title { font-size: 12px; font-weight: 700; color: ${config.primaryColor}; margin: 14px 0 6px; }
    ${headerPresetCss(config)}
    ${tableStyleCss(config)}
    .gdl-totals-box { margin-top: 12px; page-break-inside: avoid; width: 100%; }
    .gdl-totals-box table { width: 45%; margin-inline-start: auto; border-collapse: collapse; font-size: 11px; }
    .gdl-totals-box td { padding: 4px 8px; }
    .gdl-totals-box tr.gdl-total-final td { font-weight: 800; font-size: 13px; color: ${config.primaryColor}; border-top: 2px solid ${config.primaryColor}; padding-top: 7px; }
    .gdl-bottom-grid { display: flex; gap: 18px; margin-top: 16px; page-break-inside: avoid; }
    .gdl-bank-block { flex: 1; font-size: 9.5px; }
    .gdl-bank-block h4 { font-size: 10.5px; margin: 0 0 4px; color: ${config.primaryColor}; }
    .gdl-qr-block { text-align: center; font-size: 9px; color: ${config.secondaryColor}; }
    .gdl-qr-placeholder { width: 96px; height: 96px; border: 1.5px dashed ${hexToRgba(config.secondaryColor, 0.6)}; display: flex; align-items: center; justify-content: center; border-radius: 8px; margin: 0 auto 4px; color: ${hexToRgba(config.secondaryColor, 0.8)}; }
    .gdl-signature-grid { display: grid; grid-template-columns: repeat(${Math.max(1, Math.min(4, config.signatureLabels?.length || 4))}, 1fr); gap: 10px; margin-top: 22px; page-break-inside: avoid; }
    .gdl-signature-cell { border-top: 1px solid ${config.textColor}; padding-top: 6px; text-align: center; font-size: 10px; }
    .gdl-signature-cell .gdl-sig-space { height: 34px; }
    .gdl-footer-text { margin-top: 16px; font-size: 9px; color: ${config.secondaryColor}; border-top: 1px solid ${hexToRgba(config.secondaryColor, 0.3)}; padding-top: 8px; white-space: pre-wrap; }
    .gdl-watermark {
      position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 76px; font-weight: 800; color: ${hexToRgba(config.primaryColor, 0.07)};
      z-index: 0; pointer-events: none; white-space: nowrap;
    }
    tr, .gdl-avoid-break, .gdl-totals-box, .gdl-signature-grid, .gdl-bottom-grid, .gdl-meta-box { page-break-inside: avoid; }
    .gdl-page + .gdl-page { page-break-before: always; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .gdl-page { min-height: 0; box-shadow: none; }
    }
  `;
}
