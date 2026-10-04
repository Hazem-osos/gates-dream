# ETA official compliance matrix

Reviewed 1 Oct 2026 from the production SDK (`https://sdk.invoicing.eta.gov.eg/`) and the preproduction types index (`https://sdk.preprod.invoicing.eta.gov.eg/types/`). No third-party sources. Status is `SUPPORTED` when Gates already did the right thing, `FIXED` when this pass changed Gates to match a loaded page, and `NOT APPLICABLE` when the official field has no Gates business source and the page allows it to be omitted.

No official SHA-256 fixture with an expected digest was published on the pages that loaded. Serialization tests lock the official rules (empty `uuid`, uppercased names, repeated array names, raw numeric tokens, UTF-8 SHA-256, 64 hex characters).

## Pages loaded

| Topic | Official page |
| --- | --- |
| API index | https://sdk.invoicing.eta.gov.eg/ereceiptapi/ |
| Authenticate POS | https://sdk.invoicing.eta.gov.eg/ereceiptapi/01-authenticate-pos/ |
| Submit receipt | https://sdk.invoicing.eta.gov.eg/ereceiptapi/02-submit-receipt/ |
| Get receipt details | https://sdk.invoicing.eta.gov.eg/ereceiptapi/03-get-receipt-details/ |
| Types (production and preproduction) | https://sdk.invoicing.eta.gov.eg/types/ and https://sdk.preprod.invoicing.eta.gov.eg/types/ |
| Payment methods | https://sdk.invoicing.eta.gov.eg/codes/payment-methods/ |
| Tax types | https://sdk.invoicing.eta.gov.eg/codes/tax-types/ |
| Serialization | https://sdk.invoicing.eta.gov.eg/document-serialization-approach/ |
| Batch signature | https://sdk.invoicing.eta.gov.eg/receipt-batch-signature-creation/ |
| Issuance FAQ | https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/ |
| Receipt, return, RWR, and each industry v1.2 page | `https://sdk.invoicing.eta.gov.eg/documents/<type>-v1-2/` |
| May 2023 release | https://sdk.invoicing.eta.gov.eg/release-notes/May-2023-release/ |

The guessed code-table URLs for return-without-reference reasons and order delivery modes returned 404. The document pages still state the field rules. The printed RWR reason example is `I`. The page says two values and does not print the second value, so Gates does not invent it. A company stores the codes it was given.

## Receipt v1.2 fields

| ETA requirement | Source | Gates | Status |
| --- | --- | --- | --- |
| `dateTimeIssued` UTC `yyyy-MM-ddTHH:mm:ssZ` | Receipt v1.2, FAQ | `etaDateTime`, never rewritten to pass a window | SUPPORTED |
| `receiptNumber` unique per branch inside a submission | FAQ | Counter per company + environment + branch, separate from the device chain | SUPPORTED |
| `uuid` empty while hashing, then 64 hex | FAQ, serialization page | `receiptUuid` | SUPPORTED |
| `previousUUID` is the previous receipt of the same POS | FAQ | `eta_receipt_chains` on company + terminal + environment | SUPPORTED |
| `referenceOldUUID` on a corrected invalid receipt, and that receipt keeps the invalid receipt's `previousUUID` | FAQ resubmission example | Correction copies `previousUUID` and does not move `lastUuid` | FIXED |
| `currency` / `exchangeRate` when not EGP | Receipt v1.2 | Sent from the posted order and a foreign payment rate | SUPPORTED |
| `sOrderNameCode` optional | Receipt v1.2 | POS order number when present | SUPPORTED |
| `orderdeliveryMode` optional on `s` and `r`, mandatory on `SR` and `SC` | Retail and coffee pages | Omitted unless the company stored a mode. `SR`/`SC` fail validation without one | SUPPORTED |
| `grossWeight` / `netWeight` optional, kilograms | RWR and receipt pages | Omitted. Gates item weight has no unit, so a number would be a guess | NOT APPLICABLE |
| `receiptType` + `typeVersion` 1.2 | Each document page | Registry below. Default company issues `s` and `r` | SUPPORTED |
| Seller `rin`, trade name, branch code, address, device serial, activity | Receipt v1.2 | Device, branch, and company tax id. Readiness checks them before use | SUPPORTED |
| `syndicateLicenseNumber` optional | Receipt v1.2 | Sent only when the device has it | SUPPORTED |
| Buyer `B` / `P` / `F` | Receipt v1.2, FAQ | `buyer.ts`. No invented id. v1.2 threshold default 150000 EGP | SUPPORTED |
| `paymentNumber` optional | Receipt v1.2 | Card `providerRef` or payment reference, max 30, otherwise omitted | SUPPORTED |
| Item identity, quantity, price, `netSale`, `totalSale`, `total` | Receipt v1.2 | Posted POS line. Mismatch is a validation error | SUPPORTED |
| `commercialDiscountData` | Receipt v1.2, May 2023 rate field | Line discount. Percent included when the line stored one | SUPPORTED |
| `itemDiscountData` | Receipt v1.2 | Untaxed gift line | SUPPORTED |
| `additionalCommercialDiscount` / `additionalItemDiscount` | May 2023 release | Sent only when a second discount amount is supplied. POS has one line discount, so they stay omitted | SUPPORTED |
| `valueDifference` optional | Receipt v1.2 | Sent only when a caller supplies a non-zero value. Not used to force a total | SUPPORTED |
| `taxableItems` / `taxTotals` | Tax types page | POS sends the posted VAT line. The builder accepts another official tax only when its amount is already in the line total. Subtypes `T1`–`T20` are checked and never rewritten | FIXED |
| `totalSales`, discounts, `netAmount`, `totalAmount`, `paymentMethod` | Receipt v1.2 | Reconciled to the posted order | SUPPORTED |
| `extraReceiptDiscountData` | Receipt v1.2 | Order discount above the sum of line discounts | SUPPORTED |
| `feesAmount` and `adjustment` accept only zero | Receipt v1.2 | Omitted. Not used as plugs | NOT APPLICABLE |
| `contractor` / `beneficiary` optional | Receipt v1.2 | No Gates POS source. Omitted | NOT APPLICABLE |

## Active v1.2 receipt types

Production and preproduction type indexes list the same v1.2 families. Versions 1.0 and 1.1 are retired and are not registered.

| Code | Kind | Gates default | Class |
| --- | --- | --- | --- |
| `s` | Sale | On | Normal retail |
| `r` | Return of `s` | On | Normal retail |
| `RWR` | Return without reference | Off | Used only when the original sale predates adoption or was not issued in Egypt, and the company stored a reason |
| `SR` / `RR` | Retail sale / return | Off | Industry. `SR` requires `orderdeliveryMode` |
| `SC` / `RC` | Coffee and restaurant | Off | Industry. `SC` requires `orderdeliveryMode` |
| `SS` / `RS` | General services | Off | Industry |
| `ST` / `RT` | Transportation | Off | Industry |
| `SH` / `RH` | Shipping | Off | Industry |
| `SP` / `RP` | Professional | Off | Industry |
| `SB` / `RB` | Banking | Off | Industry |
| `SE` / `RE` | Education | Off | Industry |
| `SN` / `RN` | Entertainment | Off | Industry |
| `SU` / `RU` | Utility | Off | Industry |

While `s` or `r` is enabled, POS issues those codes. An industry code is issued only when it is the single enabled code of that kind. A linked Gates return never becomes `RWR`.

## UUID, chain, and receipt number

| Rule | Source | Gates | Status |
| --- | --- | --- | --- |
| Include `previousUUID`. Include `referenceUUID` on a return. Empty `uuid`. Serialize. SHA-256. 64 hex | FAQ | Existing serializer, receipt document only. eInvoice serializer unchanged | SUPPORTED |
| Chain belongs to the POS, not the branch | FAQ “first receipt issued from this POS”; one POS per submission | Device + environment lock. Two devices do not share or block a chain | SUPPORTED |
| `receiptNumber` unique per branch in a submission | FAQ | Stronger counter: company + environment + branch | SUPPORTED |
| Correction does not advance the chain | FAQ example R1, invalid R2, R3, corrected R2* | `correction.service.ts` | FIXED |
| Retry sends the same frozen JSON and UUID | FAQ / duplicate submission | Outbox retry. `DuplicateSubmission` uses `Retry-After` and does not mint a receipt | SUPPORTED |

## Payments, tax, discounts, buyer

| Rule | Source | Gates | Status |
| --- | --- | --- | --- |
| `C` `V` `CC` `VC` `VO` `PR` `GC` `P` `O` | Payment methods page | Central map. `CC` `VC` `PR` only through an explicit valid override. Split of different codes is `O` because the schema has one `paymentMethod`. POS payment rows stay stored | SUPPORTED |
| Subtype only with its tax type. `T1`–`T20` | Tax types page | `taxSubtypeBelongs`. Invalid codes are not repaired | FIXED |
| Buyer `P` below 150000 EGP may omit the national id on v1.2. `B` needs RIN and name and must not be the issuer. `F` needs the stored foreign id | FAQ and receipt page | `buyer.ts` | SUPPORTED |

## Return, RWR, correction, time, QR

| Rule | Source | Gates | Status |
| --- | --- | --- | --- |
| Return `referenceUUID` is the original frozen sale UUID. Window 540 days | FAQ, return page | Server loads the original receipt. Browser cannot supply the UUID | SUPPORTED |
| RWR is international or a sale not captured by the system. `documentUseReason` and `salesIssuedDateTime` are mandatory | RWR v1.2, submit API | Disabled until the company stores reason codes. Linked returns are rejected | SUPPORTED |
| Invalid receipt stays. New generation, new UUID, `referenceOldUUID` | FAQ | Correction path. Network retry is not a correction | FIXED |
| Normal window 24 hours. Future issuance forbidden. Late request is an ETA profile workflow, not a receipt field | FAQ | Original `dateTimeIssued` kept. A stored reason re-queues the same receipt and clears the POS token cache before submit. Gates does not call a late-request API because the loaded API index has none | SUPPORTED |
| QR `{portal}/receipts/search/{uuid}/share/{dateTimeIssued}#Total:{amount},IssuerRIN:{rin}` | FAQ | Dedicated builder. Timestamp is not percent-encoded. Total has 3 decimals. Host is the HTTPS portal already configured for production and preproduction. The FAQ sample prints `http` | FIXED |

## Authentication, submission, signature, status

| Rule | Source | Gates | Status |
| --- | --- | --- | --- |
| `POST /connect/token` with `posserial`, `pososversion`, `posmodelframework`, `presharedkey`, and body `client_credentials` + client id/secret. No POS scope | Authenticate POS | `requestPosToken`. Secrets stay on the server. `posModelFramework` rejected above 10 characters | SUPPORTED |
| Identity hosts | Existing endpoint map confirmed against the SDK hosts | Preproduction `https://id.preprod.eta.gov.eg/connect/token`, production `https://id.eta.gov.eg/connect/token` | SUPPORTED |
| `POST /api/v1/receiptsubmissions`. HTTP 202 is accepted for processing, not `VALID` | Submit page | `SUBMITTED` until status sync | SUPPORTED |
| Max 500 receipts and 1.5 MB. Same POS in one submission. Max 300 lines | FAQ and submit page | Count and `Buffer.byteLength` | SUPPORTED |
| Batch CAdES-BES is specified, and the same pages say signature validation will not be deployed until ETA decides | Batch signature page, FAQ, and the note on the submit page | `signatures: []` while `signingMode` is `DISABLED`. `REQUIRED` refuses an unsigned batch. No fake signature and no eInvoice per-document signature | SUPPORTED |
| Details include Valid, Invalid, Cancelled, and validation steps with code, path, message, and inner errors | Get receipt details | `flattenEtaErrors` stores them. They are not collapsed into a generic 500 | SUPPORTED |
| `DuplicateSubmission` within 10 minutes returns `Retry-After` | Submit page | Same frozen receipt is retried after the delay | SUPPORTED |

## Offline

A browser does not allocate `previousUUID`. The financial POS sale can complete offline. The fiscal receipt is created on the server when that posted order is synced, under the device row lock. Two browsers for one ETA device cannot publish two chain heads. That separation is the supported behavior.

## External only

These are not software gaps:

- ETA taxpayer B2C tag, POS activation, client id, client secret, and preshared key.
- A physical signing token if ETA later deploys batch signature validation. Software already refuses unsigned submit when the company sets `REQUIRED`.
- The ETA portal late-submission request. No create-request API was on the loaded eReceipt API index.
- A live preproduction submission, which needs activated credentials and was not sent.
