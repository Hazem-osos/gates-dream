import { ERECEIPT_LIMITS } from './limits';

/** Group frozen receipt JSON texts. Same caller must already have restricted them to one POS. */
export function packSubmissionBatches(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let bytes = 64;
  for (const text of texts) {
    const size = Buffer.byteLength(text, 'utf8') + 1;
    const overflow =
      current.length >= ERECEIPT_LIMITS.maxReceiptsPerSubmission ||
      bytes + size > ERECEIPT_LIMITS.maxSubmissionBytes;
    if (overflow && current.length > 0) {
      batches.push(current);
      current = [];
      bytes = 64;
    }
    if (size > ERECEIPT_LIMITS.maxSubmissionBytes) {
      throw new Error('ERECEIPT_RECEIPT_TOO_LARGE');
    }
    current.push(text);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function submissionBody(texts: string[]): string {
  // Batch signature validation is not deployed. Official note on the submit page
  // and https://sdk.invoicing.eta.gov.eg/receipt-batch-signature-creation/
  // signatures stays empty unless signingMode REQUIRED, which refuses to submit.
  return `{"receipts":[${texts.join(',')}],"signatures":[]}`;
}
