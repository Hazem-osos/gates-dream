# تقرير قاعدة بيانات GATES ERP

مستكشف تفاعلي بشرح عربي لكل جدول وعمود: [`database-explorer.html`](./database-explorer.html)  
دليل مقروء كامل: [`DATABASE-GUIDE-FULL-AR.md`](./DATABASE-GUIDE-FULL-AR.md)  
مصدر JSON بدون قص: [`database-explorer.json`](./database-explorer.json)  
خريطة تتخيّلها + برومبت صورة العلاقات: [`DATABASE-FIGURE-AR.md`](./DATABASE-FIGURE-AR.md)

مصدر الحقيقة: `gates-backend/prisma/schema.prisma`  
قاعدة البيانات: **MySQL** عبر **Prisma**  
العزل: كل بيانات التشغيل مربوطة بشركة (`companyId`)

---

## 1) الفكرة في جملة واحدة

النظام مش مجموعة جداول منفصلة. فيه **شركة**، جواها **دليل حسابات + مخازن + أطراف**. أي مستند تشغيلي (فاتورة، سند، إذن مخزن، مستخلص…) لما يترحل بيولّد **قيد يومية**، والقيد ده هو اللي يحرّك الأرصدة المالية. المخزون له دفتر منفصل، والخزينة ليها مسار أوامر ثم سندات.

```
شركة (companies)
  ├─ فروع + مستخدمين + صلاحيات
  ├─ دليل الحسابات + مراكز التكلفة + سنوات مالية
  ├─ عملاء / موردين / مناديب
  ├─ أصناف + مخازن
  │
  └─ مستندات تشغيل
        فاتورة / سند / إذن مخزن / شيك / مستخلص / …
              │ ترحيل
              ▼
        قيد يومية (journal_entries + journal_entry_lines)
              │
              ├─ أرصدة الحسابات الشهرية (account_period_balances)
              └─ أرصدة العملاء/الموردين (partner_running_balances)
```

---

## 2) قواعد ذهبية لازم الفريق يفهمها

### العزل حسب الشركة
تقريبًا كل جدول تشغيلي فيه `companyId`. مفيش صف بيتقري أو بيتكتب من غير ما يتفلتر على الشركة الحالية. الفرع اختياري (`branchId`) على المستندات مش على كل الكروت.

### الـ ID
المفاتيح كلها **UUID نص** (`String @id @default(uuid())`). الرقم اللي المستخدم بيشوفه (رقم الفاتورة، رقم السند، كود الحساب) حاجة تانية خالص: `invoiceNumber` / `voucherNumber` / `code`.

### المستند ≠ القيد
- المستند = اللي المستخدم بيملاه (فاتورة، سند صرف، إذن إضافة…).
- القيد = أثره المحاسبي في دفتر اليومية.
- الربط: `journalEntryId` على المستند المصدر.
- لو المستند اتلغى أو اتفك ترحيله، القيد بيتلغي/بيتعكس معاه (cascade).

### القيد المرحّل مش بيتعدل
قيد اترحّل (`isPosted = true`) **ما بيتكتبش فوقه**. الإلغاء بيتعمل بقيد عكسي (`reversalOfJournalEntryId`) عشان التاريخ يفضل ظاهر في الدفتر.

### نفس المصدر ما يولّدش قيدين نشطين
`journal_entries.activeSourceKey` مفتاح فريد شكله:

`companyId|sourceType|sourceNumber|sourceYearId`

وهو موجود بس طول ما القيد **نشط**. لما يتفك الترحيل أو يتلغي، المفتاح بيرجع `NULL` عشان ينفع يتعمل قيد جديد بعد كده من غير تصادم.

### التاريخ المالي محمي من المسح
قيود اليومية وحركات المخزون وأرصدة الفترات **ممنوع** تتمسح لو اتمسحت الشركة من الداتابيز (`onDelete: Restrict`). باقي الكروت العادية غالبًا `Cascade`.

### الترقيم
جدول `document_sequences` بيحسب الرقم الجاي حسب الشركة + الفرع + السنة + نوع المستند.  
`NewModule` بيخلّي نفس النوع يتكرر (مثلاً فاتورة مبيعات `SI01` وفاتورة تانية `SI02`).

---

## 3) الطبقة الأساسية: الشركة والفرع والإعدادات

| الجدول | الموديل | الدور |
|---|---|---|
| `companies` | Company | جذر الـ tenant. الاسم، الضرائب، حصة الـ AI، onboarding |
| `branches` | Branch | فروع الشركة + مخزن/خزينة افتراضيين |
| `company_settings` | CompanySettings | عملة، سنة مالية، سلوك القيود، حسابات فروقات… |
| `company_setting_entries` | CompanySettingEntry | إعدادات مفتاح/قيمة إضافية |
| `fiscal_years` | FiscalYear | السنة المالية. `status = Open \| Close` بيمنع الترحيل لو مقفولة |
| `fiscal_periods` | FiscalPeriod | شهور/فترات جوه السنة |
| `document_sequences` | DocumentSequence | مسلسلات الأرقام |
| `new_modules` | NewModule | نسخ أنواع المستندات (`SI01`, `BP01`…) |
| `new_module_stores` | NewModuleStore | المخازن المسموح بيها لكل موديول |
| `other_module_rights` | OtherModuleRight | موديول يقرأ مستندات موديول تاني |
| `document_profiles` | DocumentProfile | بروفايل شاشة: بادئة رقم، مخزن/خزينة/مركز افتراضي |
| `transaction_settings` | TransactionSettings | سياسة كل نوع مستند: ترحيل أوتوماتيك، ضريبة، تسعير، تأثير مخزون |
| `users` | User | مستخدمي الشركة |
| `user_groups` / `user_group_members` | UserGroup | مجموعات |
| `user_permissions` / `user_advanced_permissions` | UserPermission | صلاحيات |
| `user_branch_permissions` | UserBranchPermission | صلاحية على فرع |

`Tenant` و `UserLegacy` جداول قديمة للتوافق، مش مسار التشغيل الحالي.

---

## 4) المحاسبة: قلب النظام

### 4.1 دليل الحسابات ومراكز التكلفة

```
Account (accounts)
  شجرة: parentId → children
  طبيعة: DEBIT / CREDIT
  قائمة: BALANCE_SHEET / INCOME_STATEMENT
  كود فريد داخل الشركة: @@unique(companyId, code)
  soft-delete: deletedAt

CostCenter (cost_centers)
  شجرة برضو (parentId)
  بيتربط على سطور القيود والفواتير والسندات
```

الخزائن والبنوك والمخازن **مش حسابات بنفسها**. كل واحد فيهم ليه حساب أستاذ مربوط:

- الخزينة `safes` → حساب GL
- الحساب البنكي `bank_accounts` → حساب GL
- المخزن `warehouses` → حساب مخزون + حساب تكلفة + حساب هدايا

### 4.2 القيد وسطوره

`journal_entries` = رأس القيد  
`journal_entry_lines` = مدين/دائن

كل سطر فيه:

- حساب + مركز تكلفة اختياري
- `debit` / `credit` بالعملة
- `debitBase` / `creditBase` بالعملة الأساسية للشركة
- `partnerId` + `partnerType` لو السطر على عميل/مورد
- `invoiceId` لو السطر مقيّد بفاتورة

حالات الرأس المهمة:

| الحقل | المعنى |
|---|---|
| `isPosted` / `postingStatus` | مرحّل ولا لأ (`Post` / `UnPost`) |
| `isCancelled` | ملغي |
| `workflowStatus` | DRAFT → PENDING_APPROVAL → APPROVED → REJECTED → POSTED |
| `sourceType` | كود قصير: `SI` فاتورة بيع، `PI` شراء، `CR` قبض، `SP` مخزن… |
| `sourceKind` | نوع العرض: MANUAL / SALES_INVOICE / PAYMENT_VOUCHER / STOCK_TRANSACTION… |
| `sourceId` | UUID المستند الأصلي |
| `activeSourceKey` | منع قيدين نشطين لنفس المصدر |
| `reversalOfJournalEntryId` | القيد ده عكس لقيد تاني |
| `version` | قفل تفاؤلي عشان اتنين ما يعدلوش مسودة في نفس الوقت |

### 4.3 إزاي الترحيل بيحدّث الأرصدة

نفس الـ transaction اللي بترحّل القيد بتحدّث جدولين ملخصين عشان التقارير ما تعملش `SUM` على كل السطور كل مرة:

```
account_period_balances
  مفتاح: شركة + حساب + سنة + شهر
  debitTotal / creditTotal / netBalance

partner_running_balances
  مفتاح: شركة + طرف + عملة
  أصل العملة منفصل عن العملة الأساسية (ما يتخلطوش)
```

`cost_center_movements` = حركة لكل حساب×مركز تكلفة، بنفس دقة سطر القيد (`Decimal(18,4)`).

`gl_posting_violations` = مخالفات ترحيل متسجلة (حساب ناقص، مركز إجباري…).

`recurring_journal_entries` + `recurring_journal_lines` = قوالب قيود متكررة، مش قيود فعلية.

### 4.4 مسار المستند → القيد

```
مستند تشغيلي
  DRAFT ──اعتماد──► APPROVED ──ترحيل──► POSTED
                                           │
                                           ▼
                              journal_entries (isPosted=true)
                              journal_entry_lines
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
         account_period_balances  partner_running_balances  cost_center_movements

إلغاء / فك ترحيل المستند
  ──► قيد عكسي (reversal) أو cascade على نفس journalEntryId
  ──► activeSourceKey تترجع NULL
  ──► الأرصدة تتعكس في نفس الـ transaction
```

---

## 5) الأطراف: عميل، مورد، مندوب

| الجدول | الدور |
|---|---|
| `customers` | العميل. مربوط بحساب أستاذ (`mainAccountId`)، حد ائتمان، مدة سداد، قائمة أسعار، مندوب. soft-delete |
| `suppliers` | المورد. نفس الفكرة. ممكن العميل يتربط بمورد (`linkedSupplierId`) لو نفس الجهة اتنين |
| `delegates` | المندوب / المندوب البيعي |
| `customer_categories` / `supplier_categories` | تصنيفات |
| `customer_contracts` | عقود عملاء |
| `persons` / `person_groups` | أطراف عامة (مش شرط عميل/مورد كلاسيكي) |
| `currencies` | عملات الشركة |
| `exchange_rate_histories` | تاريخ أسعار التحويل |

رصيد العميل التشغيلي الحي بيتحدث من القيود في `partner_running_balances`، مش من حقل `customers.balance` لوحده (الحقل ده تراثي/ملخص).

---

## 6) الخزينة والبنوك

### الكروت
- `banks` بنك
- `bank_accounts` حساب بنكي مربوط بحساب GL
- `safes` خزينة/صندوق مربوط بحساب GL
- `bank_box_rights` مين يقدر يستخدم خزينة/بنك

### المستند الموحّد: `cash_transactions`

ده الجدول الحالي لأوامر وسندات القبض والصرف.

| حقل | المعنى |
|---|---|
| `transactionKind` | `RECEIPT` قبض أو `PAYMENT` صرف |
| `documentRole` | `ORDER` = أمر قبض/صرف — `VOUCHER` = السند الفعلي |
| `sourceOrderId` | السند اتنفّذ من أمر |
| `executionStatus` | `PENDING` / `COMPLETED` / `CANCELLED` |
| `safeId` / `bankAccountId` | الصندوق أو البنك |
| `offsetAccountId` | الحساب المقابل |
| `invoiceId` | لو السند بيصفّي فاتورة |
| `journalEntryId` | القيد المتولّد |
| `exchangeRate` | سعر التحويل (فرق السعر عن الفاتورة = ربح/خسارة عملة) |

`cash_transaction_lines` = بنود السند (حسابات متعددة + مراكز تكلفة + ربط فاتورة).

العلاقة المهمة للفريق:

```
أمر صرف (documentRole=ORDER, executionStatus=PENDING)
        │ تحميل الأمر في سند الصرف
        ▼
سند صرف (documentRole=VOUCHER, sourceOrderId = الأمر)
        │ حفظ السند
        ▼
الأمر يبقى COMPLETED  ←  ممنوع يعدّل أو يتلغي
        │
        ▼ لو السند اتلغى ومافيش سند تاني على نفس الأمر
الأمر يرجع متاح (release)
```

`treasury_receipts` و `treasury_payments` جداول أقدم؛ الصف الحالي غالبًا بيستخدم `cash_transactions` مع علاقة اختيارية ليهم.

### تسوية الفواتير والشيكات

| الجدول | الدور |
|---|---|
| `payment_allocations` | السند صفّى فاتورة معينة (open-item) |
| `counterparty_offsets` | مقاصة عميل×مورد |
| `cheques` | دورة الشيك: محفظة، إيداع، تحصيل، ارتداد، تظهير — كل حالة ممكن تولّد قيد |
| `securities_receipts` / `securities_payments` / `securities_renewals` | أوراق قبض/صرف |
| `multi_collection_lines` | تحصيل متعدد |

---

## 7) المخازن والأصناف

### الكروت
- `items` الصنف: باركود، أسعار، تكلفة متوسطة، حساب مبيعات/تكلفة، خدمة ولا مخزني
- `item_units` وحدات الصنف + معامل التحويل
- `units` وحدات القياس
- `item_categories` مجموعات أصناف
- `price_lists` / `item_prices` قوائم أسعار
- `warehouses` شجرة مخازن (`parentWarehouseId`) + حسابات GL
- `locations` مواقع داخل المخزن
- `item_order_limit_lists` حدود الطلب

### الرصيد الحي vs دفتر الحركة

```
item_warehouse_balances     ← الرصيد الحالي (صنف × مخزن)
  quantityOnHand
  reservedQuantity
  averageCost
  فريد: companyId + itemId + warehouseId

inventory_movements         ← دفتر لا يُمسح (كل حركة +/− )
  quantityDelta
  unitCost / resultingAverageCost
  sourceDocumentId

item_quantities             ← تفصيل على الموقع داخل المخزن
```

مستندات المخزن (رأس + سطور)، وكل رأس يقدر يولّد قيد:

| المستند | الجدول | المعنى |
|---|---|---|
| أول المدة | `opening_stocks` | رصيد أول المدة |
| إذن إضافة | `receipts` | دخول مخزن |
| إذن صرف | `issues` | خروج مخزن |
| تحويل | `transfers` | من مخزن لمخزن |
| تسوية | `adjustments` | زيادة/عجز |
| تسوية أخرى | `other_adjustments` | تسويات خاصة |
| جرد | `stocktakings` | مقارنة فعلي vs دفتري |
| تجميع | `assemblies` | مكونات → صنف تام |
| تفكيك | `disassemblies` | العكس |
| تكلفة إضافية | `landed_cost_allocations` | توزيع مصاريف على تكلفة الصنف |

بعد الترحيل: يتحدث `item_warehouse_balances` + يتسجل صف في `inventory_movements` + يتولد `journalEntryId` لو الإعداد بيطلب قيد.

---

## 8) البيع والشراء

جدول واحد لكل أنواع الفاتورة: `invoices`

`invoiceKind`: `SALE` | `PURCHASE` | `SALE_RETURN` | `PURCHASE_RETURN`  
`invoiceType` لسه موجود للتوافق القديم.

حقول تشغيل مهمة:

- أطراف: `customerId` أو `supplierId`
- مخزن + مركز تكلفة + مندوب + عملة + سعر تحويل
- totals: `totalAmount`, `discountAmount`, `taxAmount`, `withholdingTaxAmount`, `developmentFeeAmount`, `netAmount`
- سداد: `paidAmount`, `remainingAmount`, `paymentStatus` = UNPAID / PARTIALLY_PAID / PAID
- ترحيل: `isPosted`, `journalEntryId`, وقيد تكلفة اختياري `costJournalEntryId`
- سلسلة: `sourceType` + `sourceId` (عرض سعر، أمر بيع، أمر شراء…)
- مردود مربوط بفاتورة أصل: `originalInvoiceId`
- أمر بيع اتحول لفاتورة: `convertedInvoiceId` (مرة واحدة بس)
- رقم فريد داخل: شركة + فرع + سنة + نوع + رقم

الجداول التابعة:

| الجدول | الدور |
|---|---|
| `invoice_lines` | أصناف الفاتورة (كمية، وحدة أساسية، سعر، خصم سطر، حساب إيراد) |
| `invoice_adjustments` | إضافات/خصومات رأس |
| `invoice_conditions` | شروط |
| `invoice_installments` | أقساط |
| `price_quotes` / `price_quote_lines` | عروض الأسعار |
| `purchase_orders` / `purchase_order_lines` | أوامر الشراء |
| `purchase_returns` | مردود مشتريات منفصل (مسار قديم/موازٍ) |
| `item_offers` | عروض (كمية إضافية، خصم، قيمة فاتورة) |

مسار شائع:

```
عرض سعر (price_quotes)
   → أمر / فاتورة (invoices.sourceType = QUOTATION)
   → ترحيل الفاتورة → قيد مبيعات/مشتريات
   → سند قبض/صرف (cash_transactions.invoiceId)
   → payment_allocations يحدّث paidAmount / remainingAmount
```

---

## 9) الموديولات التخصصية (نفس فكرة الربط بالقيد)

كلها جوه نفس الشركة، وبتصب في الآخر على حسابات/قيود/مراكز تكلفة.

### موارد بشرية
`employees`, `employee_contracts`, `employee_procedures`, `employee_advances`  
`hr_settings`, `payroll_runs`, `payroll_run_items`  
كروت مساعدة: جنسيات، وظائف، إدارات، بدلات، خصومات، سياسات أجور  
مستندات صرف: راتب شهري، نهاية خدمة، إجازة، بدل سكن — ليها جداول صرف خاصة ممكن تولّد قيد.

### تصنيع
`bill_of_materials` + `bom_lines`  
`production_orders`  
`production_material_issues` (+ lines)  
مخزن خام / مخزن تام على أمر الإنتاج.

### مقاولات
`contracting_projects` → مقاول باطن `subcontracts`  
مستخلصات عميل / مقاول، جداول كميات `project_boq_items`، تحليل تسعير، أوراق قياس، خطابات ضمان مشروع، مخزون موقع  
`client_invoices` مستخلص/فاتورة عميل مشروع ليها `journalEntryId`.

### عقارات
`real_estate_projects` → مباني → وحدات  
حالة الوحدة: AVAILABLE → RESERVED → SOLD → DELIVERED  
`real_estate_reservations`, `unit_contracts`, أقساط الوحدة، شيكات آجلة `post_dated_cheques`.

### مدارس
سنوات دراسية، صفوف، طلاب، عقود مصروفات، أقساط، خطوط أتوبيس.

### نقاط بيع
`pos_terminals` → `pos_shifts` → `pos_orders` + `pos_order_lines`  
الوردية تقفل بقيد نهاية يوم، والأوردر ممكن يولّد قيد.

### ضرائب وإلكتروني
`tax_periods`, `tax_declarations`, `tax_settlements`  
`e_invoice_settings` / `e_invoice_documents`  
`electronic_invoices` مسار فاتورة إلكترونية أقدم/موازٍ.

### اعتمادات وخطابات ضمان
`letters_of_credit` (+ سطور استلام)  
`letters_of_guarantee` / `guarantee_letters`  
تعريفات إعدادات لكل شركة.

### ذكاء اصطناعي
`ai_conversations`, `ai_messages`, `ai_tool_executions`  
`ai_documents` + `ai_document_chunks` (معرفة الشركة)  
`ai_insights`, `ai_audit_logs`, `ai_pending_actions`  
حصة التوكن على صف الشركة نفسه.

---

## 10) خريطة العلاقات (للشرح على السبورة)

```
                         Company
                            │
        ┌─────────┬─────────┼──────────┬──────────┐
        ▼         ▼         ▼          ▼          ▼
     Branch    Account   Customer    Item     Warehouse
        │         │         │          │          │
        │         │         │          │          │
        │         ▼         │          ▼          ▼
        │   JournalEntry    │     ItemWarehouse   Location
        │    └── Lines      │        Balance
        │         │         │          ▲
        │         │         │          │ حركة
        ▼         │         ▼          │
   CashTransaction│      Invoice       │
    ORDER/VOUCHER │     + Lines        │
        │         │         │          │
        └──── journalEntryId ────┘     │
                  │                    │
                  │              Receipt / Issue /
                  │              Transfer / Adjustment
                  │                    │
                  └──── journalEntryId ┘
```

---

## 11) حالات المستند المتكررة في أغلب الجداول

نفس اللغة بتتكرر على الفاتورة والسند والقيد ومستندات المخزن:

| الحالة | المعنى التشغيلي |
|---|---|
| `DRAFT` | مسودة، تتعدل |
| `PENDING_APPROVAL` | مستني اعتماد |
| `APPROVED` | معتمد، جاهز للترحيل أو اترحّل حسب الإعداد |
| `REJECTED` | مرفوض |
| `POSTED` / `isPosted` | نزل في الدفاتر |
| `isCancelled` | ملغي — القيد المرتبط يتعكس |
| `version` | قفل تفاؤلي ضد التعديل المتزامن |

مستندات الخزينة تزيد عليها `executionStatus` للأوامر فقط.

---

## 12) إيه اللي الفريق يسأله وهو بيقرأ كود أو بيانات

1. **الصف تابع أنهي شركة؟** لازم `companyId` يطابق سياق المستخدم.
2. **ده كارت ولا مستند ولا قيد؟** الكارت (حساب/صنف/عميل) مالوش ترحيل. المستند يترحّل. القيد هو الأثر.
3. **في `journalEntryId`؟** يبقى المستند ده مولّد قيد، والإلغاء لازم يمس القيد.
4. **القيد `isPosted`؟** ما تتعدّلش السطور. اعمل عكس.
5. **الرصيد منين؟** مالي من `account_period_balances` / `partner_running_balances`. مخزني من `item_warehouse_balances`. الحركة التفصيلية من القيود أو `inventory_movements`.
6. **رقم المستند منين؟** `document_sequences` + أحيانًا `new_modules.fullCode`.
7. **أمر ولا سند؟** في الخزينة شوف `documentRole` مش اسم الشاشة لوحده.

---

## 13) فهرس الجداول حسب المجال

### أساس وامن
`companies`, `branches`, `company_settings`, `company_setting_entries`, `fiscal_years`, `fiscal_periods`, `document_sequences`, `new_modules`, `new_module_stores`, `other_module_rights`, `users`, `user_groups`, `user_group_members`, `user_permissions`, `user_advanced_permissions`, `user_branch_permissions`, `system_notifications`, `document_attachments`, `tenant_subscriptions`, `activity_logs`, `rate_limits`

### محاسبة
`accounts`, `cost_centers`, `cost_center_movements`, `journal_entries`, `journal_entry_lines`, `recurring_journal_entries`, `recurring_journal_lines`, `account_period_balances`, `partner_running_balances`, `gl_posting_violations`, `currencies`, `periods`, `financial_adjustment_notes`

### أطراف
`customers`, `customer_categories`, `customer_contracts`, `customer_contract_groups`, `suppliers`, `supplier_categories`, `delegates`, `persons`, `person_groups`, `person_item_prices`

### خزينة وبنوك
`banks`, `bank_accounts`, `safes`, `cash_transactions`, `cash_transaction_lines`, `treasury_receipts`, `treasury_payments`, `payment_allocations`, `counterparty_offsets`, `cheques`, `bank_box_rights`, `securities_receipts`, `securities_payments`, `securities_renewals`, `multi_collection_lines`, `exchange_rate_histories`

### أصناف ومخازن
`items`, `item_units`, `units`, `item_categories`, `price_lists`, `item_prices`, `warehouses`, `locations`, `item_quantities`, `item_warehouse_balances`, `inventory_movements`, `opening_stocks`, `receipts`, `issues`, `transfers`, `adjustments`, `other_adjustments`, `stocktakings`, `assemblies`, `disassemblies`, `landed_cost_allocations`, `item_offers`, `item_order_limit_lists`, `item_cost_history`

### بيع وشراء
`invoices`, `invoice_lines`, `invoice_adjustments`, `invoice_conditions`, `invoice_installments`, `price_quotes`, `purchase_orders`, `purchase_returns`, `document_profiles`, `transaction_settings`

### تخصص
HR: `employees`, `payroll_runs`, …  
تصنيع: `bill_of_materials`, `production_orders`, …  
مقاولات: `contracting_projects`, `subcontracts`, `client_invoices`, …  
عقارات: `real_estate_projects`, `real_estate_units`, `unit_contracts`, …  
مدارس: `school_students`, `student_fee_contracts`, …  
POS: `pos_terminals`, `pos_shifts`, `pos_orders`  
ضرائب: `tax_periods`, `tax_declarations`, `e_invoice_documents`  
AI: `ai_conversations`, `ai_documents`, `ai_insights`

المصدر الكامل لكل عمود وعلاقة: `prisma/schema.prisma` (حوالي 200 موديل).

---

*التقرير ده للشرح الداخلي. أي تغيير على العلاقات أو قواعد الترحيل لازم يتراجع من الـ schema + خدمات الترحيل (`journal-posting`) مش من الذاكرة.*
