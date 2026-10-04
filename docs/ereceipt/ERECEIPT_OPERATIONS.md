# eReceipt operations

## Before the first live receipt

Open الإيصالات الإلكترونية and check readiness: registration number, an active device, serial, branch code, OS version, model and activity code. Item GS1/EGS codes and ETA unit codes must already be on the items. Payment methods use the mapping in `ERECEIPT_ETA_MAPPING.md`.

Save the device in pre-production first. Production is a separate device row and a separate setting. Do not point a pre-production receipt at production.

## What the cashier sees

After a posted sale the receipt shows one fiscal line: قيد الإرسال, تم الإرسال, صالح, or يتطلب مراجعة. The cashier does not retry ETA. A supervisor uses the admin screen.

## Queue

With Redis enabled, the worker process registers `ereceipt-drain` every 30 seconds. Without Redis, each new queued receipt still kicks a drain, and an administrator can post `/api/v1/electronic-receipts/queue/drain`. The claim is a conditional status update, so two drains do not submit the same receipt.

Retryable failures wait and then use the same frozen text. Invalid schema, item, tax, buyer, total, UUID or device errors stay stopped. `DuplicateSubmission` honors `Retry-After` and does not create another fiscal receipt.

## Status and errors

Sync loads ETA validation steps. The detail screen shows the property path, code and message, for example a tax subtype that does not belong to its tax type, rather than only "rejected".

## Limits

Centralized in `ERECEIPT_LIMITS`: 1–500 receipts, 1.5 MB, 300 lines, 24-hour submission window, 540-day return window, POS serial at most 100 characters, buyer threshold default 150000 EGP.

## Not verified against a live ETA device

Token headers, submission HTTP 202, asynchronous Valid/Invalid and the QR host are implemented from the Receipt v1.2 page and the published API shape. The eReceipt API, issuance FAQ, batch-signature and types pages timed out while this was written, so those calls still need a real pre-production POS activation before they are treated as proven. Gates does not fabricate a successful ETA response.

This change is not deployed and does not migrate production.
