# Accounting Settings Gap Report

Forensic comparison of the Accounting Settings UI in `gates-web` against Prisma models and accounting APIs in `gates-backend`.

**Scope:** discovery only. No production code was changed.

**Date:** 2026-09-07

---

## Executive finding

The gap is **two-sided**. The backend does not fail to store “everything the UI needs.” Most document tabs never persist. The backend already seeds a large `accountDefinitions` JSON map and enforces several controls through a **legacy EAV** (`CompanySettingEntry`) that the modern tabbed screen does not edit.

| Layer | What it is | Used by posting? |
| --- | --- | --- |
| `CompanySettings` row | Structured scalars + `accountDefinitions` JSON + `autoPostGl` | Yes (partial) |
| `CompanySettingEntry` | ~81 company keys + module-suffixed patterns (`AutoPostSI01`, `CustomersAccount`) | Yes |
| `ContractingSettings` / `TradeSettings` | Module GL codes + default VAT/WHT | Yes (internal read, no admin API) |
| Tabbed document UI | 19 tabs on `/accounting-settings/company-settings/accounting-settings` | **Almost none** — mock checkboxes / selects |

There is **no** `GET/PUT /api/v1/accounting/settings`. Live contracts:

- `GET/PUT /api/v1/companies/:companyId/settings`
- `GET/PUT/DELETE /api/v1/company-settings/:name`
- `GET /api/v1/accounting/accounts/gl-defaults`

There is **no** `accountingSettingsSchema` / React Hook Form. Mapping lives in `gates-web/lib/accounting-settings/mapCompanySettingsUi.ts`.

```
Mock document tabs  -.-> (no persist)
إعدادات عامة (partial) --> CompanySettings row
GL defaults page --> accountDefinitions JSON + EAV CustomersAccount
accountDefinitions + EAV --> Invoice / Treasury / Inventory / Subcontracts
```

---

## 1. Frontend inventory

`Present in Prisma?` means a **typed column** on `CompanySettings` (or a dedicated settings model). JSON keys inside `accountDefinitions` / `advancedSettings` and EAV names are called out in the key column.

**Wire status**

- **Wired** — bound to React state and saved on PUT.
- **Passthrough** — in `AccountingSettingsUiState` / PUT payload, no visible input on the tab.
- **Visual only** — rendered (`defaultChecked` / unbound select), not saved.
- **JSON / EAV** — saved via `accountDefinitions` or `/company-settings/:name`, not a Prisma column.

### 1.1 إعدادات عامة — `/accounting-settings/company-settings/accounting-settings`

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| إعدادات عامة | عدد الأرقام لدليل الحسابات | number stepper | `accountsGuideDigits` | Yes — `CompanySettings` |
| إعدادات عامة | عدد الأرقام لدليل مراكز التكلفة | number stepper | `costCentersGuideDigits` | Yes |
| إعدادات عامة | عدد الأرقام لدليل المخازن | number stepper | `storesGuideDigits` | Yes |
| إعدادات عامة | عدد الأرقام لدليل الأصناف | number stepper | `itemsGuideDigits` | Yes |
| إعدادات عامة | عدد الأيام لإظهار تحذير إستحقاق الأوراق المالية | number stepper | `dueSecuritiesWarningDays` | Yes |
| إعدادات عامة | من تاريخ / هجري | text/date (same binding) | `operationsFromDate` | Yes |
| إعدادات عامة | رقم واتساب المدير للملخص اليومي | tel | `executiveWhatsAppPhone` | Yes |
| إعدادات عامة | أساس احتساب سعر بند الفاتورة | select | `pricingCalculationBasis` (`SELECTED_UNIT_QTY` \| `BASE_UNIT_QTY`) | Yes |
| الحقول المتقدمة | مسار النسخ الإحتياطي | text | `backupPath` | Yes |
| الحقول المتقدمة | حساب التكلفة | select (disabled, forced average) | `costMethod` | Yes (API rejects `fifo`/`lifo`) |
| إعدادات الموازنة | السماح بتعدي قيمة الموازنة (5 radios) | radio, **visual only** | `budgetAllowExceed`, `budgetStopMessageOnly`, `budgetStopLedger`, `budgetStopOrigin`, `budgetStopBoth` | Yes — not bound in UI |
| إعدادات الموازنة | التحذير نصف/نفس/تعدي الكمية | radio, **visual only** | `budgetWarnHalf`, `budgetWarnSame`, `budgetWarnExceed` | Yes — not bound |
| الضرائب والإعدادات المتقدمة | إظهار صلاحيات الشاشة | checkbox, **visual only** | `advancedSettings.adv_showPermissions` | JSON only |
| الضرائب والإعدادات المتقدمة | تطبيق ضريبة خصم المنبع | checkbox, **visual only** | `advancedSettings.adv_applyWithholding` | JSON only |
| الضرائب والإعدادات المتقدمة | تطبيق مؤيد أو غير مؤيد | checkbox, **visual only** | `advancedSettings.adv_applySupportedOrNot` | JSON only |
| الضرائب والإعدادات المتقدمة | إستخدام التاريخ الميلادي | checkbox, **visual only** | `advancedSettings.adv_useGregorian` | JSON only |
| الضرائب والإعدادات المتقدمة | إظهار كلا التاريخين | checkbox, **visual only** | `advancedSettings.adv_showBothDates` | JSON only |
| الضرائب والإعدادات المتقدمة | التأثير المباشر على السندات و الأوراق | checkbox, **visual only** | `advancedSettings.adv_directEffectOnVouchers` | JSON only |
| Mapper (no field) | بداية السنة المالية | passthrough | `fiscalYearStart` | Yes |
| Mapper (no field) | نهاية السنة المالية | passthrough | `fiscalYearEnd` | Yes |
| Mapper (no field) | العملة الافتراضية | passthrough | `defaultCurrency` | Yes |
| Mapper (no field) | أرقام القيد | passthrough | `journalEntryDigits` | Yes |
| Mapper (no field) | السماح برصيد سالب | passthrough | `allowNegativeBalance` | Yes |
| Mapper (no field) | مركز تكلفة بدون حساب | passthrough | `allowCostCenterWithoutAccount` | Yes |
| Mapper (no field) | قفل الترحيل قبل تاريخ | passthrough | `lockPostingBeforeDate` | Yes |
| Mapper (no field) | تفعيل اعتمادات | passthrough | `enableApprovalsWorkflow` | Yes (not read by posting) |
| Mapper (no field) | ترقيم تلقائي | passthrough | `autoNumbering` | Yes |
| Mapper (no field) | خانات عشرية | passthrough | `decimalsInAmounts` | Yes |
| Mapper (no field) | استخدام التاريخ | passthrough | `dateUsage` | Yes |
| Mapper (no field) | الثيم | passthrough | `theme` | Yes |
| Mapper (no field) | إيصالات مؤقتة | passthrough | `temporaryReceipts` | Yes |
| Mapper (no field) | اعتمادات مستندية | passthrough | `documentaryCredits` | Yes |
| Not on this UI | ترحيل قيد تلقائي | — | `autoPostGl` | **Yes on model — omitted from PUT schema** |
| Not on this UI | حساب الأرباح المرحلة | — | `retainedEarningsAccountId` | **Yes on model — omitted from PUT schema** |

### 1.2 تعريف الحسابات — same page, mock pickers (no state keys)

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| تعريف الحسابات | مصروفات | account text | `operatingExpenseAccount` / `stockIssueExpenseAccount` | JSON alias only |
| تعريف الحسابات | الإهلاك | account text | `ehlakAccount` | JSON only |
| تعريف الحسابات | المشتريات | account text | `purchaseAccount` | **No** |
| تعريف الحسابات | المبيعات | account text | `salesAccount` / `salesRevenueAccount` | JSON only |
| تعريف الحسابات | المخزون | account text | `inventoryAccount` | JSON only |
| تعريف الحسابات | تكلفة البضاعة | account text | `cogsAccount` | JSON only |
| تعريف الحسابات | الهدايا | account text | `giftsAccount` | **No** |
| تعريف الحسابات | ضريبة المبيعات | account text | `salesTaxAccount` / `vatOutputAccount` | JSON only |
| تعريف الحسابات | بضاعة اول المدة | account text | `openingInventoryAccount` | **No** |
| تعريف الحسابات | الإعتمادات المستندية | account text | `lcAccount` / `TradeSettings.openLcWipAccountCode` | Trade table, no admin API |
| تعريف الحسابات | مردودات المشتريات | account text | `purchaseReturnAccount` | **No** |
| تعريف الحسابات | مردودات المبيعات | account text | `salesReturnAccount` | JSON only |
| تعريف الحسابات | المقبوضات | account text | `cashAccount` / receipts | JSON only |
| تعريف الحسابات | حساب عجز الأصناف | account text | `itemLossAccount` / `stocktakingDeficitAccount` | JSON (`itemLoss`) — dedicated stocktaking key **No** |
| تعريف الحسابات | أصول ثابتة | account text | `fixedAssetsAccount` | JSON only |
| تعريف الحسابات | الصناديق | account text | `boxesAccount` / `cashAccount` | JSON only |
| تعريف الحسابات | البنوك | account text | `banksAccount` / `bankAccount` | JSON only |
| تعريف الحسابات | العملاء | account text | `customersAccount` / EAV `CustomersAccount` | JSON + EAV |
| تعريف الحسابات | الموردين | account text | `suppliersAccount` | JSON only |
| تعريف الحسابات | الموظفين | account text | payroll / `solafAccount` | JSON (سلف) only |
| تعريف الحسابات | المدفوعات | account text | `cashAccount` (payments) | JSON only |
| تعريف الحسابات | الدائنون | account text | `apAccount` / creditors | JSON only |
| تعريف الحسابات | السلف | account text | `solafAccount` | JSON only |
| تعريف الحسابات | ضريبة مدين | account text | `vatInputAccount` / `daribaManbaAccountDebit` | JSON only |
| تعريف الحسابات | ضريبة دائن | account text | `vatOutputAccount` / `daribaManbaAccount` | JSON only |
| تعريف الحسابات | ربح أو خسارة | account text | `profitAccount` / `retainedEarningsAccount` | JSON + unused column `retainedEarningsAccountId` |
| تعريف الحسابات | بضاعة أخر المدة | account text | `closingInventoryAccount` | **No** |
| تعريف الحسابات | حساب النقل | account text | `transferAccount` | **No** |
| تعريف الحسابات | حساب العهد | account text | `ohdaAccount` | JSON only |
| تعريف الحسابات | مصروفات تسويق | account text | `marketingExpensesAccount` | JSON only |

### 1.3 GL defaults page — wired

Route: `/accounting-settings/company-settings/gl-account-defaults`

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| حساب العملاء | افتراضي الشركة + لكل فرع | AccountSelect | EAV `CustomersAccount` (`branchId` optional) | EAV, not a column |
| حسابات النظام | حساب الصناديق الافتراضي | AccountSelect | `accountDefinitions.boxesAccount` | JSON |
| حسابات النظام | حساب البنوك الافتراضي | AccountSelect | `accountDefinitions.banksAccount` | JSON |
| حسابات النظام | حساب الموردين الافتراضي | AccountSelect | `accountDefinitions.suppliersAccount` | JSON |
| حسابات النظام | حساب الأصول الثابتة | AccountSelect | `accountDefinitions.fixedAssetsAccount` | JSON |
| حسابات النظام | ضريبة الخصم من المنبع (دائن) | AccountSelect | `accountDefinitions.daribaManbaAccount` | JSON |
| حسابات النظام | ضريبة الخصم من المنبع (مدين) | AccountSelect | `accountDefinitions.daribaManbaAccountDebit` | JSON |
| حسابات النظام | أرباح العام / المرحلة | AccountSelect | `accountDefinitions.profitAccount` | JSON |
| حسابات النظام | سلف الموظفين | AccountSelect | `accountDefinitions.solafAccount` | JSON |
| حسابات النظام | عهدة الموظفين | AccountSelect | `accountDefinitions.ohdaAccount` | JSON |
| حسابات النظام | إهلاك الأصول | AccountSelect | `accountDefinitions.ehlakAccount` | JSON |
| حسابات النظام | هالك المخزون | AccountSelect | `accountDefinitions.itemLossAccount` | JSON |
| حسابات النظام | خصومات العروض | AccountSelect | `accountDefinitions.offerAccount` | JSON |
| حسابات النظام | مصروفات التسويق | AccountSelect | `accountDefinitions.marketingExpensesAccount` | JSON |
| حسابات النظام | ضريبة المبيعات | AccountSelect | `accountDefinitions.salesTaxAccount` | JSON |

### 1.4 Document tabs — mock (same page)

Shared six checkboxes (visual only, duplicated on invoice tabs): إظهار صلاحيات الشاشة، تطبيق ضريبة خصم المنبع، تطبيق مؤيد أو غير مؤيد، إستخدام التاريخ الميلادي، إظهار كلا التاريخين، التأثير المباشر على السندات و الأوراق.

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| سند قيد يومية | السند / ألوان الجدول 1–4 | select + color | document chrome only | **No** |
| سند صرف / قبض نقدية | الصندوق / صندوق الفرع | select | default safe / `boxesAccount` | Safe on branch; not this form |
| سند خصم / إضافة بنكية | البنك ×2 | select | `banksAccount` | JSON only |
| أوراق الدفع / القبض | الحساب ×2، م التكلفة (قبض) | select | `notesPayableAccount`, `chequesUnderCollectionAccount`, `receivedChequesAccount` | JSON aliases exist; **returned cheques missing** |
| إيصالات مؤقتة | الصندوق + ترقيم/طباعة | text + checkbox | `temporaryReceipts` + Serial* EAV | Partial (flag on row) |
| اعتمادات مستندية | المشتريات / المخزون | read-only text | `TradeSettings.*` | Table, no admin API |
| فاتورة مبيعات | النمط، مخزن، سياسة تسعير، حساب مبيعات/خصم، نمط قبض/ورقة، مركز تكلفة مدين/دائن | select + radio | `defaultWarehouseId`, `defaultPriceListId`, `salesAccount`, `salesDiscountAccount`, `cashDiscountAllowedAccount` | **No company columns**; discount JSON exists |
| فاتورة مردودات مبيعات | مردودات + أنماط صرف | select | `salesReturnAccount` | JSON only |
| فاتورة مشتريات | حساب مشتريات / خصم / مخزن / سياسة | select | `purchaseAccount`, `purchaseDiscountAccount`, `cashDiscountReceivedAccount` | **No** |
| فاتورة مردودات مشتريات | مردودات مشتريات | select | `purchaseReturnAccount` | **No** |
| الجرد المخزني | حساب الزيادة / العجز / تقييم | account + select | `stocktakingSurplusAccount`, `stocktakingDeficitAccount` | **No** (deficit closest: `itemLossAccount`) |
| تجميع / تفكيك | حساب التكلفة الإضافية + ترحيل تلقائي | account + checkbox | `assemblyExtraCostAccount`, `autoPostGl` / `AutoPost{module}` | **No** / EAV |
| النقل المخزني | النمط + ألوان + ترحيل | select + checkbox | `transferAccount`, `AutoPostST*` | **No** / EAV |

### 1.5 Statement layouts — wired JSON

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| قائمة الدخل | صافي مشتريات/مبيعات/مصروفات/إيرادات ×5 صفوف | text code+name | `accountDefinitions.incomeStatementSettings` | JSON |
| المركز المالي | أصول / التزامات / حقوق / متداول + 5 صافي | account search | `accountDefinitions.financialPositionSettings` | JSON |

### 1.6 Contracting mock + period close (outside accounting-settings hub)

| Tab / Section | Field Name | Type / UI Input | Expected Backend Key | Present in Prisma? |
| --- | --- | --- | --- | --- |
| مستخلصات المقاولين | حساب المقاولين / تكاليف / مصروفات / إيرادات / ضرائب / تأمينات / خصومات | read-only (8 rows) | `ContractingSettings.*AccountCode` | **Yes on `ContractingSettings` — no REST, UI not bound** |
| مستخلصات المقاولين | ضمان أعمال / دفعات مقدمة / غرامات | not labeled as such on mock | `retention*`, `*AdvanceAccountCode`, `penaltiesExpenseAccountCode` | Yes on `ContractingSettings` |
| إغلاق الفترات (`/accounting/create/periods`) | فتح/إغلاق، كود، اسم، تواريخ | toggle + dates | `Period` CRUD | Legacy `Period` yes; `FiscalPeriod` **no API** |

### 1.7 Requested control flags vs current product

| Requested flag | UI on accounting settings? | Backend today |
| --- | --- | --- |
| `autoPostGl` | No | Column on `CompanySettings`; posting also uses EAV `AutoPost{ModuleCode}` + `GLPost` |
| `noSellBelowCost` | No | **`Item.noSellBelowCost` only** — not company-wide |
| `preventNegativeStock` | No | EAV `AllowMinusQty` / `AllowNegativeStore` + row `allowNegativeBalance` |
| `preventCashOverdraft` | No | **Not found** |
| `requireCostCenterForExpenses` | No | Closest: `allowCostCenterWithoutAccount` + `Account.requiresCostCenter` |
| Default payment terms | No | Not a company setting column |
| Default currency | Passthrough only | `CompanySettings.defaultCurrency` |
| Default VAT / WHT / نموذج 41 | Visual withholding checkbox only | Rates on `ContractingSettings` (`defaultVatRate` 0.14, `defaultWhtRate` 0.01). Invoices use line/header tax, not a company default rate. Table tax: no company binding found. |

### 1.8 Define-new-operation flags (wired EAV, not the tabbed form)

`/accounting-settings/operations-management/define-new-operation-screens` writes:

| Field | Key | Prisma column? |
| --- | --- | --- |
| ترحيل تلقائي | `AutoPost{fullCode}` | EAV |
| ضريبة مبيعات | `SalesDariba{fullCode}` | EAV |
| عدم إنشاء قيد | `NotCreateGL{fullCode}` | EAV |
| تأثير على المخزون | `PostTostore{fullCode}` | EAV |
| خصومات متتالية | `CascadingDiscounts{fullCode}` | EAV |

---

## 2. Missing database columns and relations

Do **not** explode every mock picker into a Prisma column. `accountDefinitions` is already a flexible JSON map stamped by `buildAccountDefinitions()` in `gates-backend/src/modules/accounting/data/system-account-map.ts`.

### 2.1 Already on `CompanySettings` — expose on API/UI

| Column | Status |
| --- | --- |
| `autoPostGl` | In Prisma (`Boolean @default(true)`). **Missing from** `companySettingsSchema` PUT. |
| `retainedEarningsAccountId` | In Prisma. Used by year-end close. **Missing from PUT.** |
| Budget flags | In Prisma. **Not enforced** in posting services. |
| `enableApprovalsWorkflow` | In Prisma. Approvals actually read EAV (`ApprovalHighValueThreshold`, maker-checker keys). |

### 2.2 Add as `accountDefinitions` keys (JSON) — no new columns unless a later wave needs FK integrity

Seeded today (aliases exist):

- Sales / AR: `salesAccount`, `salesReturnAccount`, `salesDiscountAccount`, `cogsAccount`, `inventoryAccount`, `arAccount`
- Tax: `vatOutputAccount`, `vatInputAccount`, `withholdingTaxAccount`, `whtReceivableAccount`, `daribaManbaAccount*`
- Treasury: `cashAccount`, `bankAccount`, `chequesUnderCollectionAccount`, `receivedChequesAccount` / `chequesUnderHandAccount`, `notesPayableAccount`
- Advances / FX: `customerAdvanceAccount`, `supplierAdvanceAccount` (advance-from-customers seeded; supplier advance used in some resolvers), `fxGainAccount`, `fxLossAccount`

**Missing vs UI / product list:**

| Expected key | Why |
| --- | --- |
| `purchaseAccount` | Mock «المشتريات»; purchase GL not in `glDefaultsForForms` |
| `purchaseReturnAccount` | Mock مردودات مشتريات |
| `purchaseDiscountAccount` | Mock حساب الخصومات on purchase invoice |
| `cashDiscountAllowedAccount` | Sales cash discount (user inventory) |
| `cashDiscountReceivedAccount` | Purchase cash discount |
| `returnedChequesAccount` | شيكات مرتدة — not in `system-account-map` |
| `roundingDifferenceAccount` | فروق الكسور والتقريب |
| `openingInventoryAccount` | بضاعة أول المدة |
| `closingInventoryAccount` | بضاعة آخر المدة |
| `giftsAccount` | الهدايا |
| `lcAccount` | Prefer `TradeSettings.openLcWipAccountCode` rather than a second column |
| `transferAccount` | النقل المخزني |
| `stocktakingSurplusAccount` | حساب الزيادة |
| `stocktakingDeficitAccount` | حساب العجز (today `itemLossAccount` is reused) |
| `assemblyExtraCostAccount` | تكلفة إضافية للتجميع/التفكيك |
| `supplierAdvanceAccount` | Explicit first-class key if not already resolved everywhere |

Cheque **under collection** and **notes payable** already exist. **Returned cheques** does not.

### 2.3 Dedicated tables — add admin API, do not duplicate onto `CompanySettings`

**`ContractingSettings`** (`contracting_settings`):

- `contractingRevenueAccountCode`, `projectExpenseAccountCode`, `clientReceivableAccountCode`, `subcontractorPayableAccountCode`
- `customerAdvanceAccountCode`, `subcontractorAdvanceAccountCode`
- `retentionHeldByOthersAccountCode`, `retentionWithheldForOthersAccountCode`
- `outputVatAccountCode`, `inputVatAccountCode`, `whtAssetAccountCode`, `whtPayableAccountCode`
- `penaltiesExpenseAccountCode`
- `defaultVatRate`, `defaultWhtRate`

**`TradeSettings`:** LC/LG WIP, inventory, payable, cash cover, commission, confiscation loss.

**`FiscalPeriod`:** model exists; **no create/close HTTP API**. Close today goes through legacy `Period` (`POST /api/v1/accounting/periods/:id/close`).

Subcontract EAV (not columns): `SubcontractWipAccount`, `SubcontractAdvanceAccount`, `SubcontractRetentionAccount` in `subcontract-account-resolver.service.ts`.

### 2.4 New first-class control columns (only if product wants them off EAV)

| Proposed column | Unifies |
| --- | --- |
| `preventNegativeStock` | `AllowMinusQty`, `AllowNegativeStore`, `allowNegativeBalance` |
| `preventCashOverdraft` | Does not exist |
| `noSellBelowCostCompany` | Today `Item.noSellBelowCost` |
| `requireCostCenterForExpenses` | Today per-account `requiresCostCenter` |
| `defaultVatRate`, `whtRate`, `whtThreshold` | Company-wide tax (rates today contracting-only) |
| `defaultPaymentTermsDays` | Missing |

No new FK from `CompanySettings` to `Account` is required if IDs stay inside `accountDefinitions`. If a later wave needs cascading integrity, add optional `*AccountId` columns with `onDelete: SetNull`.

---

## 3. API contracts

### 3.1 What exists today (do not pretend these are `/accounting/settings`)

**`GET /api/v1/companies/:companyId/settings`**

Auth: `company:view`. Returns `{ status: 'success', data: CompanySettings }` including `accountDefinitions`, budget flags, and `autoPostGl` / `retainedEarningsAccountId` if the row has them.

**`PUT /api/v1/companies/:companyId/settings`**

Auth: `company:edit`. Body = `companySettingsSchema` (all optional). Accepts the scalars in section 1.1 plus `advancedSettings` and `accountDefinitions`. **Does not accept** `autoPostGl` or `retainedEarningsAccountId`. Rejects `costMethod` other than `average`. Tenant must come from JWT / route company the user can edit — never a spoofable body `companyId` for a different company.

**`GET /api/v1/accounting/accounts/gl-defaults`**

```json
{
  "status": "success",
  "data": {
    "inventoryAccountId": "uuid|null",
    "salesAccountId": "uuid|null",
    "cogsAccountId": "uuid|null",
    "arAccountId": "uuid|null",
    "apAccountId": "uuid|null",
    "cashAccountId": "uuid|null",
    "bankAccountId": "uuid|null",
    "salesReturnAccountId": "uuid|null",
    "vatAccountId": "uuid|null",
    "retainedEarningsAccountId": "uuid|null",
    "underCollectionChequeAccountId": "uuid|null"
  }
}
```

No purchase-return, rounding, or returned-cheque IDs.

**`GET/PUT /api/v1/company-settings/:name`**

EAV string values (`T`/`F` or account codes). Branch override via `branchId`.

### 3.2 Proposed facade (not implemented)

`GET /api/v1/accounting/settings`  
`PUT /api/v1/accounting/settings`

- JWT + tenant context only. **Do not accept `companyId` from the body.**
- PUT is partial (deep-merge objects).
- Implementation should compose existing stores: `CompanySettings`, `CompanySettingEntry`, `ContractingSettings`, `TradeSettings`.

```json
{
  "status": "success",
  "data": {
    "general": {
      "fiscalYearStart": "01-01-2026",
      "fiscalYearEnd": "31-12-2026",
      "defaultCurrency": "EGP",
      "journalEntryDigits": 6,
      "decimalsInAmounts": 2,
      "accountsGuideDigits": 1,
      "costCentersGuideDigits": 1,
      "storesGuideDigits": 1,
      "itemsGuideDigits": 1,
      "dateUsage": "gregorian",
      "operationsFromDate": null,
      "dueSecuritiesWarningDays": 10,
      "lockPostingBeforeDate": null,
      "autoNumbering": true,
      "costMethod": "average",
      "pricingCalculationBasis": "SELECTED_UNIT_QTY",
      "backupPath": null,
      "theme": "light",
      "temporaryReceipts": false,
      "documentaryCredits": false,
      "executiveWhatsAppPhone": null,
      "autoPostGl": true,
      "retainedEarningsAccountId": null
    },
    "controls": {
      "enableApprovalsWorkflow": true,
      "allowNegativeBalance": false,
      "preventNegativeStock": true,
      "preventCashOverdraft": true,
      "noSellBelowCost": false,
      "requireCostCenterForExpenses": false,
      "allowCostCenterWithoutAccount": false,
      "defaultPaymentTermsDays": null,
      "budgetAllowExceed": false,
      "budgetWarnHalf": false,
      "budgetWarnSame": false,
      "budgetWarnExceed": false,
      "budgetStopMessageOnly": false,
      "budgetStopLedger": false,
      "budgetStopOrigin": false,
      "budgetStopBoth": false
    },
    "tax": {
      "defaultVatRate": 0.14,
      "whtRate": 0.01,
      "whtThreshold": null,
      "applyWithholding": false,
      "salesTaxAccountId": null,
      "vatInputAccountId": null,
      "whtPayableAccountId": null,
      "whtReceivableAccountId": null
    },
    "accounts": {
      "salesAccountId": null,
      "salesReturnAccountId": null,
      "cogsAccountId": null,
      "inventoryAccountId": null,
      "purchaseAccountId": null,
      "purchaseReturnAccountId": null,
      "salesDiscountAccountId": null,
      "purchaseDiscountAccountId": null,
      "cashDiscountAllowedAccountId": null,
      "cashDiscountReceivedAccountId": null,
      "arAccountId": null,
      "apAccountId": null,
      "cashAccountId": null,
      "bankAccountId": null,
      "chequesUnderCollectionAccountId": null,
      "chequesPayableAccountId": null,
      "returnedChequesAccountId": null,
      "customerAdvanceAccountId": null,
      "supplierAdvanceAccountId": null,
      "fxGainAccountId": null,
      "fxLossAccountId": null,
      "roundingDifferenceAccountId": null,
      "stocktakingSurplusAccountId": null,
      "stocktakingDeficitAccountId": null,
      "assemblyExtraCostAccountId": null,
      "openingInventoryAccountId": null,
      "closingInventoryAccountId": null,
      "giftsAccountId": null,
      "transferAccountId": null
    },
    "contracting": {
      "contractingRevenueAccountCode": null,
      "projectExpenseAccountCode": null,
      "clientReceivableAccountCode": null,
      "subcontractorPayableAccountCode": null,
      "customerAdvanceAccountCode": null,
      "subcontractorAdvanceAccountCode": null,
      "retentionHeldByOthersAccountCode": null,
      "retentionWithheldForOthersAccountCode": null,
      "penaltiesExpenseAccountCode": null,
      "outputVatAccountCode": null,
      "inputVatAccountCode": null,
      "whtAssetAccountCode": null,
      "whtPayableAccountCode": null,
      "defaultVatRate": 0.14,
      "defaultWhtRate": 0.01
    },
    "statementLayouts": {
      "incomeStatementSettings": null,
      "financialPositionSettings": null
    }
  }
}
```

`PUT` body is the same object without the wrapper, all sections optional:

```json
{
  "general": { "autoPostGl": true },
  "accounts": { "purchaseAccountId": "<uuid>" },
  "tax": { "defaultVatRate": 0.14 }
}
```

Until this facade exists, the frontend must keep calling `/companies/:id/settings` and `/company-settings/:name`. Binding mock tabs without a persist path will silently lie to the user.

---

## 4. Cascading effects (services that must read settings once active)

These services **already** read fragments. A facade must become their single source; do not leave a second write path that posting ignores.

### 4.1 Invoices and sales/purchase GL

| Service | Keys today | Must also honor |
| --- | --- | --- |
| `invoice-account-resolver.service.ts` | `CustomersAccount` EAV, `accountDefinitions` AR/sales/VAT/WHT | `purchaseAccount`, discounts, `autoPostGl` |
| `invoice-document-type.ts` | `AutoPost{module}`, `DirectAffectStore`, `DirectAffectMoney`, `CheckMinusQty{module}` | Company-level `autoPostGl` + `preventNegativeStock` |
| `auto-gl-posting.service.ts` | `CompanySettings.autoPostGl`, EAV `GLPost` | Facade `controls` + `general.autoPostGl` |
| `invoice-unit-conversion.ts` / `invoice-m5.service.ts` | `pricingCalculationBasis` | Unchanged |
| `invoice-posting-orchestrator.ts` | `CreditWarningOnly` EAV | Company credit / `noSellBelowCost` if made company-wide |
| `item.service.ts` | `Item.noSellBelowCost` | Optional company override |

### 4.2 Inventory costing and stock

| Service | Keys today | Must also honor |
| --- | --- | --- |
| `stock-movement.service.ts` / `adjust-stock-in-tx` | `allowNegativeBalance`, `AllowMinusQty`, `AllowNegativeStore` | `preventNegativeStock` |
| Stocktaking / assembly posting | `itemLossAccount`, COGS aliases | `stocktakingSurplusAccount`, `stocktakingDeficitAccount`, `assemblyExtraCostAccount` |
| `item-cost.service.ts` | Moving average only | `costMethod` stays `average` until FIFO/LIFO exists |

### 4.3 Treasury, cheques, safes

| Service | Keys today | Must also honor |
| --- | --- | --- |
| Cash receipt/payment / cheque lifecycle | `cashAccount`, `bankAccount`, `chequesUnderCollectionAccount`, `notesPayableAccount`, `GLUnPost` | `returnedChequesAccount`, `preventCashOverdraft`, `roundingDifferenceAccount` |
| FX settlement | `fxGainAccount`, `fxLossAccount` | Unchanged |
| Securities warning | `dueSecuritiesWarningDays` | Unchanged |

### 4.4 Subcontractors, extracts, contracting

| Service | Keys today | Must also honor |
| --- | --- | --- |
| `contracting-account-resolver.service.ts` | `ContractingSettings` upsert-on-read | Admin PUT of that row via facade `contracting` |
| Client / subcontractor extract services | `defaultVatRate`, `defaultWhtRate` | Company `tax` if product wants one rate everywhere |
| `subcontract-account-resolver.service.ts` | EAV `SubcontractWipAccount`, `SubcontractAdvanceAccount`, `SubcontractRetentionAccount` | Same keys surfaced in facade `accounts` or `contracting` |

### 4.5 Fiscal close

| Service | Keys today | Must also honor |
| --- | --- | --- |
| `fiscal-year.service.ts` | `lockPostingBeforeDate`, `FiscalYear` / `Period` / `FiscalPeriod.isClosed` | Dedicated `FiscalPeriod` admin |
| `year-end-closing.service.ts` | `retainedEarningsAccountId` | PUT must be able to set that column |

### 4.6 Stored but not enforced (runtime gap, not a column gap)

- All `budget*` flags on `CompanySettings`
- `enableApprovalsWorkflow` on the row (approvals use separate EAV)
- FIFO/LIFO `costMethod` (rejected by API; engine is average)

---

## 5. Recommended next wave (out of this document’s write scope)

1. Bind إعدادات عامة radios/checkboxes to existing mapper keys (frontend-only; they already PUT).
2. Add `autoPostGl` + `retainedEarningsAccountId` to `companySettingsSchema`.
3. Implement `GET/PUT /api/v1/accounting/settings` as a compose/facade — no second source of truth.
4. Persist `accountDefinitions` keys for purchase / returned cheques / rounding / stocktaking.
5. Add GET/PUT for `ContractingSettings` and `TradeSettings`.
6. Replace mock document tabs with the facade, or hide them until they save.

---

## Source index

| Concern | Path |
| --- | --- |
| Tabbed settings UI | `gates-web/app/accounting-settings/company-settings/accounting-settings/page.tsx` |
| UI mapper | `gates-web/lib/accounting-settings/mapCompanySettingsUi.ts` |
| GL defaults UI | `gates-web/app/accounting-settings/company-settings/gl-account-defaults/page.tsx` |
| PUT schema | `gates-backend/src/modules/company/schemas/company-settings.schema.ts` |
| Seeded GL map | `gates-backend/src/modules/accounting/data/system-account-map.ts` |
| Prisma `CompanySettings` | `gates-backend/prisma/schema.prisma` (~line 337) |
| Prisma `ContractingSettings` | `gates-backend/prisma/schema.prisma` (~line 3979) |
| Legacy EAV catalog | `gates-backend/src/modules/platform/data/legacy-settings-defaults.ts` |
