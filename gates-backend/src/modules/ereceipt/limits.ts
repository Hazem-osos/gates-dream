/**
 * Official ETA receipt constraints, kept in one place.
 * Sources: Receipt v1.2, the receipt issuance FAQ, and the submit-receipt API.
 */
export const ERECEIPT_LIMITS = {
  typeVersion: '1.2',
  minReceiptsPerSubmission: 1,
  maxReceiptsPerSubmission: 500,
  maxSubmissionBytes: 1_500_000,
  maxLinesPerReceipt: 300,
  /** Documented normal submission window after dateTimeIssued. */
  submissionWindowMs: 24 * 60 * 60 * 1000,
  /** Documented maximum age of the original sale for a referenced return. */
  returnWindowMs: 540 * 24 * 60 * 60 * 1000,
  /** Receipt v1.2 buyer identity threshold for a natural person. Configurable per company. */
  defaultBuyerIdentityThresholdEgp: 150_000,
  maxPosSerialLength: 100,
  maxReceiptNumberLength: 50,
  staleSubmittingMs: 5 * 60 * 1000,
} as const;

export const ERECEIPT_PATHS = {
  submit: '/api/v1/receiptsubmissions',
  submission: (submissionUuid: string) => `/api/v1/receiptsubmissions/${encodeURIComponent(submissionUuid)}`,
  details: (uuid: string) => `/api/v1/receipts/${encodeURIComponent(uuid)}/details`,
  raw: (uuid: string) => `/api/v1/receipts/${encodeURIComponent(uuid)}/raw`,
  search: '/api/v1/receipts/search',
} as const;
