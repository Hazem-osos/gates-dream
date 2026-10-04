# eReceipt lifecycle

1. POS financial posting commits.
2. If the terminal has an active eReceipt device, Gates validates and freezes a receipt. Checkout does not call ETA.
3. A frozen receipt inside the submission window is `QUEUED`. Older than the configured window (24 hours) and without `referenceOldUUID` is `LATE_WINDOW`. The issue time is not rewritten. A supervisor can record a late reason, which moves it to `QUEUED`.
4. The outbox drain claims `QUEUED` and `RETRYABLE` rows by updating them to `SUBMITTING` only while they still have the previous status.
5. Compatible receipts for one device and environment are packed, at most 500 and at most 1.5 MB.
6. `POST /api/v1/receiptsubmissions` with `{ receipts, signatures }`. HTTP 202 stores `submissionUUID` and marks accepted rows `SUBMITTED`. That is not `VALID`.
7. Status sync reads the submission or receipt details and stores `VALID`, `INVALID` or `CANCELLED`, plus the returned validation steps.

## Returns

A posted Gates return with an original sale uses receipt type `r` and that sale's UUID. The return amounts are the posted return lines as positive quantities. The original sale must be inside the 540-day window. If the sale has no frozen receipt, the return fails validation. It does not become `RWR`.

`RWR` is `POST /electronic-receipts/orders/:id/rwr` with a configured reason and the original sale time. A return that already has an original order is rejected.

## Correction

An `INVALID` receipt is kept. Correction clones the frozen JSON, applies only buyer or item-identity edits, keeps the invalid receipt's `previousUUID`, sets `referenceOldUUID` to the invalid UUID, and hashes a new UUID. The device chain head stays on the invalid receipt. Money fields cannot be patched. The new row is another generation of the same POS order. A network retry does not do this.

## Local states

`NOT_CONFIGURED` and `NOT_APPLICABLE` do not create a fiscal row. `VALIDATION_FAILED` has no UUID and does not move the chain. `RETRYABLE` waits until `nextAttemptAt`, including `Retry-After` on `DuplicateSubmission`. `CONFIG_FAILED` stops until the device or signing setup changes. `LOCAL_CANCELLED` is set when a posted order is voided or unposted before ETA has accepted it. A submitted receipt is not deleted by void or unpost.

## Signing

Receipt signing in the ETA documentation is a batch CAdES-BES signature, and the toolkit also says validation can be off for the deployed solution. Gates defaults `signingMode` to `DISABLED` and sends `signatures: []`. It does not invent a signature. `REQUIRED` refuses the submit until a real batch signature exists. eInvoice per-document signing is not reused.

## QR and print

The QR follows the issuance FAQ: `{portal}/receipts/search/{uuid}/share/{dateTimeIssued}#Total:{amount},IssuerRIN:{rin}`. The timestamp is the UTC issuance string and is not percent-encoded. The amount uses three decimal places. The host is the HTTPS portal from the existing ETA endpoint map (`https://invoicing.eta.gov.eg` or `https://preprod.invoicing.eta.gov.eg`). The FAQ sample uses `http`; Gates uses the HTTPS host already configured for the portal. Thermal print draws that URL only when a fiscal receipt produced it. A Gates summary string is not labeled as an ETA QR.
