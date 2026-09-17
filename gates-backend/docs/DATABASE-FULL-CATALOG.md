# قاعدة بيانات GATES — المنطق + كل الجداول والأعمدة والعلاقات

مصدر الحقيقة: `gates-backend/prisma/schema.prisma`  
قاعدة البيانات: **MySQL** عبر **Prisma**  
عدد الموديلات الحالي: **270**  
العزل: كل بيانات التشغيل مربوطة بشركة (`companyId`) إلا جداول تراثية قديمة (`tenants` / `users_legacy`).

الملف ده فيه جزئين:

1. **المنطق** — إزاي المستند بيتحول لقيد، وإزاي التقارير بتتقري (تجميع لحظي ولا جداول أرصدة محدّثة).
2. **الكتالوج الكامل** — كل جدول، كل عمود، وكل علاقة زي ما هي في الـ schema.

لو الـ schema اتغيّر: شغّل `node gates-backend/scripts/generate-db-catalog.mjs` وحدّث الجزء التاني.

---

## 1) الفكرة في جملة واحدة

النظام مش جداول تقارير جاهزة. فيه **شركة**، جواها **دليل حسابات + أطراف + مخازن**. أي مستند تشغيلي (فاتورة، سند، إذن مخزن…) لما يترحل بيولّد **قيد يومية**. القيد هو دفتر المالية. المخزون له دفتر حركة منفصل. التقارير **بتتجمع وقت الطلب** من الدفاتر دي، مع جداول **ملخص أرصدة** بتتحدث في نفس instant الترحيل عشان ميزان المراجعة وما شابه ما يعملوش `SUM` على كل السطور كل مرة.

```
شركة (companies)
  ├─ فروع + مستخدمين + صلاحيات
  ├─ دليل الحسابات + مراكز التكلفة + سنوات مالية
  ├─ عملاء / موردين / مناديب
  ├─ أصناف + مخازن
  └─ مستندات تشغيل
        فاتورة / سند / إذن مخزن / شيك / مستخلص
              │ ترحيل
              ▼
        قيد يومية (journal_entries + journal_entry_lines)
              │
              ├─ account_period_balances     ← ملخص شهري للحساب (يتحدث مع كل ترحيل)
              ├─ partner_running_balances    ← رصيد عميل/مورد حي
              └─ cost_center_movements       ← حركة حساب×مركز تكلفة

        مستند مخزن مرحّل
              ├─ inventory_movements         ← دفتر حركة لا يُمسح
              └─ item_warehouse_balances     ← رصيد صنف×مخزن حي
```

---

## 2) التقارير: بنتجمع ساعتها ولا فيه جداول ليها؟

**مفيش جداول تقارير محفوظة** زي `trial_balance_reports` أو `income_statement_rows` بتتحدث مع كل حركة وتتعرض جاهزة.

اللي موجود نوعين:

### أ) دفاتر الحركة (المصدر)

دي الصفوف الأصلية. أي تقرير تفصيلي بيقرى منها **لحظي** وقت ما تفتح التقرير:

| الجدول | إيه اللي فيه | تقارير بتقرى منه لحظي |
|---|---|---|
| `journal_entries` + `journal_entry_lines` | كل قيد وسطوره (مدين/دائن + عملة أساس) | دفتر الأستاذ، اليومية، تحليل حساب، حركة حساب، قيود غير مرحلة، قائمة الدخل/ميزانية لو فيه فلتر فرع أو مركز تكلفة |
| `cost_center_movements` | نسخة حركة لكل حساب×مركز | أستاذ مركز تكلفة، أرصدة مراكز |
| `inventory_movements` | كل +/− مخزني | كارت الصنف، حركة مخزن، تكلفة |
| `invoices` + `invoice_lines` | الفواتير | أعمار ديون، مبيعات، مردود |
| `cash_transactions` + lines | سندات وأوامر الخزينة | حركة خزينة/بنك، تدفق نقدي التفصيلي |
| `cheques` / أوراق قبض وصرف | دورة الشيك | محافظ وتحصيل |

يعني: **التقرير مش متسجل كصف نتيجة**. السيرفر بيعمل `SELECT` / `SUM` / تجميع وقت الطلب.

### ب) جداول ملخص أرصدة (تتحدث مع كل ترحيل)

دي **مش تقارير**. دي أرصدة جاهزة عشان السرعة والتطابق. بتتحدث **ذرّيًا في نفس transaction الترحيل أو فك الترحيل** (`ledger-balance.service` + ترحيل المخزون).

| الجدول | المفتاح | بيتحدث إمتى | مين بيستخدمه |
|---|---|---|---|
| `account_period_balances` | شركة + حساب + سنة + شهر | ترحيل/عكس قيد | ميزان المراجعة والميزانية **لو مفيش** فلتر فرع أو مركز تكلفة |
| `partner_running_balances` | شركة + طرف + عملة | ترحيل/عكس قيد عليه عميل/مورد | كشف حساب طرف، أعمار ديون (الرصيد)، تطابق حساب التحكم |
| `item_warehouse_balances` | شركة + صنف + مخزن | ترحيل مستند مخزن | رصيد المخزن، تكلفة متوسطة، كمية محجوزة |
| `item_quantities` | صنف + مخزن + موقع | حركة على موقع | تفصيل الموقع داخل المخزن |
| `customers.balance` / حقول مشابهة | على الكارت | تراثي/ملخص — **الرصيد التشغيلي الصح من `partner_running_balances`** | عرض سريع فقط |

فك الترحيل **بينقص** نفس المبالغ (`invert: true`) مش بيعمل صف تقرير جديد.

لو ملخص الحسابات فاضي وفيه قيود مرحلة، `financial-report.service` يعمل `rebuildCompanyBalances` مرة قبل ما يقرأ الميزان.

### ج) متى التقرير يلجأ للدفاتر الحية بدل الملخص؟

`usesLiveJournalSum` في `financial-report.service.ts`:

- فلتر **فرع** أو **مركز تكلفة** أو **سنة مالية معيّنة على القيد** → التقرير يتجمع من `journal_entry_lines` لحظي (الملخص الشهري مش متقسم فرع/مركز).
- من غير الفلاتر دي → ميزان المراجعة يقرأ `account_period_balances`.

قائمة الدخل والميزانية: تجميع SQL على القيود المرحلة (أو الملخص الشهري حسب المسار). **النتيجة مش بتتكتب في جدول**.

### الخلاصة بصريح العبارة

| السؤال | الجواب |
|---|---|
| فيه جدول لكل تقرير بيتحدث مع كل حركة؟ | **لا** |
| التقارير بتتجمع ساعتها؟ | **أيوه** — من القيود / حركات المخزن / الفواتير |
| فيه حاجة بتتحدث مع كل حركة؟ | **أيوه** — أرصدة شهرية، أرصدة أطراف، أرصدة مخزن، دفتر حركة المخزن، حركات مراكز التكلفة |
| لو عايز رقم تقرير بعد سنتين | نفس التجميع على الدفاتر. مفيش نسخة قديمة محفوظة إلا لو اتعمل تصدير/مرفق برة |

---

## 3) قواعد تشغيل مهمة

### العزل
تقريبًا كل جدول تشغيلي فيه `companyId`. القراءة والكتابة تتفلتر على الشركة الحالية. `branchId` على المستندات مش على كل كارت.

### الـ ID vs الرقم الظاهر
المفتاح الداخلي UUID. الرقم اللي المستخدم يشوفه: `invoiceNumber` / `voucherNumber` / `code`. الترقيم من `document_sequences` (+ `new_modules` لنسخ النوع).

### المستند ≠ القيد
- المستند = اللي المستخدم بيملاه.
- القيد = أثره في اليومية (`journalEntryId`).
- الإلغاء/فك الترحيل يمس القيد والأرصدة في نفس العملية.

### القيد المرحّل
`isPosted = true` ما يتعدّلش فوقه كدفتر. المسار المعتمد: فك ترحيل أو قيد عكسي (`reversalOfJournalEntryId`) حسب الشاشة.  
`activeSourceKey` يمنع قيدين نشطين لنفس المصدر (`companyId|sourceType|sourceNumber|sourceYearId`).

### حالات متكررة
`DRAFT` → اعتماد → `isPosted` / `POSTED`.  
`isCancelled` ملغي.  
`version` قفل تفاؤلي.  
خزينة: `documentRole` = `ORDER` أمر أو `VOUCHER` سند، و`executionStatus` للأوامر.

---

## 4) خريطة العلاقات الأساسية

```
                         Company
                            │
        ┌─────────┬─────────┼──────────┬──────────┐
        ▼         ▼         ▼          ▼          ▼
     Branch    Account   Customer    Item     Warehouse
        │         │         │          │          │
        │         ▼         │          ▼          ▼
        │   JournalEntry    │   ItemWarehouseBalance
        │    └── Lines      │   InventoryMovement
        │         │         │
        ▼         │         ▼
   CashTransaction│      Invoice
    + Lines       │     + Lines
        │         │         │
        └──── journalEntryId ────┘
                  │
         account_period_balances
         partner_running_balances
         cost_center_movements
```

الخزينة/البنك/المخزن مش حسابات بنفسها: كل واحد مربوط بحساب GL (`safes`, `bank_accounts`, `warehouses`).

---

## 5) مسار الترحيل (مالي)

```
مستند DRAFT ──ترحيل──► journal_entries (isPosted)
                         journal_entry_lines
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
account_period_balances  partner_running_balances  cost_center_movements
```

مخزن مرحّل: `item_warehouse_balances` + صف في `inventory_movements` + قيد لو الإعداد يطلب.

---

## 6) فهرس سريع حسب المجال

- أساس: `companies`, `branches`, `company_settings`, `fiscal_years`, `fiscal_periods`, `document_sequences`, `users`, مجموعات وصلاحيات
- محاسبة: `accounts`, `cost_centers`, `journal_entries`, `journal_entry_lines`, ملخصات الأرصدة أعلاه
- أطراف: `customers`, `suppliers`, `delegates`, تصنيفات وعقود
- خزينة: `safes`, `banks`, `bank_accounts`, `cash_transactions`, شيكات وأوراق
- مخزن: `items`, `warehouses`, مستندات الإضافة/الصرف/التحويل/الجرد/التجميع
- بيع وشراء: `invoices` (`SALE` / `PURCHASE` / مردود), `price_quotes`, `purchase_orders`
- تخصص: HR، تصنيع، مقاولات، عقارات، مدارس، POS، ضرائب، AI — كلها في الكتالوج تحت

---

## 7) الكتالوج الكامل (كل جدول / عمود / علاقة)

القسم التالي مولَّد آليًا من `schema.prisma`. العلاقات:

- `N→1` الموديل ده فيه FK لصف واحد
- `N→0..1` FK اختياري
- `1→N` مجموعة عكسية (الجدول التاني بيمسك الـ FK)

onDelete: `Cascade` يمسح التابع مع الأب. `Restrict` يمنع مسح الأب لو فيه تاريخ مالي. `SetNull` يفك الربط.
## `tenants` (`Tenant`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `name` | String | — |
| `locked` | Boolean | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- 1→N `users` → `UserLegacy[]`

## `users_legacy` (`UserLegacy`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `tenantId` | String | — |
| `email` | String | — |
| `role` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `tenant` → `Tenant` — FK `tenantId` → `Tenant.id` · onDelete Cascade

قيود فريدة: `@@unique([tenantId, email])`

فهارس: `@@index([tenantId])`

## `rate_limits` (`RateLimit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `tenantId` | String | — |
| `userId` | String? | اختياري |
| `key` | String | — |
| `window` | DateTime | — |
| `count` | Int | — |

قيود فريدة: `@@unique([tenantId, userId, key, window])`

فهارس: `@@index([tenantId, key])`

## `activity_logs` (`ActivityLog`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `tenantId` | String | — |
| `actorId` | String | — |
| `kind` | String | — |
| `subjectType` | String | — |
| `subjectId` | String | — |
| `severity` | String | — |
| `reason` | String? | اختياري |
| `metadata` | Json? | اختياري |
| `at` | DateTime | الآن |
| `requestId` | String? | اختياري |
| `ip` | String? | اختياري |
| `userAgent` | String? | اختياري |
| `impersonatedBy` | String? | اختياري |

فهارس: `@@index([tenantId, kind, at])`

## `companies` (`Company`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `legacyCompanyCode` | String? | اختياري |
| `serial` | String? | اختياري · فريد |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `entityType` | String? | اختياري · e.g., "جنية مصري" |
| `entityTypeCode` | String? | اختياري |
| `entityNumber` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `address` | String? | اختياري |
| `contactEmail` | String? | اختياري |
| `taxNumber1` | String? | اختياري |
| `taxNumber2` | String? | اختياري |
| `taxNumber3` | String? | اختياري |
| `isActive` | Boolean | — |
| `isOnboarded` | Boolean | — |
| `onboardedAt` | DateTime? | اختياري |
| `onboardingStep` | Int | — |
| `hasCompletedTour` | Boolean | — |
| `launchChecklist` | Json? | اختياري |
| `aiMonthlyTokenLimit` | Int | — |
| `aiTokensUsedThisMonth` | Int | — |
| `aiQuotaResetDate` | DateTime | الآن |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- 1→N `branches` → `Branch[]`
- 1→N `users` → `User[]`
- N→0..1 `settings` → `CompanySettings`
- 1→N `accounts` → `Account[]`
- 1→N `costCenters` → `CostCenter[]`
- 1→N `journalEntries` → `JournalEntry[]`
- 1→N `recurringJournalEntries` → `RecurringJournalEntry[]`
- 1→N `customers` → `Customer[]`
- 1→N `suppliers` → `Supplier[]`
- 1→N `delegates` → `Delegate[]`
- 1→N `currencies` → `Currency[]`
- 1→N `periods` → `Period[]`
- 1→N `items` → `Item[]`
- 1→N `units` → `Unit[]`
- 1→N `warehouses` → `Warehouse[]`
- 1→N `itemWarehouseBalances` → `ItemWarehouseBalance[]`
- 1→N `electronicInvoiceItems` → `ElectronicInvoiceItem[]`
- 1→N `electronicInvoiceCustomers` → `ElectronicInvoiceCustomer[]`
- 1→N `electronicInvoices` → `ElectronicInvoice[]`
- 1→N `priceLists` → `PriceList[]`
- 1→N `invoices` → `Invoice[]`
- 1→N `invoiceAdjustments` → `InvoiceAdjustment[]`
- 1→N `documentProfiles` → `DocumentProfile[]`
- 1→N `transactionSettings` → `TransactionSettings[]`
- 1→N `openingStocks` → `OpeningStock[]`
- 1→N `stocktaking` → `Stocktaking[]`
- 1→N `transfers` → `Transfer[]`
- 1→N `assemblies` → `Assembly[]`
- 1→N `disassemblies` → `Disassembly[]`
- 1→N `receipts` → `Receipt[]`
- 1→N `issues` → `Issue[]`
- 1→N `adjustments` → `Adjustment[]`
- 1→N `otherAdjustments` → `OtherAdjustment[]`
- 1→N `landedCostAllocations` → `LandedCostAllocation[]`
- 1→N `purchaseOrders` → `PurchaseOrder[]`
- 1→N `purchaseReturns` → `PurchaseReturn[]`
- 1→N `priceQuotes` → `PriceQuote[]`
- 1→N `serialNumbers` → `SerialNumber[]`
- 1→N `itemOffers` → `ItemOffer[]`
- 1→N `employees` → `Employee[]`
- 1→N `nationalities` → `Nationality[]`
- 1→N `religions` → `Religion[]`
- 1→N `maritalStatuses` → `MaritalStatus[]`
- 1→N `jobTitles` → `JobTitle[]`
- 1→N `departments` → `Department[]`
- 1→N `jobCadres` → `JobCadre[]`
- 1→N `cities` → `City[]`
- 1→N `wagePolicies` → `WagePolicy[]`
- 1→N `allowances` → `Allowance[]`
- 1→N `deductions` → `Deduction[]`
- 1→N `students` → `Student[]`
- 1→N `stages` → `Stage[]`
- 1→N `semesters` → `Semester[]`
- 1→N `collectors` → `Collector[]`
- 1→N `userGroups` → `UserGroup[]`
- 1→N `CostCenterMovement` → `CostCenterMovement[]`
- 1→N `banks` → `Bank[]`
- 1→N `bankAccounts` → `BankAccount[]`
- 1→N `safes` → `Safe[]`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `cashTransactionLines` → `CashTransactionLine[]`
- 1→N `exchangeRateHistories` → `ExchangeRateHistory[]`
- 1→N `paymentAllocations` → `PaymentAllocation[]`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `bankBoxRights` → `BankBoxRight[]`
- 1→N `SecuritiesReceipt` → `SecuritiesReceipt[]`
- 1→N `SecuritiesPayment` → `SecuritiesPayment[]`
- 1→N `SecuritiesRenewal` → `SecuritiesRenewal[]`
- 1→N `projects` → `Project[]`
- 1→N `contractors` → `Contractor[]`
- 1→N `subcontractors` → `Subcontractor[]`
- 1→N `subcontracts` → `Subcontract[]`
- 1→N `subcontractInvoices` → `SubcontractInvoice[]`
- 1→N `propertyProjects` → `PropertyProject[]`
- 1→N `postDatedCheques` → `PostDatedCheque[]`
- 1→N `rentalPoolAgreements` → `RentalPoolAgreement[]`
- 1→N `monthlySalaries` → `MonthlySalary[]`
- 1→N `housingAllowanceClearances` → `HousingAllowanceClearance[]`
- 1→N `endOfServiceClearances` → `EndOfServiceClearance[]`
- 1→N `annualLeaveEntitlementsClearances` → `AnnualLeaveEntitlementsClearance[]`
- 1→N `documentaryCreditDefinitions` → `DocumentaryCreditDefinition[]`
- 1→N `documentaryCredits` → `DocumentaryCredit[]`
- N→0..1 `letterOfGuaranteeSettings` → `LetterOfGuaranteeSettings`
- 1→N `lettersOfGuarantee` → `LetterOfGuarantee[]`
- 1→N `customerFollowups` → `CustomerFollowup[]`
- 1→N `withholdingTaxPayments` → `WithholdingTaxPayment[]`
- 1→N `endOfServiceDisbursements` → `EndOfServiceDisbursement[]`
- 1→N `annualLeaveEntitlementsDisbursements` → `AnnualLeaveEntitlementsDisbursement[]`
- 1→N `monthlySalariesDisbursements` → `MonthlySalariesDisbursement[]`
- 1→N `housingAllowanceEntitlementsDisbursements` → `HousingAllowanceEntitlementsDisbursement[]`
- 1→N `otherAdditionDiscountTypes` → `OtherAdditionDiscountType[]`
- 1→N `representativeCommissionQuantities` → `RepresentativeCommissionQuantity[]`
- 1→N `representativeCommissionValues` → `RepresentativeCommissionValue[]`
- 1→N `representativeCommissionPolicies` → `RepresentativeCommissionPolicy[]`
- 1→N `itemOrderLimitLists` → `ItemOrderLimitList[]`
- 1→N `clothingColors` → `ClothingColor[]`
- 1→N `clothingSizes` → `ClothingSize[]`
- 1→N `clothingCombos` → `ClothingCombo[]`
- 1→N `distributors` → `Distributor[]`
- 1→N `drivers` → `Driver[]`
- 1→N `customerCategories` → `CustomerCategory[]`
- 1→N `supplierCategories` → `SupplierCategory[]`
- 1→N `itemCategories` → `ItemCategory[]`
- 1→N `persons` → `Person[]`
- 1→N `personGroups` → `PersonGroup[]`
- 1→N `personItemPrices` → `PersonItemPrice[]`
- 1→N `itemCostHistory` → `ItemCostHistory[]`
- 1→N `inventoryMovements` → `InventoryMovement[]`
- 1→N `customerContracts` → `CustomerContract[]`
- 1→N `fiscalYears` → `FiscalYear[]`
- 1→N `fiscalPeriods` → `FiscalPeriod[]`
- 1→N `companySettingEntries` → `CompanySettingEntry[]`
- 1→N `documentSequences` → `DocumentSequence[]`
- 1→N `newModules` → `NewModule[]`
- 1→N `newModuleStores` → `NewModuleStore[]`
- 1→N `otherModuleRights` → `OtherModuleRight[]`
- 1→N `glPostingViolations` → `GlPostingViolation[]`
- 1→N `taxPeriods` → `TaxPeriod[]`
- 1→N `taxDeclarations` → `TaxDeclaration[]`
- 1→N `taxSettlements` → `TaxSettlement[]`
- 1→N `posTerminals` → `PosTerminal[]`
- 1→N `posShifts` → `PosShift[]`
- 1→N `posOrders` → `PosOrder[]`
- 1→N `eInvoiceSettings` → `EInvoiceSetting[]`
- 1→N `eInvoiceDocuments` → `EInvoiceDocument[]`
- N→0..1 `tradeSettings` → `TradeSettings`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- 1→N `guaranteeLetters` → `GuaranteeLetter[]`
- N→0..1 `hrSettings` → `HrSettings`
- 1→N `payrollRuns` → `PayrollRun[]`
- N→0..1 `manufacturingSettings` → `ManufacturingSettings`
- 1→N `billOfMaterials` → `BillOfMaterials[]`
- 1→N `productionOrders` → `ProductionOrder[]`
- N→0..1 `contractingSettings` → `ContractingSettings`
- 1→N `contractingProjects` → `ContractingProject[]`
- 1→N `contractExtracts` → `ContractExtract[]`
- 1→N `projectBOQItems` → `ProjectBOQItem[]`
- 1→N `boqRateAnalysisItems` → `BOQRateAnalysisItem[]`
- 1→N `boqMarkupStructures` → `BOQMarkupStructure[]`
- 1→N `executiveMeasurementSheets` → `ExecutiveMeasurementSheet[]`
- 1→N `clientContracts` → `ClientContract[]`
- 1→N `clientInvoices` → `ClientInvoice[]`
- 1→N `clientInvoiceItems` → `ClientInvoiceItem[]`
- 1→N `siteStockMaterials` → `SiteStockMaterial[]`
- 1→N `projectLettersOfGuarantee` → `ProjectLetterOfGuarantee[]`
- 1→N `lgActionHistories` → `LgActionHistory[]`
- 1→N `financialAdjustmentNotes` → `FinancialAdjustmentNote[]`
- N→0..1 `realEstateSettings` → `RealEstateSettings`
- 1→N `realEstateProjects` → `RealEstateProject[]`
- 1→N `realEstateReservations` → `RealEstateReservation[]`
- 1→N `unitContracts` → `UnitContract[]`
- N→0..1 `schoolSettings` → `SchoolSettings`
- 1→N `schoolAcademicYears` → `SchoolAcademicYear[]`
- 1→N `academicGrades` → `AcademicGrade[]`
- 1→N `schoolStudents` → `SchoolStudent[]`
- 1→N `studentFeeContracts` → `StudentFeeContract[]`
- 1→N `schoolBusRoutes` → `SchoolBusRoute[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`
- N→0..1 `tenantSubscription` → `TenantSubscription`
- 1→N `systemNotifications` → `SystemNotification[]`
- 1→N `documentLayoutConfigs` → `DocumentLayoutConfig[]`
- 1→N `accountPeriodBalances` → `AccountPeriodBalance[]`
- 1→N `partnerRunningBalances` → `PartnerRunningBalance[]`
- 1→N `aiConversations` → `AiConversation[]`
- 1→N `aiAuditLogs` → `AiAuditLog[]`
- 1→N `aiDocuments` → `AiDocument[]`
- 1→N `aiInsights` → `AiInsight[]`
- N→0..1 `aiSentinelSnapshot` → `AiSentinelSnapshot`
- 1→N `growthOpportunities` → `GrowthOpportunity[]`
- 1→N `growthOpportunityActions` → `GrowthOpportunityAction[]`
- 1→N `growthAttributions` → `GrowthAttribution[]`
- 1→N `userTourProgress` → `UserTourProgress[]`
- N→0..1 `whatsappConfig` → `CompanyWhatsappConfig`
- 1→N `whatsappAuthorizedUsers` → `WhatsappAuthorizedUser[]`

قيود فريدة: `@@unique([legacyCompanyCode])`

## `branches` (`Branch`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyBranchCode` | String? | اختياري |
| `serial` | String? | اختياري · فريد |
| `arabicName` | String | — |
| `branchNumber` | String? | اختياري |
| `activationNumber` | String? | اختياري |
| `priceList` | String? | اختياري |
| `registrationNumber` | String? | اختياري |
| `barcodePrice` | String? | اختياري · e.g., "بالجملة" |
| `governorate` | String? | اختياري |
| `district` | String? | اختياري |
| `streetName` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `buildingNumber` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `address` | String? | اختياري |
| `deletedAt` | DateTime? | اختياري |
| `defaultWarehouseId` | String? | اختياري |
| `defaultSafeId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `defaultWarehouse` → `Warehouse` اسم العلاقة: `BranchDefaultWarehouse` — FK `defaultWarehouseId` → `Warehouse.id` · onDelete SetNull
- N→0..1 `defaultSafe` → `Safe` اسم العلاقة: `BranchDefaultSafe` — FK `defaultSafeId` → `Safe.id` · onDelete SetNull
- 1→N `warehouses` → `Warehouse[]`
- 1→N `userBranchPermissions` → `UserBranchPermission[]`
- 1→N `electronicInvoices` → `ElectronicInvoice[]`
- 1→N `journalEntries` → `JournalEntry[]`
- 1→N `documentSequences` → `DocumentSequence[]`
- 1→N `itemCostHistory` → `ItemCostHistory[]`
- 1→N `inventoryMovements` → `InventoryMovement[]`
- 1→N `invoices` → `Invoice[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `taxPeriods` → `TaxPeriod[]`
- 1→N `posTerminals` → `PosTerminal[]`
- 1→N `posShifts` → `PosShift[]`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- 1→N `guaranteeLetters` → `GuaranteeLetter[]`
- 1→N `payrollRuns` → `PayrollRun[]`
- 1→N `productionOrders` → `ProductionOrder[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`
- 1→N `documentLayoutConfigs` → `DocumentLayoutConfig[]`
- 1→N `companySettingEntries` → `CompanySettingEntry[]`

قيود فريدة: `@@unique([companyId, legacyBranchCode])`

## `company_settings` (`CompanySettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `fiscalYearStart` | String? | اختياري |
| `fiscalYearEnd` | String? | اختياري |
| `defaultCurrency` | String? | اختياري |
| `journalEntryDigits` | Int? | اختياري |
| `allowNegativeBalance` | Boolean? | اختياري |
| `allowCostCenterWithoutAccount` | Boolean? | اختياري |
| `lockPostingBeforeDate` | String? | اختياري |
| `enableApprovalsWorkflow` | Boolean? | اختياري |
| `autoNumbering` | Boolean? | اختياري |
| `decimalsInAmounts` | Int? | اختياري |
| `accountsGuideDigits` | Int? | اختياري |
| `costCentersGuideDigits` | Int? | اختياري |
| `storesGuideDigits` | Int? | اختياري |
| `itemsGuideDigits` | Int? | اختياري |
| `dateUsage` | String? | اختياري · 'gregorian' | 'hijri' | 'both' |
| `operationsFromDate` | String? | اختياري |
| `dueSecuritiesWarningDays` | Int? | اختياري |
| `budgetAllowExceed` | Boolean? | اختياري |
| `budgetWarnHalf` | Boolean? | اختياري |
| `budgetWarnSame` | Boolean? | اختياري |
| `budgetWarnExceed` | Boolean? | اختياري |
| `budgetStopMessageOnly` | Boolean? | اختياري |
| `budgetStopLedger` | Boolean? | اختياري |
| `budgetStopOrigin` | Boolean? | اختياري |
| `budgetStopBoth` | Boolean? | اختياري |
| `backupPath` | String? | اختياري |
| `costMethod` | String? | اختياري · 'average' | 'fifo' | 'lifo' |
| `theme` | String? | اختياري · 'light' | 'dark' |
| `temporaryReceipts` | Boolean? | اختياري |
| `documentaryCredits` | Boolean? | اختياري |
| `advancedSettings` | Json? | اختياري · For flexible advanced settings |
| `logoUrl` | String? | اختياري |
| `accountDefinitions` | Json? | اختياري |
| `retainedEarningsAccountId` | String? | اختياري |
| `executiveWhatsAppPhone` | String? | اختياري |
| `autoPostGl` | Boolean | — |
| `pricingCalculationBasis` | String | — |
| `preventNegativeStock` | Boolean | — |
| `preventCashOverdraft` | Boolean | — |
| `enforceCostCenterForPnl` | Boolean | — |
| `preventSellingBelowCost` | Boolean | — |
| `roundingAccountId` | String? | اختياري |
| `exchangeGainLossAccountId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `roundingAccount` → `Account` اسم العلاقة: `CompanySettingsRoundingAccount` — FK `roundingAccountId` → `Account.id` · onDelete SetNull
- N→0..1 `exchangeGainLossAccount` → `Account` اسم العلاقة: `CompanySettingsExchangeAccount` — FK `exchangeGainLossAccountId` → `Account.id` · onDelete SetNull

فهارس: `@@index([roundingAccountId])` · `@@index([exchangeGainLossAccountId])`

## `company_setting_entries` (`CompanySettingEntry`)

Legacy CompanySetting name/value pairs (SerialStart*, GLPost, SaveUnbalanced, …). `branchId` NULL = company-wide row; non-null = a branch-scoped override (legacy stores `CustomersAccount` this way — see untbranchvariables.pas). MySQL unique indexes treat every NULL as distinct, so uniqueness of the `branchId IS NULL` (company-wide) row per (companyId, name) is enforced by the service layer (findFirst-then-create/update), not this DB constraint.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `name` | String | — |
| `value` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, branchId, name])`

فهارس: `@@index([companyId])`

## `fiscal_years` (`FiscalYear`)

Legacy Year table — fiscal year open/close (YearId)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyYearId` | String | — |
| `arabicName` | String? | اختياري |
| `englishName` | String? | اختياري |
| `startDate` | DateTime | — |
| `endDate` | DateTime | — |
| `status` | String | — |
| `closedAt` | DateTime? | اختياري |
| `closedBy` | String? | اختياري |
| `closingJournalEntryId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `fiscalPeriods` → `FiscalPeriod[]`
- 1→N `documentSequences` → `DocumentSequence[]`
- 1→N `journalEntries` → `JournalEntry[]`
- 1→N `invoices` → `Invoice[]`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `taxPeriods` → `TaxPeriod[]`
- 1→N `taxDeclarations` → `TaxDeclaration[]`
- 1→N `posShifts` → `PosShift[]`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- 1→N `guaranteeLetters` → `GuaranteeLetter[]`
- 1→N `payrollRuns` → `PayrollRun[]`
- 1→N `productionOrders` → `ProductionOrder[]`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`

قيود فريدة: `@@unique([companyId, legacyYearId])`

فهارس: `@@index([companyId, status])`

## `fiscal_periods` (`FiscalPeriod`)

Sub-periods within a fiscal year (monthly / custom slices)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `fiscalYearId` | String | — |
| `periodNumber` | Int | — |
| `name` | String? | اختياري |
| `startDate` | DateTime | — |
| `endDate` | DateTime | — |
| `isClosed` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete Cascade

قيود فريدة: `@@unique([fiscalYearId, periodNumber])`

فهارس: `@@index([companyId, startDate, endDate])`

## `document_sequences` (`DocumentSequence`)

Document numbering (GLNum, CashNum, …) — 8-digit zero-padded legacy serials

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `docType` | String | — |
| `scope` | String | — |
| `lastNumber` | Int | — |
| `padding` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull

قيود فريدة: `@@unique([companyId, branchId, fiscalYearId, docType])`

فهارس: `@@index([companyId, docType])`

## `new_modules` (`NewModule`)

Legacy NewModule — user-defined document-type instances per base type (BP, BR, KP, KR, RC, PC, TP, SI, PI, SR, PR, store types, …). Each row is one additional instance of a base document type (e.g. a second sales invoice module "SI02"). `fullCode` (baseType + moduleCode, e.g. "SI01") is the module-suffix used by legacy per-module settings such as SalesDaribaSI01 / AutoPostBP01 / PostTostoreSI02 / NotCreateGLSR01.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `baseType` | String | — |
| `moduleCode` | String | — |
| `fullCode` | String | — |
| `nameAr` | String | — |
| `nameEn` | String? | اختياري |
| `menuNameAr` | String | — |
| `menuNameEn` | String? | اختياري |
| `priceListId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `priceList` → `PriceList` — FK `priceListId` → `PriceList.id` · onDelete SetNull
- 1→N `stores` → `NewModuleStore[]`
- 1→N `invoices` → `Invoice[]`

قيود فريدة: `@@unique([companyId, baseType, moduleCode])` · `@@unique([companyId, fullCode])`

فهارس: `@@index([companyId, baseType])`

## `new_module_stores` (`NewModuleStore`)

Legacy NewModuleStore — warehouses a given user-defined store/document module is allowed to operate against.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `newModuleId` | String | — |
| `warehouseId` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `newModule` → `NewModule` — FK `newModuleId` → `NewModule.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade

قيود فريدة: `@@unique([newModuleId, warehouseId])`

فهارس: `@@index([companyId])`

## `other_module_rights` (`OtherModuleRight`)

Legacy OtherModulesRights — cross-module read permission: a voucher module (`sanadModule`, e.g. "BP01") is permitted to read/pull records from another module (`readModule`, e.g. "DK01"). Plain code strings, same as legacy (no FK — the referenced module may belong to a different base-type family than NewModule tracks natively, e.g. tax settlements).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `sanadModule` | String | — |
| `readModule` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, sanadModule, readModule])`

فهارس: `@@index([companyId])`

## `users` (`User`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `email` | String | فريد |
| `username` | String | فريد |
| `passwordHash` | String | — |
| `firstName` | String? | اختياري |
| `lastName` | String? | اختياري |
| `phone` | String? | اختياري |
| `preferredLanguage` | String? | اختياري |
| `avatarUrl` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `branchPermissions` → `UserBranchPermission[]`
- 1→N `groupMemberships` → `UserGroupMember[]`
- 1→N `permissions` → `UserPermission[]`
- 1→N `advancedPermissions` → `UserAdvancedPermission[]`
- 1→N `systemNotifications` → `SystemNotification[]`
- 1→N `approvedUnitResales` → `UnitResaleTransfer[]`
- 1→N `aiConversations` → `AiConversation[]`
- 1→N `aiAuditLogs` → `AiAuditLog[]`
- 1→N `aiDocuments` → `AiDocument[]`
- 1→N `tourProgress` → `UserTourProgress[]`

## `system_notifications` (`SystemNotification`)

In-app notifications for tenant users (stock alerts, posting, credit limits, etc.)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `userId` | String? | اختياري |
| `title` | String | — |
| `message` | String | — |
| `type` | String | — |
| `category` | String? | اختياري |
| `linkUrl` | String? | اختياري |
| `isRead` | Boolean | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade

فهارس: `@@index([companyId, userId, isRead, createdAt])` · `@@index([companyId, createdAt])`

## `ai_notifications` (`AiNotification`)

RBAC-targeted Gates Intelligence alerts. `targetRoles` is a JSON string[] (MySQL has no scalar lists).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `userId` | String? | اختياري |
| `targetRoles` | Json | — |
| `category` | NotificationCategory | — |
| `severity` | NotificationSeverity | — |
| `titleAr` | String | — |
| `messageAr` | String | — |
| `actionUrl` | String? | اختياري |
| `actionLabelAr` | String? | اختياري |
| `metadata` | Json? | اختياري |
| `fingerprint` | String? | اختياري |
| `isRead` | Boolean | — |
| `readAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |

فهارس: `@@index([companyId, createdAt])` · `@@index([companyId, isRead])` · `@@index([companyId, fingerprint])`

## `user_branch_permissions` (`UserBranchPermission`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `userId` | String | — |
| `branchId` | String | — |
| `companyId` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade
- N→1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade

قيود فريدة: `@@unique([userId, branchId])`

فهارس: `@@index([userId])` · `@@index([branchId])` · `@@index([companyId])`

## `user_groups` (`UserGroup`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري · passwordName |
| `arabicName` | String | — |
| `password` | String? | اختياري · Group password (optional) |
| `priceList` | String? | اختياري |
| `hidePricesInInvoices` | Boolean? | اختياري |
| `allowChangePaymentValue` | Boolean? | اختياري |
| `posManager` | Boolean? | اختياري |
| `deactivate` | Boolean? | اختياري |
| `studentAffairs` | Boolean? | اختياري |
| `busManager` | Boolean? | اختياري |
| `studentAccounts` | Boolean? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `users` → `UserGroupMember[]`

## `user_group_members` (`UserGroupMember`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `userId` | String | — |
| `userGroupId` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade
- N→1 `userGroup` → `UserGroup` — FK `userGroupId` → `UserGroup.id` · onDelete Cascade

قيود فريدة: `@@unique([userId, userGroupId])`

فهارس: `@@index([userId])` · `@@index([userGroupId])` · `@@index([companyId])`

## `user_permissions` (`UserPermission`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `userId` | String | — |
| `companyId` | String | — |
| `resource` | String | Limited length for MySQL key constraints |
| `action` | String | Limited length for MySQL key constraints |
| `module` | String? | اختياري · Optional module filter, limited length |
| `branchId` | String? | اختياري · Optional branch filter |
| `allow` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade

قيود فريدة: `@@unique([userId, resource, action, module, branchId])`

فهارس: `@@index([userId])` · `@@index([companyId])` · `@@index([resource, action])` · `@@index([module])` · `@@index([branchId])`

## `user_advanced_permissions` (`UserAdvancedPermission`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `userId` | String | — |
| `companyId` | String | — |
| `branchId` | String? | اختياري · Optional branch-specific permissions |
| `permissions` | Json | Flexible JSON for transfer/untransfer permissions |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade

فهارس: `@@index([userId])` · `@@index([companyId])` · `@@index([branchId])`

## `accounts` (`Account`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String | Account code |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `accountType` | String? | اختياري · نوع الحساب |
| `parentId` | String? | اختياري · Parent account |
| `accountSide` | String? | اختياري · مدين/دائن (legacy caption) |
| `accountNature` | AccountNature | — |
| `accountKind` | AccountKind | — |
| `statementType` | StatementType | — |
| `costCenterRequired` | String? | اختياري · إجباري/اختياري/بدون (legacy caption) |
| `requiresCostCenter` | Boolean | — |
| `defaultCostCenterId` | String? | اختياري |
| `warning` | String? | اختياري · مدين/دائن/بدون |
| `budget` | Decimal? | اختياري · Decimal(15,2) |
| `currencyCode` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `parent` → `Account` اسم العلاقة: `AccountHierarchy` — FK `parentId` → `Account.id`
- 1→N `children` → `Account[]` اسم العلاقة: `AccountHierarchy`
- N→0..1 `defaultCostCenter` → `CostCenter` اسم العلاقة: `AccountDefaultCostCenter` — FK `defaultCostCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `journalEntryLines` → `JournalEntryLine[]`
- 1→N `recurringJournalLines` → `RecurringJournalLine[]`
- 1→N `costCenterMovements` → `CostCenterMovement[]`
- 1→N `customerMainAccounts` → `Customer[]` اسم العلاقة: `CustomerMainAccount`
- 1→N `supplierMainAccounts` → `Supplier[]` اسم العلاقة: `SupplierMainAccount`
- 1→N `personMainAccounts` → `Person[]` اسم العلاقة: `PersonMainAccount`
- 1→N `employeeAdvanceAccounts` → `Employee[]` اسم العلاقة: `EmployeeAdvanceAccount`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `safesAsGl` → `Safe[]`
- 1→N `bankAccountsAsGl` → `BankAccount[]`
- 1→N `cashTransactionOffsets` → `CashTransaction[]`
- 1→N `cashTransactionLines` → `CashTransactionLine[]`
- 1→N `multiCollectionLines` → `MultiCollectionLine[]`
- 1→N `landedCostAllocations` → `LandedCostAllocation[]`
- 1→N `accountPeriodBalances` → `AccountPeriodBalance[]`
- 1→N `companySettingsRounding` → `CompanySettings[]` اسم العلاقة: `CompanySettingsRoundingAccount`
- 1→N `companySettingsExchange` → `CompanySettings[]` اسم العلاقة: `CompanySettingsExchangeAccount`
- 1→N `invoiceLineRevenueAccounts` → `InvoiceLine[]` اسم العلاقة: `InvoiceLineRevenueAccount`
- 1→N `invoiceAdjustmentAccounts` → `InvoiceAdjustment[]` اسم العلاقة: `AdjustmentAccount`
- 1→N `invoiceAdjustmentOffsetAccounts` → `InvoiceAdjustment[]` اسم العلاقة: `AdjustmentOffsetAccount`
- 1→N `transactionSettingsSales` → `TransactionSettings[]` اسم العلاقة: `SettingsSalesAccount`
- 1→N `transactionSettingsPurchaseReturns` → `TransactionSettings[]` اسم العلاقة: `SettingsPurchaseReturnAccount`
- 1→N `transactionSettingsCash` → `TransactionSettings[]` اسم العلاقة: `SettingsCashAccount`
- 1→N `transactionSettingsBankGl` → `TransactionSettings[]` اسم العلاقة: `SettingsBankGlAccount`
- 1→N `transactionSettingsOffset` → `TransactionSettings[]` اسم العلاقة: `SettingsOffsetAccount`
- 1→N `transactionSettingsCharges` → `TransactionSettings[]` اسم العلاقة: `SettingsChargesAccount`
- 1→N `warehouseInventoryAccounts` → `Warehouse[]` اسم العلاقة: `WarehouseInventoryAccount`
- 1→N `warehouseCostAccounts` → `Warehouse[]` اسم العلاقة: `WarehouseCostAccount`
- 1→N `warehouseGiftAccounts` → `Warehouse[]` اسم العلاقة: `WarehouseGiftAccount`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId])` · `@@index([defaultCostCenterId])` · `@@index([companyId, isActive])`

## `cost_centers` (`CostCenter`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `parentId` | String? | اختياري |
| `quantityBudget` | Decimal? | اختياري · Decimal(15,2) |
| `warning` | String? | اختياري · مدين/دائن/بدون |
| `budget` | Decimal? | اختياري · Decimal(15,2) |
| `currencyCode` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `parent` → `CostCenter` اسم العلاقة: `CostCenterHierarchy` — FK `parentId` → `CostCenter.id`
- 1→N `children` → `CostCenter[]` اسم العلاقة: `CostCenterHierarchy`
- 1→N `movements` → `CostCenterMovement[]`
- 1→N `journalEntryLines` → `JournalEntryLine[]`
- 1→N `recurringJournalLines` → `RecurringJournalLine[]`
- 1→N `cashTransactionLines` → `CashTransactionLine[]`
- 1→N `invoices` → `Invoice[]`
- 1→N `purchaseOrders` → `PurchaseOrder[]`
- 1→N `transfersFrom` → `Transfer[]` اسم العلاقة: `TransferFromCC`
- 1→N `transfersTo` → `Transfer[]` اسم العلاقة: `TransferToCC`
- 1→N `PurchaseReturn` → `PurchaseReturn[]`
- 1→N `PriceQuote` → `PriceQuote[]`
- 1→N `EmployeeContract` → `EmployeeContract[]`
- 1→N `employees` → `Employee[]`
- 1→N `contractingProjects` → `ContractingProject[]`
- 1→N `realEstateProjects` → `RealEstateProject[]`
- 1→N `propertyProjects` → `PropertyProject[]`
- 1→N `academicGrades` → `AcademicGrade[]`
- 1→N `invoiceLines` → `InvoiceLine[]`
- 1→N `invoiceAdjustments` → `InvoiceAdjustment[]`
- 1→N `documentProfiles` → `DocumentProfile[]`
- 1→N `transactionSettings` → `TransactionSettings[]`
- 1→N `accountsAsDefault` → `Account[]` اسم العلاقة: `AccountDefaultCostCenter`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId, parentId])`

## `cost_center_movements` (`CostCenterMovement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `accountId` | String | — |
| `costCenterId` | String | — |
| `date` | DateTime | — |
| `debit` | Decimal | Decimal(18,4) |
| `credit` | Decimal | Decimal(18,4) |
| `description` | String? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `account` → `Account` — FK `accountId` → `Account.id`
- N→1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id`

فهارس: `@@index([companyId, date])` · `@@index([accountId])` · `@@index([costCenterId])`

## `journal_entries` (`JournalEntry`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `legacyGlNum` | String? | اختياري |
| `voucherNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `descriptionAr` | String? | اختياري |
| `descriptionEn` | String? | اختياري |
| `description` | String? | اختياري |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `postingStatus` | String | — |
| `documentStatus` | String | — |
| `workflowStatus` | String | — |
| `workflowSubmittedAt` | DateTime? | اختياري |
| `workflowSubmittedBy` | String? | اختياري |
| `workflowApprovedAt` | DateTime? | اختياري |
| `workflowApprovedBy` | String? | اختياري |
| `workflowRejectedAt` | DateTime? | اختياري |
| `workflowRejectedBy` | String? | اختياري |
| `workflowRejectionReason` | String? | اختياري |
| `isBalanced` | Boolean | — |
| `isPosted` | Boolean | — |
| `isApproved` | Boolean | — |
| `isCyclic` | Boolean | — |
| `isRecurring` | Boolean | — |
| `isCancelled` | Boolean | — |
| `sourceType` | String? | اختياري |
| `sourceNumber` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `sourceId` | String? | اختياري |
| `sourceKind` | JournalSourceType | — |
| `entryType` | String? | اختياري |
| `activeSourceKey` | String? | اختياري |
| `reversalOfJournalEntryId` | String? | اختياري · فريد |
| `postedAt` | DateTime? | اختياري |
| `postedBy` | String? | اختياري |
| `deletedAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdBy` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Restrict
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete Restrict
- 1→N `lines` → `JournalEntryLine[]`
- 1→N `violations` → `GlPostingViolation[]`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `chequePortfolio` → `Cheque[]` اسم العلاقة: `ChequePortfolioJe`
- 1→N `chequeDeposit` → `Cheque[]` اسم العلاقة: `ChequeDepositJe`
- 1→N `chequeClear` → `Cheque[]` اسم العلاقة: `ChequeClearJe`
- 1→N `chequeIssue` → `Cheque[]` اسم العلاقة: `ChequeIssueJe`
- 1→N `chequeCancel` → `Cheque[]` اسم العلاقة: `ChequeCancelJe`
- 1→N `chequeEndorse` → `Cheque[]` اسم العلاقة: `ChequeEndorseJe`
- 1→N `chequeBounce` → `Cheque[]` اسم العلاقة: `ChequeBounceJe`
- 1→N `taxDeclarations` → `TaxDeclaration[]`
- 1→N `taxSettlements` → `TaxSettlement[]`
- 1→N `posShiftEndOfDay` → `PosShift[]` اسم العلاقة: `PosShiftEndJe`
- 1→N `posOrders` → `PosOrder[]` اسم العلاقة: `PosOrderJournalEntry`
- 1→N `invoiceAsPrimary` → `Invoice[]` اسم العلاقة: `InvoiceJournalEntry`
- 1→N `invoiceAsCost` → `Invoice[]` اسم العلاقة: `InvoiceCostJournalEntry`
- 1→N `stockIssues` → `Issue[]` اسم العلاقة: `IssueJournalEntry`
- 1→N `stockReceipts` → `Receipt[]` اسم العلاقة: `ReceiptJournalEntry`
- 1→N `stockTransfers` → `Transfer[]` اسم العلاقة: `TransferJournalEntry`
- 1→N `stockAdjustments` → `Adjustment[]` اسم العلاقة: `AdjustmentJournalEntry`
- 1→N `stocktakings` → `Stocktaking[]` اسم العلاقة: `StocktakingJournalEntry`
- 1→N `openingStocksAsJournal` → `OpeningStock[]` اسم العلاقة: `OpeningStockJournalEntry`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`
- 1→N `subcontractInvoices` → `SubcontractInvoice[]`
- 1→N `clientInvoices` → `ClientInvoice[]`
- 1→N `projectLettersOfGuarantee` → `ProjectLetterOfGuarantee[]`
- 1→N `postDatedCheques` → `PostDatedCheque[]`
- 1→N `adjustmentNotesPosted` → `FinancialAdjustmentNote[]` اسم العلاقة: `AdjustmentNoteJournal`
- 1→N `adjustmentNotesReversed` → `FinancialAdjustmentNote[]` اسم العلاقة: `AdjustmentNoteReversalOf`
- N→0..1 `reversalOf` → `JournalEntry` اسم العلاقة: `JournalEntryReversal` — FK `reversalOfJournalEntryId` → `JournalEntry.id` · onDelete Restrict
- N→0..1 `reversedBy` → `JournalEntry` اسم العلاقة: `JournalEntryReversal`

قيود فريدة: `@@unique([companyId, branchId, fiscalYearId, legacyGlNum])` · `@@unique([activeSourceKey])`

فهارس: `@@index([companyId, sourceType, sourceId])` · `@@index([companyId, sourceKind])` · `@@index([companyId, date])` · `@@index([companyId, fiscalYearId, isPosted, date])` · `@@index([companyId, postingStatus])` · `@@index([voucherNumber])` · `@@index([companyId, isPosted, isApproved])` · `@@index([companyId, isPosted, date(sort: Desc)], map: "idx_journal_entries_company_posted_date")`

## `journal_entry_lines` (`JournalEntryLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `journalEntryId` | String | — |
| `lineNumber` | Int | — |
| `accountId` | String | — |
| `costCenterId` | String? | اختياري |
| `descriptionAr` | String? | اختياري |
| `descriptionEn` | String? | اختياري |
| `description` | String? | اختياري |
| `debit` | Decimal | Decimal(18,4) |
| `credit` | Decimal | Decimal(18,4) |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `debitBase` | Decimal | Decimal(18,4) |
| `creditBase` | Decimal | Decimal(18,4) |
| `taxPercentCode` | String? | اختياري |
| `lineOrder` | Int | — |
| `partnerId` | String? | اختياري |
| `partnerType` | String? | اختياري |
| `isTiedToInvoice` | Boolean | — |
| `invoiceId` | String? | اختياري |
| `invoiceNumber` | String? | اختياري |

**العلاقات**

- N→1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Cascade
- N→1 `account` → `Account` — FK `accountId` → `Account.id`
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id`
- N→0..1 `invoice` → `Invoice` اسم العلاقة: `JournalLineTiedInvoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull

قيود فريدة: `@@unique([journalEntryId, lineNumber])`

فهارس: `@@index([journalEntryId])` · `@@index([accountId])` · `@@index([accountId, journalEntryId])` · `@@index([partnerId])` · `@@index([invoiceId])`

## `recurring_journal_entries` (`RecurringJournalEntry`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `templateNameAr` | String | — |
| `frequency` | RecurringFrequency | — |
| `notes` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `isActive` | Boolean | — |
| `lastGeneratedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- 1→N `lines` → `RecurringJournalLine[]`
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId, isActive])`

## `recurring_journal_lines` (`RecurringJournalLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `recurringEntryId` | String | — |
| `accountId` | String | — |
| `costCenterId` | String? | اختياري |
| `description` | String? | اختياري |
| `debit` | Decimal | Decimal(15,2) |
| `credit` | Decimal | Decimal(15,2) |

**العلاقات**

- N→1 `recurringEntry` → `RecurringJournalEntry` — FK `recurringEntryId` → `RecurringJournalEntry.id` · onDelete Cascade
- N→1 `account` → `Account` — FK `accountId` → `Account.id`
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id`

فهارس: `@@index([recurringEntryId])`

## `account_period_balances` (`AccountPeriodBalance`)

Pre-aggregated GL balances per calendar month. Updated atomically inside the same transaction as journal post / reverse so Trial Balance can read summaries instead of SUM() over journal_entry_lines.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `accountId` | String | — |
| `fiscalYear` | Int | — |
| `periodMonth` | Int | — |
| `debitTotal` | Decimal | Decimal(18,4) |
| `creditTotal` | Decimal | Decimal(18,4) |
| `netBalance` | Decimal | Decimal(18,4) |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→1 `account` → `Account` — FK `accountId` → `Account.id` · onDelete Restrict

قيود فريدة: `@@unique([companyId, accountId, fiscalYear, periodMonth], map: "apb_company_account_period_key")`

فهارس: `@@index([companyId, fiscalYear, periodMonth])` · `@@index([accountId])`

## `partner_running_balances` (`PartnerRunningBalance`)

Running AR/AP totals per partner + document currency. Original and company-base amounts are stored separately and must never be mixed.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `partnerId` | String | — |
| `partnerType` | String | — |
| `currencyCode` | String | — |
| `debitOriginal` | Decimal | Decimal(18,4) |
| `creditOriginal` | Decimal | Decimal(18,4) |
| `netOriginal` | Decimal | Decimal(18,4) |
| `debitBase` | Decimal | Decimal(18,4) |
| `creditBase` | Decimal | Decimal(18,4) |
| `netBase` | Decimal | Decimal(18,4) |
| `lastEntryDate` | DateTime? | اختياري |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict

قيود فريدة: `@@unique([companyId, partnerId, currencyCode])`

فهارس: `@@index([companyId])` · `@@index([partnerId])` · `@@index([companyId, partnerType])`

## `gl_posting_violations` (`GlPostingViolation`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `journalEntryId` | String | — |
| `violationType` | String | — |
| `accountCode` | String? | اختياري |
| `costCenterCode` | String? | اختياري |
| `message` | String? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Cascade

فهارس: `@@index([journalEntryId])`

## `customers` (`Customer`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `customerType` | String? | اختياري · company/individual |
| `how` | String? | اختياري · local/export/exempt |
| `nationality` | String? | اختياري |
| `taxData` | Boolean | — |
| `taxAuthority` | String? | اختياري |
| `taxAuthorityName` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `mobile` | String? | اختياري |
| `fax` | String? | اختياري |
| `email` | String? | اختياري |
| `website` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `area` | String? | اختياري |
| `street` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `poBox` | String? | اختياري |
| `mainAccountId` | String? | اختياري |
| `accountId` | String? | اختياري |
| `representativeId` | String? | اختياري |
| `priceListId` | String? | اختياري |
| `priceTier` | PriceTier | — |
| `linkedSupplierId` | String? | اختياري · فريد |
| `sellingPrice` | String? | اختياري |
| `transactionType` | String? | اختياري |
| `warning` | String? | اختياري · debtor/creditor |
| `estimatedBudget` | Decimal? | اختياري · Decimal(15,2) |
| `creditLimit` | Decimal? | اختياري · Decimal(18,4) |
| `paymentTermsDays` | Int? | اختياري |
| `customerCategoryId` | String? | اختياري |
| `currencyCode` | String? | اختياري |
| `balance` | Decimal | Decimal(15,2) |
| `contactDate` | DateTime? | اختياري |
| `contactDateHijri` | String? | اختياري |
| `gender` | String? | اختياري · ذكر/أنثى |
| `averagePrice` | Decimal? | اختياري · Decimal(15,2) |
| `role` | String? | اختياري · الدور (الأول/الثاني/الثالث) |
| `marketingChannelId` | String? | اختياري |
| `roomsCount` | Int? | اختياري |
| `propertyArea` | Decimal? | اختياري · Decimal(15,2) · Real estate property area |
| `bathroomsCount` | Int? | اختياري |
| `facade` | String? | اختياري · الواجهة |
| `transferTo` | String? | اختياري · بائع/مدير مبيعات |
| `employeeId` | String? | اختياري · الموظف المسؤول |
| `followUpDate` | DateTime? | اختياري |
| `followUpDateHijri` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `mainAccount` → `Account` اسم العلاقة: `CustomerMainAccount` — FK `mainAccountId` → `Account.id`
- N→0..1 `linkedSupplier` → `Supplier` اسم العلاقة: `CustomerToLinkedSupplier` — FK `linkedSupplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `customerCategory` → `CustomerCategory` — FK `customerCategoryId` → `CustomerCategory.id` · onDelete SetNull
- 1→N `invoices` → `Invoice[]`
- 1→N `electronicInvoiceCustomers` → `ElectronicInvoiceCustomer[]`
- 1→N `priceQuotes` → `PriceQuote[]`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `posOrders` → `PosOrder[]`
- 1→N `posTerminalsDefault` → `PosTerminal[]`
- 1→N `securitiesReceipts` → `SecuritiesReceipt[]`
- 1→N `securitiesPayments` → `SecuritiesPayment[]`
- 1→N `customerFollowups` → `CustomerFollowup[]` اسم العلاقة: `CustomerFollowups`
- 1→N `customerContracts` → `CustomerContract[]`
- 1→N `contractingProjects` → `ContractingProject[]`
- 1→N `clientContracts` → `ClientContract[]`
- 1→N `unitContracts` → `UnitContract[]`
- 1→N `realEstateReservations` → `RealEstateReservation[]`
- 1→N `unitResalesAsSeller` → `UnitResaleTransfer[]` اسم العلاقة: `ResaleSeller`
- 1→N `unitResalesAsBuyer` → `UnitResaleTransfer[]` اسم العلاقة: `ResaleBuyer`
- 1→N `rentalPoolAgreements` → `RentalPoolAgreement[]`
- 1→N `schoolStudents` → `SchoolStudent[]`
- N→0..1 `linkedBySupplier` → `Supplier` اسم العلاقة: `SupplierToLinkedCustomer`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`

فهارس: `@@index([companyId])` · `@@index([code])` · `@@index([customerCategoryId])` · `@@index([linkedSupplierId])` · `@@index([companyId, code])`

## `customer_categories` (`CustomerCategory`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `customers` → `Customer[]`

قيود فريدة: `@@unique([companyId, legacyCode])`

فهارس: `@@index([companyId])`

## `supplier_categories` (`SupplierCategory`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `suppliers` → `Supplier[]`

قيود فريدة: `@@unique([companyId, legacyCode])`

فهارس: `@@index([companyId])`

## `customer_contracts` (`CustomerContract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `customerId` | String | — |
| `operationsCenterId` | String? | اختياري · مركز العمليات |
| `contractType` | String? | اختياري · نقدي/آجل/جزء نقدي وجزء آجل/حسب الصنف |
| `cashPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `creditPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `daysCount` | Int? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete Cascade
- 1→N `groups` → `CustomerContractGroup[]`

فهارس: `@@index([companyId])` · `@@index([customerId])` · `@@index([code])`

## `customer_contract_groups` (`CustomerContractGroup`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `customerContractId` | String | — |
| `categoryId` | String? | اختياري |
| `groupNumber` | String? | اختياري |
| `groupName` | String? | اختياري |
| `days` | Int? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `customerContract` → `CustomerContract` — FK `customerContractId` → `CustomerContract.id` · onDelete Cascade
- N→0..1 `category` → `ItemCategory` — FK `categoryId` → `ItemCategory.id` · onDelete SetNull

فهارس: `@@index([customerContractId])` · `@@index([categoryId])`

## `suppliers` (`Supplier`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `supplierType` | String? | اختياري · company/individual |
| `how` | String? | اختياري · local/export/exempt |
| `nationality` | String? | اختياري |
| `taxData` | Boolean | — |
| `taxAuthority` | String? | اختياري |
| `taxAuthorityName` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `mobile` | String? | اختياري |
| `fax` | String? | اختياري |
| `email` | String? | اختياري |
| `website` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `area` | String? | اختياري |
| `street` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `poBox` | String? | اختياري |
| `barcode` | String? | اختياري |
| `fileNumber` | String? | اختياري · رقم الملف |
| `registrationNumber` | String? | اختياري · رقم التسجيل |
| `financier` | String? | اختياري · الممول |
| `discountType` | String? | اختياري · نوع الخصم |
| `mainAccountId` | String? | اختياري |
| `accountId` | String? | اختياري |
| `linkedCustomerId` | String? | اختياري · فريد |
| `transactionType` | String? | اختياري |
| `warning` | String? | اختياري · debtor/creditor |
| `estimatedBudget` | Decimal? | اختياري · Decimal(15,2) |
| `creditLimit` | Decimal? | اختياري · Decimal(18,4) |
| `paymentTermsDays` | Int? | اختياري |
| `currencyCode` | String? | اختياري |
| `supplierCategoryId` | String? | اختياري |
| `balance` | Decimal | Decimal(15,2) |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `mainAccount` → `Account` اسم العلاقة: `SupplierMainAccount` — FK `mainAccountId` → `Account.id`
- N→0..1 `supplierCategory` → `SupplierCategory` — FK `supplierCategoryId` → `SupplierCategory.id` · onDelete SetNull
- N→0..1 `linkedCustomer` → `Customer` اسم العلاقة: `SupplierToLinkedCustomer` — FK `linkedCustomerId` → `Customer.id` · onDelete SetNull
- 1→N `invoices` → `Invoice[]`
- 1→N `purchaseOrders` → `PurchaseOrder[]`
- 1→N `purchaseReturns` → `PurchaseReturn[]`
- 1→N `itemOffers` → `ItemOffer[]`
- 1→N `treasuryReceipts` → `TreasuryReceipt[]`
- 1→N `treasuryPayments` → `TreasuryPayment[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `endorsedCheques` → `Cheque[]` اسم العلاقة: `ChequeEndorsedSupplier`
- 1→N `securitiesReceipts` → `SecuritiesReceipt[]`
- 1→N `securitiesPayments` → `SecuritiesPayment[]`
- 1→N `electronicInvoiceCustomers` → `ElectronicInvoiceCustomer[]`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- N→0..1 `linkedByCustomer` → `Customer` اسم العلاقة: `CustomerToLinkedSupplier`
- 1→N `counterpartyOffsets` → `CounterpartyOffset[]`

فهارس: `@@index([companyId])` · `@@index([code])` · `@@index([linkedCustomerId])` · `@@index([supplierCategoryId])` · `@@index([companyId, code])`

## `delegates` (`Delegate`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `nationality` | String? | اختياري |
| `barcode` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `mobile` | String? | اختياري |
| `fax` | String? | اختياري |
| `email` | String? | اختياري |
| `website` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `area` | String? | اختياري |
| `street` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `poBox` | String? | اختياري |
| `address` | String? | اختياري |
| `commissionPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `commissionPolicyId` | String? | اختياري |
| `groupId` | String? | اختياري |
| `salesCommissionsId` | String? | اختياري |
| `priceListId` | String? | اختياري |
| `role` | String | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `invoices` → `Invoice[]`
- 1→N `PurchaseReturn` → `PurchaseReturn[]`
- 1→N `PriceQuote` → `PriceQuote[]`

فهارس: `@@index([companyId])` · `@@index([code])` · `@@index([companyId, role])`

## `currencies` (`Currency`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | Int? | اختياري |
| `code` | String | e.g., "EGP" |
| `symbol` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,6) |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `invoices` → `Invoice[]`
- 1→N `purchaseOrders` → `PurchaseOrder[]`
- 1→N `purchaseReturns` → `PurchaseReturn[]`
- 1→N `priceQuotes` → `PriceQuote[]`

قيود فريدة: `@@unique([companyId, code])` · `@@unique([companyId, serial])`

## `periods` (`Period`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String | — |
| `name` | String | — |
| `startDate` | DateTime | — |
| `endDate` | DateTime | — |
| `isActive` | Boolean | — |
| `isClosed` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, code])`

## `banks` (`Bank`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `bankAccounts` → `BankAccount[]`
- 1→N `receipts` → `TreasuryReceipt[]`
- 1→N `payments` → `TreasuryPayment[]`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId])`

## `bank_accounts` (`BankAccount`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `bankId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `accountNumber` | String? | اختياري |
| `iban` | String? | اختياري |
| `currencyCode` | String | — |
| `balance` | Decimal | Decimal(15,2) |
| `glAccountId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `bank` → `Bank` — FK `bankId` → `Bank.id` · onDelete Cascade
- N→0..1 `glAccount` → `Account` — FK `glAccountId` → `Account.id` · onDelete SetNull
- 1→N `receipts` → `TreasuryReceipt[]`
- 1→N `payments` → `TreasuryPayment[]`
- 1→N `cheques` → `Cheque[]`
- 1→N `bankBoxRights` → `BankBoxRight[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `posTerminals` → `PosTerminal[]`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- 1→N `guaranteeLetters` → `GuaranteeLetter[]`
- 1→N `projectLettersOfGuarantee` → `ProjectLetterOfGuarantee[]`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId, bankId])`

## `safes` (`Safe`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `currencyCode` | String | — |
| `balance` | Decimal | Decimal(15,2) |
| `glAccountId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `glAccount` → `Account` — FK `glAccountId` → `Account.id` · onDelete SetNull
- 1→N `receipts` → `TreasuryReceipt[]`
- 1→N `payments` → `TreasuryPayment[]`
- 1→N `bankBoxRights` → `BankBoxRight[]`
- 1→N `cashTransactions` → `CashTransaction[]`
- 1→N `posTerminals` → `PosTerminal[]`
- 1→N `branchesDefaultFor` → `Branch[]` اسم العلاقة: `BranchDefaultSafe`
- 1→N `documentProfiles` → `DocumentProfile[]` اسم العلاقة: `DocumentProfileTreasury`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId])`

## `treasury_receipts` (`TreasuryReceipt`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `serial` | String? | اختياري |
| `voucherNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `receiptType` | String | 'cash' | 'bank' | 'safe' | 'party' |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `accountId` | String? | اختياري |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,6) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `journalEntryId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `postedBy` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |
| `bankId` | String? | اختياري |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `account` → `Account` — FK `accountId` → `Account.id` · onDelete SetNull
- N→0..1 `safe` → `Safe` — FK `safeId` → `Safe.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `cashTransaction` → `CashTransaction`
- N→0..1 `Bank` → `Bank` — FK `bankId` → `Bank.id`

قيود فريدة: `@@unique([companyId, voucherNumber])`

فهارس: `@@index([companyId, date])` · `@@index([voucherNumber])` · `@@index([receiptType])` · `@@index([fiscalYearId])`

## `treasury_payments` (`TreasuryPayment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `serial` | String? | اختياري |
| `voucherNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `paymentType` | String | 'cash' | 'bank' | 'safe' | 'party' |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `accountId` | String? | اختياري |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,6) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `journalEntryId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `postedBy` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |
| `bankId` | String? | اختياري |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `account` → `Account` — FK `accountId` → `Account.id` · onDelete SetNull
- N→0..1 `safe` → `Safe` — FK `safeId` → `Safe.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `cashTransaction` → `CashTransaction`
- N→0..1 `Bank` → `Bank` — FK `bankId` → `Bank.id`

قيود فريدة: `@@unique([companyId, voucherNumber])`

فهارس: `@@index([companyId, date])` · `@@index([voucherNumber])` · `@@index([paymentType])` · `@@index([fiscalYearId])`

## `cash_transactions` (`CashTransaction`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `transactionKind` | String | — |
| `voucherNumber` | String? | اختياري |
| `date` | DateTime | — |
| `description` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `offsetAccountId` | String? | اختياري |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `exchangeRate` | Decimal? | اختياري · Decimal(18,6) |
| `hijriDate` | String? | اختياري |
| `bankReference` | String? | اختياري |
| `valueDate` | DateTime? | اختياري |
| `isRecurring` | Boolean | — |
| `documentRole` | String | — |
| `departmentId` | String? | اختياري |
| `sourceOrderId` | String? | اختياري |
| `invoiceId` | String? | اختياري |
| `treasuryReceiptId` | String? | اختياري · فريد |
| `treasuryPaymentId` | String? | اختياري · فريد |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `postedBy` | String? | اختياري |
| `isCancelled` | Boolean | — |
| `executionStatus` | OrderExecutionStatus | — |
| `executedAt` | DateTime? | اختياري |
| `executedBy` | String? | اختياري |
| `createdBy` | String? | اختياري |
| `workflowStatus` | String | — |
| `approvalState` | Json? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |
| `invoiceInstallmentId` | String? | اختياري |

**العلاقات**

- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `offsetAccount` → `Account` — FK `offsetAccountId` → `Account.id` · onDelete SetNull
- N→0..1 `safe` → `Safe` — FK `safeId` → `Safe.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `invoice` → `Invoice` اسم العلاقة: `InvoiceSettlements` — FK `invoiceId` → `Invoice.id` · onDelete SetNull
- N→0..1 `invoiceInstallment` → `InvoiceInstallment` — FK `invoiceInstallmentId` → `InvoiceInstallment.id` · onDelete SetNull
- N→0..1 `treasuryReceipt` → `TreasuryReceipt` — FK `treasuryReceiptId` → `TreasuryReceipt.id` · onDelete SetNull
- N→0..1 `treasuryPayment` → `TreasuryPayment` — FK `treasuryPaymentId` → `TreasuryPayment.id` · onDelete SetNull
- 1→N `unitInstallments` → `UnitInstallment[]`
- 1→N `schoolFeeInstallments` → `StudentFeeInstallment[]`
- 1→N `paymentAllocations` → `PaymentAllocation[]`
- 1→N `lines` → `CashTransactionLine[]`
- N→0..1 `department` → `Department` — FK `departmentId` → `Department.id` · onDelete SetNull
- N→0..1 `sourceOrder` → `CashTransaction` اسم العلاقة: `CashOrderVoucher` — FK `sourceOrderId` → `CashTransaction.id` · onDelete SetNull
- 1→N `vouchersFromOrder` → `CashTransaction[]` اسم العلاقة: `CashOrderVoucher`

فهارس: `@@index([companyId, date])` · `@@index([invoiceId])` · `@@index([invoiceInstallmentId])` · `@@index([companyId, safeId, isPosted, date])` · `@@index([departmentId])` · `@@index([sourceOrderId])` · `@@index([companyId, documentRole, transactionKind])` · `@@index([companyId, documentRole, executionStatus])` · `@@index([companyId, isRecurring])`

## `cash_transaction_lines` (`CashTransactionLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `cashTransactionId` | String | — |
| `accountId` | String | — |
| `description` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `costCenterId` | String? | اختياري |
| `entrySide` | String | — |
| `isTiedToInvoice` | Boolean | — |
| `invoiceId` | String? | اختياري |
| `lineOrder` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `cashTransaction` → `CashTransaction` — FK `cashTransactionId` → `CashTransaction.id` · onDelete Cascade
- N→1 `account` → `Account` — FK `accountId` → `Account.id` · onDelete Restrict
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull

فهارس: `@@index([companyId])` · `@@index([cashTransactionId])` · `@@index([accountId])` · `@@index([costCenterId])` · `@@index([invoiceId])`

## `exchange_rate_histories` (`ExchangeRateHistory`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `currencyCode` | String | — |
| `rate` | Decimal | Decimal(18,6) |
| `sourceType` | String | — |
| `sourceId` | String? | اختياري |
| `userId` | String? | اختياري |
| `recordedAt` | DateTime | الآن |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId, currencyCode, recordedAt])`

## `payment_allocations` (`PaymentAllocation`)

Open-item allocation: links a posted cash receipt/payment to specific invoices.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `cashTransactionId` | String | — |
| `invoiceId` | String | — |
| `counterpartyOffsetId` | String? | اختياري |
| `allocatedAmount` | Decimal | Decimal(15,2) |
| `allocatedAt` | DateTime | الآن |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→1 `cashTransaction` → `CashTransaction` — FK `cashTransactionId` → `CashTransaction.id` · onDelete Restrict
- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Restrict
- N→0..1 `counterpartyOffset` → `CounterpartyOffset` — FK `counterpartyOffsetId` → `CounterpartyOffset.id` · onDelete SetNull

فهارس: `@@index([companyId, invoiceId])` · `@@index([cashTransactionId])` · `@@index([counterpartyOffsetId])`

## `counterparty_offsets` (`CounterpartyOffset`)

AR/AP netting between linked customer and supplier (مقاصة)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `voucherNumber` | String? | اختياري |
| `date` | DateTime | — |
| `amount` | Decimal | Decimal(18,4) |
| `customerId` | String | — |
| `supplierId` | String | — |
| `journalEntryId` | String? | اختياري |
| `description` | String? | اختياري |
| `createdBy` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete Restrict
- N→1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete Restrict
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `paymentAllocations` → `PaymentAllocation[]`

فهارس: `@@index([companyId, date])` · `@@index([customerId])` · `@@index([supplierId])`

## `cheques` (`Cheque`)

Inward/outward cheque lifecycle (أوراق قبض / أوراق دفع)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `direction` | ChequeDirection | — |
| `status` | ChequeStatus | — |
| `chequeNumber` | String | — |
| `bankName` | String? | اختياري |
| `dueDate` | DateTime? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `sourceYearId` | String? | اختياري |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `description` | String? | اختياري |
| `invoiceId` | String? | اختياري |
| `portfolioJournalEntryId` | String? | اختياري |
| `depositJournalEntryId` | String? | اختياري |
| `clearJournalEntryId` | String? | اختياري |
| `issueJournalEntryId` | String? | اختياري |
| `cancelJournalEntryId` | String? | اختياري |
| `endorsedSupplierId` | String? | اختياري |
| `endorseJournalEntryId` | String? | اختياري |
| `bounceJournalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `endorsedSupplier` → `Supplier` اسم العلاقة: `ChequeEndorsedSupplier` — FK `endorsedSupplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull
- N→0..1 `portfolioJournalEntry` → `JournalEntry` اسم العلاقة: `ChequePortfolioJe` — FK `portfolioJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `depositJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeDepositJe` — FK `depositJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `clearJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeClearJe` — FK `clearJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `issueJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeIssueJe` — FK `issueJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `cancelJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeCancelJe` — FK `cancelJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `bounceJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeBounceJe` — FK `bounceJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `endorseJournalEntry` → `JournalEntry` اسم العلاقة: `ChequeEndorseJe` — FK `endorseJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `unitInstallments` → `UnitInstallment[]`

قيود فريدة: `@@unique([companyId, chequeNumber, direction])`

فهارس: `@@index([companyId, status])` · `@@index([companyId, direction, status])` · `@@index([invoiceId])` · `@@index([endorsedSupplierId])`

## `bank_box_rights` (`BankBoxRight`)

Legacy BankBoxRights — per-user safe/bank access

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `userId` | String | — |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `canView` | Boolean | — |
| `canPost` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `safe` → `Safe` — FK `safeId` → `Safe.id` · onDelete Cascade
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, userId, safeId, bankAccountId])`

فهارس: `@@index([companyId, userId])`

## `securities_receipts` (`SecuritiesReceipt`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `serial` | String? | اختياري |
| `receiptNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `securityType` | String | 'check' | 'promissory-note' | 'bond' | 'other' |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `issuerName` | String? | اختياري |
| `issuerBank` | String? | اختياري |
| `securityNumber` | String? | اختياري |
| `dueDate` | DateTime? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `entityName` | String? | اختياري |
| `destinationAccountId` | String? | اختياري |
| `commissionAmount` | Decimal? | اختياري · Decimal(15,2) |
| `commissionAccountId` | String? | اختياري |
| `isReceived` | Boolean | — |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull

قيود فريدة: `@@unique([companyId, receiptNumber])`

فهارس: `@@index([companyId, date])` · `@@index([receiptNumber])` · `@@index([securityType])`

## `securities_payments` (`SecuritiesPayment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `serial` | String? | اختياري |
| `paymentNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `securityType` | String | 'check' | 'promissory-note' | 'bond' | 'other' |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `payeeName` | String? | اختياري |
| `payeeBank` | String? | اختياري |
| `securityNumber` | String? | اختياري |
| `dueDate` | DateTime? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `entityName` | String? | اختياري |
| `destinationAccountId` | String? | اختياري |
| `commissionAmount` | Decimal? | اختياري · Decimal(15,2) |
| `commissionAccountId` | String? | اختياري |
| `isPaid` | Boolean | — |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull

قيود فريدة: `@@unique([companyId, paymentNumber])`

فهارس: `@@index([companyId, date])` · `@@index([paymentNumber])` · `@@index([securityType])`

## `multi_collection_lines` (`MultiCollectionLine`)

سجلات التحصيل المتعدد لأوراق القبض / الصرف

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `paperKind` | String | PAYMENT | RECEIPT |
| `paperId` | String | — |
| `accountId` | String | — |
| `amount` | Decimal | Decimal(15,2) |
| `description` | String? | اختياري |
| `collectionDate` | DateTime | الآن |
| `hijriDate` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `account` → `Account` — FK `accountId` → `Account.id`

فهارس: `@@index([companyId, paperKind, paperId])` · `@@index([accountId])`

## `securities_renewals` (`SecuritiesRenewal`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `serial` | String? | اختياري |
| `renewalNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `originalSecurityId` | String? | اختياري · Reference to receipt or payment |
| `originalSecurityType` | String? | اختياري · 'receipt' | 'payment' |
| `newDueDate` | DateTime? | اختياري |
| `newAmount` | Decimal? | اختياري · Decimal(15,2) |
| `renewalFee` | Decimal? | اختياري · Decimal(15,2) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, renewalNumber])`

فهارس: `@@index([companyId, date])` · `@@index([renewalNumber])`

## `units` (`Unit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `itemUnits` → `ItemUnit[]`
- 1→N `itemPrices` → `ItemPrice[]`
- 1→N `invoiceLines` → `InvoiceLine[]`
- 1→N `invoiceLineBaseUnits` → `InvoiceLine[]` اسم العلاقة: `InvoiceLineBaseUnit`
- 1→N `stocktakingLines` → `StocktakingLine[]`
- 1→N `purchaseOrderLines` → `PurchaseOrderLine[]`
- 1→N `purchaseOrderBaseUnits` → `PurchaseOrderLine[]` اسم العلاقة: `BaseUnit`
- 1→N `priceQuoteLines` → `PriceQuoteLine[]`
- 1→N `priceQuoteBaseUnits` → `PriceQuoteLine[]` اسم العلاقة: `BaseUnit`
- 1→N `itemOffers` → `ItemOffer[]` اسم العلاقة: `OfferSourceUnit`
- 1→N `PurchaseReturnLine` → `PurchaseReturnLine[]`
- 1→N `personItemPrices` → `PersonItemPrice[]`
- 1→N `posOrderLines` → `PosOrderLine[]`

قيود فريدة: `@@unique([companyId, code])`

## `item_categories` (`ItemCategory`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `groupType` | String? | اختياري |
| `parentCategoryId` | String? | اختياري |
| `isFeatured` | Boolean | — |
| `isTaxExempt` | Boolean | — |
| `taxRate` | Decimal? | اختياري · Decimal(5,2) |
| `defaultInventoryAccountId` | String? | اختياري |
| `defaultSalesAccountId` | String? | اختياري |
| `defaultCogsAccountId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `parentCategory` → `ItemCategory` اسم العلاقة: `ItemCategoryParent` — FK `parentCategoryId` → `ItemCategory.id` · onDelete SetNull
- 1→N `childCategories` → `ItemCategory[]` اسم العلاقة: `ItemCategoryParent`
- 1→N `items` → `Item[]`
- 1→N `contractGroups` → `CustomerContractGroup[]`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId])` · `@@index([companyId, isActive])` · `@@index([parentCategoryId])`

## `items` (`Item`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `mainAccountId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `specifications` | String? | اختياري |
| `itemType` | String? | اختياري · normal/pack-sheet/pack-kilo/roll |
| `weight` | Decimal? | اختياري · Decimal(10,3) |
| `categoryId` | String? | اختياري |
| `barcode` | String? | اختياري |
| `salesAccountId` | String? | اختياري |
| `cogsAccountId` | String? | اختياري |
| `defaultTaxPercent` | Decimal? | اختياري · Decimal(5,2) |
| `taxExemptionReason` | String? | اختياري |
| `manufacturerId` | String? | اختياري |
| `colorId` | String? | اختياري |
| `countryOfOrigin` | String? | اختياري |
| `quality` | String? | اختياري |
| `size` | String? | اختياري |
| `property1` | String? | اختياري |
| `property2` | String? | اختياري |
| `property3` | String? | اختياري |
| `property4` | String? | اختياري |
| `property5` | String? | اختياري |
| `useExpirationDate` | Boolean | — |
| `inactiveItem` | Boolean | — |
| `notSubjectToTerms` | Boolean | — |
| `cannotBeReturned` | Boolean | — |
| `noSellBelowCost` | Boolean | — |
| `useSerialNumber` | Boolean | — |
| `clothingItem` | Boolean | — |
| `upperLimit` | Decimal? | اختياري · Decimal(15,3) |
| `orderLimit` | Decimal? | اختياري · Decimal(15,3) |
| `orderLimitPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `lowerLimit` | Decimal? | اختياري · Decimal(15,3) |
| `beginningBalance` | Decimal? | اختياري · Decimal(15,3) |
| `beginningCostPrice` | Decimal? | اختياري · Decimal(15,2) |
| `priceRetail` | Decimal | Decimal(18,4) |
| `priceSemiWholesale` | Decimal | Decimal(18,4) |
| `priceWholesale` | Decimal | Decimal(18,4) |
| `priceProjects` | Decimal | Decimal(18,4) |
| `isService` | Boolean | — |
| `isAssembly` | Boolean | — |
| `isTaxExempt` | Boolean | — |
| `consumerPrice` | Decimal | Decimal(18,4) |
| `retailPrice` | Decimal | Decimal(18,4) |
| `representativePrice` | Decimal | Decimal(18,4) |
| `exportPrice` | Decimal | Decimal(18,4) |
| `averageCost` | Decimal | Decimal(18,4) |
| `lastPurchasePrice` | Decimal | Decimal(18,4) |
| `priceMode` | String? | اختياري |
| `priceCurrency` | String? | اختياري |
| `extraAssemblyCost` | Decimal? | اختياري · Decimal(18,4) |
| `extraAssemblyCostPct` | Decimal? | اختياري · Decimal(18,4) |
| `purchaseCount` | Int? | اختياري |
| `minPurchaseQty` | Decimal? | اختياري · Decimal(18,4) |
| `assemblyComponents` | Json? | اختياري |
| `preferredSuppliers` | Json? | اختياري |
| `imageUrl` | String? | اختياري |
| `defaultWarehouseId` | String? | اختياري |
| `priceSource` | String? | اختياري · price_list | item_card |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `category` → `ItemCategory` — FK `categoryId` → `ItemCategory.id` · onDelete SetNull
- 1→N `units` → `ItemUnit[]`
- 1→N `prices` → `ItemPrice[]`
- 1→N `quantities` → `ItemQuantity[]`
- 1→N `warehouseBalances` → `ItemWarehouseBalance[]`
- 1→N `invoiceLines` → `InvoiceLine[]`
- 1→N `electronicInvoiceItems` → `ElectronicInvoiceItem[]`
- 1→N `openingStockLines` → `OpeningStockLine[]`
- 1→N `stocktakingLines` → `StocktakingLine[]`
- 1→N `transferLines` → `TransferLine[]`
- 1→N `assembledItems` → `AssemblyLine[]` اسم العلاقة: `AssembledItem`
- 1→N `componentItems` → `AssemblyComponent[]` اسم العلاقة: `ComponentItem`
- 1→N `disassembledItems` → `DisassemblyLine[]` اسم العلاقة: `DisassembledItem`
- 1→N `disassemblyComponents` → `DisassemblyComponent[]` اسم العلاقة: `DisassemblyComponentItem`
- 1→N `receiptLines` → `ReceiptLine[]`
- 1→N `issueLines` → `IssueLine[]`
- 1→N `adjustmentLines` → `AdjustmentLine[]`
- 1→N `otherAdjustmentLines` → `OtherAdjustmentLine[]`
- 1→N `purchaseReturnLines` → `PurchaseReturnLine[]`
- 1→N `priceQuoteLines` → `PriceQuoteLine[]`
- 1→N `itemOffersFrom` → `ItemOffer[]` اسم العلاقة: `FromItem`
- 1→N `itemOffersTo` → `ItemOffer[]` اسم العلاقة: `ToItem`
- 1→N `PurchaseOrderLine` → `PurchaseOrderLine[]`
- 1→N `costHistory` → `ItemCostHistory[]`
- 1→N `inventoryMovements` → `InventoryMovement[]`
- 1→N `personItemPrices` → `PersonItemPrice[]`
- 1→N `posOrderLines` → `PosOrderLine[]`
- 1→N `lcReceiptLines` → `LcReceiptLine[]`
- 1→N `bomAsFinished` → `BillOfMaterials[]` اسم العلاقة: `BomFinishedItem`
- 1→N `bomAsRaw` → `BomLine[]` اسم العلاقة: `BomRawItem`
- 1→N `productionFinished` → `ProductionOrder[]` اسم العلاقة: `ProductionFinishedItem`
- 1→N `productionIssueLines` → `ProductionMaterialIssueLine[]` اسم العلاقة: `ProductionIssueRawItem`
- 1→N `landedCostAllocationLines` → `LandedCostAllocationLine[]`
- 1→N `materialReconciliationLogs` → `MaterialReconciliationLog[]`
- 1→N `commissionQuantityLines` → `RepresentativeCommissionQuantity[]`
- 1→N `orderLimitLines` → `ItemOrderLimitLine[]`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([companyId, isActive])` · `@@index([categoryId])` · `@@index([companyId, barcode])` · `@@index([defaultWarehouseId])`

## `item_units` (`ItemUnit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `itemId` | String | — |
| `unitId` | String | — |
| `conversionFactor` | Decimal | Decimal(15,6) |
| `isFactorFixed` | Boolean | — |
| `isBaseUnit` | Boolean | — |

**العلاقات**

- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id`

قيود فريدة: `@@unique([itemId, unitId])`

## `price_lists` (`PriceList`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `description` | String? | اختياري |
| `discountPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `currencyCode` | String? | اختياري |
| `priceMode` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `prices` → `ItemPrice[]`
- 1→N `newModules` → `NewModule[]`

قيود فريدة: `@@unique([companyId, code])`

## `item_prices` (`ItemPrice`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `itemId` | String | — |
| `priceListId` | String | — |
| `unitId` | String | — |
| `price` | Decimal | Decimal(15,2) |
| `discount` | Decimal? | اختياري · Decimal(8,4) |
| `wholesale` | Decimal? | اختياري · Decimal(18,4) |
| `semiWholesale` | Decimal? | اختياري · Decimal(18,4) |
| `exportPrice` | Decimal? | اختياري · Decimal(18,4) |
| `representativePrice` | Decimal? | اختياري · Decimal(18,4) |
| `retailPrice` | Decimal? | اختياري · Decimal(18,4) |
| `consumerPrice` | Decimal? | اختياري · Decimal(18,4) |

**العلاقات**

- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `priceList` → `PriceList` — FK `priceListId` → `PriceList.id` · onDelete Cascade
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id`

قيود فريدة: `@@unique([itemId, priceListId, unitId])`

## `warehouses` (`Warehouse`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `legacyStoreCode` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `branchId` | String? | اختياري |
| `storeType` | String? | اختياري |
| `parentWarehouseId` | String? | اختياري |
| `inventoryAccountId` | String? | اختياري |
| `costAccountId` | String? | اختياري |
| `giftAccountId` | String? | اختياري |
| `address` | String? | اختياري |
| `keeperName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id`
- N→0..1 `parentWarehouse` → `Warehouse` اسم العلاقة: `WarehouseParent` — FK `parentWarehouseId` → `Warehouse.id` · onDelete SetNull
- 1→N `childWarehouses` → `Warehouse[]` اسم العلاقة: `WarehouseParent`
- N→0..1 `inventoryAccount` → `Account` اسم العلاقة: `WarehouseInventoryAccount` — FK `inventoryAccountId` → `Account.id` · onDelete SetNull
- N→0..1 `costAccount` → `Account` اسم العلاقة: `WarehouseCostAccount` — FK `costAccountId` → `Account.id` · onDelete SetNull
- N→0..1 `giftAccount` → `Account` اسم العلاقة: `WarehouseGiftAccount` — FK `giftAccountId` → `Account.id` · onDelete SetNull
- 1→N `branchesDefaultFor` → `Branch[]` اسم العلاقة: `BranchDefaultWarehouse`
- 1→N `locations` → `Location[]`
- 1→N `quantities` → `ItemQuantity[]`
- 1→N `warehouseBalances` → `ItemWarehouseBalance[]`
- 1→N `invoices` → `Invoice[]`
- 1→N `openingStockLines` → `OpeningStockLine[]`
- 1→N `stocktaking` → `Stocktaking[]`
- 1→N `stocktakingLines` → `StocktakingLine[]`
- 1→N `transfersFrom` → `Transfer[]` اسم العلاقة: `TransferFrom`
- 1→N `transfersTo` → `Transfer[]` اسم العلاقة: `TransferTo`
- 1→N `assemblies` → `Assembly[]`
- 1→N `disassemblies` → `Disassembly[]`
- 1→N `receipts` → `Receipt[]`
- 1→N `issues` → `Issue[]`
- 1→N `adjustments` → `Adjustment[]`
- 1→N `otherAdjustments` → `OtherAdjustment[]`
- 1→N `purchaseOrders` → `PurchaseOrder[]`
- 1→N `purchaseReturns` → `PurchaseReturn[]`
- 1→N `priceQuotes` → `PriceQuote[]`
- 1→N `inventoryMovements` → `InventoryMovement[]`
- 1→N `newModuleStores` → `NewModuleStore[]`
- 1→N `posTerminals` → `PosTerminal[]`
- 1→N `lettersOfCredit` → `LetterOfCredit[]`
- 1→N `productionOrdersRaw` → `ProductionOrder[]` اسم العلاقة: `ProductionRawWarehouse`
- 1→N `productionOrdersFinished` → `ProductionOrder[]` اسم العلاقة: `ProductionFinishedWarehouse`
- 1→N `invoiceLines` → `InvoiceLine[]`
- 1→N `documentProfiles` → `DocumentProfile[]` اسم العلاقة: `DocumentProfileWarehouse`
- 1→N `transactionSettings` → `TransactionSettings[]`
- 1→N `itemOrderLimitLists` → `ItemOrderLimitList[]`

فهارس: `@@index([companyId])` · `@@index([code])` · `@@index([parentWarehouseId])` · `@@index([inventoryAccountId])` · `@@index([costAccountId])` · `@@index([giftAccountId])`

## `locations` (`Location`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `warehouseId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- 1→N `quantities` → `ItemQuantity[]`
- 1→N `openingStockLines` → `OpeningStockLine[]`
- 1→N `stocktakingLines` → `StocktakingLine[]`
- 1→N `transferLinesFrom` → `TransferLine[]` اسم العلاقة: `TransferFromLocation`
- 1→N `transferLinesTo` → `TransferLine[]` اسم العلاقة: `TransferToLocation`
- 1→N `receiptLines` → `ReceiptLine[]`
- 1→N `issueLines` → `IssueLine[]`
- 1→N `adjustmentLines` → `AdjustmentLine[]`
- 1→N `otherAdjustmentLines` → `OtherAdjustmentLine[]`
- 1→N `PurchaseReturnLine` → `PurchaseReturnLine[]`
- 1→N `inventoryMovements` → `InventoryMovement[]`

فهارس: `@@index([warehouseId])`

## `item_quantities` (`ItemQuantity`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `itemId` | String | — |
| `warehouseId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |

**العلاقات**

- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete Cascade

قيود فريدة: `@@unique([itemId, warehouseId, locationId])`

فهارس: `@@index([itemId, warehouseId])`

## `item_order_limit_lists` (`ItemOrderLimitList`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `warehouseId` | String | — |
| `description` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Restrict
- 1→N `lines` → `ItemOrderLimitLine[]`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([companyId])` · `@@index([warehouseId])`

## `item_order_limit_lines` (`ItemOrderLimitLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `listId` | String | — |
| `itemId` | String | — |
| `orderLimit` | Decimal | Decimal(15,3) |

**العلاقات**

- N→1 `list` → `ItemOrderLimitList` — FK `listId` → `ItemOrderLimitList.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade

قيود فريدة: `@@unique([listId, itemId])`

فهارس: `@@index([itemId])`

## `clothing_colors` (`ClothingColor`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `hex` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `combos` → `ClothingCombo[]`

فهارس: `@@index([companyId])`

## `clothing_sizes` (`ClothingSize`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `sortOrder` | Int | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `combos` → `ClothingCombo[]`

فهارس: `@@index([companyId])`

## `clothing_combos` (`ClothingCombo`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `colorId` | String | — |
| `sizeId` | String | — |
| `barcode` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `color` → `ClothingColor` — FK `colorId` → `ClothingColor.id` · onDelete Cascade
- N→1 `size` → `ClothingSize` — FK `sizeId` → `ClothingSize.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, colorId, sizeId])`

فهارس: `@@index([companyId])`

## `item_warehouse_balances` (`ItemWarehouseBalance`)

Warehouse-level live stock (Odoo stock_quant analogue). Location splits stay on ItemQuantity.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `itemId` | String | — |
| `warehouseId` | String | — |
| `quantityOnHand` | Decimal | Decimal(18,4) |
| `reservedQuantity` | Decimal | Decimal(18,4) |
| `averageCost` | Decimal | Decimal(18,4) |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, itemId, warehouseId])`

فهارس: `@@index([companyId])` · `@@index([itemId])` · `@@index([warehouseId])`

## `opening_stocks` (`OpeningStock`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `OpeningStockJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `OpeningStockLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([date])` · `@@index([journalEntryId])`

## `opening_stock_lines` (`OpeningStockLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `openingStockId` | String | — |
| `itemId` | String | — |
| `warehouseId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal | Decimal(15,2) |
| `total` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `openingStock` → `OpeningStock` — FK `openingStockId` → `OpeningStock.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete Cascade

فهارس: `@@index([openingStockId])` · `@@index([itemId])` · `@@index([warehouseId])`

## `stocktaking` (`Stocktaking`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalShortage` | Decimal | Decimal(15,2) |
| `totalIncrease` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `StocktakingJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `StocktakingLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])` · `@@index([journalEntryId])`

## `stocktaking_lines` (`StocktakingLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `stocktakingId` | String | — |
| `itemId` | String | — |
| `warehouseId` | String | — |
| `locationId` | String? | اختياري |
| `unitId` | String? | اختياري |
| `bookQuantity` | Decimal | Decimal(15,3) · System quantity |
| `actualQuantity` | Decimal | Decimal(15,3) · Physical count |
| `unitPrice` | Decimal | Decimal(15,2) |
| `shortageQuantity` | Decimal? | اختياري · Decimal(15,3) · When actual < book |
| `increaseQuantity` | Decimal? | اختياري · Decimal(15,3) · When actual > book |
| `shortageTotal` | Decimal? | اختياري · Decimal(15,2) |
| `increaseTotal` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `stocktaking` → `Stocktaking` — FK `stocktakingId` → `Stocktaking.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete Cascade
- N→0..1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete SetNull

فهارس: `@@index([stocktakingId])` · `@@index([itemId])` · `@@index([warehouseId])`

## `transfers` (`Transfer`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `fromWarehouseId` | String | — |
| `toWarehouseId` | String | — |
| `fromCostCenterId` | String? | اختياري |
| `toCostCenterId` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `fromWarehouse` → `Warehouse` اسم العلاقة: `TransferFrom` — FK `fromWarehouseId` → `Warehouse.id` · onDelete Cascade
- N→1 `toWarehouse` → `Warehouse` اسم العلاقة: `TransferTo` — FK `toWarehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `fromCostCenter` → `CostCenter` اسم العلاقة: `TransferFromCC` — FK `fromCostCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `toCostCenter` → `CostCenter` اسم العلاقة: `TransferToCC` — FK `toCostCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `TransferJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `TransferLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([fromWarehouseId])` · `@@index([toWarehouseId])` · `@@index([date])` · `@@index([journalEntryId])`

## `transfer_lines` (`TransferLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `transferId` | String | — |
| `itemId` | String | — |
| `fromLocationId` | String? | اختياري |
| `toLocationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `transfer` → `Transfer` — FK `transferId` → `Transfer.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `fromLocation` → `Location` اسم العلاقة: `TransferFromLocation` — FK `fromLocationId` → `Location.id` · onDelete SetNull
- N→0..1 `toLocation` → `Location` اسم العلاقة: `TransferToLocation` — FK `toLocationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([transferId])` · `@@index([itemId])`

## `assemblies` (`Assembly`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- 1→N `lines` → `AssemblyLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])`

## `assembly_lines` (`AssemblyLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `assemblyId` | String | — |
| `assembledItemId` | String | — |
| `assembledQuantity` | Decimal | Decimal(15,3) |
| `assembledUnitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `assembledTotal` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `assembly` → `Assembly` — FK `assemblyId` → `Assembly.id` · onDelete Cascade
- N→1 `assembledItem` → `Item` اسم العلاقة: `AssembledItem` — FK `assembledItemId` → `Item.id` · onDelete Cascade
- 1→N `components` → `AssemblyComponent[]`

فهارس: `@@index([assemblyId])` · `@@index([assembledItemId])`

## `assembly_components` (`AssemblyComponent`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `assemblyLineId` | String | — |
| `componentItemId` | String | — |
| `quantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `assemblyLine` → `AssemblyLine` — FK `assemblyLineId` → `AssemblyLine.id` · onDelete Cascade
- N→1 `componentItem` → `Item` اسم العلاقة: `ComponentItem` — FK `componentItemId` → `Item.id` · onDelete Cascade

فهارس: `@@index([assemblyLineId])` · `@@index([componentItemId])`

## `disassemblies` (`Disassembly`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- 1→N `lines` → `DisassemblyLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])`

## `disassembly_lines` (`DisassemblyLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `disassemblyId` | String | — |
| `disassembledItemId` | String | — |
| `disassembledQuantity` | Decimal | Decimal(15,3) |
| `disassembledUnitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `disassembledTotal` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `disassembly` → `Disassembly` — FK `disassemblyId` → `Disassembly.id` · onDelete Cascade
- N→1 `disassembledItem` → `Item` اسم العلاقة: `DisassembledItem` — FK `disassembledItemId` → `Item.id` · onDelete Cascade
- 1→N `components` → `DisassemblyComponent[]`

فهارس: `@@index([disassemblyId])` · `@@index([disassembledItemId])`

## `disassembly_components` (`DisassemblyComponent`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `disassemblyLineId` | String | — |
| `componentItemId` | String | — |
| `quantity` | Decimal | Decimal(15,3) · Quantity per disassembled item |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `disassemblyLine` → `DisassemblyLine` — FK `disassemblyLineId` → `DisassemblyLine.id` · onDelete Cascade
- N→1 `componentItem` → `Item` اسم العلاقة: `DisassemblyComponentItem` — FK `componentItemId` → `Item.id` · onDelete Cascade

فهارس: `@@index([disassemblyLineId])` · `@@index([componentItemId])`

## `receipts` (`Receipt`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `ReceiptJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `ReceiptLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])` · `@@index([journalEntryId])`

## `receipt_lines` (`ReceiptLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `receiptId` | String | — |
| `itemId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `receipt` → `Receipt` — FK `receiptId` → `Receipt.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([receiptId])` · `@@index([itemId])`

## `issues` (`Issue`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `IssueJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `IssueLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])` · `@@index([journalEntryId])`

## `issue_lines` (`IssueLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `issueId` | String | — |
| `itemId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `issue` → `Issue` — FK `issueId` → `Issue.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([issueId])` · `@@index([itemId])`

## `adjustments` (`Adjustment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `journalEntryId` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `AdjustmentJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `AdjustmentLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])` · `@@index([journalEntryId])`

## `adjustment_lines` (`AdjustmentLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `adjustmentId` | String | — |
| `itemId` | String | — |
| `locationId` | String? | اختياري |
| `bookQuantity` | Decimal | Decimal(15,3) · System quantity (القيمة الدفترية) |
| `actualQuantity` | Decimal | Decimal(15,3) · Desired quantity (القيمة الفعلية) |
| `adjustmentQuantity` | Decimal | Decimal(15,3) · actualQuantity - bookQuantity (positive = increase, negative = decrease) |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `adjustmentTotal` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `adjustment` → `Adjustment` — FK `adjustmentId` → `Adjustment.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([adjustmentId])` · `@@index([itemId])`

## `landed_cost_allocations` (`LandedCostAllocation`)

H9 fix — landed-cost capitalization. Freight/customs/insurance/handling incurred to bring a PURCHASE invoice's goods into the warehouse are initially recorded (e.g. paid to a customs broker) against `expenseAccountId`; this document reallocates that already-recorded cost out of the expense account and into the received items' inventory value — proportional to each line's merchandise value — via a reclass journal entry and a moving-average cost top-up (see item-cost.service.ts#capitalizeAdditionalCostInTx). Never mutates the original invoice or its cost history.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `invoiceId` | String | — |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(18,4) |
| `expenseAccountId` | String | — |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Restrict
- N→1 `expenseAccount` → `Account` — FK `expenseAccountId` → `Account.id` · onDelete Restrict
- 1→N `lines` → `LandedCostAllocationLine[]`

فهارس: `@@index([companyId])` · `@@index([invoiceId])`

## `landed_cost_allocation_lines` (`LandedCostAllocationLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `allocationId` | String | — |
| `invoiceLineId` | String | — |
| `itemId` | String | — |
| `merchandiseValue` | Decimal | Decimal(18,4) · this line's share of the invoice's merchandise value (the allocation base) |
| `allocatedAmount` | Decimal | Decimal(18,4) · landed cost allocated to this line |
| `quantity` | Decimal | Decimal(18,4) · snapshot of invoiceLine.baseQuantity at allocation time |
| `unitCostAdded` | Decimal | Decimal(18,4) · allocatedAmount / quantity — what got added to the item's average cost |

**العلاقات**

- N→1 `allocation` → `LandedCostAllocation` — FK `allocationId` → `LandedCostAllocation.id` · onDelete Cascade
- N→1 `invoiceLine` → `InvoiceLine` — FK `invoiceLineId` → `InvoiceLine.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade

فهارس: `@@index([allocationId])` · `@@index([invoiceLineId])`

## `other_adjustments` (`OtherAdjustment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `warehouseId` | String | — |
| `totalAmount` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- 1→N `lines` → `OtherAdjustmentLine[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([warehouseId])` · `@@index([date])`

## `other_adjustment_lines` (`OtherAdjustmentLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `otherAdjustmentId` | String | — |
| `itemId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `adjustmentType` | String | 'addition' or 'discount' |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `otherAdjustment` → `OtherAdjustment` — FK `otherAdjustmentId` → `OtherAdjustment.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull
- 1→N `sources` → `OtherAdjustmentSource[]`

فهارس: `@@index([otherAdjustmentId])` · `@@index([itemId])`

## `other_adjustment_sources` (`OtherAdjustmentSource`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `otherAdjustmentLineId` | String | — |
| `source` | String | Source name (المصدر) |
| `percentage` | Decimal | Decimal(5,2) · Percentage (النسبة %) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `otherAdjustmentLine` → `OtherAdjustmentLine` — FK `otherAdjustmentLineId` → `OtherAdjustmentLine.id` · onDelete Cascade

فهارس: `@@index([otherAdjustmentLineId])`

## `purchase_orders` (`PurchaseOrder`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `orderNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `supplierId` | String | — |
| `warehouseId` | String? | اختياري |
| `currencyId` | String? | اختياري |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,4) |
| `expectedDeliveryDate` | DateTime? | اختياري |
| `expectedDeliveryDateHijri` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `totalDiscount` | Decimal | Decimal(15,2) |
| `totalTax` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `invoiceId` | String? | اختياري · Link to converted invoice |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete Cascade
- N→0..1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete SetNull
- N→0..1 `currency` → `Currency` — FK `currencyId` → `Currency.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull
- 1→N `lines` → `PurchaseOrderLine[]`
- 1→N `conditions` → `PurchaseOrderCondition[]`

قيود فريدة: `@@unique([invoiceId])`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([supplierId])` · `@@index([warehouseId])` · `@@index([date])`

## `purchase_order_lines` (`PurchaseOrderLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `purchaseOrderId` | String | — |
| `itemId` | String | — |
| `unitId` | String? | اختياري |
| `baseUnitId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `baseQuantity` | Decimal? | اختياري · Decimal(15,3) · Converted to base unit |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `discountPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `discountValue` | Decimal? | اختياري · Decimal(15,2) |
| `taxPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `taxValue` | Decimal? | اختياري · Decimal(15,2) |
| `netTotal` | Decimal? | اختياري · Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `purchaseOrder` → `PurchaseOrder` — FK `purchaseOrderId` → `PurchaseOrder.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete SetNull
- N→0..1 `baseUnit` → `Unit` اسم العلاقة: `BaseUnit` — FK `baseUnitId` → `Unit.id` · onDelete SetNull

فهارس: `@@index([purchaseOrderId])` · `@@index([itemId])`

## `purchase_order_conditions` (`PurchaseOrderCondition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `purchaseOrderId` | String | — |
| `condition` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `purchaseOrder` → `PurchaseOrder` — FK `purchaseOrderId` → `PurchaseOrder.id` · onDelete Cascade

فهارس: `@@index([purchaseOrderId])`

## `purchase_returns` (`PurchaseReturn`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `returnNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `originalInvoiceId` | String? | اختياري · Reference to original purchase invoice |
| `supplierId` | String | — |
| `warehouseId` | String | — |
| `currencyId` | String? | اختياري |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,4) |
| `paymentMethod` | String? | اختياري · 'cash' or 'credit' |
| `costCenterId` | String? | اختياري |
| `delegateId` | String? | اختياري |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `totalAmount` | Decimal | Decimal(15,2) |
| `totalDiscount` | Decimal | Decimal(15,2) |
| `totalTax` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Cascade
- N→0..1 `currency` → `Currency` — FK `currencyId` → `Currency.id` · onDelete SetNull
- N→0..1 `originalInvoice` → `Invoice` — FK `originalInvoiceId` → `Invoice.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `delegate` → `Delegate` — FK `delegateId` → `Delegate.id` · onDelete SetNull
- 1→N `lines` → `PurchaseReturnLine[]`
- 1→N `conditions` → `PurchaseReturnCondition[]`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([supplierId])` · `@@index([warehouseId])` · `@@index([originalInvoiceId])` · `@@index([date])`

## `purchase_return_lines` (`PurchaseReturnLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `purchaseReturnId` | String | — |
| `itemId` | String | — |
| `unitId` | String | — |
| `locationId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `baseQuantity` | Decimal | Decimal(15,3) |
| `unitPrice` | Decimal | Decimal(15,2) |
| `total` | Decimal | Decimal(15,2) |
| `discountPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `discountValue` | Decimal | Decimal(15,2) |
| `taxPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `taxValue` | Decimal | Decimal(15,2) |
| `netTotal` | Decimal | Decimal(15,2) |
| `originalInvoiceLineId` | String? | اختياري · Reference to original purchase invoice line |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `purchaseReturn` → `PurchaseReturn` — FK `purchaseReturnId` → `PurchaseReturn.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete Cascade
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([purchaseReturnId])` · `@@index([itemId])`

## `purchase_return_conditions` (`PurchaseReturnCondition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `purchaseReturnId` | String | — |
| `condition` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `purchaseReturn` → `PurchaseReturn` — FK `purchaseReturnId` → `PurchaseReturn.id` · onDelete Cascade

فهارس: `@@index([purchaseReturnId])`

## `price_quotes` (`PriceQuote`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `quoteNumber` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `customerId` | String | — |
| `warehouseId` | String? | اختياري |
| `currencyId` | String? | اختياري |
| `exchangeRate` | Decimal? | اختياري · Decimal(15,4) |
| `paymentMethod` | String? | اختياري · 'cash' or 'credit' |
| `isSalesTaxInvoice` | Boolean | — |
| `delegateId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `validUntil` | DateTime? | اختياري · Quote expiration date |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `totalAmount` | Decimal | Decimal(15,2) |
| `totalDiscount` | Decimal | Decimal(15,2) |
| `totalTax` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `isApproved` | Boolean | — |
| `approvedAt` | DateTime? | اختياري |
| `isCancelled` | Boolean | — |
| `cancelledAt` | DateTime? | اختياري |
| `isConverted` | Boolean | — |
| `convertedAt` | DateTime? | اختياري |
| `invoiceId` | String? | اختياري · Link to converted invoice |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete Cascade
- N→0..1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete SetNull
- N→0..1 `currency` → `Currency` — FK `currencyId` → `Currency.id` · onDelete SetNull
- N→0..1 `delegate` → `Delegate` — FK `delegateId` → `Delegate.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull
- 1→N `lines` → `PriceQuoteLine[]`
- 1→N `conditions` → `PriceQuoteCondition[]`

قيود فريدة: `@@unique([invoiceId])`

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([customerId])` · `@@index([warehouseId])` · `@@index([date])`

## `price_quote_lines` (`PriceQuoteLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `priceQuoteId` | String | — |
| `itemId` | String | — |
| `unitId` | String | — |
| `baseUnitId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,3) |
| `baseQuantity` | Decimal | Decimal(15,3) · Converted to base unit |
| `unitPrice` | Decimal | Decimal(15,2) |
| `total` | Decimal | Decimal(15,2) |
| `discountPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `discountValue` | Decimal | Decimal(15,2) |
| `taxPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `taxValue` | Decimal | Decimal(15,2) |
| `netTotal` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `priceQuote` → `PriceQuote` — FK `priceQuoteId` → `PriceQuote.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete Cascade
- N→0..1 `baseUnit` → `Unit` اسم العلاقة: `BaseUnit` — FK `baseUnitId` → `Unit.id` · onDelete SetNull

فهارس: `@@index([priceQuoteId])` · `@@index([itemId])`

## `price_quote_conditions` (`PriceQuoteCondition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `priceQuoteId` | String | — |
| `condition` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `priceQuote` → `PriceQuote` — FK `priceQuoteId` → `PriceQuote.id` · onDelete Cascade

فهارس: `@@index([priceQuoteId])`

## `item_offers` (`ItemOffer`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `nameAr` | String? | اختياري |
| `description` | String? | اختياري |
| `serial` | String? | اختياري |
| `how` | String | 'additional-quantity', 'discount-percentage', 'invoice-value' |
| `type` | String | 'purchases' or 'sales' |
| `source` | String | 'input-units', 'suppliers', 'customers', 'all' |
| `fromItemId` | String? | اختياري · The item that triggers the offer |
| `quantity` | Decimal | Decimal(15,3) · Required quantity to trigger offer |
| `percentage` | Decimal? | اختياري · Decimal(5,2) · Discount percentage |
| `offerQuantity` | Decimal? | اختياري · Decimal(15,3) · Gift quantity (Buy X Get Y) |
| `toItemId` | String? | اختياري · Gift item (Buy X Get Y) |
| `invoiceValue` | Decimal? | اختياري · Decimal(15,2) · Invoice value threshold |
| `supplierId` | String? | اختياري |
| `unitId` | String? | اختياري |
| `applyToAllParties` | Boolean | — |
| `applyToAllPatterns` | Boolean | — |
| `targetPartyIds` | Json? | اختياري |
| `targetPatternIds` | Json? | اختياري |
| `fromDate` | DateTime | — |
| `fromDateHijri` | String? | اختياري |
| `toDate` | DateTime | — |
| `toDateHijri` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `fromItem` → `Item` اسم العلاقة: `FromItem` — FK `fromItemId` → `Item.id` · onDelete Cascade
- N→0..1 `toItem` → `Item` اسم العلاقة: `ToItem` — FK `toItemId` → `Item.id` · onDelete SetNull
- N→0..1 `sourceSupplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `sourceUnit` → `Unit` اسم العلاقة: `OfferSourceUnit` — FK `unitId` → `Unit.id` · onDelete SetNull

فهارس: `@@index([companyId])` · `@@index([branchId])` · `@@index([fromItemId])` · `@@index([toItemId])` · `@@index([type])` · `@@index([how])` · `@@index([source])` · `@@index([fromDate])` · `@@index([toDate])` · `@@index([isActive])`

## `invoices` (`Invoice`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `invoiceNumber` | String? | اختياري |
| `invoiceKind` | String? | اختياري |
| `invoiceType` | String | sales/purchase/return |
| `moduleCode` | String? | اختياري |
| `newModuleId` | String? | اختياري |
| `date` | DateTime | — |
| `dueDate` | DateTime? | اختياري |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `currencyCode` | String | — |
| `sourceYearId` | String? | اختياري |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `customerId` | String? | اختياري |
| `supplierId` | String? | اختياري |
| `warehouseId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `representativeId` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(18,4) |
| `discountAmount` | Decimal | Decimal(18,4) |
| `headerDiscountPercent` | Decimal? | اختياري · Decimal(5,2) |
| `developmentFeeRate` | Decimal? | اختياري · Decimal(5,2) |
| `developmentFeeAmount` | Decimal | Decimal(18,4) |
| `pricingCalculationBasis` | String? | اختياري |
| `taxAmount` | Decimal | Decimal(18,4) |
| `withholdingTaxAmount` | Decimal | Decimal(18,4) |
| `netAmount` | Decimal | Decimal(18,4) |
| `paidAmount` | Decimal | Decimal(18,4) |
| `remainingAmount` | Decimal | Decimal(18,4) |
| `paymentStatus` | String? | اختياري |
| `workflowStatus` | String | — |
| `workflowSubmittedAt` | DateTime? | اختياري |
| `workflowSubmittedBy` | String? | اختياري |
| `workflowApprovedAt` | DateTime? | اختياري |
| `workflowApprovedBy` | String? | اختياري |
| `workflowRejectedAt` | DateTime? | اختياري |
| `workflowRejectedBy` | String? | اختياري |
| `workflowRejectionReason` | String? | اختياري |
| `createdBy` | String? | اختياري |
| `isPosted` | Boolean | — |
| `postedAt` | DateTime? | اختياري |
| `postedBy` | String? | اختياري |
| `isApproved` | Boolean | — |
| `isCancelled` | Boolean | — |
| `isSalesTaxInvoice` | Boolean | — |
| `allowReturn` | Boolean | — |
| `returnDays` | Int? | اختياري |
| `taxTreatmentType` | String? | اختياري |
| `isDelivered` | Boolean | — |
| `handoverDate` | DateTime? | اختياري |
| `paymentMethod` | String? | اختياري · cash/credit/split |
| `paymentSplits` | Json? | اختياري |
| `internalNotes` | Json? | اختياري |
| `sellerId` | String? | اختياري |
| `currencyId` | String? | اختياري |
| `record` | String? | اختياري · رقم القيد (Journal Entry Reference) |
| `journalEntryId` | String? | اختياري |
| `costJournalEntryId` | String? | اختياري |
| `convertedInvoiceId` | String? | اختياري · فريد |
| `originalInvoiceId` | String? | اختياري |
| `originalInvoiceNumber` | String? | اختياري |
| `sourceType` | SourceDocumentType | — |
| `sourceId` | String? | اختياري |
| `sourceNumber` | String? | اختياري |
| `taxSignature` | String? | اختياري |
| `taxHash` | String? | اختياري |
| `taxSubmitted` | Boolean | — |
| `taxSubmissionId` | String? | اختياري |
| `version` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |
| `documentProfileId` | String? | اختياري |

**العلاقات**

- 1→N `eInvoiceDocuments` → `EInvoiceDocument[]`
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id`
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id`
- N→0..1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id`
- N→0..1 `newModule` → `NewModule` — FK `newModuleId` → `NewModule.id` · onDelete SetNull
- N→0..1 `documentProfile` → `DocumentProfile` اسم العلاقة: `InvoiceDocumentProfile` — FK `documentProfileId` → `DocumentProfile.id` · onDelete SetNull
- N→0..1 `delegate` → `Delegate` — FK `representativeId` → `Delegate.id`
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id`
- N→0..1 `currency` → `Currency` — FK `currencyId` → `Currency.id` · onDelete SetNull
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `InvoiceJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- N→0..1 `costJournalEntry` → `JournalEntry` اسم العلاقة: `InvoiceCostJournalEntry` — FK `costJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `InvoiceLine[]`
- 1→N `adjustments` → `InvoiceAdjustment[]`
- 1→N `conditions` → `InvoiceCondition[]`
- 1→N `settlements` → `CashTransaction[]` اسم العلاقة: `InvoiceSettlements`
- 1→N `paymentAllocations` → `PaymentAllocation[]`
- 1→N `cashTransactionLines` → `CashTransactionLine[]`
- 1→N `tiedJournalLines` → `JournalEntryLine[]` اسم العلاقة: `JournalLineTiedInvoice`
- 1→N `settlementCheques` → `Cheque[]`
- N→0..1 `purchaseOrder` → `PurchaseOrder`
- 1→N `purchaseReturns` → `PurchaseReturn[]`
- N→0..1 `priceQuote` → `PriceQuote`
- 1→N `landedCostAllocations` → `LandedCostAllocation[]`
- N→0..1 `convertedInvoice` → `Invoice` اسم العلاقة: `InvoiceConversionSource` — FK `convertedInvoiceId` → `Invoice.id` · onDelete SetNull
- N→0..1 `convertedFromInvoice` → `Invoice` اسم العلاقة: `InvoiceConversionSource`
- N→0..1 `originalInvoice` → `Invoice` اسم العلاقة: `InvoiceReturns` — FK `originalInvoiceId` → `Invoice.id` · onDelete SetNull
- 1→N `returns` → `Invoice[]` اسم العلاقة: `InvoiceReturns`
- 1→N `installments` → `InvoiceInstallment[]`

قيود فريدة: `@@unique([companyId, branchId, fiscalYearId, invoiceType, invoiceNumber])`

فهارس: `@@index([companyId, date])` · `@@index([invoiceNumber])` · `@@index([invoiceType])` · `@@index([companyId, branchId, isPosted, invoiceType, date])` · `@@index([companyId, isPosted, isApproved])` · `@@index([companyId, isPosted, isCancelled, dueDate])` · `@@index([companyId, invoiceKind, isPosted, isCancelled, remainingAmount])` · `@@index([companyId, invoiceKind, isPosted, date(sort: Desc)], map: "idx_invoices_kind_posted_date")` · `@@index([companyId, moduleCode])` · `@@index([newModuleId])` · `@@index([documentProfileId])` · `@@index([companyId, sourceType, sourceId])` · `@@index([originalInvoiceId])`

## `invoice_installments` (`InvoiceInstallment`)

جدول أقساط الفاتورة — يُحفظ مع رأس الفاتورة في نفس الـ transaction.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `invoiceId` | String | — |
| `installmentNumber` | Int | — |
| `dueDate` | DateTime | — |
| `hijriDueDate` | String? | اختياري |
| `amount` | Decimal | Decimal(18,4) |
| `paidAmount` | Decimal | Decimal(18,4) |
| `isPaid` | Boolean | — |
| `status` | InvoiceInstallmentStatus | — |
| `paymentDate` | DateTime? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Cascade
- 1→N `cashTransactions` → `CashTransaction[]`

قيود فريدة: `@@unique([invoiceId, installmentNumber])`

فهارس: `@@index([invoiceId, status])` · `@@index([dueDate])` · `@@index([status])`

## `invoice_adjustments` (`InvoiceAdjustment`)

إضافات وخصومات الفاتورة — بنود ديناميكية مربوطة بدليل الحسابات.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `invoiceId` | String | — |
| `type` | AdjustmentType | — |
| `calcType` | CalculationType | — |
| `rate` | Decimal? | اختياري · Decimal(10,2) |
| `amount` | Decimal | Decimal(18,4) |
| `description` | String? | اختياري |
| `currency` | String | — |
| `exchangeRate` | Decimal? | اختياري · Decimal(18,6) |
| `accountId` | String | — |
| `offsetAccountId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Cascade
- N→1 `account` → `Account` اسم العلاقة: `AdjustmentAccount` — FK `accountId` → `Account.id`
- N→0..1 `offsetAccount` → `Account` اسم العلاقة: `AdjustmentOffsetAccount` — FK `offsetAccountId` → `Account.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull

فهارس: `@@index([companyId, invoiceId])` · `@@index([invoiceId])` · `@@index([accountId])` · `@@index([offsetAccountId])` · `@@index([costCenterId])`

## `document_profiles` (`DocumentProfile`)

أنماط ووحدات الإدخال المخصصة — ترقيم وثوابت وأعمدة لكل نوع مستند.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `slug` | String | — |
| `nameAr` | String | — |
| `nameEn` | String? | اختياري |
| `baseType` | DocumentBaseType | — |
| `prefix` | String? | اختياري |
| `nextNumber` | Int | — |
| `defaultWarehouseId` | String? | اختياري |
| `lockWarehouse` | Boolean | — |
| `defaultTreasuryId` | String? | اختياري |
| `lockTreasury` | Boolean | — |
| `defaultCostCenterId` | String? | اختياري |
| `lockCostCenter` | Boolean | — |
| `visibleColumns` | Json | — |
| `showInSidebar` | Boolean | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `defaultWarehouse` → `Warehouse` اسم العلاقة: `DocumentProfileWarehouse` — FK `defaultWarehouseId` → `Warehouse.id` · onDelete SetNull
- N→0..1 `defaultTreasury` → `Safe` اسم العلاقة: `DocumentProfileTreasury` — FK `defaultTreasuryId` → `Safe.id` · onDelete SetNull
- N→0..1 `defaultCostCenter` → `CostCenter` — FK `defaultCostCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `invoices` → `Invoice[]` اسم العلاقة: `InvoiceDocumentProfile`

قيود فريدة: `@@unique([companyId, slug])`

فهارس: `@@index([companyId, baseType])` · `@@index([companyId, showInSidebar, isActive])` · `@@index([defaultWarehouseId])` · `@@index([defaultTreasuryId])` · `@@index([defaultCostCenterId])`

## `transaction_settings` (`TransactionSettings`)

Per-company, per-document-type transaction policy (numbering, posting, pricing, taxes).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `documentType` | DocumentBaseType | — |
| `numberingMode` | NumberingMode | — |
| `sequenceMode` | SequenceMode | — |
| `autoPostOnSave` | Boolean | — |
| `autoPrintOnSave` | Boolean | — |
| `generateEntryOnSave` | Boolean | — |
| `affectStock` | Boolean | — |
| `allowItemPriceOverride` | Boolean | — |
| `preventSellingBelowCost` | Boolean | — |
| `preventNegativeStock` | Boolean | — |
| `autoApplyVat` | Boolean | — |
| `autoApplyWht` | Boolean | — |
| `autoApplyDevelopmentTax` | Boolean | — |
| `cascadingDiscounts` | Boolean | — |
| `showAllAccountsInCustomerField` | Boolean | — |
| `defaultSalesAccountId` | String? | اختياري |
| `defaultPurchaseReturnAccountId` | String? | اختياري |
| `defaultCashAccountId` | String? | اختياري |
| `defaultBankGlAccountId` | String? | اختياري |
| `defaultOffsetAccountId` | String? | اختياري |
| `defaultChargesAccountId` | String? | اختياري |
| `defaultCostCenterId` | String? | اختياري |
| `defaultWarehouseId` | String? | اختياري |
| `pricingPolicy` | PricingPolicy | — |
| `costCenterSide` | CostCenterPostingSide | — |
| `costCenterAllocationTarget` | CostCenterAllocationTarget | — |
| `allowStandaloneReturns` | Boolean | — |
| `enforceOriginalPrice` | Boolean | — |
| `showFxColumns` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→0..1 `defaultSalesAccount` → `Account` اسم العلاقة: `SettingsSalesAccount` — FK `defaultSalesAccountId` → `Account.id`
- N→0..1 `defaultPurchaseReturnAccount` → `Account` اسم العلاقة: `SettingsPurchaseReturnAccount` — FK `defaultPurchaseReturnAccountId` → `Account.id`
- N→0..1 `defaultCashAccount` → `Account` اسم العلاقة: `SettingsCashAccount` — FK `defaultCashAccountId` → `Account.id`
- N→0..1 `defaultBankGlAccount` → `Account` اسم العلاقة: `SettingsBankGlAccount` — FK `defaultBankGlAccountId` → `Account.id`
- N→0..1 `defaultOffsetAccount` → `Account` اسم العلاقة: `SettingsOffsetAccount` — FK `defaultOffsetAccountId` → `Account.id`
- N→0..1 `defaultChargesAccount` → `Account` اسم العلاقة: `SettingsChargesAccount` — FK `defaultChargesAccountId` → `Account.id`
- N→0..1 `defaultCostCenter` → `CostCenter` — FK `defaultCostCenterId` → `CostCenter.id`
- N→0..1 `defaultWarehouse` → `Warehouse` — FK `defaultWarehouseId` → `Warehouse.id`
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, documentType])`

فهارس: `@@index([defaultSalesAccountId])` · `@@index([defaultPurchaseReturnAccountId])` · `@@index([defaultCashAccountId])` · `@@index([defaultBankGlAccountId])` · `@@index([defaultOffsetAccountId])` · `@@index([defaultChargesAccountId])` · `@@index([defaultCostCenterId])` · `@@index([defaultWarehouseId])`

## `invoice_lines` (`InvoiceLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `invoiceId` | String | — |
| `itemId` | String | — |
| `unitId` | String | — |
| `quantity` | Decimal | Decimal(18,4) |
| `baseQuantity` | Decimal | Decimal(18,4) |
| `baseUnitId` | String? | اختياري |
| `conversionFactor` | Decimal? | اختياري · Decimal(18,6) |
| `price` | Decimal | Decimal(18,4) |
| `total` | Decimal | Decimal(18,4) |
| `discountPercent` | Decimal? | اختياري · Decimal(5,2) |
| `discountAmount` | Decimal? | اختياري · Decimal(18,4) |
| `taxPercent` | Decimal? | اختياري · Decimal(5,2) |
| `taxAmount` | Decimal? | اختياري · Decimal(18,4) |
| `lineOrder` | Int | — |
| `unitCostAtIssue` | Decimal? | اختياري · Decimal(18,4) |
| `originalInvoiceLineId` | String? | اختياري |
| `headerDiscountAllocated` | Decimal? | اختياري · Decimal(18,4) |
| `batchNumber` | String? | اختياري |
| `expiryDate` | DateTime? | اختياري |
| `productionDate` | DateTime? | اختياري |
| `serialNumbers` | String? | اختياري |
| `lineNotes` | String? | اختياري |
| `taxExemptionReason` | String? | اختياري |
| `warehouseId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `withholdingTaxRate` | Decimal? | اختياري · Decimal(8,4) |
| `withholdingTaxAmount` | Decimal? | اختياري · Decimal(18,4) |
| `batchAllocations` | Json? | اختياري |
| `color` | String? | اختياري |
| `size` | String? | اختياري |
| `customRevenueAccountId` | String? | اختياري |

**العلاقات**

- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id`
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id`
- N→0..1 `baseUnit` → `Unit` اسم العلاقة: `InvoiceLineBaseUnit` — FK `baseUnitId` → `Unit.id`
- N→0..1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `customRevenueAccount` → `Account` اسم العلاقة: `InvoiceLineRevenueAccount` — FK `customRevenueAccountId` → `Account.id` · onDelete SetNull
- 1→N `landedCostAllocationLines` → `LandedCostAllocationLine[]`
- N→0..1 `originalInvoiceLine` → `InvoiceLine` اسم العلاقة: `InvoiceLineReturns` — FK `originalInvoiceLineId` → `InvoiceLine.id` · onDelete SetNull
- 1→N `returnLines` → `InvoiceLine[]` اسم العلاقة: `InvoiceLineReturns`

فهارس: `@@index([invoiceId])` · `@@index([itemId])` · `@@index([invoiceId, itemId])` · `@@index([originalInvoiceLineId])` · `@@index([warehouseId])` · `@@index([baseUnitId])` · `@@index([costCenterId])` · `@@index([customRevenueAccountId])`

## `invoice_conditions` (`InvoiceCondition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `invoiceId` | String | — |
| `condition` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete Cascade

فهارس: `@@index([invoiceId])`

## `employees` (`Employee`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `employeeId` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `userId` | String? | اختياري |
| `gender` | String? | اختياري |
| `nationalityId` | String? | اختياري |
| `religionId` | String? | اختياري |
| `maritalStatusId` | String? | اختياري |
| `birthDate` | DateTime? | اختياري |
| `academicQualification` | String? | اختياري |
| `specialization` | String? | اختياري |
| `university` | String? | اختياري |
| `passportNumber` | String? | اختياري |
| `insurancePolicyNumber` | String? | اختياري |
| `socialInsurance` | String? | اختياري |
| `advanceAccountId` | String? | اختياري |
| `fingerprintNumber` | String? | اختياري |
| `identityNumber` | String? | اختياري |
| `identityIssueDate` | DateTime? | اختياري |
| `identityIssueDateHijri` | String? | اختياري |
| `identityExpiryDate` | DateTime? | اختياري |
| `identityExpiryDateHijri` | String? | اختياري |
| `passportIssueDate` | DateTime? | اختياري |
| `passportIssueDateHijri` | String? | اختياري |
| `passportExpiryDate` | DateTime? | اختياري |
| `passportExpiryDateHijri` | String? | اختياري |
| `graduationDate` | DateTime? | اختياري |
| `graduationDateHijri` | String? | اختياري |
| `insuranceIssueDate` | DateTime? | اختياري |
| `insuranceIssueDateHijri` | String? | اختياري |
| `insuranceExpiryDate` | DateTime? | اختياري |
| `insuranceExpiryDateHijri` | String? | اختياري |
| `mobile` | String? | اختياري |
| `homePhone` | String? | اختياري |
| `workPhone` | String? | اختياري |
| `address` | String? | اختياري |
| `city` | String? | اختياري |
| `joinDate` | DateTime? | اختياري |
| `basicSalary` | Decimal? | اختياري · Decimal(15,2) |
| `fixedAllowances` | Decimal? | اختياري · Decimal(15,2) |
| `socialInsuranceEnrolled` | Boolean | — |
| `taxExemptionAmount` | Decimal? | اختياري · Decimal(15,2) |
| `jobTitleId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `departmentId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `department` → `Department` — FK `departmentId` → `Department.id`
- N→0..1 `jobTitle` → `JobTitle` — FK `jobTitleId` → `JobTitle.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- N→0..1 `nationality` → `Nationality` — FK `nationalityId` → `Nationality.id`
- N→0..1 `religion` → `Religion` — FK `religionId` → `Religion.id`
- N→0..1 `maritalStatus` → `MaritalStatus` — FK `maritalStatusId` → `MaritalStatus.id`
- N→0..1 `advanceAccount` → `Account` اسم العلاقة: `EmployeeAdvanceAccount` — FK `advanceAccountId` → `Account.id`
- 1→N `contracts` → `EmployeeContract[]`
- 1→N `procedures` → `EmployeeProcedure[]`
- 1→N `advances` → `EmployeeAdvance[]`
- 1→N `monthlySalaries` → `MonthlySalary[]`
- 1→N `housingAllowanceClearances` → `HousingAllowanceClearance[]`
- 1→N `endOfServiceClearances` → `EndOfServiceClearance[]`
- 1→N `annualLeaveEntitlementsClearances` → `AnnualLeaveEntitlementsClearance[]`
- 1→N `endOfServiceDisbursements` → `EndOfServiceDisbursement[]`
- 1→N `annualLeaveEntitlementsDisbursements` → `AnnualLeaveEntitlementsDisbursement[]`
- 1→N `housingAllowanceEntitlementsDisbursements` → `HousingAllowanceEntitlementsDisbursement[]`
- 1→N `payrollRunItems` → `PayrollRunItem[]`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([companyId, isActive])`

## `employee_contracts` (`EmployeeContract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `contractStartDate` | DateTime | — |
| `contractStartDateHijri` | String? | اختياري |
| `contractEndDate` | DateTime? | اختياري |
| `contractEndDateHijri` | String? | اختياري |
| `wagePolicyId` | String? | اختياري |
| `basicSalary` | Decimal? | اختياري · Decimal(15,2) |
| `insuranceSalary` | Decimal? | اختياري · Decimal(15,2) |
| `insurancePercentage` | Decimal? | اختياري · Decimal(5,2) |
| `paymentMethod` | String? | اختياري · fund/bank |
| `employeeResponsibility` | Decimal? | اختياري · Decimal(15,2) |
| `companyResponsibility` | Decimal? | اختياري · Decimal(15,2) |
| `leaveBalance` | Decimal? | اختياري · Decimal(10,2) |
| `departmentId` | String? | اختياري |
| `sectionId` | String? | اختياري |
| `jobCadreId` | String? | اختياري |
| `jobTitleId` | String? | اختياري |
| `cityId` | String? | اختياري |
| `workBranchId` | String? | اختياري |
| `salaryBranchId` | String? | اختياري |
| `costCenterId` | String? | اختياري |
| `autoRenewal` | Boolean | — |
| `attendancePolicy` | Boolean | — |
| `incomeTax` | Boolean | — |
| `generalNotes` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade
- N→0..1 `wagePolicy` → `WagePolicy` — FK `wagePolicyId` → `WagePolicy.id`
- N→0..1 `department` → `Department` — FK `departmentId` → `Department.id`
- N→0..1 `jobTitle` → `JobTitle` — FK `jobTitleId` → `JobTitle.id`
- N→0..1 `jobCadre` → `JobCadre` — FK `jobCadreId` → `JobCadre.id`
- N→0..1 `city` → `City` — FK `cityId` → `City.id`
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id`
- 1→N `monthlySalaries` → `MonthlySalary[]`
- 1→N `housingAllowanceClearances` → `HousingAllowanceClearance[]`
- 1→N `endOfServiceClearances` → `EndOfServiceClearance[]`
- 1→N `annualLeaveEntitlementsClearances` → `AnnualLeaveEntitlementsClearance[]`

فهارس: `@@index([employeeId])` · `@@index([employeeId, isActive])`

## `employee_procedures` (`EmployeeProcedure`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `procedureType` | String | warning/reward/penalty/transfer/promotion/etc. |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `amount` | Decimal? | اختياري · Decimal(15,2) |
| `unit` | String? | اختياري · e.g., "جنية", "دولار", "نسبة" |
| `reason` | String? | اختياري |
| `createdBy` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade

فهارس: `@@index([employeeId])` · `@@index([procedureType])`

## `employee_advances` (`EmployeeAdvance`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `value` | Decimal | Decimal(15,2) |
| `monthlyInstallment` | Decimal? | اختياري · Decimal(15,2) |
| `fromMonth` | String? | اختياري |
| `toYear` | String? | اختياري |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `paymentMethod` | String? | اختياري · fund/bank |
| `remainingAmount` | Decimal? | اختياري · Decimal(15,2) |
| `isSettled` | Boolean | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade

فهارس: `@@index([employeeId])` · `@@index([date])`

## `hr_settings` (`HrSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `salariesExpenseAccountCode` | String? | اختياري |
| `employerInsuranceExpenseAccountCode` | String? | اختياري |
| `socialInsurancePayableAccountCode` | String? | اختياري |
| `payrollTaxPayableAccountCode` | String? | اختياري |
| `employeeAdvancesAccountCode` | String? | اختياري |
| `accruedPayrollAccountCode` | String? | اختياري |
| `employeeInsuranceRate` | Decimal | Decimal(8,6) |
| `employerInsuranceRate` | Decimal | Decimal(8,6) |
| `payrollTaxFlatRate` | Decimal | Decimal(8,6) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `payroll_runs` (`PayrollRun`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `periodMonth` | Int | — |
| `periodYear` | Int | — |
| `status` | String | — |
| `totalGross` | Decimal | Decimal(15,2) |
| `totalNet` | Decimal | Decimal(15,2) |
| `totalEmployerInsurance` | Decimal | Decimal(15,2) |
| `totalEmployeeInsurance` | Decimal | Decimal(15,2) |
| `totalTax` | Decimal | Decimal(15,2) |
| `totalAdvanceDeduction` | Decimal | Decimal(15,2) |
| `accrualJournalEntryId` | String? | اختياري |
| `paymentJournalEntryId` | String? | اختياري |
| `paymentSafeId` | String? | اختياري |
| `paymentBankAccountId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `paidAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- 1→N `items` → `PayrollRunItem[]`

قيود فريدة: `@@unique([companyId, periodYear, periodMonth])`

فهارس: `@@index([companyId, status])`

## `payroll_run_items` (`PayrollRunItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `payrollRunId` | String | — |
| `employeeId` | String | — |
| `basicSalary` | Decimal | Decimal(15,2) |
| `allowances` | Decimal | Decimal(15,2) |
| `overtime` | Decimal | Decimal(15,2) |
| `absenceDeduction` | Decimal | Decimal(15,2) |
| `otherDeductions` | Decimal | Decimal(15,2) |
| `grossSalary` | Decimal | Decimal(15,2) |
| `employerInsurance` | Decimal | Decimal(15,2) |
| `employeeInsurance` | Decimal | Decimal(15,2) |
| `tax` | Decimal | Decimal(15,2) |
| `advanceDeduction` | Decimal | Decimal(15,2) |
| `netSalary` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `payrollRun` → `PayrollRun` — FK `payrollRunId` → `PayrollRun.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Restrict

قيود فريدة: `@@unique([payrollRunId, employeeId])`

فهارس: `@@index([employeeId])`

## `manufacturing_settings` (`ManufacturingSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `wipMaterialsAccountCode` | String? | اختياري |
| `wipLaborOverheadAccountCode` | String? | اختياري |
| `rawInventoryAccountCode` | String? | اختياري |
| `finishedGoodsAccountCode` | String? | اختياري |
| `overheadAbsorptionAccountCode` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `bill_of_materials` (`BillOfMaterials`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `name` | String | — |
| `finishedItemId` | String | — |
| `baseQuantity` | Decimal | Decimal(15,4) |
| `standardLaborCost` | Decimal | Decimal(15,2) |
| `standardOverheadCost` | Decimal | Decimal(15,2) |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `finishedItem` → `Item` اسم العلاقة: `BomFinishedItem` — FK `finishedItemId` → `Item.id` · onDelete Restrict
- 1→N `lines` → `BomLine[]`
- 1→N `productionOrders` → `ProductionOrder[]`

فهارس: `@@index([companyId, finishedItemId])`

## `bom_lines` (`BomLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `bomId` | String | — |
| `rawItemId` | String | — |
| `quantity` | Decimal | Decimal(15,4) |
| `scrapPercentage` | Decimal | Decimal(8,4) |
| `lineOrder` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `bom` → `BillOfMaterials` — FK `bomId` → `BillOfMaterials.id` · onDelete Cascade
- N→1 `rawItem` → `Item` اسم العلاقة: `BomRawItem` — FK `rawItemId` → `Item.id` · onDelete Restrict

فهارس: `@@index([bomId])`

## `production_orders` (`ProductionOrder`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `orderNumber` | String | — |
| `bomId` | String | — |
| `finishedItemId` | String | — |
| `plannedQuantity` | Decimal | Decimal(15,4) |
| `actualQuantity` | Decimal? | اختياري · Decimal(15,4) |
| `warehouseIdRaw` | String | — |
| `warehouseIdFinished` | String | — |
| `status` | String | — |
| `totalMaterialCost` | Decimal | Decimal(15,2) |
| `totalLaborCost` | Decimal | Decimal(15,2) |
| `totalOverheadCost` | Decimal | Decimal(15,2) |
| `unitCost` | Decimal? | اختياري · Decimal(15,4) |
| `materialsIssueJournalEntryId` | String? | اختياري |
| `laborOverheadJournalEntryId` | String? | اختياري |
| `completionJournalEntryId` | String? | اختياري |
| `releasedAt` | DateTime? | اختياري |
| `completedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→1 `bom` → `BillOfMaterials` — FK `bomId` → `BillOfMaterials.id` · onDelete Restrict
- N→1 `finishedItem` → `Item` اسم العلاقة: `ProductionFinishedItem` — FK `finishedItemId` → `Item.id` · onDelete Restrict
- N→1 `warehouseRaw` → `Warehouse` اسم العلاقة: `ProductionRawWarehouse` — FK `warehouseIdRaw` → `Warehouse.id` · onDelete Restrict
- N→1 `warehouseFinished` → `Warehouse` اسم العلاقة: `ProductionFinishedWarehouse` — FK `warehouseIdFinished` → `Warehouse.id` · onDelete Restrict
- 1→N `materialIssues` → `ProductionMaterialIssue[]`

قيود فريدة: `@@unique([companyId, orderNumber])`

فهارس: `@@index([companyId, status])`

## `production_material_issues` (`ProductionMaterialIssue`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `productionOrderId` | String | — |
| `issueDate` | DateTime | الآن |
| `journalEntryId` | String? | اختياري |
| `totalCost` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `productionOrder` → `ProductionOrder` — FK `productionOrderId` → `ProductionOrder.id` · onDelete Cascade
- 1→N `lines` → `ProductionMaterialIssueLine[]`

فهارس: `@@index([productionOrderId])`

## `production_material_issue_lines` (`ProductionMaterialIssueLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `materialIssueId` | String | — |
| `rawItemId` | String | — |
| `quantity` | Decimal | Decimal(15,4) |
| `unitCost` | Decimal | Decimal(15,4) |
| `totalCost` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `materialIssue` → `ProductionMaterialIssue` — FK `materialIssueId` → `ProductionMaterialIssue.id` · onDelete Cascade
- N→1 `rawItem` → `Item` اسم العلاقة: `ProductionIssueRawItem` — FK `rawItemId` → `Item.id` · onDelete Restrict

فهارس: `@@index([materialIssueId])`

## `contracting_settings` (`ContractingSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `contractingRevenueAccountCode` | String? | اختياري |
| `projectExpenseAccountCode` | String? | اختياري |
| `clientReceivableAccountCode` | String? | اختياري |
| `subcontractorPayableAccountCode` | String? | اختياري |
| `customerAdvanceAccountCode` | String? | اختياري |
| `subcontractorAdvanceAccountCode` | String? | اختياري |
| `retentionHeldByOthersAccountCode` | String? | اختياري |
| `retentionWithheldForOthersAccountCode` | String? | اختياري |
| `outputVatAccountCode` | String? | اختياري |
| `whtAssetAccountCode` | String? | اختياري |
| `whtPayableAccountCode` | String? | اختياري |
| `defaultVatRate` | Decimal | Decimal(8,6) |
| `defaultWhtRate` | Decimal | Decimal(8,6) |
| `inputVatAccountCode` | String? | اختياري |
| `penaltiesExpenseAccountCode` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `contracting_projects` (`ContractingProject`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectCode` | String | — |
| `projectName` | String | — |
| `customerId` | String? | اختياري |
| `contractValue` | Decimal | Decimal(15,2) |
| `advancePaymentAmount` | Decimal | Decimal(15,2) |
| `advancePaymentBalance` | Decimal | Decimal(15,2) |
| `advanceDeductionPercent` | Decimal | Decimal(8,4) |
| `retentionPercent` | Decimal | Decimal(8,4) |
| `costCenterId` | String? | اختياري |
| `startDate` | DateTime? | اختياري |
| `endDate` | DateTime? | اختياري |
| `status` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `subcontracts` → `ProjectSubcontract[]`
- 1→N `clientExtracts` → `ClientExtract[]`
- 1→N `subcontractorExtracts` → `SubcontractorExtract[]`
- 1→N `boqItems` → `ProjectBoqItem[]`
- 1→N `contractExtracts` → `ContractExtract[]`
- 1→N `enterpriseSubcontracts` → `Subcontract[]`
- 1→N `ownerBoqItems` → `ProjectBOQItem[]`
- 1→N `boqMarkupStructures` → `BOQMarkupStructure[]`
- 1→N `executiveMeasurementSheets` → `ExecutiveMeasurementSheet[]`
- N→0..1 `clientContract` → `ClientContract`
- 1→N `siteStockMaterials` → `SiteStockMaterial[]`
- 1→N `projectLettersOfGuarantee` → `ProjectLetterOfGuarantee[]`

قيود فريدة: `@@unique([companyId, projectCode])`

فهارس: `@@index([companyId, status])`

## `project_subcontracts` (`ProjectSubcontract`)

@deprecated Prefer Subcontract (enterprise BOQ + deduction policy).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `subcontractorId` | String | — |
| `subcontractValue` | Decimal | Decimal(15,2) |
| `advancePaymentBalance` | Decimal | Decimal(15,2) |
| `advanceRecoveryPercent` | Decimal | Decimal(8,4) |
| `retentionPercent` | Decimal | Decimal(8,4) |
| `scopeOfWork` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade
- N→1 `subcontractor` → `Contractor` — FK `subcontractorId` → `Contractor.id` · onDelete Restrict
- 1→N `extracts` → `SubcontractorExtract[]`
- 1→N `contractExtracts` → `ContractExtract[]`

قيود فريدة: `@@unique([projectId, subcontractorId])`

## `client_extracts` (`ClientExtract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `extractNumber` | String | — |
| `periodStart` | DateTime? | اختياري |
| `periodEnd` | DateTime? | اختياري |
| `grossAmount` | Decimal | Decimal(15,2) |
| `advanceDeductionAmount` | Decimal | Decimal(15,2) |
| `retentionAmount` | Decimal | Decimal(15,2) |
| `vatAmount` | Decimal | Decimal(15,2) |
| `whtAmount` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `journalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, extractNumber])`

فهارس: `@@index([projectId])`

## `subcontractor_extracts` (`SubcontractorExtract`)

@deprecated Prefer SubcontractInvoice (immutable deduction breakdown + JE FK).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `projectSubcontractId` | String? | اختياري |
| `subcontractorId` | String | — |
| `extractNumber` | String | — |
| `periodStart` | DateTime? | اختياري |
| `periodEnd` | DateTime? | اختياري |
| `grossAmount` | Decimal | Decimal(15,2) |
| `advanceDeductionAmount` | Decimal | Decimal(15,2) |
| `retentionAmount` | Decimal | Decimal(15,2) |
| `penaltyAmount` | Decimal | Decimal(15,2) |
| `materialDeductionAmount` | Decimal | Decimal(15,2) |
| `whtAmount` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `journalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade
- N→0..1 `projectSubcontract` → `ProjectSubcontract` — FK `projectSubcontractId` → `ProjectSubcontract.id` · onDelete SetNull
- N→1 `subcontractor` → `Contractor` — FK `subcontractorId` → `Contractor.id` · onDelete Restrict

قيود فريدة: `@@unique([companyId, extractNumber])`

فهارس: `@@index([projectId, subcontractorId])`

## `project_boq_items` (`ProjectBoqItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `itemNumber` | String | — |
| `description` | String | — |
| `unit` | String? | اختياري |
| `contractQuantity` | Decimal | Decimal(15,4) |
| `unitPrice` | Decimal | Decimal(15,4) |
| `totalPrice` | Decimal | Decimal(15,2) |
| `lineOrder` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade
- 1→N `extractLines` → `ContractExtractLine[]`

قيود فريدة: `@@unique([projectId, itemNumber])`

فهارس: `@@index([projectId])`

## `contract_extracts` (`ContractExtract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `projectSubcontractId` | String? | اختياري |
| `extractNumber` | String | — |
| `extractType` | String | — |
| `partyId` | String | — |
| `extractDate` | DateTime | الآن |
| `periodStart` | DateTime? | اختياري |
| `periodEnd` | DateTime? | اختياري |
| `totalExecutedAmount` | Decimal | Decimal(15,2) |
| `previousExecutedAmount` | Decimal | Decimal(15,2) |
| `currentExecutedAmount` | Decimal | Decimal(15,2) |
| `advancePaymentDeduction` | Decimal | Decimal(15,2) |
| `retentionDeduction` | Decimal | Decimal(15,2) |
| `whtDeduction` | Decimal | Decimal(15,2) |
| `otherDeductions` | Decimal | Decimal(15,2) |
| `penalties` | Decimal | Decimal(15,2) |
| `netBeforeVat` | Decimal | Decimal(15,2) |
| `vatAmount` | Decimal | Decimal(15,2) |
| `netPayableAmount` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `internalNotes` | Json? | اختياري |
| `journalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade
- N→0..1 `projectSubcontract` → `ProjectSubcontract` — FK `projectSubcontractId` → `ProjectSubcontract.id` · onDelete SetNull
- 1→N `lines` → `ContractExtractLine[]`

قيود فريدة: `@@unique([companyId, extractNumber])`

فهارس: `@@index([projectId, extractType])` · `@@index([partyId])`

## `contract_extract_lines` (`ContractExtractLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `extractId` | String | — |
| `boqItemId` | String | — |
| `previousQuantity` | Decimal | Decimal(15,4) |
| `currentQuantity` | Decimal | Decimal(15,4) |
| `cumulativeQuantity` | Decimal | Decimal(15,4) |
| `unitPrice` | Decimal | Decimal(15,4) |
| `lineTotal` | Decimal | Decimal(15,2) |
| `lineOrder` | Int | — |

**العلاقات**

- N→1 `extract` → `ContractExtract` — FK `extractId` → `ContractExtract.id` · onDelete Cascade
- N→1 `boqItem` → `ProjectBoqItem` — FK `boqItemId` → `ProjectBoqItem.id` · onDelete Restrict

فهارس: `@@index([extractId])` · `@@index([boqItemId])`

## `subcontractors` (`Subcontractor`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `nameAr` | String | — |
| `nameEn` | String? | اختياري |
| `taxRegistrationNumber` | String? | اختياري |
| `commercialRegister` | String? | اختياري |
| `phone` | String? | اختياري |
| `email` | String? | اختياري |
| `address` | String? | اختياري |
| `status` | SubcontractorStatus | — |
| `bankAccountDetails` | Json? | اختياري |
| `riskScore` | Float | — |
| `legacyContractorId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `subcontracts` → `Subcontract[]`

قيود فريدة: `@@unique([companyId, taxRegistrationNumber])`

فهارس: `@@index([companyId, status])` · `@@index([legacyContractorId])`

## `subcontracts` (`Subcontract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `subcontractNumber` | String | — |
| `subcontractorId` | String | — |
| `projectId` | String | — |
| `contractDate` | DateTime | — |
| `totalContractValue` | Decimal | Decimal(18,4) |
| `status` | SubcontractStatus | — |
| `advancePaymentTotal` | Decimal | Decimal(18,4) |
| `advancePaymentRecoveryRate` | Decimal | Decimal(8,6) |
| `retentionRate` | Decimal | Decimal(8,6) |
| `taxWithholdingRate` | Decimal | Decimal(8,6) |
| `socialInsuranceRate` | Decimal | Decimal(8,6) |
| `maxAllowedVariationOrderRate` | Decimal | Decimal(8,6) |
| `standardScrapToleranceRate` | Decimal | Decimal(8,6) |
| `contractAdminOverheadRate` | Decimal | Decimal(8,6) |
| `earlyPaymentDiscountRate` | Decimal | Decimal(8,6) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `subcontractor` → `Subcontractor` — FK `subcontractorId` → `Subcontractor.id` · onDelete Restrict
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- 1→N `boqItems` → `SubcontractBOQItem[]`
- 1→N `invoices` → `SubcontractInvoice[]`
- 1→N `materialReconciliations` → `MaterialReconciliationLog[]`
- 1→N `sitePenalties` → `SitePenaltyAndSnag[]`
- 1→N `directExecutionCharges` → `DirectExecutionCharge[]`
- 1→N `financialAdjustmentNotes` → `FinancialAdjustmentNote[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, subcontractNumber])`

فهارس: `@@index([subcontractorId])` · `@@index([projectId])` · `@@index([status])`

## `subcontract_boq_items` (`SubcontractBOQItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `subcontractId` | String | — |
| `itemCode` | String | — |
| `descriptionAr` | String | — |
| `descriptionEn` | String? | اختياري |
| `unit` | String | — |
| `contractQuantity` | Decimal | Decimal(18,4) |
| `unitPrice` | Decimal | Decimal(18,4) |
| `totalPrice` | Decimal | Decimal(18,4) |
| `maxAllowedQuantity` | Decimal | Decimal(18,4) |
| `cumulativeExecutedQty` | Decimal | Decimal(18,4) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Cascade
- 1→N `invoiceItems` → `SubcontractInvoiceItem[]`
- 1→N `adjustmentLines` → `FinancialAdjustmentLineItem[]`

قيود فريدة: `@@unique([subcontractId, itemCode])`

فهارس: `@@index([subcontractId])`

## `subcontract_invoices` (`SubcontractInvoice`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `subcontractId` | String | — |
| `invoiceNumber` | String | — |
| `sequenceNumber` | Int | — |
| `periodStartDate` | DateTime | — |
| `periodEndDate` | DateTime | — |
| `type` | SubcontractInvoiceType | — |
| `status` | SubcontractInvoiceStatus | — |
| `grossCurrentAmount` | Decimal | Decimal(18,4) |
| `grossCumulativeAmount` | Decimal | Decimal(18,4) |
| `previousGrossAmount` | Decimal | Decimal(18,4) |
| `advancePaymentDeduction` | Decimal | Decimal(18,4) |
| `retentionDeduction` | Decimal | Decimal(18,4) |
| `taxWithholdingDeduction` | Decimal | Decimal(18,4) |
| `socialInsuranceDeduction` | Decimal | Decimal(18,4) |
| `materialOveruseDeduction` | Decimal | Decimal(18,4) |
| `sitePenaltiesDeduction` | Decimal | Decimal(18,4) |
| `directExecutionDeduction` | Decimal | Decimal(18,4) |
| `earlyPaymentDiscountDeduction` | Decimal | Decimal(18,4) |
| `netPayableAmount` | Decimal | Decimal(18,4) |
| `journalEntryId` | String? | اختياري |
| `attachments` | Json? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Restrict
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Restrict
- 1→N `items` → `SubcontractInvoiceItem[]`
- 1→N `materialReconciliations` → `MaterialReconciliationLog[]`
- 1→N `sitePenalties` → `SitePenaltyAndSnag[]`
- 1→N `directExecutionCharges` → `DirectExecutionCharge[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, invoiceNumber])` · `@@unique([subcontractId, sequenceNumber])`

فهارس: `@@index([subcontractId])` · `@@index([status])` · `@@index([journalEntryId])`

## `subcontract_invoice_items` (`SubcontractInvoiceItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `subcontractInvoiceId` | String | — |
| `subcontractBOQItemId` | String | — |
| `previousQuantity` | Decimal | Decimal(18,4) |
| `currentQuantity` | Decimal | Decimal(18,4) |
| `totalCumulativeQuantity` | Decimal | Decimal(18,4) |
| `completionPercentage` | Decimal | Decimal(8,4) |
| `unitPrice` | Decimal | Decimal(18,4) |
| `totalCurrentAmount` | Decimal | Decimal(18,4) |

**العلاقات**

- N→1 `invoice` → `SubcontractInvoice` — FK `subcontractInvoiceId` → `SubcontractInvoice.id` · onDelete Cascade
- N→1 `boqItem` → `SubcontractBOQItem` — FK `subcontractBOQItemId` → `SubcontractBOQItem.id` · onDelete Restrict

قيود فريدة: `@@unique([subcontractInvoiceId, subcontractBOQItemId], map: "sci_items_invoice_boq_key")`

فهارس: `@@index([subcontractInvoiceId])` · `@@index([subcontractBOQItemId])`

## `material_reconciliation_logs` (`MaterialReconciliationLog`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `subcontractId` | String | — |
| `subcontractInvoiceId` | String? | اختياري |
| `itemId` | String | — |
| `warehouseIssueSlipNumber` | String? | اختياري |
| `standardEngineeredQty` | Decimal | Decimal(18,4) |
| `actualIssuedQty` | Decimal | Decimal(18,4) |
| `scrapExcessQty` | Decimal | Decimal(18,4) |
| `marketPricePerUnit` | Decimal | Decimal(18,4) |
| `adminOverheadPercentage` | Decimal | Decimal(8,6) |
| `totalPenaltyAmount` | Decimal | Decimal(18,4) |
| `status` | MaterialReconciliationStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Cascade
- N→0..1 `invoice` → `SubcontractInvoice` — FK `subcontractInvoiceId` → `SubcontractInvoice.id` · onDelete SetNull
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Restrict
- 1→N `documentAttachments` → `DocumentAttachment[]`

فهارس: `@@index([subcontractId])` · `@@index([subcontractInvoiceId])` · `@@index([itemId])` · `@@index([status])`

## `site_penalties_and_snags` (`SitePenaltyAndSnag`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `subcontractId` | String | — |
| `subcontractInvoiceId` | String? | اختياري |
| `penaltyType` | SitePenaltyType | — |
| `amount` | Decimal | Decimal(18,4) |
| `incidentDate` | DateTime | — |
| `description` | String | — |
| `consultantReportRef` | String? | اختياري |
| `status` | SitePenaltyStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Cascade
- N→0..1 `invoice` → `SubcontractInvoice` — FK `subcontractInvoiceId` → `SubcontractInvoice.id` · onDelete SetNull
- 1→N `documentAttachments` → `DocumentAttachment[]`

فهارس: `@@index([subcontractId])` · `@@index([subcontractInvoiceId])` · `@@index([status])` · `@@index([incidentDate])`

## `direct_execution_charges` (`DirectExecutionCharge`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `subcontractId` | String | — |
| `subcontractInvoiceId` | String? | اختياري |
| `reason` | String | — |
| `thirdPartyVendorName` | String? | اختياري |
| `directCostIncurred` | Decimal | Decimal(18,4) |
| `overheadSurchargeRate` | Decimal | Decimal(8,6) |
| `totalDeduction` | Decimal | Decimal(18,4) |
| `status` | DirectExecutionStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Cascade
- N→0..1 `invoice` → `SubcontractInvoice` — FK `subcontractInvoiceId` → `SubcontractInvoice.id` · onDelete SetNull

فهارس: `@@index([subcontractId])` · `@@index([subcontractInvoiceId])` · `@@index([status])`

## `project_owner_boq_items` (`ProjectBOQItem`)

مقايسة المشروع التنفيذية مع المالك (distinct from legacy ProjectBoqItem).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `itemCode` | String | — |
| `descriptionAr` | String | — |
| `descriptionEn` | String? | اختياري |
| `unit` | BOQItemUnit | — |
| `contractQuantity` | Decimal | Decimal(18,4) |
| `directCostEstimated` | Decimal | Decimal(18,4) |
| `indirectMarkupRate` | Decimal | Decimal(8,6) |
| `unitSellingPrice` | Decimal | Decimal(18,4) |
| `totalSellingPrice` | Decimal | Decimal(18,4) |
| `cumulativeExecutedQty` | Decimal | Decimal(18,4) |
| `status` | ProjectBOQItemStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- 1→N `rateAnalysisItems` → `BOQRateAnalysisItem[]`
- 1→N `markupStructures` → `BOQMarkupStructure[]`
- 1→N `measurementSheets` → `ExecutiveMeasurementSheet[]`
- 1→N `clientInvoiceItems` → `ClientInvoiceItem[]`
- 1→N `adjustmentLines` → `FinancialAdjustmentLineItem[]`

قيود فريدة: `@@unique([companyId, projectId, itemCode])`

فهارس: `@@index([companyId])` · `@@index([projectId])` · `@@index([status])`

## `boq_rate_analysis_items` (`BOQRateAnalysisItem`)

تفكيك عناصر تكلفة البند (خامات، عمالة، معدات، مقاول باطن، مصاريف موقع).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectBOQItemId` | String | — |
| `costElementType` | BOQCostElementType | — |
| `resourceCode` | String? | اختياري |
| `descriptionAr` | String | — |
| `descriptionEn` | String? | اختياري |
| `unit` | String | — |
| `consumptionQuotaPerUnit` | Decimal | Decimal(18,4) |
| `unitCost` | Decimal | Decimal(18,4) |
| `wasteFactorRate` | Decimal | Decimal(8,6) |
| `totalCostPerUnit` | Decimal | Decimal(18,4) |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `projectBOQItem` → `ProjectBOQItem` — FK `projectBOQItemId` → `ProjectBOQItem.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([projectBOQItemId])` · `@@index([costElementType])`

## `boq_markup_structures` (`BOQMarkupStructure`)

هيكل تحميل التكاليف غير المباشرة للبند أو للمقايسة كاملة.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectBOQItemId` | String? | اختياري |
| `projectId` | String? | اختياري |
| `generalOverheadRate` | Decimal | Decimal(8,6) |
| `siteOverheadRate` | Decimal | Decimal(8,6) |
| `contingencyRiskRate` | Decimal | Decimal(8,6) |
| `profitMarginRate` | Decimal | Decimal(8,6) |
| `contractTaxesRate` | Decimal | Decimal(8,6) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `projectBOQItem` → `ProjectBOQItem` — FK `projectBOQItemId` → `ProjectBOQItem.id` · onDelete Cascade
- N→0..1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([projectBOQItemId])` · `@@index([projectId])`

## `executive_measurement_sheets` (`ExecutiveMeasurementSheet`)

دفتر حصر الأعمال المنفذة (الأبعاد والخصومات والكميات الصافية).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `projectBOQItemId` | String | — |
| `sheetNumber` | String | — |
| `measurementDate` | DateTime | — |
| `locationZone` | String? | اختياري |
| `axisGridRef` | String? | اختياري |
| `statement` | String? | اختياري |
| `multiplierCount` | Decimal | Decimal(18,4) |
| `dimensionLength` | Decimal? | اختياري · Decimal(18,4) |
| `dimensionWidth` | Decimal? | اختياري · Decimal(18,4) |
| `dimensionHeight` | Decimal? | اختياري · Decimal(18,4) |
| `calculatedGrossQty` | Decimal | Decimal(18,4) |
| `deductionQty` | Decimal | Decimal(18,4) |
| `netExecutedQty` | Decimal | Decimal(18,4) |
| `attachments` | Json? | اختياري |
| `status` | MeasurementSheetStatus | — |
| `clientInvoiceId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- N→1 `projectBOQItem` → `ProjectBOQItem` — FK `projectBOQItemId` → `ProjectBOQItem.id` · onDelete Restrict
- N→0..1 `clientInvoice` → `ClientInvoice` — FK `clientInvoiceId` → `ClientInvoice.id` · onDelete SetNull
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, projectId, sheetNumber])`

فهارس: `@@index([companyId])` · `@@index([projectId])` · `@@index([projectBOQItemId])` · `@@index([status])` · `@@index([clientInvoiceId])`

## `financial_adjustment_notes` (`FinancialAdjustmentNote`)

إشعارات دائنة/مدينة وقيود عكسية كاملة بعد ترحيل المستخلص.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `noteNumber` | String | — |
| `noteType` | FinancialAdjustmentNoteType | — |
| `targetModule` | FinancialAdjustmentTargetModule | — |
| `sourceInvoiceId` | String | — |
| `subcontractId` | String? | اختياري |
| `clientContractId` | String? | اختياري |
| `reasonCategory` | FinancialAdjustmentReasonCategory | — |
| `reasonDescription` | String | — |
| `requestedByUserId` | String | — |
| `approvedByUserId` | String? | اختياري |
| `status` | FinancialAdjustmentNoteStatus | — |
| `grossAdjustmentAmount` | Decimal | Decimal(18,4) |
| `taxWhtAdjustmentAmount` | Decimal | Decimal(18,4) |
| `netAdjustmentAmount` | Decimal | Decimal(18,4) |
| `journalEntryId` | String? | اختياري |
| `reversalOfJournalEntryId` | String? | اختياري |
| `attachments` | Json? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Restrict
- N→0..1 `clientContract` → `ClientContract` — FK `clientContractId` → `ClientContract.id` · onDelete Restrict
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `AdjustmentNoteJournal` — FK `journalEntryId` → `JournalEntry.id` · onDelete Restrict
- N→0..1 `reversalOfJournalEntry` → `JournalEntry` اسم العلاقة: `AdjustmentNoteReversalOf` — FK `reversalOfJournalEntryId` → `JournalEntry.id` · onDelete Restrict
- 1→N `lines` → `FinancialAdjustmentLineItem[]`

قيود فريدة: `@@unique([companyId, noteNumber])`

فهارس: `@@index([companyId])` · `@@index([sourceInvoiceId])` · `@@index([status])` · `@@index([subcontractId])` · `@@index([clientContractId])` · `@@index([journalEntryId])` · `@@index([reversalOfJournalEntryId])`

## `financial_adjustment_line_items` (`FinancialAdjustmentLineItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `adjustmentNoteId` | String | — |
| `subcontractBOQItemId` | String? | اختياري |
| `projectBOQItemId` | String? | اختياري |
| `description` | String | — |
| `quantityAdjustment` | Decimal | Decimal(18,4) |
| `unitPrice` | Decimal | Decimal(18,4) |
| `totalAmount` | Decimal | Decimal(18,4) |
| `deductionTypeAffected` | FinancialAdjustmentDeductionType | — |

**العلاقات**

- N→1 `adjustmentNote` → `FinancialAdjustmentNote` — FK `adjustmentNoteId` → `FinancialAdjustmentNote.id` · onDelete Cascade
- N→0..1 `subcontractBOQItem` → `SubcontractBOQItem` — FK `subcontractBOQItemId` → `SubcontractBOQItem.id` · onDelete Restrict
- N→0..1 `projectBOQItem` → `ProjectBOQItem` — FK `projectBOQItemId` → `ProjectBOQItem.id` · onDelete Restrict

فهارس: `@@index([adjustmentNoteId])` · `@@index([subcontractBOQItemId])` · `@@index([projectBOQItemId])`

## `client_contracts` (`ClientContract`)

عقد المقاولة مع المالك (1-to-1 مع ContractingProject).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | فريد |
| `contractNumber` | String | — |
| `clientCustomerId` | String | — |
| `contractDate` | DateTime | — |
| `totalContractValue` | Decimal | Decimal(18,4) |
| `advancePaymentAmount` | Decimal | Decimal(18,4) |
| `advanceRecoveryRate` | Decimal | Decimal(8,6) |
| `retentionRate` | Decimal | Decimal(8,6) |
| `engineeringStampsRate` | Decimal | Decimal(8,6) |
| `status` | ClientContractStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- N→1 `client` → `Customer` — FK `clientCustomerId` → `Customer.id` · onDelete Restrict
- 1→N `invoices` → `ClientInvoice[]`
- 1→N `financialAdjustmentNotes` → `FinancialAdjustmentNote[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, contractNumber])`

فهارس: `@@index([companyId])` · `@@index([status])` · `@@index([clientCustomerId])`

## `client_invoices` (`ClientInvoice`)

مستخلص المالك الجاري والختامي (أعمال + تشوينات + خصومات المالك).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `clientContractId` | String | — |
| `invoiceNumber` | String | — |
| `sequenceNumber` | Int | — |
| `periodStartDate` | DateTime | — |
| `periodEndDate` | DateTime | — |
| `type` | ClientInvoiceType | — |
| `status` | ClientInvoiceStatus | — |
| `grossCurrentWorks` | Decimal | Decimal(18,4) |
| `previousGrossWorks` | Decimal | Decimal(18,4) |
| `cumulativeGrossWorks` | Decimal | Decimal(18,4) |
| `materialsOnSiteCurrent` | Decimal | Decimal(18,4) |
| `materialsOnSiteDeduction` | Decimal | Decimal(18,4) |
| `advancePaymentRecovery` | Decimal | Decimal(18,4) |
| `retentionDeduction` | Decimal | Decimal(18,4) |
| `engineeringStampsDeduction` | Decimal | Decimal(18,4) |
| `otherClientPenalties` | Decimal | Decimal(18,4) |
| `netPayableByClient` | Decimal | Decimal(18,4) |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `clientContract` → `ClientContract` — FK `clientContractId` → `ClientContract.id` · onDelete Restrict
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Restrict
- 1→N `items` → `ClientInvoiceItem[]`
- 1→N `measurementSheets` → `ExecutiveMeasurementSheet[]`
- 1→N `siteStockMaterials` → `SiteStockMaterial[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, invoiceNumber])` · `@@unique([clientContractId, sequenceNumber])`

فهارس: `@@index([companyId])` · `@@index([clientContractId])` · `@@index([status])` · `@@index([journalEntryId])`

## `client_invoice_items` (`ClientInvoiceItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `clientInvoiceId` | String | — |
| `projectBOQItemId` | String | — |
| `previousQuantity` | Decimal | Decimal(18,4) |
| `currentQuantity` | Decimal | Decimal(18,4) |
| `cumulativeQuantity` | Decimal | Decimal(18,4) |
| `unitSellingPrice` | Decimal | Decimal(18,4) |
| `currentAmount` | Decimal | Decimal(18,4) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `clientInvoice` → `ClientInvoice` — FK `clientInvoiceId` → `ClientInvoice.id` · onDelete Cascade
- N→1 `projectBOQItem` → `ProjectBOQItem` — FK `projectBOQItemId` → `ProjectBOQItem.id` · onDelete Restrict

قيود فريدة: `@@unique([clientInvoiceId, projectBOQItemId], map: "cli_items_invoice_boq_key")`

فهارس: `@@index([companyId])` · `@@index([clientInvoiceId])` · `@@index([projectBOQItemId])`

## `site_stock_materials` (`SiteStockMaterial`)

تشوينات الموقع المعتمدة لحساب مستخلص المالك.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `clientInvoiceId` | String? | اختياري |
| `materialDescription` | String | — |
| `deliveryDate` | DateTime | — |
| `warehouseReceiptRef` | String? | اختياري |
| `deliveredQuantity` | Decimal | Decimal(18,4) |
| `unitPrice` | Decimal | Decimal(18,4) |
| `approvedPercentage` | Decimal | Decimal(8,6) |
| `netClaimedAmount` | Decimal | Decimal(18,4) |
| `status` | SiteStockMaterialStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- N→0..1 `clientInvoice` → `ClientInvoice` — FK `clientInvoiceId` → `ClientInvoice.id` · onDelete SetNull

فهارس: `@@index([companyId])` · `@@index([projectId])` · `@@index([status])` · `@@index([clientInvoiceId])`

## `project_letters_of_guarantee` (`ProjectLetterOfGuarantee`)

خطابات ضمان المشروع (إصدار / مد / غطاء نقدي). Distinct from the legacy import-export `LetterOfGuarantee` card and from Wave-3 `GuaranteeLetter`.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectId` | String | — |
| `lgNumber` | String | — |
| `bankAccountId` | String | — |
| `bankName` | String | — |
| `beneficiaryName` | String | — |
| `type` | ProjectLgType | — |
| `issuanceDate` | DateTime | — |
| `expiryDate` | DateTime | — |
| `originalAmount` | Decimal | Decimal(18,4) |
| `currentAmount` | Decimal | Decimal(18,4) |
| `cashMarginRate` | Decimal | Decimal(8,6) |
| `cashMarginAmount` | Decimal | Decimal(18,4) |
| `issuanceCommissionAmount` | Decimal | Decimal(18,4) |
| `status` | ProjectLgStatus | — |
| `journalEntryId` | String? | اختياري |
| `renewalCount` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `project` → `ContractingProject` — FK `projectId` → `ContractingProject.id` · onDelete Restrict
- N→1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete Restrict
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Restrict
- 1→N `actionHistory` → `LgActionHistory[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, lgNumber])`

فهارس: `@@index([companyId])` · `@@index([projectId])` · `@@index([status])` · `@@index([bankAccountId])` · `@@index([expiryDate])` · `@@index([journalEntryId])`

## `lg_action_histories` (`LgActionHistory`)

سجل حركات إصدار ومد وتعديل وإفراج خطاب الضمان.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `letterOfGuaranteeId` | String | — |
| `actionType` | LgActionType | — |
| `actionDate` | DateTime | — |
| `previousExpiryDate` | DateTime? | اختياري |
| `newExpiryDate` | DateTime? | اختياري |
| `previousAmount` | Decimal? | اختياري · Decimal(18,4) |
| `newAmount` | Decimal? | اختياري · Decimal(18,4) |
| `bankReferenceNo` | String? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `letterOfGuarantee` → `ProjectLetterOfGuarantee` — FK `letterOfGuaranteeId` → `ProjectLetterOfGuarantee.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([letterOfGuaranteeId])` · `@@index([actionType])` · `@@index([actionDate])`

## `real_estate_settings` (`RealEstateSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `realEstateArAccountCode` | String? | اختياري |
| `unearnedRealEstateRevenueAccountCode` | String? | اختياري |
| `realEstateRevenueAccountCode` | String? | اختياري |
| `maintenanceDepositsAccountCode` | String? | اختياري |
| `penaltyRevenueAccountCode` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `real_estate_projects` (`RealEstateProject`)

@deprecated Prefer PropertyProject / PropertyPhase for new development work. Kept so Wave 3 unit-sale posting (RealEstateUnit → UnitContract) stays live.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectCode` | String | — |
| `projectName` | String | — |
| `costCenterId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `buildings` → `RealEstateBuilding[]`

قيود فريدة: `@@unique([companyId, projectCode])`

## `real_estate_buildings` (`RealEstateBuilding`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `buildingCode` | String | — |
| `name` | String | — |
| `totalFloors` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `RealEstateProject` — FK `projectId` → `RealEstateProject.id` · onDelete Cascade
- 1→N `units` → `RealEstateUnit[]`

قيود فريدة: `@@unique([projectId, buildingCode])`

## `real_estate_units` (`RealEstateUnit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `buildingId` | String | — |
| `unitCode` | String | — |
| `unitType` | String | — |
| `floor` | Int | — |
| `grossArea` | Decimal | Decimal(15,2) |
| `netArea` | Decimal | Decimal(15,2) |
| `meterPrice` | Decimal | Decimal(15,2) |
| `totalPrice` | Decimal | Decimal(15,2) |
| `maintenanceDeposit` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `building` → `RealEstateBuilding` — FK `buildingId` → `RealEstateBuilding.id` · onDelete Cascade
- 1→N `contracts` → `UnitContract[]`
- 1→N `reservations` → `RealEstateReservation[]`
- N→0..1 `propertyUnit` → `PropertyUnit`

قيود فريدة: `@@unique([buildingId, unitCode])`

فهارس: `@@index([buildingId, status])`

## `real_estate_reservations` (`RealEstateReservation`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `unitId` | String | — |
| `customerId` | String | — |
| `reservationDate` | DateTime | — |
| `reservationAmount` | Decimal? | اختياري · Decimal(15,2) |
| `notes` | String? | اختياري |
| `expiryDate` | DateTime? | اختياري |
| `status` | String | — |
| `confirmedAt` | DateTime? | اختياري |
| `cancelledAt` | DateTime? | اختياري |
| `cancellationReason` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `unit` → `RealEstateUnit` — FK `unitId` → `RealEstateUnit.id` · onDelete Restrict
- N→1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete Restrict

فهارس: `@@index([companyId, status])` · `@@index([unitId])` · `@@index([customerId])`

## `property_projects` (`PropertyProject`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `projectCode` | String | — |
| `nameAr` | String | — |
| `nameEn` | String? | اختياري |
| `location` | String? | اختياري |
| `constructionCompletionPct` | Decimal | Decimal(8,4) |
| `activePriceMultiplier` | Decimal | Decimal(8,6) |
| `costCenterId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `phases` → `PropertyPhase[]`

قيود فريدة: `@@unique([companyId, projectCode])`

فهارس: `@@index([companyId])`

## `property_phases` (`PropertyPhase`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `phaseCode` | String | — |
| `nameAr` | String | — |
| `nameEn` | String? | اختياري |
| `location` | String? | اختياري |
| `constructionCompletionPct` | Decimal | Decimal(8,4) |
| `activePriceMultiplier` | Decimal | Decimal(8,6) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `PropertyProject` — FK `projectId` → `PropertyProject.id` · onDelete Cascade
- 1→N `units` → `PropertyUnit[]`

قيود فريدة: `@@unique([projectId, phaseCode])`

فهارس: `@@index([projectId])`

## `property_units` (`PropertyUnit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `phaseId` | String | — |
| `unitCode` | String | — |
| `unitType` | PropertyUnitType | — |
| `grossArea` | Decimal | Decimal(18,4) |
| `netArea` | Decimal | Decimal(18,4) |
| `floorNumber` | Int | — |
| `basePricePerMeter` | Decimal | Decimal(18,4) |
| `premiumModifiersTotal` | Decimal | Decimal(18,4) |
| `totalPrice` | Decimal | Decimal(18,4) |
| `maintenanceDepositAmount` | Decimal | Decimal(18,4) |
| `status` | PropertyUnitStatus | — |
| `legacyRealEstateUnitId` | String? | اختياري · فريد |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `phase` → `PropertyPhase` — FK `phaseId` → `PropertyPhase.id` · onDelete Cascade
- N→0..1 `legacyRealEstateUnit` → `RealEstateUnit` — FK `legacyRealEstateUnitId` → `RealEstateUnit.id` · onDelete SetNull
- 1→N `contracts` → `UnitContract[]`
- 1→N `rentalAgreements` → `RentalPoolAgreement[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([phaseId, unitCode])`

فهارس: `@@index([phaseId, status])` · `@@index([status])`

## `unit_contracts` (`UnitContract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `unitId` | String | — |
| `propertyUnitId` | String? | اختياري |
| `customerId` | String | — |
| `contractNumber` | String | — |
| `contractDate` | DateTime | — |
| `deliveryDate` | DateTime? | اختياري |
| `totalContractAmount` | Decimal | Decimal(15,2) |
| `totalSellingPrice` | Decimal | Decimal(18,4) |
| `downPayment` | Decimal | Decimal(15,2) |
| `maintenanceAmount` | Decimal | Decimal(15,2) |
| `maintenanceDeposit` | Decimal | Decimal(18,4) |
| `discountAmount` | Decimal | Decimal(15,2) |
| `financingInterest` | Decimal | Decimal(15,2) |
| `outstandingArBalance` | Decimal | Decimal(15,2) |
| `unearnedRevenueBalance` | Decimal | Decimal(15,2) |
| `paymentPlanType` | UnitPaymentPlanType | — |
| `status` | String | — |
| `resaleLock` | Boolean | — |
| `contractJournalEntryId` | String? | اختياري |
| `handoverJournalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `handoverAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `unit` → `RealEstateUnit` — FK `unitId` → `RealEstateUnit.id` · onDelete Restrict
- N→0..1 `propertyUnit` → `PropertyUnit` — FK `propertyUnitId` → `PropertyUnit.id` · onDelete SetNull
- N→1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete Restrict
- 1→N `installments` → `UnitInstallment[]`
- 1→N `postDatedCheques` → `PostDatedCheque[]`
- 1→N `resaleTransfers` → `UnitResaleTransfer[]`
- 1→N `cancellationSettlements` → `UnitCancellationSettlement[]`
- 1→N `rentalAgreements` → `RentalPoolAgreement[]`
- 1→N `documentAttachments` → `DocumentAttachment[]`

قيود فريدة: `@@unique([companyId, contractNumber])`

فهارس: `@@index([unitId])` · `@@index([propertyUnitId])` · `@@index([customerId])` · `@@index([status])`

## `unit_installments` (`UnitInstallment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `contractId` | String | — |
| `installmentType` | UnitInstallmentType | — |
| `installmentNumber` | Int | — |
| `dueDate` | DateTime | — |
| `amount` | Decimal | Decimal(15,2) |
| `originalAmount` | Decimal | Decimal(18,4) |
| `paidAmount` | Decimal | Decimal(18,4) |
| `balance` | Decimal | Decimal(18,4) |
| `dailyLateFeeRate` | Decimal | Decimal(8,6) |
| `accumulatedLateFee` | Decimal | Decimal(18,4) |
| `interestPortion` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `chequeId` | String? | اختياري |
| `paymentTransactionId` | String? | اختياري |
| `paidAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `contract` → `UnitContract` — FK `contractId` → `UnitContract.id` · onDelete Cascade
- N→0..1 `cheque` → `Cheque` — FK `chequeId` → `Cheque.id` · onDelete SetNull
- N→0..1 `paymentTransaction` → `CashTransaction` — FK `paymentTransactionId` → `CashTransaction.id` · onDelete SetNull
- 1→N `postDatedCheques` → `PostDatedCheque[]`

قيود فريدة: `@@unique([contractId, installmentNumber])`

فهارس: `@@index([contractId, status])` · `@@index([dueDate])` · `@@index([status])`

## `post_dated_cheques` (`PostDatedCheque`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `unitContractId` | String | — |
| `unitInstallmentId` | String? | اختياري |
| `chequeNumber` | String | — |
| `bankName` | String | — |
| `drawerName` | String | — |
| `chequeDate` | DateTime | — |
| `amount` | Decimal | Decimal(18,4) |
| `status` | PostDatedChequeStatus | — |
| `collectionDate` | DateTime? | اختياري |
| `bouncedReason` | String? | اختياري |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `contract` → `UnitContract` — FK `unitContractId` → `UnitContract.id` · onDelete Restrict
- N→0..1 `installment` → `UnitInstallment` — FK `unitInstallmentId` → `UnitInstallment.id` · onDelete SetNull
- N→0..1 `journalEntry` → `JournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete Restrict

قيود فريدة: `@@unique([companyId, chequeNumber, bankName])`

فهارس: `@@index([unitContractId])` · `@@index([unitInstallmentId])` · `@@index([status])` · `@@index([chequeDate])`

## `unit_resale_transfers` (`UnitResaleTransfer`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `unitContractId` | String | — |
| `sellerCustomerId` | String | — |
| `newBuyerCustomerId` | String | — |
| `currentUnitMarketValue` | Decimal | Decimal(18,4) |
| `assignmentFeeRate` | Decimal | Decimal(8,6) |
| `assignmentFeeAmount` | Decimal | Decimal(18,4) |
| `isAssignmentFeePaid` | Boolean | — |
| `clearanceStatus` | UnitResaleClearanceStatus | — |
| `approvedByUserId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `contract` → `UnitContract` — FK `unitContractId` → `UnitContract.id` · onDelete Restrict
- N→1 `seller` → `Customer` اسم العلاقة: `ResaleSeller` — FK `sellerCustomerId` → `Customer.id` · onDelete Restrict
- N→1 `newBuyer` → `Customer` اسم العلاقة: `ResaleBuyer` — FK `newBuyerCustomerId` → `Customer.id` · onDelete Restrict
- N→0..1 `approvedBy` → `User` — FK `approvedByUserId` → `User.id` · onDelete SetNull

فهارس: `@@index([unitContractId])` · `@@index([sellerCustomerId])` · `@@index([newBuyerCustomerId])` · `@@index([clearanceStatus])`

## `unit_cancellation_settlements` (`UnitCancellationSettlement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `unitContractId` | String | — |
| `cancellationDate` | DateTime | — |
| `totalAmountPaidByClient` | Decimal | Decimal(18,4) |
| `forfeiturePenaltyRate` | Decimal | Decimal(8,6) |
| `forfeiturePenaltyAmount` | Decimal | Decimal(18,4) |
| `netRefundableToClient` | Decimal | Decimal(18,4) |
| `refundStatus` | UnitRefundStatus | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `contract` → `UnitContract` — FK `unitContractId` → `UnitContract.id` · onDelete Restrict

فهارس: `@@index([unitContractId])` · `@@index([refundStatus])`

## `rental_pool_agreements` (`RentalPoolAgreement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `propertyUnitId` | String | — |
| `unitContractId` | String? | اختياري |
| `ownerCustomerId` | String | — |
| `managementFeeRate` | Decimal | Decimal(8,6) |
| `startDate` | DateTime | — |
| `endDate` | DateTime? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `propertyUnit` → `PropertyUnit` — FK `propertyUnitId` → `PropertyUnit.id` · onDelete Restrict
- N→0..1 `contract` → `UnitContract` — FK `unitContractId` → `UnitContract.id` · onDelete SetNull
- N→1 `owner` → `Customer` — FK `ownerCustomerId` → `Customer.id` · onDelete Restrict
- 1→N `distributions` → `RentalDistribution[]`

فهارس: `@@index([companyId, isActive])` · `@@index([propertyUnitId])` · `@@index([unitContractId])` · `@@index([ownerCustomerId])`

## `rental_distributions` (`RentalDistribution`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `rentalPoolAgreementId` | String | — |
| `periodStart` | DateTime | — |
| `periodEnd` | DateTime | — |
| `grossRentReceived` | Decimal | Decimal(18,4) |
| `maintenanceOperatingExpense` | Decimal | Decimal(18,4) |
| `developerManagementFee` | Decimal | Decimal(18,4) |
| `netDistributedAmount` | Decimal | Decimal(18,4) |
| `distributedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `agreement` → `RentalPoolAgreement` — FK `rentalPoolAgreementId` → `RentalPoolAgreement.id` · onDelete Cascade

فهارس: `@@index([rentalPoolAgreementId])` · `@@index([periodEnd])`

## `school_settings` (`SchoolSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `studentArAccountCode` | String? | اختياري |
| `unearnedTuitionRevenueAccountCode` | String? | اختياري |
| `earnedTuitionRevenueAccountCode` | String? | اختياري |
| `tuitionDiscountAccountCode` | String? | اختياري |
| `busRevenueAccountCode` | String? | اختياري |
| `booksRevenueAccountCode` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `school_academic_years` (`SchoolAcademicYear`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `yearCode` | String | — |
| `name` | String | — |
| `startDate` | DateTime? | اختياري |
| `endDate` | DateTime? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `terms` → `SchoolAcademicTerm[]`
- 1→N `students` → `SchoolStudent[]`
- 1→N `contracts` → `StudentFeeContract[]`

قيود فريدة: `@@unique([companyId, yearCode])`

## `school_academic_terms` (`SchoolAcademicTerm`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `academicYearId` | String | — |
| `termCode` | String | — |
| `termName` | String | — |
| `startDate` | DateTime? | اختياري |
| `endDate` | DateTime? | اختياري |
| `sortOrder` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `academicYear` → `SchoolAcademicYear` — FK `academicYearId` → `SchoolAcademicYear.id` · onDelete Cascade

قيود فريدة: `@@unique([academicYearId, termCode])`

## `academic_grades` (`AcademicGrade`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `stageName` | String | — |
| `gradeName` | String | — |
| `gradeCode` | String | — |
| `defaultTuitionFee` | Decimal | Decimal(15,2) |
| `costCenterId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `costCenter` → `CostCenter` — FK `costCenterId` → `CostCenter.id` · onDelete SetNull
- 1→N `students` → `SchoolStudent[]`

قيود فريدة: `@@unique([companyId, gradeCode])`

## `school_bus_routes` (`SchoolBusRoute`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `routeCode` | String | — |
| `name` | String | — |
| `annualFee` | Decimal | Decimal(15,2) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `students` → `SchoolStudent[]`

قيود فريدة: `@@unique([companyId, routeCode])`

## `school_students` (`SchoolStudent`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `studentCode` | String | — |
| `fullName` | String | — |
| `guardianCustomerId` | String | — |
| `gradeId` | String | — |
| `academicYearId` | String | — |
| `busRouteId` | String? | اختياري |
| `status` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `guardian` → `Customer` — FK `guardianCustomerId` → `Customer.id` · onDelete Restrict
- N→1 `grade` → `AcademicGrade` — FK `gradeId` → `AcademicGrade.id` · onDelete Restrict
- N→1 `academicYear` → `SchoolAcademicYear` — FK `academicYearId` → `SchoolAcademicYear.id` · onDelete Restrict
- N→0..1 `busRoute` → `SchoolBusRoute` — FK `busRouteId` → `SchoolBusRoute.id` · onDelete SetNull
- 1→N `feeContracts` → `StudentFeeContract[]`

قيود فريدة: `@@unique([companyId, studentCode])`

فهارس: `@@index([guardianCustomerId])`

## `student_fee_contracts` (`StudentFeeContract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `studentId` | String | — |
| `academicYearId` | String | — |
| `contractNumber` | String | — |
| `totalGrossFee` | Decimal | Decimal(15,2) |
| `totalDiscount` | Decimal | Decimal(15,2) |
| `totalNetFee` | Decimal | Decimal(15,2) |
| `tuitionFee` | Decimal | Decimal(15,2) |
| `busFee` | Decimal | Decimal(15,2) |
| `booksFee` | Decimal | Decimal(15,2) |
| `outstandingArBalance` | Decimal | Decimal(15,2) |
| `unearnedTuitionBalance` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `accrualJournalEntryId` | String? | اختياري |
| `recognitionJournalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `student` → `SchoolStudent` — FK `studentId` → `SchoolStudent.id` · onDelete Restrict
- N→1 `academicYear` → `SchoolAcademicYear` — FK `academicYearId` → `SchoolAcademicYear.id` · onDelete Restrict
- 1→N `installments` → `StudentFeeInstallment[]`

قيود فريدة: `@@unique([companyId, contractNumber])`

فهارس: `@@index([studentId])`

## `student_fee_installments` (`StudentFeeInstallment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `contractId` | String | — |
| `installmentNumber` | Int | — |
| `termName` | String? | اختياري |
| `dueDate` | DateTime | — |
| `amount` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `paymentTransactionId` | String? | اختياري |
| `paidAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `contract` → `StudentFeeContract` — FK `contractId` → `StudentFeeContract.id` · onDelete Cascade
- N→0..1 `paymentTransaction` → `CashTransaction` — FK `paymentTransactionId` → `CashTransaction.id` · onDelete SetNull

قيود فريدة: `@@unique([contractId, installmentNumber])`

فهارس: `@@index([contractId, status])`

## `monthly_salaries` (`MonthlySalary`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `contractId` | String? | اختياري |
| `serial` | String? | اختياري |
| `periodYear` | String | — |
| `periodMonth` | String | — |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `workDays` | Decimal? | اختياري · Decimal(5,2) |
| `basicSalary` | Decimal | Decimal(15,2) |
| `totalAllowances` | Decimal? | اختياري · Decimal(15,2) |
| `totalDeductions` | Decimal? | اختياري · Decimal(15,2) |
| `additions` | Decimal? | اختياري · Decimal(15,2) |
| `discounts` | Decimal? | اختياري · Decimal(15,2) |
| `overtime` | Decimal? | اختياري · Decimal(15,2) |
| `absence` | Decimal? | اختياري · Decimal(15,2) |
| `advances` | Decimal? | اختياري · Decimal(15,2) |
| `employeeInsurance` | Decimal? | اختياري · Decimal(15,2) |
| `companyInsurance` | Decimal? | اختياري · Decimal(15,2) |
| `netSalary` | Decimal | Decimal(15,2) |
| `record` | String? | اختياري |
| `notes` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade
- N→0..1 `contract` → `EmployeeContract` — FK `contractId` → `EmployeeContract.id`

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([contractId])` · `@@index([periodYear, periodMonth])` · `@@index([date])`

## `housing_allowance_clearances` (`HousingAllowanceClearance`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `contractId` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `daysSinceLastDisbursement` | Int? | اختياري |
| `monthsSinceLastDisbursement` | Int? | اختياري |
| `availableAdditions` | Decimal? | اختياري · Decimal(15,2) |
| `monthlySalary` | Decimal? | اختياري · Decimal(15,2) |
| `totalValue` | Decimal? | اختياري · Decimal(15,2) |
| `totalSalary` | Decimal? | اختياري · Decimal(15,2) |
| `allowanceAmount` | Decimal | Decimal(15,2) |
| `accountId` | String? | اختياري |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade
- N→0..1 `contract` → `EmployeeContract` — FK `contractId` → `EmployeeContract.id`

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([contractId])` · `@@index([date])`

## `end_of_service_clearances` (`EndOfServiceClearance`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `contractId` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `workDays` | Decimal? | اختياري · Decimal(10,2) |
| `absenceDays` | Decimal? | اختياري · Decimal(10,2) |
| `yearsOfWork` | Decimal? | اختياري · Decimal(10,2) |
| `netWorkDays` | Decimal? | اختياري · Decimal(10,2) |
| `vacationDays` | Decimal? | اختياري · Decimal(10,2) |
| `dueDays` | Decimal? | اختياري · Decimal(10,2) |
| `dueDaysValue` | Decimal? | اختياري · Decimal(15,2) |
| `monthlySalary` | Decimal? | اختياري · Decimal(15,2) |
| `totalValue` | Decimal? | اختياري · Decimal(15,2) |
| `vacationDaysValue` | Decimal? | اختياري · Decimal(15,2) |
| `eosAmount` | Decimal | Decimal(15,2) |
| `accountId` | String? | اختياري |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade
- N→0..1 `contract` → `EmployeeContract` — FK `contractId` → `EmployeeContract.id`

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([contractId])` · `@@index([date])`

## `annual_leave_entitlements_clearances` (`AnnualLeaveEntitlementsClearance`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `contractId` | String? | اختياري |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `fromDate` | DateTime? | اختياري |
| `fromDateHijri` | String? | اختياري |
| `toDate` | DateTime? | اختياري |
| `toDateHijri` | String? | اختياري |
| `lastDirectDate` | DateTime? | اختياري |
| `lastDirectDateHijri` | String? | اختياري |
| `workDays` | Decimal? | اختياري · Decimal(10,2) |
| `dueDays` | Decimal? | اختياري · Decimal(10,2) |
| `previousBalance` | Decimal? | اختياري · Decimal(10,2) |
| `totalAvailableDays` | Decimal? | اختياري · Decimal(10,2) |
| `monthlySalary` | Decimal? | اختياري · Decimal(15,2) |
| `availableAllowances` | Decimal? | اختياري · Decimal(15,2) |
| `totalValue` | Decimal? | اختياري · Decimal(15,2) |
| `dueTickets` | Decimal? | اختياري · Decimal(10,2) |
| `addedValue` | Decimal? | اختياري · Decimal(15,2) |
| `requiredDays` | Decimal? | اختياري · Decimal(10,2) |
| `deductedValue` | Decimal? | اختياري · Decimal(15,2) |
| `leaveEntitlements` | Decimal? | اختياري · Decimal(10,2) |
| `totalEntitlements` | Decimal? | اختياري · Decimal(15,2) |
| `entitlementDays` | Decimal | Decimal(10,2) |
| `accountId` | String? | اختياري |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade
- N→0..1 `contract` → `EmployeeContract` — FK `contractId` → `EmployeeContract.id`

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([contractId])` · `@@index([date])`

## `customer_followups` (`CustomerFollowup`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `customerId` | String | — |
| `propertyId` | String? | اختياري |
| `followupDate` | DateTime | — |
| `followupDateHijri` | String? | اختياري |
| `followupType` | String? | اختياري · call/visit/email/etc. |
| `followupData` | String? | اختياري |
| `nextFollowupDate` | DateTime? | اختياري |
| `nextFollowupDateHijri` | String? | اختياري |
| `status` | String? | اختياري · active/completed/cancelled |
| `employeeId` | String? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `customer` → `Customer` اسم العلاقة: `CustomerFollowups` — FK `customerId` → `Customer.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([customerId])` · `@@index([propertyId])` · `@@index([followupDate])`

## `nationalities` (`Nationality`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `employees` → `Employee[]`

قيود فريدة: `@@unique([companyId, code])`

## `religions` (`Religion`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `employees` → `Employee[]`

قيود فريدة: `@@unique([companyId, code])`

## `marital_statuses` (`MaritalStatus`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `employees` → `Employee[]`

قيود فريدة: `@@unique([companyId, code])`

## `job_titles` (`JobTitle`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `contracts` → `EmployeeContract[]`
- 1→N `employees` → `Employee[]`

قيود فريدة: `@@unique([companyId, code])`

## `job_cadres` (`JobCadre`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `contracts` → `EmployeeContract[]`

قيود فريدة: `@@unique([companyId, code])`

## `departments` (`Department`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `managementId` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `contracts` → `EmployeeContract[]`
- 1→N `employees` → `Employee[]`
- N→0..1 `management` → `Department` اسم العلاقة: `DepartmentManagement` — FK `managementId` → `Department.id` · onDelete SetNull
- 1→N `subDepartments` → `Department[]` اسم العلاقة: `DepartmentManagement`
- 1→N `cashTransactions` → `CashTransaction[]`

قيود فريدة: `@@unique([companyId, code])`

فهارس: `@@index([managementId])`

## `cities` (`City`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `contracts` → `EmployeeContract[]`

قيود فريدة: `@@unique([companyId, code])`

## `wage_policies` (`WagePolicy`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `contracts` → `EmployeeContract[]`

قيود فريدة: `@@unique([companyId, code])`

## `allowances` (`Allowance`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, code])`

## `deductions` (`Deduction`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, code])`

## `students` (`Student`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `studentName` | String | — |
| `year` | String? | اختياري |
| `fatherName` | String? | اختياري |
| `fatherGrandfather` | String? | اختياري |
| `fatherGreatGrandfather` | String? | اختياري |
| `motherName` | String? | اختياري |
| `motherGrandfather` | String? | اختياري |
| `motherGreatGrandfather` | String? | اختياري |
| `currencyCode` | String? | اختياري |
| `stageId` | String? | اختياري |
| `semesterId` | String? | اختياري |
| `paymentType` | String? | اختياري |
| `enrollment` | String? | اختياري |
| `isFinished` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `stage` → `Stage` — FK `stageId` → `Stage.id`
- N→0..1 `semester` → `Semester` — FK `semesterId` → `Semester.id`
- 1→N `installments` → `StudentInstallment[]`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([companyId, stageId])`

## `student_installments` (`StudentInstallment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `studentId` | String | — |
| `installment` | Int | — |
| `date` | DateTime | — |
| `value` | Decimal | Decimal(15,2) |
| `carValue` | Decimal? | اختياري · Decimal(15,2) |
| `educationDiscount` | Decimal? | اختياري · Decimal(15,2) |
| `carDiscount` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal | Decimal(15,2) |
| `isPaid` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `student` → `Student` — FK `studentId` → `Student.id` · onDelete Cascade

فهارس: `@@index([studentId])` · `@@index([date])` · `@@index([studentId, isPaid])`

## `stages` (`Stage`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `students` → `Student[]`

قيود فريدة: `@@unique([companyId, code])`

## `semesters` (`Semester`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `students` → `Student[]`

قيود فريدة: `@@unique([companyId, code])`

## `collectors` (`Collector`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, serial])`

فهارس: `@@index([companyId])`

## `projects` (`Project`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `totalValue` | Decimal? | اختياري · Decimal(15,2) |
| `advancePaymentPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `advancePaymentValue` | Decimal? | اختياري · Decimal(15,2) |
| `latePenaltyPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `latePenaltyPerDays` | String? | اختياري |
| `businessAffairsPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `facilitiesDeductionPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `facilitiesDeductionMax` | Decimal? | اختياري · Decimal(15,2) |
| `otherAdditions` | Json? | اختياري · Array of { name: string, value: Decimal } |
| `otherDeductions` | Json? | اختياري · Array of { name: string, value: Decimal } |
| `notes` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `buildings` → `ProjectBuilding[]`
- 1→N `workItems` → `ProjectWorkItem[]`
- 1→N `extracts` → `Extract[]`
- 1→N `extractPayments` → `ExtractPayment[]`
- 1→N `contractorAssignments` → `ContractorAssignment[]`
- 1→N `measurementDefinitions` → `ProjectMeasurementDefinition[]`
- 1→N `manpowerLogs` → `ManpowerLog[]`

فهارس: `@@index([companyId])` · `@@index([serial])`

## `project_buildings` (`ProjectBuilding`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `groupNumber` | String? | اختياري |
| `modelNumber` | String? | اختياري |
| `unitNumber` | String? | اختياري |
| `arabicName` | String? | اختياري |
| `imageUrl` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade
- 1→N `workItems` → `ProjectWorkItem[]`
- 1→N `extractItems` → `ExtractItem[]`

فهارس: `@@index([projectId])`

## `project_work_items` (`ProjectWorkItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `buildingId` | String? | اختياري |
| `itemNumber` | String | — |
| `itemGroupCode` | String? | اختياري |
| `itemGroupName` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,2) |
| `unit` | String? | اختياري |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `totalPrice` | Decimal? | اختياري · Decimal(15,2) |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade
- N→0..1 `building` → `ProjectBuilding` — FK `buildingId` → `ProjectBuilding.id` · onDelete SetNull
- 1→N `contractorAssignments` → `ContractorAssignment[]`
- 1→N `extractItems` → `ExtractItem[]`

فهارس: `@@index([projectId])` · `@@index([buildingId])`

## `contractors` (`Contractor`)

@deprecated Prefer Subcontractor + Subcontract for new mostakhlassat work. Remains the party card for the legacy Extract / ContractorAssignment screens.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `taxNumber` | String? | اختياري |
| `phone` | String? | اختياري |
| `address` | String? | اختياري |
| `notes` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `assignments` → `ContractorAssignment[]`
- 1→N `extracts` → `Extract[]`
- 1→N `extractPayments` → `ExtractPayment[]`
- N→0..1 `contractorSettings` → `ContractorSettings`
- 1→N `projectSubcontracts` → `ProjectSubcontract[]`
- 1→N `subcontractorExtracts` → `SubcontractorExtract[]`

فهارس: `@@index([companyId])` · `@@index([serial])`

## `contractor_settings` (`ContractorSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `contractorId` | String | فريد |
| `advancePaymentPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `workInsurancePercentage` | Decimal? | اختياري · Decimal(5,2) |
| `taxDeductionPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `otherSettings` | Json? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `contractor` → `Contractor` — FK `contractorId` → `Contractor.id` · onDelete Cascade

## `contractor_assignments` (`ContractorAssignment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `contractorId` | String | — |
| `workItemId` | String | — |
| `assignmentDate` | DateTime | الآن |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade
- N→1 `contractor` → `Contractor` — FK `contractorId` → `Contractor.id` · onDelete Cascade
- N→1 `workItem` → `ProjectWorkItem` — FK `workItemId` → `ProjectWorkItem.id` · onDelete Cascade

قيود فريدة: `@@unique([projectId, contractorId, workItemId])`

فهارس: `@@index([projectId])` · `@@index([contractorId])` · `@@index([workItemId])`

## `extracts` (`Extract`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `contractorId` | String? | اختياري |
| `extractNumber` | String? | اختياري |
| `extractDate` | DateTime | — |
| `statementType` | String | 'partial' | 'final' |
| `statement` | String? | اختياري |
| `extractType` | String | 'contractor' | 'owner' | 'self-execution' |
| `totalValue` | Decimal? | اختياري · Decimal(15,2) |
| `advancePayment` | Decimal? | اختياري · Decimal(15,2) |
| `netWorkValue` | Decimal? | اختياري · Decimal(15,2) |
| `previousWorkTotal` | Decimal? | اختياري · Decimal(15,2) |
| `previousExtractCount` | Int? | اختياري |
| `isPosted` | Boolean | — |
| `isCancelled` | Boolean | — |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade
- N→0..1 `contractor` → `Contractor` — FK `contractorId` → `Contractor.id` · onDelete SetNull
- 1→N `items` → `ExtractItem[]`
- 1→N `payments` → `ExtractPayment[]`

فهارس: `@@index([projectId])` · `@@index([contractorId])` · `@@index([extractDate])`

## `extract_items` (`ExtractItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `extractId` | String | — |
| `workItemId` | String? | اختياري |
| `buildingId` | String? | اختياري |
| `unitNumber` | String? | اختياري |
| `modelNumber` | String? | اختياري |
| `groupCode` | String? | اختياري |
| `groupName` | String? | اختياري |
| `itemNumber` | String? | اختياري |
| `itemName` | String | — |
| `quantity` | Decimal | Decimal(15,2) |
| `unit` | String? | اختياري |
| `unitPrice` | Decimal? | اختياري · Decimal(15,2) |
| `totalPrice` | Decimal? | اختياري · Decimal(15,2) |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `extract` → `Extract` — FK `extractId` → `Extract.id` · onDelete Cascade
- N→0..1 `workItem` → `ProjectWorkItem` — FK `workItemId` → `ProjectWorkItem.id` · onDelete SetNull
- N→0..1 `building` → `ProjectBuilding` — FK `buildingId` → `ProjectBuilding.id` · onDelete SetNull

فهارس: `@@index([extractId])` · `@@index([workItemId])` · `@@index([buildingId])`

## `extract_payments` (`ExtractPayment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `extractId` | String | — |
| `contractorId` | String? | اختياري |
| `projectId` | String | — |
| `paymentNumber` | String? | اختياري |
| `paymentDate` | DateTime | — |
| `dueDate` | DateTime? | اختياري |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `checkNumber` | String? | اختياري |
| `checkDate` | DateTime? | اختياري |
| `hijriDate` | String? | اختياري |
| `description` | String? | اختياري |
| `totalExtracts` | Decimal? | اختياري · Decimal(15,2) |
| `totalPaid` | Decimal? | اختياري · Decimal(15,2) |
| `paymentAmount` | Decimal | Decimal(15,2) |
| `itemGroup` | String? | اختياري |
| `notes` | String? | اختياري |
| `isPosted` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `extract` → `Extract` — FK `extractId` → `Extract.id` · onDelete Cascade
- N→0..1 `contractor` → `Contractor` — FK `contractorId` → `Contractor.id` · onDelete SetNull
- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade

فهارس: `@@index([extractId])` · `@@index([contractorId])` · `@@index([projectId])` · `@@index([paymentDate])`

## `project_measurement_definitions` (`ProjectMeasurementDefinition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `unit` | String? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade

فهارس: `@@index([projectId])`

## `manpower_logs` (`ManpowerLog`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `projectId` | String | — |
| `date` | DateTime | — |
| `workerName` | String | — |
| `workerType` | String? | اختياري · 'skilled' | 'unskilled' | 'supervisor' | etc. |
| `hours` | Decimal? | اختياري · Decimal(5,2) |
| `wage` | Decimal? | اختياري · Decimal(15,2) |
| `total` | Decimal? | اختياري · Decimal(15,2) |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `project` → `Project` — FK `projectId` → `Project.id` · onDelete Cascade

فهارس: `@@index([projectId])` · `@@index([date])`

## `serial_numbers` (`SerialNumber`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `documentType` | String | e.g., 'INV', 'JE', 'TR', etc. |
| `year` | Int? | اختياري · Year for year-based numbering |
| `sequence` | Int | — |
| `lastUsed` | DateTime | الآن |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, documentType, year])`

فهارس: `@@index([companyId, documentType])`

## `electronic_invoice_items` (`ElectronicInvoiceItem`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `itemId` | String? | اختياري · Reference to inventory item |
| `itemCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `unitCode` | String? | اختياري |
| `unitName` | String? | اختياري |
| `taxType` | String? | اختياري · 'T1' | 'T2' | 'T3' | etc. |
| `taxRate` | Decimal? | اختياري · Decimal(5,2) |
| `price` | Decimal? | اختياري · Decimal(15,2) |
| `description` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete SetNull
- 1→N `invoiceLines` → `ElectronicInvoiceLine[]`

فهارس: `@@index([companyId])` · `@@index([itemCode])`

## `electronic_invoice_customers` (`ElectronicInvoiceCustomer`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `customerId` | String? | اختياري · Reference to accounting customer |
| `supplierId` | String? | اختياري · Reference to supplier |
| `taxNumber` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `address` | String? | اختياري |
| `city` | String? | اختياري |
| `country` | String? | اختياري |
| `phone` | String? | اختياري |
| `email` | String? | اختياري |
| `registrationNumber` | String? | اختياري |
| `commercialRegistration` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- 1→N `invoices` → `ElectronicInvoice[]`

قيود فريدة: `@@unique([companyId, taxNumber])`

فهارس: `@@index([companyId])` · `@@index([taxNumber])`

## `electronic_invoices` (`ElectronicInvoice`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `customerId` | String | — |
| `invoiceType` | String | 'sales' | 'return' | 'amendment' |
| `invoiceNumber` | String? | اختياري |
| `invoiceDate` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `uuid` | String? | اختياري · فريد · ETA UUID |
| `longId` | String? | اختياري · ETA Long ID |
| `qrCode` | String? | اختياري |
| `status` | String | 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled' |
| `submissionDate` | DateTime? | اختياري |
| `approvalDate` | DateTime? | اختياري |
| `rejectionReason` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `totalTax` | Decimal | Decimal(15,2) |
| `totalAmountAfterTax` | Decimal | Decimal(15,2) |
| `discountAmount` | Decimal? | اختياري · Decimal(15,2) |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→1 `customer` → `ElectronicInvoiceCustomer` — FK `customerId` → `ElectronicInvoiceCustomer.id` · onDelete Cascade
- 1→N `lines` → `ElectronicInvoiceLine[]`

فهارس: `@@index([companyId])` · `@@index([customerId])` · `@@index([invoiceDate])` · `@@index([status])` · `@@index([uuid])`

## `electronic_invoice_lines` (`ElectronicInvoiceLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `invoiceId` | String | — |
| `itemId` | String? | اختياري |
| `itemCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,2) |
| `unitCode` | String? | اختياري |
| `unitName` | String? | اختياري |
| `unitPrice` | Decimal | Decimal(15,2) |
| `totalPrice` | Decimal | Decimal(15,2) |
| `taxType` | String? | اختياري |
| `taxRate` | Decimal? | اختياري · Decimal(5,2) |
| `taxAmount` | Decimal | Decimal(15,2) |
| `discountAmount` | Decimal? | اختياري · Decimal(15,2) |
| `totalAfterTax` | Decimal | Decimal(15,2) |
| `lineNumber` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `invoice` → `ElectronicInvoice` — FK `invoiceId` → `ElectronicInvoice.id` · onDelete Cascade
- N→0..1 `item` → `ElectronicInvoiceItem` — FK `itemId` → `ElectronicInvoiceItem.id` · onDelete SetNull

فهارس: `@@index([invoiceId])` · `@@index([itemId])`

## `sensor_readings` (`SensorReading`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String? | اختياري |
| `machineId` | String | — |
| `sensorType` | String | — |
| `value` | Decimal | Decimal(15,4) |
| `unit` | String? | اختياري |
| `timestamp` | DateTime | — |
| `metadata` | Json? | اختياري |
| `createdAt` | DateTime | الآن |

فهارس: `@@index([companyId, machineId, sensorType])` · `@@index([timestamp])` · `@@index([companyId, machineId, timestamp])`

## `api_keys` (`ApiKey`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `name` | String | — |
| `key` | String | Encrypted API key |
| `keyHash` | String | فريد · SHA-256 hash for lookup |
| `userId` | String? | اختياري |
| `companyId` | String? | اختياري |
| `tenantId` | String? | اختياري |
| `permissions` | Json | Array of permission strings |
| `expiresAt` | DateTime? | اختياري |
| `lastUsedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

فهارس: `@@index([userId])` · `@@index([companyId])` · `@@index([tenantId])` · `@@index([expiresAt])`

## `system_settings` (`SystemSetting`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `key` | String | فريد |
| `value` | String? | اختياري |
| `type` | String | string, number, boolean, json |
| `category` | String? | اختياري |
| `description` | String? | اختياري |
| `isPublic` | Boolean | Can be accessed without auth |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

فهارس: `@@index([key])` · `@@index([category])` · `@@index([isPublic])`

## `documentary_credit_definitions` (`DocumentaryCreditDefinition`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `supplierId` | String? | اختياري · Reference to Supplier |
| `supplierName` | String? | اختياري |
| `description` | String? | اختياري |
| `shippingPort` | String? | اختياري |
| `creditValue` | Decimal? | اختياري · Decimal(15,2) |
| `creditNumber` | String? | اختياري |
| `currencyId` | String? | اختياري · Reference to Currency |
| `currencyName` | String? | اختياري |
| `shippingMethod` | String? | اختياري · 'بحري' | 'جوي' | 'برى' |
| `paymentMethod` | String? | اختياري · 'فيزا' | 'شيك' | 'نقد' |
| `openingDate` | DateTime? | اختياري |
| `openingDateHijri` | String? | اختياري |
| `closingDate` | DateTime? | اختياري |
| `closingDateHijri` | String? | اختياري |
| `shippingDate` | DateTime? | اختياري |
| `shippingDateHijri` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `credits` → `DocumentaryCredit[]`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([supplierId])`

## `documentary_credits` (`DocumentaryCredit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `definitionId` | String? | اختياري · Reference to DocumentaryCreditDefinition |
| `serial` | String? | اختياري |
| `supplierId` | String? | اختياري · Reference to Supplier |
| `supplierName` | String? | اختياري |
| `accountId` | String? | اختياري · Reference to Account |
| `accountName` | String? | اختياري |
| `costCenterId` | String? | اختياري · Reference to CostCenter |
| `costCenterName` | String? | اختياري |
| `description` | String? | اختياري |
| `approvalStatus` | String | 'open' | 'closed' |
| `approvalNumber` | String? | اختياري |
| `approvalValue` | Decimal? | اختياري · Decimal(15,2) |
| `currencyId` | String? | اختياري · Reference to Currency |
| `currencyName` | String? | اختياري |
| `shippingMethod` | String? | اختياري · 'بحري' | 'جوي' | 'برى' |
| `paymentMethod` | String? | اختياري · 'فيزا' | 'شيك' | 'نقد' |
| `applicationDate` | DateTime? | اختياري · تاريخ الطلب |
| `applicationDateHijri` | String? | اختياري |
| `openingDate` | DateTime? | اختياري · تاريخ الفتح |
| `openingDateHijri` | String? | اختياري |
| `closingDate` | DateTime? | اختياري · تاريخ الإغلاق |
| `closingDateHijri` | String? | اختياري |
| `shippingDate` | DateTime? | اختياري · تاريخ الشحن |
| `shippingDateHijri` | String? | اختياري |
| `arrivalDate` | DateTime? | اختياري · تاريخ الوصول |
| `arrivalDateHijri` | String? | اختياري |
| `date1` | DateTime? | اختياري |
| `date1Hijri` | String? | اختياري |
| `date2` | DateTime? | اختياري |
| `date2Hijri` | String? | اختياري |
| `date3` | DateTime? | اختياري |
| `date3Hijri` | String? | اختياري |
| `date4` | DateTime? | اختياري |
| `date4Hijri` | String? | اختياري |
| `date5` | DateTime? | اختياري |
| `date5Hijri` | String? | اختياري |
| `date6` | DateTime? | اختياري |
| `date6Hijri` | String? | اختياري |
| `date7` | DateTime? | اختياري |
| `date7Hijri` | String? | اختياري |
| `date8` | DateTime? | اختياري |
| `date8Hijri` | String? | اختياري |
| `date9` | DateTime? | اختياري |
| `date9Hijri` | String? | اختياري |
| `date10` | DateTime? | اختياري |
| `date10Hijri` | String? | اختياري |
| `shippingPort` | String? | اختياري |
| `billOfLading` | String? | اختياري · البوليصة |
| `taxEntryId` | String? | اختياري · Reference to JournalEntry |
| `entryId` | String? | اختياري · Reference to JournalEntry |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `definition` → `DocumentaryCreditDefinition` — FK `definitionId` → `DocumentaryCreditDefinition.id` · onDelete SetNull

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([supplierId])` · `@@index([definitionId])` · `@@index([approvalStatus])`

## `letter_of_guarantee_settings` (`LetterOfGuaranteeSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `guaranteeAccountId` | String? | اختياري · Default account for guarantees |
| `expenseAccountId` | String? | اختياري · Default expense account |
| `defaultCurrencyId` | String? | اختياري · Default currency |
| `defaultBidPercentage` | Decimal? | اختياري · Decimal(5,2) · Default bid percentage |
| `autoRenewalEnabled` | Boolean | — |
| `renewalWarningDays` | Int? | اختياري · Days before expiry to warn |
| `includeBankExpenses` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `letters_of_guarantee` (`LetterOfGuarantee`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `description` | String? | اختياري |
| `guaranteeAccountId` | String? | اختياري · Reference to Account |
| `guaranteeAccountName` | String? | اختياري |
| `letterType` | String | 'incoming' | 'outgoing' |
| `letterNumber` | String? | اختياري |
| `issueDate` | DateTime? | اختياري |
| `issueDateHijri` | String? | اختياري |
| `expiryDate` | DateTime? | اختياري |
| `expiryDateHijri` | String? | اختياري |
| `letterValue` | Decimal? | اختياري · Decimal(15,2) |
| `bidPercentage` | Decimal? | اختياري · Decimal(5,2) |
| `bidValue` | Decimal? | اختياري · Decimal(15,2) |
| `beneficiary` | String? | اختياري · الجهة المستفيدة |
| `issuingBank` | String? | اختياري · بنك الإصدار |
| `incomingParty` | String? | اختياري · طرف الوارد |
| `includesBankExpenses` | Boolean | — |
| `expenseAccountId` | String? | اختياري · Reference to Account |
| `expenseAccountName` | String? | اختياري |
| `expenseValue` | Decimal? | اختياري · Decimal(15,2) |
| `costCenterId` | String? | اختياري · Reference to CostCenter |
| `costCenterName` | String? | اختياري |
| `type` | String? | اختياري · نوع الخطاب |
| `currencyId` | String? | اختياري · Reference to Currency |
| `currencyName` | String? | اختياري |
| `accruedRevenue` | Decimal? | اختياري · Decimal(15,2) |
| `operationsCenter` | String? | اختياري |
| `cashCollectionPapers1` | String? | اختياري · أوراق القبض النقدية 1 |
| `cashCollectionPapers2` | String? | اختياري · أوراق القبض النقدية 2 |
| `cashCollectionPapers3` | String? | اختياري · أوراق القبض النقدية 3 |
| `approvalStatus` | String | 'open' | 'closed' |
| `entryId` | String? | اختياري · Reference to JournalEntry |
| `closingEntryId` | String? | اختياري · Reference to JournalEntry |
| `creationEntryId` | String? | اختياري · Reference to JournalEntry |
| `date1` | DateTime? | اختياري |
| `date1Hijri` | String? | اختياري |
| `date2` | DateTime? | اختياري |
| `date2Hijri` | String? | اختياري |
| `date3` | DateTime? | اختياري |
| `date3Hijri` | String? | اختياري |
| `date4` | DateTime? | اختياري |
| `date4Hijri` | String? | اختياري |
| `date5` | DateTime? | اختياري |
| `date5Hijri` | String? | اختياري |
| `date6` | DateTime? | اختياري |
| `date6Hijri` | String? | اختياري |
| `date7` | DateTime? | اختياري |
| `date7Hijri` | String? | اختياري |
| `date8` | DateTime? | اختياري |
| `date8Hijri` | String? | اختياري |
| `date9` | DateTime? | اختياري |
| `date9Hijri` | String? | اختياري |
| `date10` | DateTime? | اختياري |
| `date10Hijri` | String? | اختياري |
| `isRenewed` | Boolean | — |
| `renewedFromId` | String? | اختياري · Reference to previous letter |
| `renewedAt` | DateTime? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `renewedFrom` → `LetterOfGuarantee` اسم العلاقة: `LetterRenewals` — FK `renewedFromId` → `LetterOfGuarantee.id` · onDelete SetNull
- 1→N `renewedTo` → `LetterOfGuarantee[]` اسم العلاقة: `LetterRenewals`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([letterType])` · `@@index([approvalStatus])` · `@@index([expiryDate])` · `@@index([renewedFromId])`

## `tax_periods` (`TaxPeriod`)

DaribaPeriod — VAT / WHT declaration window

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String | — |
| `periodNumber` | Int | — |
| `periodName` | String? | اختياري |
| `periodType` | String | — |
| `sourceYearId` | String? | اختياري |
| `startDate` | DateTime | — |
| `endDate` | DateTime | — |
| `status` | String | — |
| `closedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete Restrict
- 1→N `declarations` → `TaxDeclaration[]`

قيود فريدة: `@@unique([companyId, fiscalYearId, periodNumber])`

فهارس: `@@index([companyId, startDate, endDate])` · `@@index([companyId, status])`

## `tax_declarations` (`TaxDeclaration`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `taxPeriodId` | String | — |
| `fiscalYearId` | String? | اختياري |
| `totalOutputVat` | Decimal | Decimal(15,2) |
| `totalInputVat` | Decimal | Decimal(15,2) |
| `netVatAmount` | Decimal | Decimal(15,2) |
| `totalWithholdingTax` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `settlementJournalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `taxPeriod` → `TaxPeriod` — FK `taxPeriodId` → `TaxPeriod.id` · onDelete Cascade
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `settlementJournalEntry` → `JournalEntry` — FK `settlementJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `settlements` → `TaxSettlement[]`

قيود فريدة: `@@unique([companyId, taxPeriodId])`

## `tax_settlements` (`TaxSettlement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `taxDeclarationId` | String | — |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `paymentJournalEntryId` | String? | اختياري |
| `safeId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `settledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `taxDeclaration` → `TaxDeclaration` — FK `taxDeclarationId` → `TaxDeclaration.id` · onDelete Cascade
- N→0..1 `paymentJournalEntry` → `JournalEntry` — FK `paymentJournalEntryId` → `JournalEntry.id` · onDelete SetNull

فهارس: `@@index([companyId, taxDeclarationId])`

## `pos_terminals` (`PosTerminal`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String | — |
| `warehouseId` | String | — |
| `safeId` | String | — |
| `bankAccountId` | String? | اختياري |
| `defaultCustomerId` | String? | اختياري |
| `name` | String | — |
| `deviceCode` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Restrict
- N→1 `safe` → `Safe` — FK `safeId` → `Safe.id` · onDelete Restrict
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `defaultCustomer` → `Customer` — FK `defaultCustomerId` → `Customer.id` · onDelete SetNull
- 1→N `shifts` → `PosShift[]`

قيود فريدة: `@@unique([companyId, deviceCode])`

فهارس: `@@index([companyId, branchId])`

## `pos_shifts` (`PosShift`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String | — |
| `fiscalYearId` | String? | اختياري |
| `terminalId` | String | — |
| `userId` | String | — |
| `shiftNumber` | String? | اختياري |
| `status` | String | — |
| `openedAt` | DateTime | الآن |
| `closedAt` | DateTime? | اختياري |
| `openingCash` | Decimal | Decimal(15,2) |
| `closingCashDeclared` | Decimal? | اختياري · Decimal(15,2) |
| `closingCashSystem` | Decimal? | اختياري · Decimal(15,2) |
| `cashVariance` | Decimal? | اختياري · Decimal(15,2) |
| `totalCashSales` | Decimal | Decimal(15,2) |
| `totalCardSales` | Decimal | Decimal(15,2) |
| `totalCreditSales` | Decimal | Decimal(15,2) |
| `totalMerchandise` | Decimal | Decimal(15,2) |
| `totalTaxAmount` | Decimal | Decimal(15,2) |
| `totalCogs` | Decimal | Decimal(15,2) |
| `endOfDayJournalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→1 `terminal` → `PosTerminal` — FK `terminalId` → `PosTerminal.id` · onDelete Restrict
- N→0..1 `endOfDayJournalEntry` → `JournalEntry` اسم العلاقة: `PosShiftEndJe` — FK `endOfDayJournalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `orders` → `PosOrder[]`

فهارس: `@@index([companyId, terminalId, status])`

## `pos_orders` (`PosOrder`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `shiftId` | String | — |
| `orderNumber` | String | — |
| `orderType` | String | — |
| `originalOrderId` | String? | اختياري |
| `status` | String | — |
| `customerId` | String? | اختياري |
| `barcodeRef` | String? | اختياري |
| `totalAmount` | Decimal | Decimal(15,2) |
| `discountAmount` | Decimal | Decimal(15,2) |
| `taxAmount` | Decimal | Decimal(15,2) |
| `netAmount` | Decimal | Decimal(15,2) |
| `cashAmount` | Decimal | Decimal(15,2) |
| `cardAmount` | Decimal | Decimal(15,2) |
| `creditAmount` | Decimal | Decimal(15,2) |
| `paymentMethod` | String | — |
| `currencyCode` | String | — |
| `journalEntryId` | String? | اختياري |
| `postedAt` | DateTime? | اختياري |
| `postedBy` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `shift` → `PosShift` — FK `shiftId` → `PosShift.id` · onDelete Cascade
- N→0..1 `customer` → `Customer` — FK `customerId` → `Customer.id` · onDelete SetNull
- N→0..1 `originalOrder` → `PosOrder` اسم العلاقة: `PosReturnLink` — FK `originalOrderId` → `PosOrder.id` · onDelete SetNull
- 1→N `returns` → `PosOrder[]` اسم العلاقة: `PosReturnLink`
- N→0..1 `journalEntry` → `JournalEntry` اسم العلاقة: `PosOrderJournalEntry` — FK `journalEntryId` → `JournalEntry.id` · onDelete SetNull
- 1→N `lines` → `PosOrderLine[]`
- 1→N `eInvoiceDocuments` → `EInvoiceDocument[]`

قيود فريدة: `@@unique([companyId, orderNumber])`

فهارس: `@@index([shiftId, status])`

## `pos_order_lines` (`PosOrderLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `orderId` | String | — |
| `itemId` | String | — |
| `unitId` | String | — |
| `quantity` | Decimal | Decimal(15,4) |
| `price` | Decimal | Decimal(15,4) |
| `discountPercent` | Decimal? | اختياري · Decimal(5,2) |
| `discountAmount` | Decimal | Decimal(15,2) |
| `taxPercent` | Decimal | Decimal(8,4) |
| `taxAmount` | Decimal | Decimal(15,2) |
| `lineTotal` | Decimal | Decimal(15,2) |
| `unitCost` | Decimal | Decimal(15,4) |
| `lineOrder` | Int | — |

**العلاقات**

- N→1 `order` → `PosOrder` — FK `orderId` → `PosOrder.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Restrict
- N→1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete Restrict

فهارس: `@@index([orderId])`

## `e_invoice_settings` (`EInvoiceSetting`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `clientId` | String? | اختياري |
| `clientSecret` | String? | اختياري |
| `tokenPin` | String? | اختياري |
| `environment` | String | — |
| `issuerTaxId` | String? | اختياري |
| `issuerName` | String? | اختياري |
| `activityCode` | String? | اختياري |
| `apiBaseUrl` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `e_invoice_documents` (`EInvoiceDocument`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `invoiceId` | String? | اختياري |
| `posOrderId` | String? | اختياري |
| `documentType` | String | — |
| `status` | String | — |
| `documentUuid` | String? | اختياري · فريد |
| `submissionUuid` | String? | اختياري |
| `longId` | String? | اختياري |
| `publicUrl` | String? | اختياري |
| `originalDocumentUuid` | String? | اختياري |
| `contentHash` | String | — |
| `rawPayload` | Json | — |
| `submissionResponse` | Json? | اختياري |
| `errorDetails` | Json? | اختياري |
| `validationErrors` | Json? | اختياري |
| `dateTimeIssued` | DateTime? | اختياري |
| `dateTimeReceived` | DateTime? | اختياري |
| `submittedAt` | DateTime? | اختياري |
| `cancelledAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `invoice` → `Invoice` — FK `invoiceId` → `Invoice.id` · onDelete SetNull
- N→0..1 `posOrder` → `PosOrder` — FK `posOrderId` → `PosOrder.id` · onDelete SetNull

قيود فريدة: `@@unique([companyId, contentHash])`

فهارس: `@@index([companyId, status])` · `@@index([invoiceId])` · `@@index([posOrderId])`

## `trade_settings` (`TradeSettings`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `openLcWipAccountCode` | String? | اختياري |
| `inventoryAccountCode` | String? | اختياري |
| `lcPayableAccountCode` | String? | اختياري |
| `lgCashCoverAccountCode` | String? | اختياري |
| `bankCommissionAccountCode` | String? | اختياري |
| `lgConfiscationLossAccountCode` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `letter_of_credits` (`LetterOfCredit`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `lcNumber` | String | — |
| `supplierId` | String? | اختياري |
| `bankAccountId` | String? | اختياري |
| `warehouseId` | String? | اختياري |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `totalAmountFx` | Decimal | Decimal(15,2) |
| `merchandiseBase` | Decimal | Decimal(15,2) |
| `totalLandedCost` | Decimal | Decimal(15,2) |
| `status` | String | — |
| `expiryDate` | DateTime? | اختياري |
| `openingJournalEntryId` | String? | اختياري |
| `clearingJournalEntryId` | String? | اختياري |
| `issueDate` | DateTime | الآن |
| `clearedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `supplier` → `Supplier` — FK `supplierId` → `Supplier.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull
- N→0..1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete SetNull
- 1→N `expenses` → `LcExpense[]`
- 1→N `receiptLines` → `LcReceiptLine[]`

قيود فريدة: `@@unique([companyId, lcNumber])`

فهارس: `@@index([companyId, status])`

## `lc_expenses` (`LcExpense`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `lcId` | String | — |
| `expenseType` | String | — |
| `description` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `exchangeRate` | Decimal | Decimal(18,6) |
| `amountBase` | Decimal | Decimal(15,2) |
| `expenseDate` | DateTime | الآن |
| `journalEntryId` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `lc` → `LetterOfCredit` — FK `lcId` → `LetterOfCredit.id` · onDelete Cascade

فهارس: `@@index([lcId])` · `@@index([companyId])`

## `lc_receipt_lines` (`LcReceiptLine`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `lcId` | String | — |
| `itemId` | String | — |
| `unitId` | String? | اختياري |
| `quantity` | Decimal | Decimal(15,4) |
| `merchandiseBase` | Decimal | Decimal(15,2) |
| `allocatedExpenseBase` | Decimal | Decimal(15,2) |
| `landedUnitCostBase` | Decimal | Decimal(15,4) |
| `lineOrder` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `lc` → `LetterOfCredit` — FK `lcId` → `LetterOfCredit.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Restrict

فهارس: `@@index([lcId])`

## `guarantee_letters` (`GuaranteeLetter`)

Wave 2 bank guarantee letters (M23); legacy `letters_of_guarantee` remains for import-export UI.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `fiscalYearId` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `lgNumber` | String | — |
| `lgType` | String | — |
| `bankAccountId` | String? | اختياري |
| `beneficiaryName` | String? | اختياري |
| `amount` | Decimal | Decimal(15,2) |
| `cashCoverAmount` | Decimal | Decimal(15,2) |
| `commissionAmount` | Decimal | Decimal(15,2) |
| `currencyCode` | String | — |
| `issueDate` | DateTime | — |
| `expiryDate` | DateTime? | اختياري |
| `status` | String | — |
| `issueJournalEntryId` | String? | اختياري |
| `releaseJournalEntryId` | String? | اختياري |
| `confiscateJournalEntryId` | String? | اختياري |
| `extendedAt` | DateTime? | اختياري |
| `releasedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `fiscalYear` → `FiscalYear` — FK `fiscalYearId` → `FiscalYear.id` · onDelete SetNull
- N→0..1 `bankAccount` → `BankAccount` — FK `bankAccountId` → `BankAccount.id` · onDelete SetNull

قيود فريدة: `@@unique([companyId, lgNumber])`

فهارس: `@@index([companyId, status])`

## `withholding_tax_payments` (`WithholdingTaxPayment`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `description` | String? | اختياري |
| `gregorianDate` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `selectedPeriod` | String? | اختياري · e.g., "الفترة الأولى", "الفترة الثانية" |
| `due` | Decimal? | اختياري · Decimal(15,2) |
| `paid` | Decimal? | اختياري · Decimal(15,2) |
| `dueBalance` | Decimal? | اختياري · Decimal(15,2) |
| `supplierId` | String? | اختياري |
| `invoiceId` | String? | اختياري |
| `paymentDate` | DateTime? | اختياري |
| `taxAmount` | Decimal? | اختياري · Decimal(15,2) |
| `accountId` | String? | اختياري |
| `notes` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([gregorianDate])` · `@@index([supplierId])`

## `end_of_service_disbursements` (`EndOfServiceDisbursement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `paymentMethod` | String? | اختياري · 'fund' | 'bank' |
| `vacationId` | String? | اختياري · Reference to EndOfServiceClearance or vacation type |
| `amount` | Decimal | Decimal(15,2) |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([date])`

## `annual_leave_entitlements_disbursements` (`AnnualLeaveEntitlementsDisbursement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `paymentMethod` | String? | اختياري · 'fund' | 'bank' |
| `vacationId` | String? | اختياري · Reference to AnnualLeaveEntitlementsClearance |
| `amount` | Decimal | Decimal(15,2) |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([date])`

## `monthly_salaries_disbursements` (`MonthlySalariesDisbursement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `month` | String | e.g., "يناير", "فبراير" |
| `year` | String | e.g., "2025" |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([year, month])`

## `housing_allowance_entitlements_disbursements` (`HousingAllowanceEntitlementsDisbursement`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `employeeId` | String | — |
| `serial` | String? | اختياري |
| `date` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `paymentMethod` | String? | اختياري · 'fund' | 'bank' |
| `housingRef` | String? | اختياري · Reference to HousingAllowanceClearance or type |
| `amount` | Decimal | Decimal(15,2) |
| `notes` | String? | اختياري |
| `record` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `employee` → `Employee` — FK `employeeId` → `Employee.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([employeeId])` · `@@index([date])`

## `other_addition_discount_types` (`OtherAdditionDiscountType`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `name` | String | e.g., "دمغة" |
| `accountId` | String? | اختياري · Reference to Account |
| `offsetAccountId` | String? | اختياري |
| `abbreviation` | String? | اختياري · e.g., "دمغة" |
| `isActive` | Boolean | — |
| `base` | String? | اختياري · 'amount' | 'discount-origin' (أصل المبلغ | أصل - خصم الصنف) |
| `type` | String? | اختياري · 'addition' | 'discount' (إضافة | خصم) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `percentages` → `OtherAdditionDiscountPercentage[]`

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([name])`

## `other_addition_discount_percentages` (`OtherAdditionDiscountPercentage`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `otherAdditionDiscountTypeId` | String | — |
| `source` | String | default | activities | items | groups | suppliers | customers |
| `sourceId` | String? | اختياري |
| `sourceName` | String? | اختياري |
| `percentage` | Decimal | Decimal(5,2) · Percentage value |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `otherAdditionDiscountType` → `OtherAdditionDiscountType` — FK `otherAdditionDiscountTypeId` → `OtherAdditionDiscountType.id` · onDelete Cascade

فهارس: `@@index([otherAdditionDiscountTypeId])` · `@@index([source])`

## `representative_commission_quantities` (`RepresentativeCommissionQuantity`)

Item-level quantity commission policy (تعريف سياسة عمولات المندوبين كميات).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `itemId` | String? | اختياري |
| `itemName` | String? | اختياري |
| `policyName` | String? | اختياري |
| `days` | Int? | اختياري |
| `commissionBefore` | Decimal? | اختياري · Decimal(18,4) |
| `commissionAfter` | Decimal? | اختياري · Decimal(18,4) |
| `cashRate` | Decimal? | اختياري · Decimal(18,4) |
| `creditRate` | Decimal? | اختياري · Decimal(18,4) |
| `percent` | Decimal? | اختياري · Decimal(8,4) |
| `target` | Decimal? | اختياري · Decimal(18,4) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete SetNull

فهارس: `@@index([companyId])` · `@@index([itemId])`

## `representative_commission_values` (`RepresentativeCommissionValue`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `name` | String | — |
| `target` | Decimal? | اختياري · Decimal(18,4) |
| `targetPercentage` | Decimal? | اختياري · Decimal(8,4) |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `tiers` → `RepresentativeCommissionValueTier[]`

فهارس: `@@index([companyId])` · `@@index([serial])`

## `representative_commission_value_tiers` (`RepresentativeCommissionValueTier`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `policyId` | String | — |
| `days` | Int? | اختياري |
| `commissionPct` | Decimal? | اختياري · Decimal(8,4) |
| `sortOrder` | Int | — |

**العلاقات**

- N→1 `policy` → `RepresentativeCommissionValue` — FK `policyId` → `RepresentativeCommissionValue.id` · onDelete Cascade

فهارس: `@@index([policyId])`

## `representative_commission_policies` (`RepresentativeCommissionPolicy`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `code` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `tiers` → `RepresentativeCommissionPolicyTier[]`

فهارس: `@@index([companyId])` · `@@index([code])`

## `representative_commission_policy_tiers` (`RepresentativeCommissionPolicyTier`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `policyId` | String | — |
| `targetSlice` | String? | اختياري |
| `targetPct` | Decimal? | اختياري · Decimal(8,4) |
| `commissionPct` | Decimal? | اختياري · Decimal(8,4) |
| `bonusPct` | Decimal? | اختياري · Decimal(8,4) |
| `increasePct` | Decimal? | اختياري · Decimal(8,4) |
| `sortOrder` | Int | — |

**العلاقات**

- N→1 `policy` → `RepresentativeCommissionPolicy` — FK `policyId` → `RepresentativeCommissionPolicy.id` · onDelete Cascade

فهارس: `@@index([policyId])`

## `distributors` (`Distributor`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `nationality` | String? | اختياري |
| `barcode` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `mobile` | String? | اختياري |
| `fax` | String? | اختياري |
| `email` | String? | اختياري |
| `website` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `area` | String? | اختياري |
| `street` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `poBox` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([arabicName])`

## `drivers` (`Driver`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `serial` | String? | اختياري |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `nationality` | String? | اختياري |
| `barcode` | String? | اختياري |
| `phone1` | String? | اختياري |
| `phone2` | String? | اختياري |
| `mobile` | String? | اختياري |
| `fax` | String? | اختياري |
| `email` | String? | اختياري |
| `website` | String? | اختياري |
| `country` | String? | اختياري |
| `city` | String? | اختياري |
| `area` | String? | اختياري |
| `street` | String? | اختياري |
| `postalCode` | String? | اختياري |
| `poBox` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([serial])` · `@@index([arabicName])`

## `person_groups` (`PersonGroup`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `persons` → `Person[]`

قيود فريدة: `@@unique([companyId, legacyCode])`

## `persons` (`Person`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `legacyCode` | String | — |
| `arabicName` | String | — |
| `englishName` | String? | اختياري |
| `personGroupId` | String? | اختياري |
| `mainAccountId` | String? | اختياري |
| `priceListId` | String? | اختياري |
| `isActive` | Boolean | — |
| `deletedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `personGroup` → `PersonGroup` — FK `personGroupId` → `PersonGroup.id` · onDelete SetNull
- N→0..1 `mainAccount` → `Account` اسم العلاقة: `PersonMainAccount` — FK `mainAccountId` → `Account.id` · onDelete SetNull
- 1→N `itemPrices` → `PersonItemPrice[]`

قيود فريدة: `@@unique([companyId, legacyCode])`

فهارس: `@@index([companyId, personGroupId])`

## `person_item_prices` (`PersonItemPrice`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `personId` | String | — |
| `itemId` | String | — |
| `unitId` | String? | اختياري |
| `price` | Decimal | Decimal(18,4) |
| `discountPct` | Decimal? | اختياري · Decimal(18,4) |
| `validFrom` | DateTime? | اختياري |
| `validTo` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `person` → `Person` — FK `personId` → `Person.id` · onDelete Cascade
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Cascade
- N→0..1 `unit` → `Unit` — FK `unitId` → `Unit.id` · onDelete SetNull

فهارس: `@@index([companyId, personId, itemId])`

## `item_cost_history` (`ItemCostHistory`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String | — |
| `itemId` | String | — |
| `serial` | Int | — |
| `cost` | Decimal | Decimal(18,4) |
| `effectiveAt` | DateTime | — |
| `documentDate` | DateTime | — |
| `hijriDate` | String? | اختياري |
| `sourceType` | String | — |
| `sourceNumber` | String | — |
| `sourceYearId` | String | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Restrict
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Restrict

قيود فريدة: `@@unique([companyId, itemId, serial])` · `@@unique([companyId, itemId, sourceType, sourceNumber, sourceYearId])`

فهارس: `@@index([companyId, itemId, effectiveAt])`

## `inventory_movements` (`InventoryMovement`)

Consolidated stock ledger (legacy AllWarehousingTrans)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `warehouseId` | String | — |
| `itemId` | String | — |
| `locationId` | String? | اختياري |
| `quantityDelta` | Decimal | Decimal(18,4) |
| `unitCost` | Decimal? | اختياري · Decimal(18,4) |
| `resultingAverageCost` | Decimal? | اختياري · Decimal(18,4) |
| `movementType` | String | — |
| `sourceType` | String? | اختياري |
| `sourceNumber` | String? | اختياري |
| `sourceYearId` | String? | اختياري |
| `sourceDocumentId` | String? | اختياري |
| `documentDate` | DateTime | — |
| `effectiveAt` | DateTime | الآن |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Restrict
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→1 `warehouse` → `Warehouse` — FK `warehouseId` → `Warehouse.id` · onDelete Restrict
- N→1 `item` → `Item` — FK `itemId` → `Item.id` · onDelete Restrict
- N→0..1 `location` → `Location` — FK `locationId` → `Location.id` · onDelete SetNull

فهارس: `@@index([companyId, itemId, effectiveAt])` · `@@index([companyId, warehouseId, itemId])` · `@@index([companyId, warehouseId, itemId, documentDate])` · `@@index([companyId, documentDate(sort: Desc), movementType], map: "idx_inventory_movements_date_type")` · `@@index([companyId, sourceDocumentId])`

## `document_attachments` (`DocumentAttachment`)

Tenant-isolated legal/engineering files. Never store base64 on the parent row.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `originalFileName` | String | — |
| `storedFileName` | String | — |
| `fileSize` | Int | — |
| `mimeType` | String | — |
| `storageProvider` | String | — |
| `storagePathKey` | String | — |
| `fileCategory` | DocumentCategory | — |
| `entityType` | String | — |
| `entityId` | String | — |
| `fileName` | String | — |
| `storagePath` | String | — |
| `fileUrl` | String? | اختياري |
| `description` | String? | اختياري |
| `tags` | Json? | اختياري |
| `uploadedById` | String? | اختياري |
| `deletedAt` | DateTime? | اختياري |
| `subcontractId` | String? | اختياري |
| `subcontractInvoiceId` | String? | اختياري |
| `sitePenaltyId` | String? | اختياري |
| `materialReconciliationId` | String? | اختياري |
| `executiveMeasurementSheetId` | String? | اختياري |
| `clientContractId` | String? | اختياري |
| `clientInvoiceId` | String? | اختياري |
| `letterOfGuaranteeId` | String? | اختياري |
| `propertyUnitId` | String? | اختياري |
| `unitContractId` | String? | اختياري |
| `uploadedByUserId` | String | — |
| `isArchived` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete SetNull
- N→0..1 `subcontract` → `Subcontract` — FK `subcontractId` → `Subcontract.id` · onDelete Restrict
- N→0..1 `subcontractInvoice` → `SubcontractInvoice` — FK `subcontractInvoiceId` → `SubcontractInvoice.id` · onDelete Restrict
- N→0..1 `sitePenalty` → `SitePenaltyAndSnag` — FK `sitePenaltyId` → `SitePenaltyAndSnag.id` · onDelete Restrict
- N→0..1 `materialReconciliation` → `MaterialReconciliationLog` — FK `materialReconciliationId` → `MaterialReconciliationLog.id` · onDelete Restrict
- N→0..1 `executiveMeasurementSheet` → `ExecutiveMeasurementSheet` — FK `executiveMeasurementSheetId` → `ExecutiveMeasurementSheet.id` · onDelete Restrict
- N→0..1 `clientContract` → `ClientContract` — FK `clientContractId` → `ClientContract.id` · onDelete Restrict
- N→0..1 `clientInvoice` → `ClientInvoice` — FK `clientInvoiceId` → `ClientInvoice.id` · onDelete Restrict
- N→0..1 `letterOfGuarantee` → `ProjectLetterOfGuarantee` — FK `letterOfGuaranteeId` → `ProjectLetterOfGuarantee.id` · onDelete Restrict
- N→0..1 `propertyUnit` → `PropertyUnit` — FK `propertyUnitId` → `PropertyUnit.id` · onDelete Restrict
- N→0..1 `unitContract` → `UnitContract` — FK `unitContractId` → `UnitContract.id` · onDelete Restrict

فهارس: `@@index([companyId])` · `@@index([companyId, entityType, entityId])` · `@@index([companyId, deletedAt])` · `@@index([subcontractInvoiceId])` · `@@index([letterOfGuaranteeId])` · `@@index([executiveMeasurementSheetId])` · `@@index([clientInvoiceId])` · `@@index([subcontractId])` · `@@index([clientContractId])` · `@@index([isArchived])`

## `tenant_subscriptions` (`TenantSubscription`)

M21 — SaaS tenant license / subscription (legacy smAppLisence)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `planType` | String | — |
| `status` | String | — |
| `startDate` | DateTime | — |
| `expiryDate` | DateTime? | اختياري |
| `maxBranches` | Int | — |
| `maxUsers` | Int | — |
| `maxStorageMb` | Int | — |
| `allowedModules` | Json | — |
| `licenseKeyHash` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([status])`

## `document_layout_configs` (`DocumentLayoutConfig`)

Print/layout customization profile for generated documents (invoices, receipts, tax documents, …). One row per (company, branch?, documentType); branchId = null means the config applies company-wide unless a branch-specific row overrides it.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `name` | String | — |
| `isDefault` | Boolean | — |
| `documentType` | DocumentLayoutType | — |
| `layoutPreset` | DocumentLayoutPreset | — |
| `tableStyle` | DocumentTableStyle | — |
| `fontFamily` | String | — |
| `primaryColor` | String | — |
| `secondaryColor` | String | — |
| `textColor` | String | — |
| `paperSize` | DocumentPaperSize | — |
| `marginSize` | DocumentMarginSize | — |
| `logoUrl` | String? | اختياري |
| `logoPosition` | DocumentLogoPosition | — |
| `logoWidth` | Int | — |
| `companyNameAr` | String? | اختياري |
| `companyNameEn` | String? | اختياري |
| `taxId` | String? | اختياري |
| `commercialReg` | String? | اختياري |
| `tagline` | String? | اختياري |
| `footerText` | String? | اختياري |
| `bankDetails` | Json? | اختياري |
| `showQrCode` | Boolean | — |
| `showStampAndSignatures` | Boolean | — |
| `signatureLabels` | Json? | اختياري |
| `watermarkText` | String? | اختياري |
| `columnSettings` | Json? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→0..1 `branch` → `Branch` — FK `branchId` → `Branch.id` · onDelete Cascade

فهارس: `@@index([companyId, documentType])` · `@@index([companyId, isDefault])`

## `ai_conversations` (`AiConversation`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `title` | String | — |
| `userId` | String | — |
| `companyId` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `messages` → `AiMessage[]`
- 1→N `toolExecutions` → `AiToolExecution[]`
- 1→N `pendingActions` → `AiPendingAction[]`

فهارس: `@@index([companyId, userId])` · `@@index([companyId, updatedAt])`

## `ai_messages` (`AiMessage`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `conversationId` | String | — |
| `role` | String | — |
| `content` | String | — |
| `toolCalls` | Json? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `conversation` → `AiConversation` — FK `conversationId` → `AiConversation.id` · onDelete Cascade

فهارس: `@@index([conversationId, createdAt])`

## `ai_tool_executions` (`AiToolExecution`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `conversationId` | String | — |
| `toolName` | String | — |
| `inputArgs` | Json | — |
| `outputResult` | Json? | اختياري |
| `status` | String | — |
| `executionTimeMs` | Int? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `conversation` → `AiConversation` — FK `conversationId` → `AiConversation.id` · onDelete Cascade

فهارس: `@@index([conversationId, createdAt])` · `@@index([toolName])`

## `ai_audit_logs` (`AiAuditLog`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `userId` | String | — |
| `companyId` | String | — |
| `userRole` | String? | اختياري |
| `currentScreen` | String? | اختياري |
| `userPrompt` | String? | اختياري |
| `toolCalls` | Json? | اختياري |
| `toolResults` | Json? | اختياري |
| `aiResponse` | String? | اختياري |
| `status` | AiAuditStatus | — |
| `latencyMs` | Int? | اختياري |
| `tokensUsed` | Int? | اختياري |
| `action` | String | — |
| `metadata` | Json? | اختياري |
| `ipAddress` | String? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade
- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId, userId])` · `@@index([companyId, createdAt])` · `@@index([userId, createdAt])` · `@@index([action])`

## `ai_pending_actions` (`AiPendingAction`)

Human-in-the-loop write queue. Tools only insert PENDING rows — never execute.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `conversationId` | String | — |
| `companyId` | String | — |
| `userId` | String | — |
| `actionType` | String | — |
| `requiredPermission` | String | — |
| `payload` | Json | — |
| `summaryDisplay` | Json | — |
| `status` | AiActionStatus | — |
| `executionError` | String? | اختياري |
| `resultingEntityId` | String? | اختياري |
| `expiresAt` | DateTime | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `conversation` → `AiConversation` — FK `conversationId` → `AiConversation.id` · onDelete Cascade

فهارس: `@@index([companyId, userId, status])` · `@@index([conversationId])`

## `ai_documents` (`AiDocument`)

Company-scoped RAG corpus. Embeddings live in JSON here (MySQL) and optionally in pgvector when VECTOR_DATABASE_URL is configured.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `uploadedById` | String | — |
| `title` | String | — |
| `fileName` | String | — |
| `fileUrl` | String | — |
| `fileSize` | Int | — |
| `mimeType` | String | — |
| `category` | AiDocumentCategory | — |
| `referenceId` | String? | اختياري |
| `totalChunks` | Int | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `uploadedBy` → `User` — FK `uploadedById` → `User.id` · onDelete Cascade
- 1→N `chunks` → `AiDocumentChunk[]`

فهارس: `@@index([companyId, category])` · `@@index([companyId, referenceId])`

## `ai_document_chunks` (`AiDocumentChunk`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `documentId` | String | — |
| `companyId` | String | — |
| `chunkIndex` | Int | — |
| `content` | String | — |
| `tokenCount` | Int | — |
| `metadata` | Json? | اختياري |
| `embedding` | Json? | اختياري |

**العلاقات**

- N→1 `document` → `AiDocument` — FK `documentId` → `AiDocument.id` · onDelete Cascade

فهارس: `@@index([companyId])` · `@@index([documentId])`

## `ai_insights` (`AiInsight`)

Nightly CFO anomalies. Numbers are deterministic; `summary` may be AI-written.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `branchId` | String? | اختياري |
| `category` | InsightCategory | — |
| `severity` | InsightSeverity | — |
| `title` | String | — |
| `summary` | String | — |
| `deterministicData` | Json | — |
| `actionLink` | String? | اختياري |
| `isDismissed` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `expiresAt` | DateTime? | اختياري |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([companyId, isDismissed, createdAt])` · `@@index([companyId, category])`

## `user_tour_progress` (`UserTourProgress`)

Per-user Gates Academy AI tour progress. Replaces company JSON `academyProgress` and localStorage.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `userId` | String | — |
| `moduleSlug` | String | — |
| `isCompleted` | Boolean | — |
| `lastStepIndex` | Int | — |
| `dismissedCount` | Int | — |
| `completedAt` | DateTime? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `user` → `User` — FK `userId` → `User.id` · onDelete Cascade

قيود فريدة: `@@unique([userId, moduleSlug])`

فهارس: `@@index([companyId, userId])`

## `ai_sentinel_snapshots` (`AiSentinelSnapshot`)

Cached Enterprise Sentinel executive report (06:00 Cairo scan + live GET).

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `payload` | Json | — |
| `generatedAt` | DateTime | — |
| `source` | String | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

## `company_whatsapp_configs` (`CompanyWhatsappConfig`)

@deprecated Decommissioned WhatsApp Cloud API config. Table kept; no runtime readers.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | فريد |
| `phoneNumberId` | String | — |
| `wabaId` | String? | اختياري |
| `accessToken` | String | — |
| `webhookVerifyToken` | String | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

فهارس: `@@index([phoneNumberId])`

## `whatsapp_authorized_users` (`WhatsappAuthorizedUser`)

@deprecated Decommissioned WhatsApp phone bindings. Table kept; no runtime readers.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `phoneNumber` | String | — |
| `userId` | String? | اختياري |
| `customerId` | String? | اختياري |
| `roleType` | String | — |
| `isActive` | Boolean | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, phoneNumber])`

فهارس: `@@index([phoneNumber])`

## `growth_opportunities` (`GrowthOpportunity`)

Deterministic financial opportunity detected from ERP records.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `fingerprint` | String | — |
| `type` | String | — |
| `category` | GrowthOpportunityCategory | — |
| `title` | String | — |
| `description` | String | — |
| `whyDetected` | String | — |
| `status` | GrowthOpportunityStatus | — |
| `priority` | GrowthOpportunityPriority | — |
| `estimatedValue` | Decimal | Decimal(18,4) |
| `actionedValue` | Decimal | Decimal(18,4) |
| `realizedValue` | Decimal | Decimal(18,4) |
| `currencyCode` | String | — |
| `module` | String? | اختياري |
| `entityType` | String? | اختياري |
| `entityId` | String? | اختياري |
| `confidence` | Decimal | Decimal(5,2) |
| `evidence` | Json? | اختياري |
| `recommendedActions` | Json? | اختياري |
| `metadata` | Json? | اختياري |
| `generatedBy` | String | — |
| `aiExplanation` | String? | اختياري |
| `reviewedAt` | DateTime? | اختياري |
| `reviewedBy` | String? | اختياري |
| `actionedAt` | DateTime? | اختياري |
| `actionedBy` | String? | اختياري |
| `resolvedAt` | DateTime? | اختياري |
| `dismissedAt` | DateTime? | اختياري |
| `dismissedBy` | String? | اختياري |
| `createdAt` | DateTime | الآن |
| `updatedAt` | DateTime | يتحدث تلقائي |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- 1→N `actions` → `GrowthOpportunityAction[]`
- 1→N `attributions` → `GrowthAttribution[]`

قيود فريدة: `@@unique([companyId, fingerprint])`

فهارس: `@@index([companyId, status])` · `@@index([companyId, category])` · `@@index([companyId, priority])` · `@@index([companyId, type])` · `@@index([companyId, createdAt])`

## `growth_opportunity_actions` (`GrowthOpportunityAction`)

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `opportunityId` | String | — |
| `actionKey` | String | — |
| `label` | String | — |
| `userId` | String? | اختياري |
| `notes` | String? | اختياري |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `opportunity` → `GrowthOpportunity` — FK `opportunityId` → `GrowthOpportunity.id` · onDelete Cascade

فهارس: `@@index([companyId, opportunityId])` · `@@index([opportunityId, createdAt])`

## `growth_attributions` (`GrowthAttribution`)

Links a growth opportunity to a later ERP transaction used for realized impact.

| العمود | النوع | ملاحظات |
|---|---|---|
| `id` | String | PK · UUID |
| `companyId` | String | — |
| `opportunityId` | String | — |
| `kind` | String | — |
| `entityType` | String | — |
| `entityId` | String | — |
| `amount` | Decimal | Decimal(18,4) |
| `label` | String | — |
| `isRealized` | Boolean | — |
| `createdAt` | DateTime | الآن |

**العلاقات**

- N→1 `company` → `Company` — FK `companyId` → `Company.id` · onDelete Cascade
- N→1 `opportunity` → `GrowthOpportunity` — FK `opportunityId` → `GrowthOpportunity.id` · onDelete Cascade

قيود فريدة: `@@unique([companyId, opportunityId, entityType, entityId], map: "growth_attr_uniq")`

فهارس: `@@index([companyId, opportunityId])`
