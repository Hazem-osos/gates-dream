# خريطة تخيّل قاعدة بيانات GATES

الملف ده عشان **تشوف** النظام كصورة في دماغك.  
مستكشف كامل لكل الجداول: افتح [`database-explorer.html`](./database-explorer.html) — المصدر [`database-explorer.json`](./database-explorer.json) (**270 جدول**)  
الكتالوج الحرفي (كل عمود): [`DATABASE-FULL-CATALOG.md`](./DATABASE-FULL-CATALOG.md)  
الفكرة التشغيلية: [`DATABASE-STRUCTURE.md`](./DATABASE-STRUCTURE.md)

- افتح الملف في Cursor / GitHub: رسومات Mermaid هتترسم.
- أو انسخ قسم **برومبت الصورة** تحت واده لأي مولد صور / ChatGPT / Gemini يطلب «بوستر علاقات».

عدد الموديلات ≈ **270**. مفيش بوستر واحد يرسم كل عمود مقروء. الصورة الصحيحة = **شمس في النص (الشركة + القيد)** وحواليها مدارات.

---

## 0) الجملة اللي تلزق في الدماغ

```
شركة
  فيها دليل حسابات + أطراف + أصناف + مخازن + خزائن
  المستخدم يملا مستند (فاتورة / سند / إذن / شيك / مستخلص)
  الترحيل يولّد قيد يومية
  القيد يحرّك:
      أرصدة الحسابات الشهرية
      أرصدة العملاء/الموردين
      حركة مراكز التكلفة
  مستند المخزن يحرّك:
      دفتر حركة المخزون
      رصيد الصنف × المخزن
```

المفتاح الداخلي دايمًا **UUID**. الرقم اللي تشوفه على الشاشة حاجة تانية (`code` / `invoiceNumber` / `voucherNumber`).

تقريبًا كل جدول تشغيلي فيه **`companyId`**. مفيش صف يعيش برة الشركة.

---

## 1) الصورة الكبيرة — شمس النظام

```mermaid
flowchart TB
  subgraph TENANT["الشركة — companies"]
    C[شركة]
    B[فروع branches]
    U[مستخدمين وصلاحيات]
    FY[سنوات مالية fiscal_years]
    SET[إعدادات + مسلسلات + بروفايلات]
    C --> B
    C --> U
    C --> FY
    C --> SET
  end

  subgraph MASTERS["الكروت الأساسية"]
    ACC[دليل الحسابات accounts]
    CC[مراكز تكلفة cost_centers]
    CUST[عملاء customers]
    SUP[موردين suppliers]
    DEL[مندوب / سائق / موزع]
    ITM[أصناف items]
    WH[مخازن warehouses]
    SAFE[خزائن safes]
    BANK[بنوك bank_accounts]
    CUR[عملات currencies]
  end

  subgraph DOCS["مستندات التشغيل"]
    INV[فواتير invoices]
    CASH[سندات وأوامر خزينة cash_transactions]
    CHQ[شيكات cheques]
    STK[إذون مخزن / تحويل / جرد / تجميع]
    PO[أوامر شراء وشراء مرتجع]
    PQ[عروض سعر]
    HR[موارد بشرية]
    MFG[تصنيع]
    CTR[مقاولات ومستخلصات]
    RE[عقارات]
    POS[نقاط بيع]
    TAX[ضرائب وإي-فاتورة]
  end

  subgraph LEDGER["دفتر الحقيقة"]
    JE[قيود journal_entries]
    JEL[سطور القيود journal_entry_lines]
    APB[أرصدة شهرية account_period_balances]
    PRB[أرصدة أطراف partner_running_balances]
    CCM[حركة مراكز cost_center_movements]
    IM[حركة مخزون inventory_movements]
    IWB[رصيد صنف×مخزن item_warehouse_balances]
  end

  C --> ACC
  C --> CUST
  C --> ITM
  ACC --> JEL
  CUST --> INV
  ITM --> STK
  SAFE --> CASH
  BANK --> CASH
  INV -->|journalEntryId| JE
  CASH -->|journalEntryId| JE
  CHQ -->|قيود حسب الحالة| JE
  STK -->|journalEntryId| JE
  JE --> JEL
  JEL --> APB
  JEL --> PRB
  JEL --> CCM
  STK --> IM
  IM --> IWB
```

---

## 2) مدار المحاسبة — القلب

```mermaid
erDiagram
  COMPANY ||--|{ ACCOUNT : "دليل الحسابات"
  ACCOUNT ||--o{ ACCOUNT : "أب / ابن parentId"
  COMPANY ||--|{ COST_CENTER : "مراكز تكلفة"
  COST_CENTER ||--o{ COST_CENTER : "شجرة"
  COMPANY ||--|{ FISCAL_YEAR : "سنوات مالية"
  FISCAL_YEAR ||--o{ FISCAL_PERIOD : "فترات"
  COMPANY ||--|{ JOURNAL_ENTRY : "قيود"
  JOURNAL_ENTRY ||--|{ JOURNAL_ENTRY_LINE : "سطور مدين/دائن"
  ACCOUNT ||--o{ JOURNAL_ENTRY_LINE : "حساب السطر"
  COST_CENTER ||--o{ JOURNAL_ENTRY_LINE : "مركز اختياري"
  JOURNAL_ENTRY_LINE ||--o{ COST_CENTER_MOVEMENT : "نسخة حركة المركز"
  ACCOUNT ||--o{ ACCOUNT_PERIOD_BALANCE : "ملخص شهري"
  COMPANY ||--o{ PARTNER_RUNNING_BALANCE : "رصيد طرف حي"

  COMPANY {
    string id PK
    string name
  }
  ACCOUNT {
    string id PK
    string code "فريد داخل الشركة"
    string arabicName
    string accountKind "HEADER أو POSTING"
    string accountNature "DEBIT أو CREDIT"
    string statementType "ميزانية أو قائمة دخل"
    string parentId FK
    decimal budget
  }
  JOURNAL_ENTRY {
    string id PK
    datetime date
    string voucherNumber
    boolean isPosted
    boolean isCancelled
    string sourceType "SI PI CR ..."
    string sourceId
    string activeSourceKey "يمنع قيدين لنفس المصدر"
    string reversalOfJournalEntryId
  }
  JOURNAL_ENTRY_LINE {
    string id PK
    decimal debit
    decimal credit
    decimal debitBase "بالعملة الأساسية"
    decimal creditBase
    string accountId FK
    string costCenterId FK
    string partnerId "عميل أو مورد"
    string invoiceId "لو مقيد بفاتورة"
  }
```

### أعمدة لازم تتخيلها على القيد

| عمود | معنى عربي |
|---|---|
| `isPosted` | اترحّل ولا لأ. المرحّل ما بيتكتبش فوقه |
| `isCancelled` | ملغي |
| `sourceType` + `sourceId` | مين المستند اللي ولّد القيد |
| `activeSourceKey` | مفتاح فريد: شركة\|نوع\|رقم\|سنة — يفضل فاضي بعد فك الترحيل |
| `reversalOfJournalEntryId` | القيد ده عكس لقيد تاني |
| `debit` / `credit` | بعملة المستند |
| `debitBase` / `creditBase` | بعد سعر التحويل — ده اللي التقارير بتجمعه |

---

## 3) مدار الأطراف

```mermaid
erDiagram
  COMPANY ||--o{ CUSTOMER : عملاء
  COMPANY ||--o{ SUPPLIER : موردين
  COMPANY ||--o{ DELEGATE : مناديب
  COMPANY ||--o{ DISTRIBUTOR : موزعين
  COMPANY ||--o{ DRIVER : سائقين
  COMPANY ||--o{ PERSON : أطراف عامة
  CUSTOMER_CATEGORY ||--o{ CUSTOMER : تصنيف
  SUPPLIER_CATEGORY ||--o{ SUPPLIER : تصنيف
  ACCOUNT ||--o{ CUSTOMER : "حساب أستاذ العميل"
  ACCOUNT ||--o{ SUPPLIER : "حساب أستاذ المورد"
  DELEGATE ||--o{ CUSTOMER : مندوب افتراضي
  CUSTOMER ||--o{ CUSTOMER_CONTRACT : عقود
  CUSTOMER ||--o{ INVOICE : فواتير بيع
  SUPPLIER ||--o{ INVOICE : فواتير شراء
  CUSTOMER ||--o{ PARTNER_RUNNING_BALANCE : رصيد حي
  SUPPLIER ||--o{ PARTNER_RUNNING_BALANCE : رصيد حي

  CUSTOMER {
    string code
    string arabicName
    decimal creditLimit "حد ائتمان"
    int paymentTermDays
    string mainAccountId
    decimal balance "تراثي — الصح من partner_running_balances"
  }
```

تخيّل العميل ككارت. الكارت عليه اسم وحد ائتمان. **الرصيد التشغيلي** مش على الكارت؛ عايش في `partner_running_balances` ويتحدث مع كل قيد عليه.

---

## 4) مدار البيع والشراء

```mermaid
flowchart LR
  PQ[عرض سعر price_quotes] --> SO[أمر بيع]
  SO --> INV_S[فاتورة بيع invoices SALE]
  PO[أمر شراء purchase_orders] --> INV_P[فاتورة شراء PURCHASE]
  INV_S --> RET_S[مرتجع بيع SALE_RETURN]
  INV_P --> RET_P[مرتجع شراء PURCHASE_RETURN]
  INV_S --> INST[أقساط invoice_installments]
  INV_S --> JE1[قيد إيراد]
  INV_S --> JE2[قيد تكلفة اختياري]
  INV_S --> CASH[سداد من الخزينة]
  CASH --> ALLOC[payment_allocations]
```

جدول الفاتورة **واحد**: `invoices`. النوع في `invoiceKind`:

| القيمة | المعنى |
|---|---|
| `SALE` | بيع |
| `PURCHASE` | شراء |
| `SALE_RETURN` | مرتجع بيع |
| `PURCHASE_RETURN` | مرتجع شراء |

سطور: `invoice_lines` (صنف، كمية، سعر، ضريبة، مخزن، مركز).  
إضافات: `invoice_adjustments`. شروط: `invoice_conditions`.

حقول فلوس مهمة على الرأس: `totalAmount` `discountAmount` `taxAmount` `netAmount` `paidAmount` `remainingAmount` `paymentStatus`.

---

## 5) مدار الخزينة والشيكات

```mermaid
erDiagram
  COMPANY ||--o{ SAFE : خزائن
  COMPANY ||--o{ BANK : بنوك
  BANK ||--o{ BANK_ACCOUNT : حسابات بنكية
  ACCOUNT ||--o{ SAFE : "حساب GL للصندوق"
  ACCOUNT ||--o{ BANK_ACCOUNT : "حساب GL للبنك"
  COMPANY ||--o{ CASH_TRANSACTION : سندات وأوامر
  CASH_TRANSACTION ||--o{ CASH_TRANSACTION_LINE : بنود
  CASH_TRANSACTION ||--o{ PAYMENT_ALLOCATION : تصفية فواتير
  COMPANY ||--o{ CHEQUE : شيكات
  CUSTOMER ||--o{ CHEQUE : شيك وارد
  SUPPLIER ||--o{ CHEQUE : شيك صادر
  CASH_TRANSACTION ||--o| JOURNAL_ENTRY : قيد السند
  CHEQUE ||--o| JOURNAL_ENTRY : "قيد محفظة / إيداع / تحصيل / ارتداد"

  CASH_TRANSACTION {
    string transactionKind "RECEIPT أو PAYMENT"
    string documentRole "ORDER أمر أو VOUCHER سند"
    string executionStatus "PENDING COMPLETED CANCELLED"
    string sourceOrderId "السند اتنفّذ من أمر"
    decimal amount
    decimal exchangeRate
  }
  CHEQUE {
    string direction "INWARD قبض أو OUTWARD دفع"
    string status "UNDER_HAND SENT_TO_BANK COLLECTED ENDORSED BOUNCED CANCELLED"
    string chequeNumber
    decimal amount
    datetime dueDate
  }
```

دورة الشيك الوارد تتخيّلها خط أنابيب:

`في الخزينة → إيداع برسم التحصيل → تحصيل`  
أو `في الخزينة → تظهير لمورد`  
أو من البنك / التظهير → `ارتداد`.

كل سهم ممكن يولّد قيد. فك السهم يعكس القيد.

أوراق قبض/صرف التراثية: `securities_receipts` `securities_payments` `securities_renewals`.

---

## 6) مدار المخزون

```mermaid
flowchart TB
  ITEM[صنف items] --> IWB[رصيد حي item_warehouse_balances]
  WH[مخزن warehouses] --> IWB
  ITEM --> IM[دفتر حركة inventory_movements]
  WH --> IM

  OS[أول المدة opening_stocks]
  R[إذن إضافة receipts]
  ISS[إذن صرف issues]
  TR[تحويل transfers]
  ADJ[تسوية adjustments]
  ST[جرد stocktakings]
  ASM[تجميع assemblies]
  DIS[تفكيك disassemblies]
  LC[تكلفة إضافية landed_cost]

  OS --> IM
  R --> IM
  ISS --> IM
  TR --> IM
  ADJ --> IM
  ST --> IM
  ASM --> IM
  DIS --> IM
  LC --> IM
  IM --> IWB
  OS -.-> JE[قيد مخزني]
  R -.-> JE
```

كل مستند مخزن = **رأس + سطور**. الرأس فيه `journalEntryId` لو الترحيل المحاسبي شغال.

الرصيد الحي مفتاحه: شركة + صنف + مخزن (`quantityOnHand` `reservedQuantity` `averageCost`).

---

## 7) باقي المدارات — جدول واحد لكل مجموعة

| المدار | الجداول | تتخيّله إزاي |
|---|---|---|
| الشركة والإعداد | `companies` `branches` `company_settings` `company_setting_entries` `document_sequences` `new_modules` `document_profiles` `transaction_settings` | مفتاح البيت + قواعد كل شاشة |
| المستخدمين | `users` `user_groups` `user_permissions` `user_advanced_permissions` `user_branch_permissions` `bank_box_rights` | مين يدخل أنهي فرع/خزينة |
| الموارد البشرية | `employees` `employee_contracts` `payroll_runs` `monthly_salary` صرفيات نهاية الخدمة والإجازات | عقد → مسير → صرف |
| التصنيع | `bills_of_materials` `bom_lines` `production_orders` `production_material_issues` | وصفة → أمر تشغيل → صرف خام |
| المقاولات | مشاريع، مقاولين، مستخلصات عميل/مقاول، جداول كميات، خطابات ضمان | مشروع فيه بنود؛ المستخلص يقص منها |
| العقارات | مشاريع، مباني، وحدات، حجوزات، عقود، أقساط، شيكات آجلة | وحدة تتعمل عقد وتقسّط |
| المدارس | سنوات، فصول، طلبة، أقساط مصروفات | زي العقد العقاري بس طالب |
| المستخلصات العامة | `extracts` `extract_items` `extract_payments` `contractors` | دفعات مقاول على بنود |
| الاستيراد | اعتمادات مستندية `letter_of_credit` + خطاب ضمان | ملف استيراد بمصاريف |
| الضرائب | `tax_periods` `tax_declarations` `tax_settlements` `e_invoice_*` | فترة → إقرار → تسوية |
| نقاط البيع | `pos_terminals` `pos_shifts` `pos_orders` | وردية تقفل على فاتورة |
| العمولات | سياسات وشريحات مندوب | كمية/قيمة → نسبة |
| الذكاء الاصطناعي | محادثات، أدوات، مستندات مقطعة، إنذارات | مش دفتر محاسبي |
| المرفقات والطباعة | `document_attachments` `document_layout_configs` | شكل الورقة |

---

## 8) خط الحياة لأي مستند مالي

```mermaid
stateDiagram-v2
  [*] --> DRAFT: إنشاء
  DRAFT --> APPROVED: اعتماد إن وُجد
  DRAFT --> POSTED: ترحيل مباشر
  APPROVED --> POSTED: ترحيل
  POSTED --> UNPOSTED: فك ترحيل
  UNPOSTED --> DRAFT: يرجع مسودة
  POSTED --> CANCELLED: إلغاء بقيد عكسي
  DRAFT --> CANCELLED: إلغاء مسودة
```

لما يترحل:

1. يتولد أو يتثبت `journal_entries` + سطوره.
2. يتحدث `account_period_balances` لنفس الشهر.
3. لو السطر عليه عميل/مورد → `partner_running_balances`.
4. لو السطر عليه مركز → `cost_center_movements`.
5. لو مخزن → `inventory_movements` + `item_warehouse_balances`.

التقارير **مش جداول جاهزة**. وقت ما تفتح التقرير السيرفر يجمع من الدفاتر دي.

---

## 9) علاقات الـ FK اللي تتكرر في كل حتة

تخيّل الأسهم دي مرسومة على كل مستند تقريبًا:

```
المستند
  companyId        → companies.id          إلزامي
  branchId         → branches.id           غالبًا اختياري
  fiscalYearId     → fiscal_years.id
  journalEntryId   → journal_entries.id    بعد الترحيل
  currency / currencyCode
  costCenterId     → cost_centers.id
  createdAt / updatedAt
  isPosted / isCancelled / version
```

الفاتورة تزيد: `customerId` أو `supplierId` + `warehouseId` + `delegateId`.  
السند يزيد: `safeId` أو `bankAccountId` + `offsetAccountId`.  
سطر القيد يزيد: `accountId` + `debit/credit` + `debitBase/creditBase`.

---

## 10) برومبت جاهز تديه لـ AI عشان يطلع صورة علاقات

انسخ البلوك تحت كما هو:

```
ارسم بوستر جداري أفقي ضخم Ultra detailed infographic، اتجاه عربي من اليمين لليسار، خلفية كحلي غامق #0A3D5E، خطوط وأسهم سماوي #1787B8، كروت بيضاء بكتابة عربية واضحة.

العنوان أعلى اليمين: «خريطة قاعدة بيانات GATES ERP — الشركة شمس النظام».

وسط الصورة شمس كبيرة اسمها «شركة companies» ومنها أسهم لكل المدارات التالية، كل مدار دائرة أو جزيرة بلون مختلف، وجواها جداول بصناديق صغيرة:

1) مدار الأساس ذهبي: فروع branches، مستخدمين users، صلاحيات، سنوات مالية fiscal_years، إعدادات company_settings، مسلسلات document_sequences، بروفايل مستند document_profiles، سياسات ترحيل transaction_settings.

2) مدار المحاسبة أحمر/خمري وهو الأكبر بعد الشمس: شجرة حسابات accounts أب-ابن، مراكز تكلفة cost_centers، قيد journal_entries مربوط بسطور journal_entry_lines مدين/دائن وdebitBase/creditBase. من السطور أسهم إلى account_period_balances ملخص شهري، partner_running_balances رصيد عميل/مورد، cost_center_movements حركة مركز.

3) مدار الأطراف أخضر: customers، suppliers، delegates، distributors، drivers، persons، تصنيفات، عقود. كل طرف مربوط بحساب أستاذ.

4) مدار البيع والشراء برتقالي: عرض سعر → أمر → فاتورة invoices بحالات SALE / PURCHASE / SALE_RETURN / PURCHASE_RETURN. سطور invoice_lines، أقساط، تسويات. الفاتورة سهم إلى القيد وسهم إلى السداد.

5) مدار الخزينة أزرق مائي: safes خزائن وbank_accounts بنوك مربوطين بحساب GL. cash_transactions نوع قبض/صرف ودور أمر ORDER أو سند VOUCHER. شيكات cheques دورة: في الخزينة → إيداع → تحصيل أو تظهير أو ارتداد. كل حالة سهم لقيد.

6) مدار المخزون بنفسجي: items، warehouses، رصيد حي item_warehouse_balances، دفتر inventory_movements. مستندات: أول مدة، إذن إضافة، إذن صرف، تحويل، تسوية، جرد، تجميع، تفكيك.

7) مدارات أصغر على الحافة: موارد بشرية، تصنيع BOM، مقاولات ومستخلصات، عقارات ووحدات وأقساط، مدارس، نقاط بيع، ضرائب وإي-فاتورة، اعتمادات مستندية، ذكاء اصطناعي.

أسفل البوستر شريط قواعد ذهبية بالعربي:
- كل صف تشغيلي عليه companyId
- المفتاح UUID والرقم الظاهر منفصل
- المستند ≠ القيد، الربط journalEntryId
- القيد المرحّل لا يُعدّل؛ يُعكس
- التقارير تُجمع لحظيًا من الدفاتر مش من جداول نتائج

الأسلوب: خريطة معمارية سينمائية، خط عربي حديث، صناديق بحواف دائرية، أسهم منحنية عليها كلمات علاقة قصيرة، كثافة عالية لكن مقروءة، كأن ملصق غرفة سيرفر لشركة محاسبة.
```

لو المولد يقبل صورة مرجعية: قوله «نفس ترتيب الشمس والمدارات، زوّد أسماء الجداول».

لو عايز صورة **ER تقنية** مش بوستر: قوله

```
Generate a dark-theme entity-relationship poster of a MySQL ERP.
Center: Company 1—N to Account, Customer, Item, Warehouse, Safe.
Account 1—N JournalEntryLine; JournalEntry 1—N JournalEntryLine.
Invoice N—1 Customer/Supplier and N—1 JournalEntry.
CashTransaction N—1 Safe/BankAccount and N—1 JournalEntry.
Item + Warehouse → ItemWarehouseBalance and InventoryMovement.
Use Arabic labels next to English table names. No decorative people.
```

---

## 11) إزاي تحدّث الكتالوج الحرفي بعد تغيير الـ schema

```bash
node gates-backend/scripts/generate-db-catalog.mjs
```

الملف المتولّد: `DATABASE-FULL-CATALOG.generated.md` — كل جدول + كل عمود + كل علاقة كما في Prisma.
