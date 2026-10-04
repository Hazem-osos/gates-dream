# UUID and previousUUID

## UUID

The receipt UUID is not random. `header.uuid` is set to an empty string, the receipt JSON is passed through the ETA document serializer (uppercase names, quoted values, array names repeated), and the UTF-8 bytes are SHA-256. The digest is 64 lowercase hex characters and is then written into `header.uuid`.

The exact `submitText` is stored. A retry sends that text. Gates does not rebuild it from later item or customer edits.

The serializer function is the one eInvoice already uses. This change does not alter its output. Receipt hashing is a separate call on a receipt document.

No official worked example with a published digest was available from the pages that loaded. The unit test locks a Gates fixture: the same document hashes the same way, and one changed quantity changes the hash. The hash input contains an empty UUID field.

## previousUUID

Each ETA device has one chain: `eta_receipt_chains` for `(companyId, terminalId, environment)`.

Inside one database transaction Gates:

1. Locks the branch receipt-number row with `SELECT ... FOR UPDATE`.
2. Locks the device chain row with `SELECT ... FOR UPDATE`.
3. Builds the receipt with `previousUUID` equal to `lastUuid` (empty only for the first receipt).
4. Hashes it.
5. Inserts the fiscal row and sets `lastUuid` to the new hash.

A second sale on the same device waits on the lock. If the insert loses a uniqueness race, the transaction rolls back the chain movement.

A referenced return takes the next link on the same device. A correction does not. The issuance FAQ says the corrected receipt keeps the invalid receipt's `previousUUID`, sets `referenceOldUUID` to the invalid UUID, and later receipts stay pointed at the invalid UUID. Gates copies `previousUUID` from the invalid row and does not change `lastUuid`.

Receipt numbers come from `eta_receipt_numbers` per company, environment and branch. That counter is separate from the device chain. Two terminals in one branch do not share `previousUUID` and do not reuse a receipt number.

Offline sales allocate the chain when the server posts the order. Two offline clients for the same device are serialized by the same lock. The issuance time stays the order's posted time. The chain follows server allocation order, which is the order the sales are committed.
