# POS accounting and inventory matrix

Amounts below are the persisted order figures. Change is not revenue. `customer.balance` is a cache. The journal is the receivable.

| Operation | Journal | Stock | Drawer | Customer cache |
| --- | --- | --- | --- | --- |
| Cash sale | Debit safe, credit revenue and VAT, debit COGS, credit inventory | Outbound at average cost | Cash `amount`, not tendered | None |
| Bank or manual card sale | Debit bank GL | Outbound | Not drawer cash | None |
| Terminal card | No journal until provider status is `APPROVED` with a reference | None until post | None until post | None |
| Credit sale | Debit AR with the customer partner | Outbound | Not drawer cash | Increase by the credit amount |
| Split | One leg per settlement type | Outbound once | Only the cash settlement | Only the credit leg |
| Line discount | Tax is on the discounted base. Revenue is merchandise after discount | Outbound for the sold quantity | Net cash if paid in cash | Credit net if any |
| Order discount | Reduces net. Does not change line VAT | Unchanged | Net | Credit net |
| Gift line | Price 0, so no extra revenue. COGS and inventory still move | Outbound for the gift quantity | None from the gift itself | None |
| Return | Flips the sale legs. Cost is the original unit cost | Inbound | Cash refund reduces expected cash | Credit refund decreases the cache |
| Void | Contra journal stored as source type `POS-VOID`. Original journal stays posted | Inbound of the sold quantity, or outbound if voiding a return | Payments remain on the order but the order is no longer `POSTED`, so the drawer equation drops it | Credit cache reversed |
| Unpost | Original journal unposted in place. Order returns to `DRAFT` | Same direction as void | Payments deleted | Credit cache reversed |
| Cash in | Debit safe, credit the chosen account | None | Increases expected cash | None |
| Cash out | Credit safe, debit the chosen account | None | Decreases expected cash | None |
| Shortage | Debit shortage account, credit safe. The full counted difference | None | Variance is counted minus expected | None |
| Surplus | Debit safe, credit surplus account. The full counted difference | None | Same | None |
| Credit collection | Debit safe, credit AR | None | Not a sale | Decrease by the collected amount |

A void is refused when the shift is closed or when the sale still has a posted return. A second void does not post a second contra journal.
