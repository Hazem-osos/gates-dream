# POS permissions

Resource is `pos`. An admin wildcard still passes every action. A cashier grant of `view`, `edit`, and `post` does not include the rows below.

| Action | What it allows |
| --- | --- |
| `view` | Catalog, receipts list, reports, settings read, audit read, credit read |
| `edit` | Open and close a session, cash in and out, hold, terminal and policy edits, approval requests |
| `post` | Post a sale, post a return, sync an offline sale, collect credit |
| `discount` | Send a manual line or order discount. The server still rejects it without this flag |
| `override_tier_price` | Send a price that is not the resolved price. Also accepted from `invoice` |
| `reprint` | `GET /pos/orders/:id/receipt`. The first copy is on the post response |
| `unpost` | Return a posted order to draft. Not a void |
| `void` | Cancel a posted order into `VOIDED` |
| `reopen_shift` | Reopen a closed session |
| `approve` | Decide another user's approval, and close a session whose variance is above the company tolerance |

Discount above `discountApprovalPercent` also needs an approved request whose approver is not the cashier. Variance above `varianceTolerance` needs `approve` or an approval from another user. The variance journal is still the real difference.
