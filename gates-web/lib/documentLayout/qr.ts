import type { PreviewMockData } from './mockData';

/** Builds the ZATCA/ETA-style QR payload string for a mock document. */
export function buildQrPayload(data: PreviewMockData): string {
  if (data.kind === 'TAX_INVOICE') {
    return [
      `Seller: ${data.sellerName}`,
      `VAT#: ${data.sellerTaxId}`,
      `Date: ${data.etaSubmissionDate}`,
      `Total: ${data.grandTotal.toFixed(2)} ${data.currency}`,
      `VAT: ${data.totalTax.toFixed(2)} ${data.currency}`,
      `UUID: ${data.etaUuid}`,
    ].join('\n');
  }
  if (data.kind === 'CONTRACTOR_INVOICE') {
    return `EXT:${data.documentNo}|DATE:${data.documentDate}|NET:${data.netPayable.toFixed(2)} ${data.currency}`;
  }
  return `RCV:${data.documentNo}|DATE:${data.documentDate}|AMT:${data.amountPaidNow.toFixed(2)} ${data.currency}`;
}

/** Generates a base64 PNG data URL for the given payload (client-side only). */
export async function buildQrDataUrl(
  payload: string,
  options?: { width?: number; margin?: number }
): Promise<string> {
  const { default: QRCode } = await import(/* webpackChunkName: "qrcode" */ 'qrcode');
  return QRCode.toDataURL(payload, {
    width: options?.width ?? 200,
    margin: options?.margin ?? 1,
  });
}
