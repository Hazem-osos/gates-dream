import { resolveEtaEndpoints } from '../electronic-invoices/utils/eta-endpoints';
import { etaDateTime } from './uuid';

/**
 * Receipt QR from the issuance FAQ.
 * `{portal}/receipts/search/{UUID}/share/{dateTimeIssued}#Total:{amount},IssuerRIN:{rin}`
 * The published example does not percent-encode the timestamp.
 * https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/
 */
export function etaReceiptQrUrl(input: {
  environment: string;
  uuid: string;
  issuedAt: Date;
  totalAmount: number;
  issuerRin: string;
}): string {
  const { shareBaseUrl } = resolveEtaEndpoints({
    environment: input.environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION',
  });
  const issued = etaDateTime(input.issuedAt);
  const total = input.totalAmount.toFixed(3);
  return `${shareBaseUrl}/receipts/search/${input.uuid}/share/${issued}#Total:${total},IssuerRIN:${input.issuerRin}`;
}

export function isEtaReceiptQr(value: string | null | undefined): boolean {
  const text = String(value ?? '');
  return text.includes('invoicing.eta.gov.eg/receipts/search/') && text.includes('#Total:') && text.includes(',IssuerRIN:');
}
