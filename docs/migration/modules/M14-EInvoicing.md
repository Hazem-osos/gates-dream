# M14 — Electronic Invoicing & E-Receipt (ETA)

## Scope

| Area | Implementation |
|------|----------------|
| **M5 → ETA JSON** | `EInvoicePayloadBuilderService.buildFromM5Invoice` (types I/C/D, T1 VAT, EGS/GS1 codes) |
| **M6 → E-Receipt** | `buildFromPosOrder` receipt payload |
| **Submission** | `EInvoiceSubmissionService` + `MockEtaClient` (token, submit, status, cancel) |
| **Idempotency** | SHA-256 `contentHash` unique per company; blocks duplicate VALID/SUBMITTED |
| **Lifecycle** | `DRAFT` → `PENDING_SIGNATURE` → `VALID`/`INVALID` → `CANCELLED` (72h window) |

## Schema (`20250816200000_wave2_m14_einvoice`)

- **`EInvoiceSetting`** — ETA credentials, issuer tax ID, activity code, environment
- **`EInvoiceDocument`** — links `invoiceId` / `posOrderId`, UUIDs, raw payload, responses

Legacy `ElectronicInvoice*` card tables remain for item/customer ETA codes.

## API

Mounted on `/api/v1/electronic-invoices`:

| Method | Path |
|--------|------|
| POST | `/submit/:invoiceId` — M5 posted invoice |
| POST | `/submit-receipt/:posOrderId` — M6 posted order |
| GET | `/status/:documentUuid` |
| POST | `/cancel/:documentUuid` |
| GET | `/preview/:invoiceId` — payload only |
| GET/PUT | `/settings` — existing routes (now persisted) |

## Test

```bash
npm run test:wave2-einvoice
```

Set `ETA_USE_LIVE_CLIENT=true` when real ETA HTTP client is wired (not yet in this build).

## Follow-ups

- PKCS#11 / token signing (`tokenPin`), production OAuth endpoints
- Credit/debit notes linked via `originalDocumentUuid`
- Webhook polling for INVALID rejection details
