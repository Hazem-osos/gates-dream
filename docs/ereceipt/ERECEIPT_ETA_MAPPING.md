# ETA receipt mapping

Receipt version is `1.2`. Sale `receiptType` is `s`. A Gates return that points at a posted sale is `r` and sets `header.referenceUUID` to the original sale receipt UUID. `RWR` is only the explicit supervisor action, and only when the return has no original order and the reason code is configured. It is not used when the original UUID is missing.

## Money

Line `totalSale` is quantity times unit price. A normal line discount is `commercialDiscountData`. A gift line with no tax uses `itemDiscountData` for that discount. `netSale` is `totalSale` minus those discounts. Line `total` is `netSale` plus the stored tax. Header `totalAmount` subtracts an extra receipt discount when the order discount is larger than the sum of line discounts.

`feesAmount` and `adjustment` are not sent. ETA currently accepts only zero, and Gates does not use them as fee fields.

The builder rejects the receipt when the line total or the receipt total does not match the posted POS amounts. It does not rewrite those amounts.

## Tax, items, units

VAT on a POS line uses the existing ETA table: `T1` / `V009` when tax is present, `T1` / `V002` when the rate is zero. The receipt builder also accepts extra `taxableItems` when a caller supplies an amount that is already inside the line total. POS issuance sends the VAT stored on the posted line and does not invent a second tax amount from the eInvoice item profile. Subtype membership is checked against the full official tax-type table (`T1`–`T20`). An unknown or mismatched subtype is rejected and is not rewritten. A second tax of the same type on one line is rejected.

Item codes must already be GS1 or EGS. Unit codes must already be the ETA unit code stored on the item profile or the unit. Arabic unit names are not translated.

## Payments

| Gates method | ETA code |
| --- | --- |
| CASH | C |
| CARD | V |
| VOUCHER | VO |
| GIFT_CARD | GC |
| POINTS | P |
| STORE_CREDIT, WALLET, BANK, CREDIT, EXCHANGE, DEPOSIT | O |

`CC`, `VC` and `PR` are not assigned automatically. A company `paymentMap` may set them explicitly. Two different ETA codes on one sale become `O`.

## Buyer

`B` needs a 9-digit registration and a name. `P` needs a 14-digit national id and a name only at or above the company threshold, which defaults to the 150000 EGP figure on Receipt v1.2. `F` is used for an export customer or a non-Egyptian nationality and needs the identification already stored. Missing ids are a validation error.

## Seller

RIN, trade name, ETA branch code, activity code, device serial and branch address come from the terminal device, the branch and the existing company ETA identity. The browser cannot choose another company's device.
