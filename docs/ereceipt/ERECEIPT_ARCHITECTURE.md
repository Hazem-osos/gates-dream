# eReceipt architecture

Gates fiscal receipts are a separate document from both the POS order and the eInvoice document.

`PosOrder` remains the financial and inventory source of truth. Posting it moves stock, posts the journal and updates the customer balance. After that commit, Gates may freeze an ETA Receipt v1.2. That freeze does not post stock, a journal, a payment or a customer balance again.

The fiscal row is `EtaReceipt`. Its status is not `PosOrder.status`. A posted sale can have a receipt that is still `QUEUED`, `SUBMITTED`, `VALID`, `INVALID` or another local state.

## What is reused

- POS money already stored on the order, lines and payments. The builder does not trust the browser cart.
- The existing ETA document serializer (`serializeEtaJsonText`) as the hash input. The eInvoice serializer is not modified.
- ETA endpoint host resolution (`resolveEtaEndpoints`) for pre-production and production hosts.
- Item GS1/EGS checks and the VAT tax-type table already used for Egyptian codes.
- AES-GCM `encrypt` / `decrypt` for the POS client secret and pre-shared key.
- BullMQ when `REDIS_ENABLED` is on. The durable queue is still the `eta_receipts` outbox, so a replica claims a row with a conditional update before calling ETA.

eInvoice canonicalization, CAdES, submission URLs and prepared-document behavior are unchanged.

## Modules

`gates-backend/src/modules/ereceipt/`

- `document.ts` builds and validates the receipt.
- `uuid.ts` hashes it.
- `issue.service.ts` allocates `previousUUID` and the receipt number inside one transaction.
- `submit.service.ts` batches and submits.
- `correction.service.ts` creates a new receipt with `referenceOldUUID`.
- `routes.ts` is the admin API under `/api/v1/electronic-receipts`.

Retail types in the registry are `s`, `r` and `RWR`, all version `1.2`. Only `s` and `r` are enabled by default. A company turns other registry codes on in `EtaReceiptSetting`. No extra industry type is enabled, because the types catalog page did not load during implementation.

## Environments

`PREPRODUCTION` and `PRODUCTION` are stored on the device, the setting and every receipt. Submission uses the device row for that same environment. A receipt is never moved to the other host.
