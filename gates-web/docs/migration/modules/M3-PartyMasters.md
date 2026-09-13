# M3 — Party Masters (AR / AP & Related Persons)

## 1. Module Overview & Legacy Source Analysis

### Domain scope

Master data for trading partners: **customers** (AR), **suppliers** (AP), generic **persons**, **sellers/delegates**, **distributors**, **drivers**, person groups, person-specific item pricing, customer categories, and links to GL accounts and credit warnings. Feeds sales/purchase invoices (M5), cash (M2), real estate (M12), and electronic invoice customers (M14).

### Key Delphi files

| Area | Units |
|------|--------|
| Customers | [untCustomer.pas](../../../../MainProgram/untCustomer.pas), [UntSpecialCustomerContract.pas](../../../../MainProgram/UntSpecialCustomerContract.pas) |
| Suppliers | [untSupplier.pas](../../../../MainProgram/untSupplier.pas) |
| Persons | [untPerson.pas](../../../../MainProgram/untPerson.pas), [untChartOfPersons.pas](../../../../MainProgram/untChartOfPersons.pas), [untPersonGroup.pas](../../../../MainProgram/untPersonGroup.pas) |
| Sales staff | [untSeller.pas](../../../../MainProgram/untSeller.pas) |
| Distribution | [untDistributor.pas](../../../../MainProgram/untDistributor.pas), [UntDistPaymentsAll.pas](../../../../MainProgram/UntDistPaymentsAll.pas), [UntDistCash.pas](../../../../MainProgram/UntDistCash.pas) |
| Person pricing | [UntPersonItems.pas](../../../../MainProgram/UntPersonItems.pas), [untPersonItemsValues.pas](../../../../MainProgram/untPersonItemsValues.pas) |
| Reports | [UntSTPersonRep.pas](../../../../MainProgram/UntSTPersonRep.pas), [untSTPersonOptions.pas](../../../../MainProgram/untSTPersonOptions.pas) |

### Underlying database tables

| Table | Purpose |
|-------|---------|
| `Customer`, `Customer1`, `CustomerCategory` | Customer master (+ possible shadow/archive) |
| `Supplier` | Supplier master |
| `Person`, `PersonGroup` | Person chart & grouping |
| `PersonItems`, `PersonItemsValuesH`, `PersonItemsValuesD` | Customer-specific item prices |
| `Seller` | Sales representatives (maps to delegates) |
| `Distributor`, `Driver` | Logistics / wholesale channel |
| `GroupSales` | Group sales policies |
| `SalesPolicyH`, `SalesPolicyD` | Pricing/sales rules (cross M5) |
| `SpecialCustomerContractH`, `SpecialCustomerContractD` | Contract pricing |

Column metadata: [DataBase.ini `[Customer]`, `[Supplier]`, `[Person]`](../../../../MainProgram/DataBase.ini).

---

## 2. Business Logic, Formulas & Accounting Rules

### Core operations & flows

1. **Create customer/supplier:** Assign codes, link **main GL account** (`AccountCode`), optional cost center, currency, credit **warning** (debit/credit/none), price list, delegate/seller.
2. **Person chart:** Hierarchical persons used where invoice allows “person” instead of customer (depending on company setup).
3. **Person item values:** Header/detail per person + item + unit with special prices/discounts—used when pricing sales documents.
4. **Distributor/driver:** Master for distribution invoices and cash settlement ([UntDistPaymentsAll](../../../../MainProgram/UntDistPaymentsAll.pas)—settlement in M2).
5. **Balance display:** Customer/supplier running balance often derived from posted GL / open invoices—not always stored; web `Customer.balance` is a simplified field to reconcile.

### Calculations & math

- **Credit limit / warning:** Typically comparison of current balance vs `EstimatedBudget` or warning side (مدين/دائن)—enforce on invoice save in M5 (grep `untCustomer` / `untRInovice` during M5 doc).
- **Person item price:** Line net = f(base price list, person override, quantity)—document in M5; M3 stores overrides only.
- **Multi-currency:** Party currency + exchange from M1 `CurrencyHistory` at invoice date.

### Accounting & journal entry generation

M3 masters **do not post** by themselves; they supply **default accounts**:

| Master | Typical GL link |
|--------|-----------------|
| Customer | AR control account on `Customer` |
| Supplier | AP control account |
| Distributor | Distinct AR/AP or clearing (company setting) |

Invoice posting (M5) debits/credits these control accounts.

### Validation rules & edge cases

- Duplicate codes within company/branch scope.
- Inactive or deleted customers blocked on new invoices (`Deleted='F'` pattern).
- `Customer1` table—verify if staging or alternate; include in import mapping.
- Real-estate fields on customer (contact date, marketing channel)—already partially on Prisma `Customer` in [schema.prisma](../../../gates-backend/prisma/schema.prisma).
- **Electronic invoice customer** is separate table in legacy (`EInvoice` module)—keep sync rules documented in M14; avoid duplicate divergent masters long term.

---

## 3. Architecture Modernization & Refactoring Plan

### Legacy smells

- Overlapping customer concepts (accounting customer vs e-invoice customer vs BL customer).
- Person/item price in wide denormalized grids.
- Distributor payments spread across many forms.

### Target architecture

| Service | Scope |
|---------|--------|
| `CustomerService` | CRUD, account link validation |
| `SupplierService` | CRUD |
| `PartyPricingService` | PersonItemsValues |
| `DistributorService` / `DriverService` | Channel masters |
| `PartyAccountResolver` | Resolve GL account for posting |

**Repository:** Prisma with `companyId`; optional `legacyCode` unique per company.

**DTO + Zod:** Match nvarchar lengths from ini; normalize phone/tax IDs.

**Transactions:** Create customer + default person link in one transaction when required.

---

## 4. Target Prisma Models & Data Schema

Existing: `Customer`, `Supplier`, `Delegate`, `Distributor`, `Driver`.

Add / extend:

```prisma
model Person {
  id            String   @id @default(uuid())
  companyId     String
  legacyCode    String
  arabicName    String
  englishName   String?
  personGroupId String?
  mainAccountId String?
  isActive      Boolean  @default(true)
  @@unique([companyId, legacyCode])
  @@map("persons")
}

model PersonGroup {
  id         String @id @default(uuid())
  companyId  String
  legacyCode String
  arabicName String
  @@unique([companyId, legacyCode])
  @@map("person_groups")
}

model PersonItemPrice {
  id           String  @id @default(uuid())
  companyId    String
  personId     String
  itemId       String
  unitId       String?
  price        Decimal @db.Decimal(18, 4)
  discountPct  Decimal? @db.Decimal(18, 4)
  validFrom    DateTime?
  validTo      DateTime?
  @@index([companyId, personId, itemId])
  @@map("person_item_prices")
}

model CustomerCategory {
  id         String @id @default(uuid())
  companyId  String
  legacyCode String
  arabicName String
  @@unique([companyId, legacyCode])
  @@map("customer_categories")
}
```

Extend `Customer` / `Supplier` with:

- `legacyCode` (maps `CustomerCode` / supplier code)
- `warningSide` enum (debit/credit/none)
- `creditLimit` Decimal(18,4)

---

## 5. API Endpoint Specifications

| Method | Route | Notes | Permission |
|--------|-------|-------|------------|
| GET/POST/PUT | `/api/v1/accounting/customers` | exists | `customers.*` |
| GET/POST/PUT | `/api/v1/accounting/suppliers` | exists | `suppliers.*` |
| GET/POST/PUT | `/api/v1/accounting/delegates` | maps Seller | `delegates.*` |
| GET/POST/PUT | `/api/v1/distributors` | **add** or extend accounting | `distributors.*` |
| GET/POST/PUT | `/api/v1/drivers` | **add** | `drivers.*` |
| CRUD | `/api/v1/accounting/persons` | new | `persons.*` |
| CRUD | `/api/v1/accounting/person-groups` | new | `persons.*` |
| CRUD | `/api/v1/accounting/person-item-prices` | bulk import | `pricing.*` |
| GET | `/api/v1/accounting/customers/:id/balance` | posted GL + open docs | `customers.view` |

---

## 6. Phased Execution & Unit Testing Strategy

### Checklist

- [ ] Import legacy customers/suppliers with GL account FK resolution.
- [ ] Map `Seller` → `Delegate` (or rename API for parity).
- [ ] Implement `Person` + `PersonItemPrice` from `PersonItemsValues*`.
- [ ] Add `Distributor`/`Driver` REST (models exist in schema).
- [ ] Single **Customer 360** query: master + balance + open invoices (stub until M5).
- [ ] Define merge strategy: `ElectronicInvoiceCustomer` ↔ `Customer` (M14).

### Tests

1. Customer with invalid `mainAccountId` → 400.
2. Duplicate `legacyCode` → 409.
3. Person item price overrides base price list when resolver runs (unit test pricing service).
4. Imported distributor count matches legacy row count for sample company.
5. Credit warning: customer with debit warning + negative balance flags `creditHold=true` for M5.

---

**Wave 0 order:** After M0 (context) and in parallel with M1 COA accounts needed for customer/supplier links; before M5 invoices.
