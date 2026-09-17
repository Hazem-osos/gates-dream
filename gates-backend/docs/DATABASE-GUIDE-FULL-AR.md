# دليل قاعدة بيانات GATES — شرح كل جدول وكل عمود

مولَّد من الـ schema: **270 جدول · 4111 عمود · 1358 علاقة · 67 قائمة قيم**.

المستكشف التفاعلي: [`database-explorer.html`](./database-explorer.html)

## كيف تقرأ الدليل

- كل قسم مجال (محاسبة، مخازن…).
- كل جدول صفحة: المعنى، الاستخدام، الشاشات، الأعمدة، العلاقات.
- المستند التشغيلي غير القيد. الترحيل هو اللي يكتب في الدفاتر.

## المجالات

- **تراث قديم** (3 جدول): جداول قديمة قبل نموذج الشركة. مش مسار التشغيل اليومي.
- **الشركة والفروع والإعدادات** (21 جدول): جذر النظام: الشركة، الفرع، السنة المالية، المسلسلات، إعدادات المستندات.
- **مستخدمين وصلاحيات** (8 جدول): من يدخل، على أنهي فرع، وبأي صلاحية ترحيل/تعديل.
- **محاسبة وقيود** (12 جدول): قلب الدفاتر: دليل، مراكز، قيود، أرصدة شهرية، أرصدة أطراف.
- **أطراف (عميل/مورد/مندوب)** (21 جدول): كروت العملاء والموردين والمناديب والجداول المساعدة.
- **خزينة وبنوك وشيكات** (19 جدول): خزينة، بنك، شيكات، أوراق مالية، تخصيص سداد، نقطة بيع.
- **مخازن وأصناف** (48 جدول): أصناف، مخازن، أذون، جرد، دفتر حركة، رصيد حي.
- **بيع وشراء وفواتير** (19 جدول): فواتير بيع/شراء ومرتجعات، أوامر، عروض، عمولات.
- **موارد بشرية** (18 جدول): موظف، عقد، مسير، سلف، إجازات، نهاية خدمة.
- **تصنيع** (6 جدول): قائمة مكونات وأوامر تشغيل وصرف خام.
- **مقاولات ومستخلصات** (39 جدول): مشاريع، مستخلصات، مقاول باطن، حصر، خطابات ضمان.
- **عقارات** (10 جدول): وحدات، حجز، عقد، أقساط، شيكات آجلة، فسخ.
- **مدارس** (12 جدول): طالب، سنة دراسية، مصروفات، أقساط.
- **استيراد واعتمادات** (10 جدول): اعتماد مستندي، خطاب ضمان، خصم منبع.
- **ضرائب وإي-فاتورة** (10 جدول): فترة ضريبية، إقرار، فاتورة إلكترونية.
- **ذكاء اصطناعي ونمو** (14 جدول): مساعد GATES، معرفة، فرص نمو، واتساب.

## قوائم القيم (enums)

- `NotificationSeverity`: INFO · WARNING · CRITICAL
- `NotificationCategory`: FINANCIAL_LIQUIDITY · PROFIT_ANOMALY · CHEQUE_DUE · TAX_COMPLIANCE · STOCK_REORDER · EXPIRING_BATCH · SALES_AUDIT · UNPOSTED_DRAFTS
- `AccountKind`: HEADER · POSTING
- `AccountNature`: DEBIT · CREDIT
- `StatementType`: BALANCE_SHEET · INCOME_STATEMENT
- `JournalSourceType`: MANUAL · RECURRING_TEMPLATE · SALES_INVOICE · SALES_RETURN · PURCHASE_INVOICE · PURCHASE_RETURN · PAYMENT_VOUCHER · RECEIPT_VOUCHER · STOCK_TRANSACTION · DEPRECIATION · CHEQUE_ENDORSEMENT · CLOSING_ENTRY
- `RecurringFrequency`: WEEKLY · MONTHLY · QUARTERLY · YEARLY
- `PriceTier`: RETAIL · SEMI_WHOLESALE · WHOLESALE · PROJECTS
- `OrderExecutionStatus`: PENDING · COMPLETED · CANCELLED
- `ChequeDirection`: INWARD · OUTWARD
- `ChequeStatus`: UNDER_HAND · SENT_TO_BANK · COLLECTED · ENDORSED · BOUNCED · RETURNED_TO_DRAWER · CANCELLED
- `SourceDocumentType`: QUOTATION · SALES_ORDER · PURCHASE_ORDER · PURCHASE_INVOICE · DELIVERY_NOTE · NONE
- `InvoiceInstallmentStatus`: PENDING · PARTIALLY_PAID · PAID · OVERDUE
- `AdjustmentType`: ADDITION · DEDUCTION
- `CalculationType`: FIXED · PERCENTAGE
- `DocumentBaseType`: SALES_INVOICE · PURCHASE_INVOICE · PAYMENT_VOUCHER · RECEIPT_VOUCHER · STOCK_ISSUE · STOCK_RECEIPT · SALES_RETURN · PURCHASE_RETURN · BANK_DEBIT_ADVICE · BANK_CREDIT_ADVICE · JOURNAL_ENTRY · OPENING_BALANCE
- `NumberingMode`: AUTOMATIC · MANUAL
- `SequenceMode`: CONTINUOUS · ANNUAL_RESET
- `PricingPolicy`: COST · LAST_PURCHASE · LAST_SALE · LAST_SALE_TO_CUSTOMER
- `CostCenterPostingSide`: DEBIT · CREDIT
- `CostCenterAllocationTarget`: SALES · COST_OF_GOODS_SOLD
- `SubcontractorStatus`: ACTIVE · SUSPENDED · BLACKLISTED
- `SubcontractStatus`: DRAFT · ACTIVE · SUSPENDED · COMPLETED · TERMINATED
- `SubcontractInvoiceType`: INTERIM_RUNNING · FINAL_SETTLEMENT
- `SubcontractInvoiceStatus`: DRAFT · SITE_SUBMITTED · CONSULTANT_APPROVED · TECH_OFFICE_APPROVED · FINANCE_POSTED · REJECTED · PAID · REVERSED
- `MaterialReconciliationStatus`: PENDING_DEDUCTION · DEDUCTED · WAIVED
- `SitePenaltyType`: DELAY_PENALTY · NCR_QUALITY_DEFECT · HSE_SAFETY_VIOLATION · MANPOWER_SHORTAGE · EQUIPMENT_DEMURRAGE
- `SitePenaltyStatus`: PENDING · DISPUTED · APPROVED_FOR_DEDUCTION · APPLIED_TO_INVOICE
- `DirectExecutionStatus`: PENDING · APPLIED
- `BOQItemUnit`: M2 · M3 · TON · ITEM · LM · LS
- `ProjectBOQItemStatus`: PENDING_PRICING · PRICED · APPROVED_IN_CONTRACT
- `BOQCostElementType`: MATERIAL · LABOR · EQUIPMENT · SUBCONTRACTOR · SITE_EXPENSE
- `MeasurementSheetStatus`: DRAFT · SITE_ENGINEER_VERIFIED · CONSULTANT_APPROVED · INVOICED_IN_EXTRACT
- `ClientContractStatus`: ACTIVE · SUSPENDED · COMPLETED
- `ClientInvoiceType`: INTERIM · FINAL_SETTLEMENT
- `ClientInvoiceStatus`: DRAFT · SUBMITTED_TO_CLIENT · CLIENT_APPROVED · FINANCE_POSTED · REJECTED · PAID · REVERSED
- `SiteStockMaterialStatus`: STORED_ON_SITE · INSTALLED_AND_DEDUCTED · REJECTED
- `ProjectLgType`: BID_BOND_INITIAL · ADVANCE_PAYMENT_BOND · PERFORMANCE_BOND_FINAL · RETENTION_RELEASE_BOND
- `ProjectLgStatus`: ACTIVE_ISSUED · EXTENDED · AMENDED_VALUE · RELEASED_RETURNED · LIQUIDATED_CONFISCATED
- `LgActionType`: ISSUANCE · EXTENSION · VALUE_INCREASE · VALUE_DECREASE · RELEASE_RETURN · LIQUIDATION
- `FinancialAdjustmentNoteType`: CREDIT_NOTE · DEBIT_NOTE · FULL_INVOICE_REVERSAL
- `FinancialAdjustmentTargetModule`: SUBCONTRACT_INVOICE · CLIENT_INVOICE
- `FinancialAdjustmentReasonCategory`: QUANTITY_CORRECTION · PENALTY_DISPUTE_WAIVER · SCRAP_RECONCILIATION_ADJUSTMENT · RATE_DISCREPANCY · COMMERCIAL_CONCESSION · BILLING_ERROR
- `FinancialAdjustmentNoteStatus`: DRAFT · PENDING_FINANCE_APPROVAL · POSTED · REJECTED
- `FinancialAdjustmentDeductionType`: NONE · RETENTION · ADVANCE_PAYMENT · MATERIAL_SCRAP · SITE_PENALTY · WHT_TAX · DIRECT_EXECUTION
- `PropertyUnitType`: RESIDENTIAL_APARTMENT · VILLA · COMMERCIAL_RETAIL · OFFICE_ADMIN
- `PropertyUnitStatus`: AVAILABLE · RESERVED · CONTRACTED · DELIVERED · BLOCKED
- `UnitPaymentPlanType`: EQUAL_INSTALLMENTS · FRONT_LOADED · CUSTOM_BALLOON
- `UnitInstallmentType`: RESERVATION_DEPOSIT · CONTRACTING_DOWNPAYMENT · REGULAR_INSTALLMENT · DELIVERY_PAYMENT · MAINTENANCE_DEPOSIT · ANNUAL_BALLOON
- `PostDatedChequeStatus`: UNDER_SAFE_CUSTODY · DEPOSITED_UNDER_COLLECTION · CLEARED_COLLECTED · BOUNCED_RETURNED · REPLACED_CANCELLED
- `UnitResaleClearanceStatus`: PENDING_CLEARANCE · FINANCIALLY_CLEARED · REJECTED
- `UnitRefundStatus`: HELD_UNTIL_RESALE · PARTIALLY_REFUNDED · FULLY_REFUNDED
- `DocumentCategory`: GENERAL · CAD_DRAWING · CONSULTANT_REPORT · SITE_PHOTO_DEFECT · BANK_LG_STAMPED_LETTER · SIGNED_INVOICE_COPY · PAYMENT_RECEIPT · CONTRACT_LEGAL_DOC · BOQ_SPECIFICATION
- `DocumentLayoutType`: ALL · CONTRACTOR_INVOICE · REAL_ESTATE_RECEIPT · TAX_INVOICE · DEBIT_NOTE · PAYMENT_SCHEDULE
- `DocumentLayoutPreset`: LIGHT · BUBBLE · WAVE · CORPORATE_DUAL · MINIMAL_BORDER · ARCHITECTURAL_GRID
- `DocumentTableStyle`: LIGHT · BOXED · STRIPED · BUBBLE · COMPACT · BORDERLESS
- `DocumentPaperSize`: A4 · LETTER · A5_LANDSCAPE
- `DocumentMarginSize`: COMPACT_8MM · NORMAL_15MM · WIDE_20MM
- `DocumentLogoPosition`: LEFT · CENTER · RIGHT
- `AiAuditStatus`: SUCCESS · FAILED · OUT_OF_SCOPE · BLOCKED_BY_RBAC
- `AiActionStatus`: PENDING · CONFIRMED · REJECTED · EXECUTED · FAILED · EXPIRED
- `AiDocumentCategory`: CONTRACT · BOQ_SPECIFICATION · HR_POLICY · COMPANY_BYLAW · TAX_REGULATION · OTHER
- `InsightCategory`: CASH_FLOW_RISK · OVERDUE_RECEIVABLES · STOCK_RUNOUT · PROJECT_MARGIN_DROP · EXPENSE_ANOMALY
- `InsightSeverity`: INFO · WARNING · CRITICAL
- `GrowthOpportunityStatus`: NEW · REVIEWED · ACTION_TAKEN · WON · LOST · DISMISSED · EXPIRED
- `GrowthOpportunityPriority`: LOW · MEDIUM · HIGH · CRITICAL
- `GrowthOpportunityCategory`: REVENUE · CASH_RECOVERY · INVENTORY · SAVINGS · PRICING · CUSTOMERS · COSTS

## تراث قديم

جداول قديمة قبل نموذج الشركة. مش مسار التشغيل اليومي.

### 1. المستأجرون القدامى (`tenants`)

موديل: `Tenant` · 4 عمود · 1 علاقة

**إيه الجدول؟** جدول تراثي قبل نموذج الشركة الحالي.

**امتى بيتستخدم؟** مش مسار التشغيل. الشركة الحقيقية في companies.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الاسم | `name` | String | اسم الصف. |
| locked | `locked` | Boolean | حقل «locked» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `1-N` users → مستخدمو النظام القديم: هذا الجدول أب: صف واحد هنا له أكثر من «مستخدمو النظام القديم».

### 2. مستخدمو النظام القديم (`users_legacy`)

موديل: `UserLegacy` · 5 عمود · 1 علاقة

**إيه الجدول؟** حسابات دخول قديمة مربوطة بـ tenantId.

**امتى بيتستخدم؟** للتوافق فقط. المستخدم التشغيلي في users.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستأجر القديم | `tenantId` | String | حقل تراثي قبل نموذج الشركة. التشغيل الحالي بيستخدم companyId. |
| البريد | `email` | String | بريد الدخول أو التواصل. |
| role | `role` | String | حقل «role» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` tenant → المستأجرون القدامى: كل صف هنا مربوط بصف واحد من «المستأجرون القدامى» عبر tenantId.

### 3. حدود الطلبات (`rate_limits`)

موديل: `RateLimit` · 6 عمود · 0 علاقة

**إيه الجدول؟** يحمي الـ API من الضغط الزائد.

**امتى بيتستخدم؟** السيرفر بيسجّل عدد الطلبات في نافذة زمنية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستأجر القديم | `tenantId` | String | حقل تراثي قبل نموذج الشركة. التشغيل الحالي بيستخدم companyId. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| مفتاح | `key` | String | حقل «مفتاح» على هذا الجدول. |
| window | `window` | DateTime | حقل «window» على هذا الجدول. |
| count | `count` | Int | حقل «count» على هذا الجدول. |

## الشركة والفروع والإعدادات

جذر النظام: الشركة، الفرع، السنة المالية، المسلسلات، إعدادات المستندات.

### 4. سجل النشاط (`activity_logs`)

موديل: `ActivityLog` · 14 عمود · 0 علاقة

**إيه الجدول؟** أثر مين عمل إيه في النظام.

**امتى بيتستخدم؟** يتكتب تلقائي مع حفظ/ترحيل مهم.

**الشاشات:** سجل العمليات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستأجر القديم | `tenantId` | String | حقل تراثي قبل نموذج الشركة. التشغيل الحالي بيستخدم companyId. |
| actor | `actorId` | String | مفتاح أجنبي يربط الصف بجدول «actor». |
| تصنيف | `kind` | String | حقل «تصنيف» على هذا الجدول. |
| subject نوع | `subjectType` | String | حقل «subject نوع» على هذا الجدول. |
| subject | `subjectId` | String | مفتاح أجنبي يربط الصف بجدول «subject». |
| severity | `severity` | String | حقل «severity» على هذا الجدول. |
| reason | `reason` | String? | حقل «reason» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| at | `at` | DateTime | حقل «at» على هذا الجدول. |
| request | `requestId` | String? | مفتاح أجنبي يربط الصف بجدول «request». |
| ip | `ip` | String? | حقل «ip» على هذا الجدول. |
| مستخدم agent | `userAgent` | String? | حقل «مستخدم agent» على هذا الجدول. |
| impersonated by | `impersonatedBy` | String? | حقل «impersonated by» على هذا الجدول. |

### 5. الشركات (`companies`)

موديل: `Company` · 27 عمود · 177 علاقة

**إيه الجدول؟** جذر كل البيانات. أي جدول تشغيلي تقريبًا عليه companyId من هنا.

**امتى بيتستخدم؟** إنشاء الشركة يولّد إعدادات وسنة ودليل. مسح الشركة يتمنع لو فيها قيود تاريخية.

**الشاشات:** إعدادات الشركة · اختيار الشركة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| legacy شركة كود | `legacyCompanyCode` | String? | حقل «legacy شركة كود» على هذا الجدول. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| entity نوع | `entityType` | String? | e.g., "جنية مصري" |
| entity نوع كود | `entityTypeCode` | String? | حقل «entity نوع كود» على هذا الجدول. |
| entity رقم | `entityNumber` | String? | حقل «entity رقم» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| العنوان | `address` | String? | عنوان الطرف. |
| contact email | `contactEmail` | String? | حقل «contact email» على هذا الجدول. |
| ضريبة number1 | `taxNumber1` | String? | حقل «ضريبة number1» على هذا الجدول. |
| ضريبة number2 | `taxNumber2` | String? | حقل «ضريبة number2» على هذا الجدول. |
| ضريبة number3 | `taxNumber3` | String? | حقل «ضريبة number3» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| is onboarded | `isOnboarded` | Boolean | علامة نعم/لا: is onboarded. |
| onboarded at | `onboardedAt` | DateTime? | ختم زمني لهذا الحدث. |
| onboarding step | `onboardingStep` | Int | حقل «onboarding step» على هذا الجدول. |
| has completed جولة | `hasCompletedTour` | Boolean | علامة نعم/لا: has completed جولة. |
| launch checklist | `launchChecklist` | Json? | حقل «launch checklist» على هذا الجدول. |
| ai monthly token limit | `aiMonthlyTokenLimit` | Int | حقل «ai monthly token limit» على هذا الجدول. |
| ai tokens used this month | `aiTokensUsedThisMonth` | Int | حقل «ai tokens used this month» على هذا الجدول. |
| ai quota reset تاريخ | `aiQuotaResetDate` | DateTime | حقل «ai quota reset تاريخ» على هذا الجدول. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `1-N` branches → الفروع: هذا الجدول أب: صف واحد هنا له أكثر من «الفروع».
- `1-N` users → المستخدمون: هذا الجدول أب: صف واحد هنا له أكثر من «المستخدمون».
- `N-0..1` إعدادات → إعدادات الشركة: ربط اختياري بصف واحد من «إعدادات الشركة».
- `1-N` accounts → دليل الحسابات: هذا الجدول أب: صف واحد هنا له أكثر من «دليل الحسابات».
- `1-N` تكلفة centers → مراكز التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «مراكز التكلفة».
- `1-N` قيد entries → قيود اليومية: هذا الجدول أب: صف واحد هنا له أكثر من «قيود اليومية».
- `1-N` متكرر قيد entries → قوالب قيود متكررة: هذا الجدول أب: صف واحد هنا له أكثر من «قوالب قيود متكررة».
- `1-N` customers → العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «العملاء».
- `1-N` suppliers → الموردون: هذا الجدول أب: صف واحد هنا له أكثر من «الموردون».
- `1-N` delegates → المندوبون: هذا الجدول أب: صف واحد هنا له أكثر من «المندوبون».
- `1-N` currencies → العملات: هذا الجدول أب: صف واحد هنا له أكثر من «العملات».
- `1-N` periods → فترات محاسبية مساعدة: هذا الجدول أب: صف واحد هنا له أكثر من «فترات محاسبية مساعدة».
- `1-N` items → الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «الأصناف».
- `1-N` units → وحدات القياس: هذا الجدول أب: صف واحد هنا له أكثر من «وحدات القياس».
- `1-N` warehouses → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».
- `1-N` صنف مخزن balances → رصيد الصنف في المخزن: هذا الجدول أب: صف واحد هنا له أكثر من «رصيد الصنف في المخزن».
- `1-N` electronic فاتورة items → أصناف الإي-فاتورة (كتالوج): هذا الجدول أب: صف واحد هنا له أكثر من «أصناف الإي-فاتورة (كتالوج)».
- `1-N` electronic فاتورة customers → عملاء الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «عملاء الإي-فاتورة».
- `1-N` electronic invoices → الإي-فواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الإي-فواتير».
- `1-N` سعر lists → قوائم الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «قوائم الأسعار».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` فاتورة adjustments → تسويات على الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات على الفاتورة».
- `1-N` مستند profiles → بروفايل المستند: هذا الجدول أب: صف واحد هنا له أكثر من «بروفايل المستند».
- `1-N` معاملة إعدادات → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` افتتاحي stocks → بضاعة أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «بضاعة أول المدة».
- `1-N` stocktaking → الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «الجرد».
- `1-N` transfers → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` assemblies → التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «التجميع».
- `1-N` disassemblies → التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «التفكيك».
- `1-N` receipts → إذن إضافة: هذا الجدول أب: صف واحد هنا له أكثر من «إذن إضافة».
- `1-N` issues → إذن صرف: هذا الجدول أب: صف واحد هنا له أكثر من «إذن صرف».
- `1-N` adjustments → تسوية المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «تسوية المخزون».
- `1-N` other adjustments → تسويات مخزنية أخرى: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات مخزنية أخرى».
- `1-N` تكلفة إضافية تكلفة allocations → توزيع التكلفة الإضافية: هذا الجدول أب: صف واحد هنا له أكثر من «توزيع التكلفة الإضافية».
- `1-N` purchase orders → أوامر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر الشراء».
- `1-N` purchase returns → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` سعر quotes → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».
- `1-N` مسلسل numbers → الأرقام التسلسلية: هذا الجدول أب: صف واحد هنا له أكثر من «الأرقام التسلسلية».
- `1-N` صنف offers → عروض الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأصناف».
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».
- `1-N` nationalities → الجنسيات: هذا الجدول أب: صف واحد هنا له أكثر من «الجنسيات».
- `1-N` religions → الديانات: هذا الجدول أب: صف واحد هنا له أكثر من «الديانات».
- `1-N` حالة اجتماعية statuses → الحالة الاجتماعية: هذا الجدول أب: صف واحد هنا له أكثر من «الحالة الاجتماعية».
- `1-N` وظيفة titles → المسميات الوظيفية: هذا الجدول أب: صف واحد هنا له أكثر من «المسميات الوظيفية».
- `1-N` departments → الإدارات: هذا الجدول أب: صف واحد هنا له أكثر من «الإدارات».
- `1-N` وظيفة cadres → الكادرات الوظيفية: هذا الجدول أب: صف واحد هنا له أكثر من «الكادرات الوظيفية».
- `1-N` cities → المدن: هذا الجدول أب: صف واحد هنا له أكثر من «المدن».
- `1-N` wage policies → سياسات الأجور: هذا الجدول أب: صف واحد هنا له أكثر من «سياسات الأجور».
- `1-N` allowances → البدلات: هذا الجدول أب: صف واحد هنا له أكثر من «البدلات».
- `1-N` deductions → الاستقطاعات: هذا الجدول أب: صف واحد هنا له أكثر من «الاستقطاعات».
- `1-N` students → الطلبة (كارت عام): هذا الجدول أب: صف واحد هنا له أكثر من «الطلبة (كارت عام)».
- `1-N` stages → المراحل الدراسية: هذا الجدول أب: صف واحد هنا له أكثر من «المراحل الدراسية».
- `1-N` semesters → التيرمات: هذا الجدول أب: صف واحد هنا له أكثر من «التيرمات».
- `1-N` collectors → المحصّلون: هذا الجدول أب: صف واحد هنا له أكثر من «المحصّلون».
- `1-N` مستخدم groups → مجموعات المستخدمين: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات المستخدمين».
- `1-N` تكلفة مركز حركة → حركة مراكز التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «حركة مراكز التكلفة».
- `1-N` banks → البنوك: هذا الجدول أب: صف واحد هنا له أكثر من «البنوك».
- `1-N` بنك accounts → الحسابات البنكية: هذا الجدول أب: صف واحد هنا له أكثر من «الحسابات البنكية».
- `1-N` safes → الخزائن: هذا الجدول أب: صف واحد هنا له أكثر من «الخزائن».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` cash معاملة lines → بنود سند الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «بنود سند الخزينة».
- `1-N` تحويل سعر histories → تاريخ أسعار التحويل: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ أسعار التحويل».
- `1-N` دفع allocations → تخصيصات السداد: هذا الجدول أب: صف واحد هنا له أكثر من «تخصيصات السداد».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` بنك box rights → صلاحية الخزينة/البنك: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية الخزينة/البنك».
- `1-N` securities قبض/إذن → أوراق قبض (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق قبض (أوراق مالية)».
- `1-N` securities دفع → أوراق دفع (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق دفع (أوراق مالية)».
- `1-N` securities renewal → تجديد الأوراق: هذا الجدول أب: صف واحد هنا له أكثر من «تجديد الأوراق».
- `1-N` projects → المشاريع (مستخلصات عامة): هذا الجدول أب: صف واحد هنا له أكثر من «المشاريع (مستخلصات عامة)».
- `1-N` contractors → المقاولون: هذا الجدول أب: صف واحد هنا له أكثر من «المقاولون».
- `1-N` subcontractors → المقاولون من الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «المقاولون من الباطن».
- `1-N` subcontracts → عقود الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الباطن».
- `1-N` subcontract invoices → مطالبات الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مطالبات الباطن».
- `1-N` عقار projects → مشاريع أملاك: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع أملاك».
- `1-N` post dated cheques → شيكات آجلة للوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «شيكات آجلة للوحدات».
- `1-N` تأجير صندوق إيجار agreements → اتفاقيات صندوق التأجير: هذا الجدول أب: صف واحد هنا له أكثر من «اتفاقيات صندوق التأجير».
- `1-N` monthly salaries → الرواتب الشهرية (مستند): هذا الجدول أب: صف واحد هنا له أكثر من «الرواتب الشهرية (مستند)».
- `1-N` سكن allowance clearances → إخلاء بدل السكن: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء بدل السكن».
- `1-N` end of service clearances → إخلاء نهاية الخدمة: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء نهاية الخدمة».
- `1-N` annual إجازة entitlements clearances → إخلاء رصيد الإجازات: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء رصيد الإجازات».
- `1-N` documentary ائتمان/دائن definitions → قوالب الاعتماد المستندي: هذا الجدول أب: صف واحد هنا له أكثر من «قوالب الاعتماد المستندي».
- `1-N` documentary credits → الاعتمادات المستندية: هذا الجدول أب: صف واحد هنا له أكثر من «الاعتمادات المستندية».
- `N-0..1` خطاب of ضمان إعدادات → إعدادات خطابات الضمان: ربط اختياري بصف واحد من «إعدادات خطابات الضمان».
- `1-N` letters of ضمان → خطابات الضمان: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان».
- `1-N` عميل followups → متابعة العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «متابعة العملاء».
- `1-N` خصم منبع ضريبة payments → سداد ضريبة الخصم من المنبع: هذا الجدول أب: صف واحد هنا له أكثر من «سداد ضريبة الخصم من المنبع».
- `1-N` end of service disbursements → صرف نهاية الخدمة: هذا الجدول أب: صف واحد هنا له أكثر من «صرف نهاية الخدمة».
- `1-N` annual إجازة entitlements disbursements → صرف مقابل الإجازة: هذا الجدول أب: صف واحد هنا له أكثر من «صرف مقابل الإجازة».
- `1-N` monthly salaries disbursements → صرف الرواتب الشهرية: هذا الجدول أب: صف واحد هنا له أكثر من «صرف الرواتب الشهرية».
- `1-N` سكن allowance entitlements disbursements → صرف بدل السكن: هذا الجدول أب: صف واحد هنا له أكثر من «صرف بدل السكن».
- `1-N` other addition خصم types → أنواع إضافات/خصومات أخرى: هذا الجدول أب: صف واحد هنا له أكثر من «أنواع إضافات/خصومات أخرى».
- `1-N` representative عمولة quantities → عمولة المندوب بالكمية: هذا الجدول أب: صف واحد هنا له أكثر من «عمولة المندوب بالكمية».
- `1-N` representative عمولة values → عمولة المندوب بالقيمة: هذا الجدول أب: صف واحد هنا له أكثر من «عمولة المندوب بالقيمة».
- `1-N` representative عمولة policies → سياسات عمولة المندوب: هذا الجدول أب: صف واحد هنا له أكثر من «سياسات عمولة المندوب».
- `1-N` صنف أمر limit lists → قوائم حدود الطلب: هذا الجدول أب: صف واحد هنا له أكثر من «قوائم حدود الطلب».
- `1-N` clothing colors → ألوان الملابس: هذا الجدول أب: صف واحد هنا له أكثر من «ألوان الملابس».
- `1-N` clothing sizes → مقاسات الملابس: هذا الجدول أب: صف واحد هنا له أكثر من «مقاسات الملابس».
- `1-N` clothing combos → تركيبات لون×مقاس: هذا الجدول أب: صف واحد هنا له أكثر من «تركيبات لون×مقاس».
- `1-N` distributors → الموزعون: هذا الجدول أب: صف واحد هنا له أكثر من «الموزعون».
- `1-N` drivers → السائقون: هذا الجدول أب: صف واحد هنا له أكثر من «السائقون».
- `1-N` عميل categories → تصنيفات العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «تصنيفات العملاء».
- `1-N` مورد categories → تصنيفات الموردين: هذا الجدول أب: صف واحد هنا له أكثر من «تصنيفات الموردين».
- `1-N` صنف categories → مجموعات الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات الأصناف».
- `1-N` persons → الأشخاص: هذا الجدول أب: صف واحد هنا له أكثر من «الأشخاص».
- `1-N` شخص groups → مجموعات الأشخاص: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات الأشخاص».
- `1-N` شخص صنف prices → أسعار خاصة لشخص: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار خاصة لشخص».
- `1-N` صنف تكلفة تاريخ → تاريخ تكلفة الصنف: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ تكلفة الصنف».
- `1-N` inventory movements → دفتر حركة المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «دفتر حركة المخزون».
- `1-N` عميل contracts → عقود العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «عقود العملاء».
- `1-N` مالي years → السنوات المالية: هذا الجدول أب: صف واحد هنا له أكثر من «السنوات المالية».
- `1-N` مالي periods → فترات السنة: هذا الجدول أب: صف واحد هنا له أكثر من «فترات السنة».
- `1-N` شركة إعداد entries → مفاتيح إعداد إضافية: هذا الجدول أب: صف واحد هنا له أكثر من «مفاتيح إعداد إضافية».
- `1-N` مستند sequences → مسلسلات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مسلسلات المستندات».
- `1-N` new modules → نسخ أنواع المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «نسخ أنواع المستندات».
- `1-N` new موديول stores → مخازن الموديول: هذا الجدول أب: صف واحد هنا له أكثر من «مخازن الموديول».
- `1-N` other موديول rights → صلاحية قراءة بين الموديولات: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية قراءة بين الموديولات».
- `1-N` أستاذ ترحيل violations → مخالفات الترحيل: هذا الجدول أب: صف واحد هنا له أكثر من «مخالفات الترحيل».
- `1-N` ضريبة periods → الفترات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الفترات الضريبية».
- `1-N` ضريبة declarations → الإقرارات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الإقرارات الضريبية».
- `1-N` ضريبة settlements → تسويات الضريبة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات الضريبة».
- `1-N` نقطة بيع terminals → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` نقطة بيع shifts → ورديات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «ورديات نقطة البيع».
- `1-N` نقطة بيع orders → طلبات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «طلبات نقطة البيع».
- `1-N` e فاتورة إعدادات → إعدادات بوابة الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات بوابة الإي-فاتورة».
- `1-N` e فاتورة documents → مستندات البوابة الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «مستندات البوابة الضريبية».
- `N-0..1` trade إعدادات → إعدادات التجارة الخارجية: ربط اختياري بصف واحد من «إعدادات التجارة الخارجية».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `1-N` ضمان letters → خطابات الضمان (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان (مسار تجارة)».
- `N-0..1` hr إعدادات → إعدادات الموارد البشرية: ربط اختياري بصف واحد من «إعدادات الموارد البشرية».
- `1-N` مسير runs → تشغيل المسير: هذا الجدول أب: صف واحد هنا له أكثر من «تشغيل المسير».
- `N-0..1` manufacturing إعدادات → إعدادات التصنيع: ربط اختياري بصف واحد من «إعدادات التصنيع».
- `1-N` bill of materials → قوائم المكونات BOM: هذا الجدول أب: صف واحد هنا له أكثر من «قوائم المكونات BOM».
- `1-N` تشغيل orders → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `N-0..1` contracting إعدادات → إعدادات المقاولات: ربط اختياري بصف واحد من «إعدادات المقاولات».
- `1-N` contracting projects → مشاريع المقاولات: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع المقاولات».
- `1-N` عقد extracts → مستخلصات العقد: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات العقد».
- `1-N` مشروع boqitems → بنود جدول كميات المالك: هذا الجدول أب: صف واحد هنا له أكثر من «بنود جدول كميات المالك».
- `1-N` boq سعر analysis items → تحليل تسعير البند: هذا الجدول أب: صف واحد هنا له أكثر من «تحليل تسعير البند».
- `1-N` boq markup structures → هيكل هامش الـ BOQ: هذا الجدول أب: صف واحد هنا له أكثر من «هيكل هامش الـ BOQ».
- `1-N` executive measurement sheets → حصر تنفيذي: هذا الجدول أب: صف واحد هنا له أكثر من «حصر تنفيذي».
- `1-N` client contracts → عقود العميل (مقاولات): هذا الجدول أب: صف واحد هنا له أكثر من «عقود العميل (مقاولات)».
- `1-N` client invoices → فواتير/مطالبات العميل: هذا الجدول أب: صف واحد هنا له أكثر من «فواتير/مطالبات العميل».
- `1-N` client فاتورة items → سطور مطالبة العميل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مطالبة العميل».
- `1-N` site stock materials → مخزون موقع المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «مخزون موقع المشروع».
- `1-N` مشروع letters of ضمان → خطابات ضمان المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات ضمان المشروع».
- `1-N` lg إجراء histories → تاريخ حركة خطاب الضمان: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ حركة خطاب الضمان».
- `1-N` financial adjustment notes → إشعارات تسوية مالية للمشروع: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات تسوية مالية للمشروع».
- `N-0..1` عقاري عقار إعدادات → إعدادات الاستثمار العقاري: ربط اختياري بصف واحد من «إعدادات الاستثمار العقاري».
- `1-N` عقاري عقار projects → مشاريع عقارية: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع عقارية».
- `1-N` عقاري عقار reservations → حجوزات الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «حجوزات الوحدات».
- `1-N` وحدة contracts → عقود الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الوحدات».
- `N-0..1` مدرسة إعدادات → إعدادات المدارس: ربط اختياري بصف واحد من «إعدادات المدارس».
- `1-N` مدرسة دراسي years → سنوات دراسية: هذا الجدول أب: صف واحد هنا له أكثر من «سنوات دراسية».
- `1-N` دراسي grades → الصفوف الدراسية: هذا الجدول أب: صف واحد هنا له أكثر من «الصفوف الدراسية».
- `1-N` مدرسة students → طلبة المدرسة (كارت مدرسي): هذا الجدول أب: صف واحد هنا له أكثر من «طلبة المدرسة (كارت مدرسي)».
- `1-N` طالب مصروف دراسي contracts → عقود مصروفات الطالب: هذا الجدول أب: صف واحد هنا له أكثر من «عقود مصروفات الطالب».
- `1-N` مدرسة أتوبيس routes → خطوط الأتوبيس: هذا الجدول أب: صف واحد هنا له أكثر من «خطوط الأتوبيس».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».
- `N-0..1` tenant subscription → اشتراكات المستأجر: ربط اختياري بصف واحد من «اشتراكات المستأجر».
- `1-N` system notifications → إشعارات النظام: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات النظام».
- `1-N` مستند تخطيط configs → تخطيطات الطباعة: هذا الجدول أب: صف واحد هنا له أكثر من «تخطيطات الطباعة».
- `1-N` حساب فترة balances → الأرصدة الشهرية للحسابات: هذا الجدول أب: صف واحد هنا له أكثر من «الأرصدة الشهرية للحسابات».
- `1-N` طرف جاري balances → أرصدة العملاء والموردين: هذا الجدول أب: صف واحد هنا له أكثر من «أرصدة العملاء والموردين».
- `1-N` ai conversations → محادثات المساعد: هذا الجدول أب: صف واحد هنا له أكثر من «محادثات المساعد».
- `1-N` ai مراجعة logs → سجل تدقيق الذكاء الاصطناعي: هذا الجدول أب: صف واحد هنا له أكثر من «سجل تدقيق الذكاء الاصطناعي».
- `1-N` ai documents → مستندات معرفة الذكاء: هذا الجدول أب: صف واحد هنا له أكثر من «مستندات معرفة الذكاء».
- `1-N` ai insights → استنتاجات الذكاء: هذا الجدول أب: صف واحد هنا له أكثر من «استنتاجات الذكاء».
- `N-0..1` ai مراقب لقطة → لقطات المراقب: ربط اختياري بصف واحد من «لقطات المراقب».
- `1-N` نمو opportunities → فرص النمو: هذا الجدول أب: صف واحد هنا له أكثر من «فرص النمو».
- `1-N` نمو فرصة actions → إجراءات الفرصة: هذا الجدول أب: صف واحد هنا له أكثر من «إجراءات الفرصة».
- `1-N` نمو attributions → إسناد نتيجة النمو: هذا الجدول أب: صف واحد هنا له أكثر من «إسناد نتيجة النمو».
- `1-N` مستخدم جولة تقدّم → تقدّم جولة المنتج: هذا الجدول أب: صف واحد هنا له أكثر من «تقدّم جولة المنتج».
- `N-0..1` واتساب config → إعداد واتساب الشركة: ربط اختياري بصف واحد من «إعداد واتساب الشركة».
- `1-N` واتساب مصرّح users → مستخدمو واتساب المصرّحون: هذا الجدول أب: صف واحد هنا له أكثر من «مستخدمو واتساب المصرّحون».

### 6. الفروع (`branches`)

موديل: `Branch` · 23 عمود · 24 علاقة

**إيه الجدول؟** فروع الشركة: عنوان، مخزن افتراضي، خزينة افتراضية.

**امتى بيتستخدم؟** المستند يقدر يتسجل على فرع. التقارير تتفلتر به.

**الشاشات:** تعريف الفروع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy فرع كود | `legacyBranchCode` | String? | حقل «legacy فرع كود» على هذا الجدول. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| فرع رقم | `branchNumber` | String? | حقل «فرع رقم» على هذا الجدول. |
| activation رقم | `activationNumber` | String? | حقل «activation رقم» على هذا الجدول. |
| سعر list | `priceList` | String? | حقل «سعر list» على هذا الجدول. |
| registration رقم | `registrationNumber` | String? | حقل «registration رقم» على هذا الجدول. |
| barcode سعر | `barcodePrice` | String? | e.g., "بالجملة" |
| governorate | `governorate` | String? | حقل «governorate» على هذا الجدول. |
| district | `district` | String? | حقل «district» على هذا الجدول. |
| street اسم | `streetName` | String? | حقل «street اسم» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| مبنى رقم | `buildingNumber` | String? | حقل «مبنى رقم» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| العنوان | `address` | String? | عنوان الطرف. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| افتراضي مخزن | `defaultWarehouseId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي مخزن». |
| افتراضي خزينة | `defaultSafeId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي خزينة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` افتراضي مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر defaultWarehouseId.
- `N-0..1` افتراضي خزينة → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر defaultSafeId.
- `1-N` warehouses → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».
- `1-N` مستخدم فرع permissions → صلاحية المستخدم على الفرع: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية المستخدم على الفرع».
- `1-N` electronic invoices → الإي-فواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الإي-فواتير».
- `1-N` قيد entries → قيود اليومية: هذا الجدول أب: صف واحد هنا له أكثر من «قيود اليومية».
- `1-N` مستند sequences → مسلسلات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مسلسلات المستندات».
- `1-N` صنف تكلفة تاريخ → تاريخ تكلفة الصنف: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ تكلفة الصنف».
- `1-N` inventory movements → دفتر حركة المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «دفتر حركة المخزون».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` ضريبة periods → الفترات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الفترات الضريبية».
- `1-N` نقطة بيع terminals → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` نقطة بيع shifts → ورديات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «ورديات نقطة البيع».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `1-N` ضمان letters → خطابات الضمان (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان (مسار تجارة)».
- `1-N` مسير runs → تشغيل المسير: هذا الجدول أب: صف واحد هنا له أكثر من «تشغيل المسير».
- `1-N` تشغيل orders → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».
- `1-N` مستند تخطيط configs → تخطيطات الطباعة: هذا الجدول أب: صف واحد هنا له أكثر من «تخطيطات الطباعة».
- `1-N` شركة إعداد entries → مفاتيح إعداد إضافية: هذا الجدول أب: صف واحد هنا له أكثر من «مفاتيح إعداد إضافية».

### 7. إعدادات الشركة (`company_settings`)

موديل: `CompanySettings` · 47 عمود · 3 علاقة

**إيه الجدول؟** عملة الأساس، سلوك القيود، حسابات الفروقات، تحذيرات الميزانية.

**امتى بيتستخدم؟** شاشة إعدادات المحاسبة بتقرأ وتكتب الصف ده.

**الشاشات:** إعدادات المحاسبة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مالي سنة start | `fiscalYearStart` | String? | حقل «مالي سنة start» على هذا الجدول. |
| مالي سنة end | `fiscalYearEnd` | String? | حقل «مالي سنة end» على هذا الجدول. |
| افتراضي عملة | `defaultCurrency` | String? | حقل «افتراضي عملة» على هذا الجدول. |
| قيد حركة digits | `journalEntryDigits` | Int? | حقل «قيد حركة digits» على هذا الجدول. |
| allow negative رصيد | `allowNegativeBalance` | Boolean? | حقل «allow negative رصيد» على هذا الجدول. |
| allow تكلفة مركز without حساب | `allowCostCenterWithoutAccount` | Boolean? | حقل «allow تكلفة مركز without حساب» على هذا الجدول. |
| lock ترحيل before تاريخ | `lockPostingBeforeDate` | String? | حقل «lock ترحيل before تاريخ» على هذا الجدول. |
| enable approvals workflow | `enableApprovalsWorkflow` | Boolean? | حقل «enable approvals workflow» على هذا الجدول. |
| auto numbering | `autoNumbering` | Boolean? | حقل «auto numbering» على هذا الجدول. |
| decimals in amounts | `decimalsInAmounts` | Int? | حقل «decimals in amounts» على هذا الجدول. |
| accounts guide digits | `accountsGuideDigits` | Int? | حقل «accounts guide digits» على هذا الجدول. |
| تكلفة centers guide digits | `costCentersGuideDigits` | Int? | حقل «تكلفة centers guide digits» على هذا الجدول. |
| stores guide digits | `storesGuideDigits` | Int? | حقل «stores guide digits» على هذا الجدول. |
| items guide digits | `itemsGuideDigits` | Int? | حقل «items guide digits» على هذا الجدول. |
| تاريخ usage | `dateUsage` | String? | 'gregorian' | 'hijri' | 'both' |
| operations من تاريخ | `operationsFromDate` | String? | حقل «operations من تاريخ» على هذا الجدول. |
| due securities warning days | `dueSecuritiesWarningDays` | Int? | حقل «due securities warning days» على هذا الجدول. |
| budget allow exceed | `budgetAllowExceed` | Boolean? | حقل «budget allow exceed» على هذا الجدول. |
| budget warn half | `budgetWarnHalf` | Boolean? | حقل «budget warn half» على هذا الجدول. |
| budget warn same | `budgetWarnSame` | Boolean? | حقل «budget warn same» على هذا الجدول. |
| budget warn exceed | `budgetWarnExceed` | Boolean? | حقل «budget warn exceed» على هذا الجدول. |
| budget stop رسالة only | `budgetStopMessageOnly` | Boolean? | حقل «budget stop رسالة only» على هذا الجدول. |
| budget stop ledger | `budgetStopLedger` | Boolean? | حقل «budget stop ledger» على هذا الجدول. |
| budget stop origin | `budgetStopOrigin` | Boolean? | حقل «budget stop origin» على هذا الجدول. |
| budget stop both | `budgetStopBoth` | Boolean? | حقل «budget stop both» على هذا الجدول. |
| backup path | `backupPath` | String? | حقل «backup path» على هذا الجدول. |
| تكلفة method | `costMethod` | String? | 'average' | 'fifo' | 'lifo' |
| theme | `theme` | String? | 'light' | 'dark' |
| temporary receipts | `temporaryReceipts` | Boolean? | حقل «temporary receipts» على هذا الجدول. |
| documentary credits | `documentaryCredits` | Boolean? | حقل «documentary credits» على هذا الجدول. |
| advanced إعدادات | `advancedSettings` | Json? | For flexible advanced settings |
| logo url | `logoUrl` | String? | حقل «logo url» على هذا الجدول. |
| حساب definitions | `accountDefinitions` | Json? | حقل «حساب definitions» على هذا الجدول. |
| retained earnings حساب | `retainedEarningsAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «retained earnings حساب». |
| executive whats app phone | `executiveWhatsAppPhone` | String? | حقل «executive whats app phone» على هذا الجدول. |
| auto post أستاذ | `autoPostGl` | Boolean | حقل «auto post أستاذ» على هذا الجدول. |
| pricing calculation basis | `pricingCalculationBasis` | String | حقل «pricing calculation basis» على هذا الجدول. |
| prevent negative stock | `preventNegativeStock` | Boolean | حقل «prevent negative stock» على هذا الجدول. |
| prevent cash overdraft | `preventCashOverdraft` | Boolean | حقل «prevent cash overdraft» على هذا الجدول. |
| enforce تكلفة مركز for pnl | `enforceCostCenterForPnl` | Boolean | حقل «enforce تكلفة مركز for pnl» على هذا الجدول. |
| prevent selling below تكلفة | `preventSellingBelowCost` | Boolean | حقل «prevent selling below تكلفة» على هذا الجدول. |
| rounding حساب | `roundingAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «rounding حساب». |
| تحويل gain loss حساب | `exchangeGainLossAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «تحويل gain loss حساب». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` rounding حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر roundingAccountId.
- `N-0..1` تحويل gain loss حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر exchangeGainLossAccountId.

### 8. مفاتيح إعداد إضافية (`company_setting_entries`)

موديل: `CompanySettingEntry` · 7 عمود · 2 علاقة

**إيه الجدول؟** إعدادات مفتاح/قيمة زيادة عن الأعمدة الثابتة.

**امتى بيتستخدم؟** الخدمات الداخلية (GLUnPost، حدود اعتماد…).

**الشاشات:** إعدادات المحاسبة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| الاسم | `name` | String | اسم الصف. |
| value | `value` | String | حقل «value» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.

### 9. السنوات المالية (`fiscal_years`)

موديل: `FiscalYear` · 14 عمود · 17 علاقة

**إيه الجدول؟** سنة مفتوحة أو مغلقة. الترحيل يتوقف لو مقفولة.

**امتى بيتستخدم؟** فتح/إغلاق الفترة يعمل قيد إقفال إيرادات ومصروفات على الأرباح والخسائر.

**الشاشات:** الفترات المالية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy سنة | `legacyYearId` | String | مفتاح أجنبي يربط الصف بجدول «legacy سنة». |
| الاسم العربي | `arabicName` | String? | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime | نهاية السنة/الفترة/العقد. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| closed at | `closedAt` | DateTime? | ختم زمني لهذا الحدث. |
| closed by | `closedBy` | String? | حقل «closed by» على هذا الجدول. |
| ختامي قيد حركة | `closingJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «ختامي قيد حركة». |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` مالي periods → فترات السنة: هذا الجدول أب: صف واحد هنا له أكثر من «فترات السنة».
- `1-N` مستند sequences → مسلسلات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مسلسلات المستندات».
- `1-N` قيد entries → قيود اليومية: هذا الجدول أب: صف واحد هنا له أكثر من «قيود اليومية».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` ضريبة periods → الفترات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الفترات الضريبية».
- `1-N` ضريبة declarations → الإقرارات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الإقرارات الضريبية».
- `1-N` نقطة بيع shifts → ورديات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «ورديات نقطة البيع».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `1-N` ضمان letters → خطابات الضمان (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان (مسار تجارة)».
- `1-N` مسير runs → تشغيل المسير: هذا الجدول أب: صف واحد هنا له أكثر من «تشغيل المسير».
- `1-N` تشغيل orders → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».

### 10. فترات السنة (`fiscal_periods`)

موديل: `FiscalPeriod` · 10 عمود · 2 علاقة

**إيه الجدول؟** شهور أو أرباع جوه السنة المالية.

**امتى بيتستخدم؟** تُستخدم لتقطيع الأرصدة الشهرية والتقارير.

**الشاشات:** الفترات المالية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| السنة المالية | `fiscalYearId` | String | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| فترة رقم | `periodNumber` | Int | حقل «فترة رقم» على هذا الجدول. |
| الاسم | `name` | String? | اسم الصف. |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime | نهاية السنة/الفترة/العقد. |
| is closed | `isClosed` | Boolean | علامة نعم/لا: is closed. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مالي سنة → السنوات المالية: كل صف هنا مربوط بصف واحد من «السنوات المالية» عبر fiscalYearId.

### 11. مسلسلات المستندات (`document_sequences`)

موديل: `DocumentSequence` · 10 عمود · 3 علاقة

**إيه الجدول؟** الرقم الجاي لكل نوع مستند حسب الشركة والفرع والسنة.

**امتى بيتستخدم؟** أي حفظ فاتورة/سند/إذن بياخد الرقم من هنا.

**الشاشات:** إعدادات الترقيم

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| doc نوع | `docType` | String | حقل «doc نوع» على هذا الجدول. |
| scope | `scope` | String | حقل «scope» على هذا الجدول. |
| last رقم | `lastNumber` | Int | حقل «last رقم» على هذا الجدول. |
| padding | `padding` | Int | حقل «padding» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.

### 12. نسخ أنواع المستندات (`new_modules`)

موديل: `NewModule` · 13 عمود · 4 علاقة

**إيه الجدول؟** نسخ من نفس النوع (SI01، SI02) لكل بادئة أو مخزن.

**امتى بيتستخدم؟** لو عندك أكتر من مسلسل لنفس الفاتورة.

**الشاشات:** تعريف الموديولات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| base نوع | `baseType` | String | حقل «base نوع» على هذا الجدول. |
| موديول كود | `moduleCode` | String | حقل «موديول كود» على هذا الجدول. |
| full كود | `fullCode` | String | حقل «full كود» على هذا الجدول. |
| اسم ar | `nameAr` | String | حقل «اسم ar» على هذا الجدول. |
| اسم en | `nameEn` | String? | حقل «اسم en» على هذا الجدول. |
| menu اسم ar | `menuNameAr` | String | حقل «menu اسم ar» على هذا الجدول. |
| menu اسم en | `menuNameEn` | String? | حقل «menu اسم en» على هذا الجدول. |
| قائمة الأسعار | `priceListId` | String? | الأسعار الافتراضية للعميل/العرض. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` سعر list → قوائم الأسعار: ربط اختياري بصف واحد من «قوائم الأسعار» عبر priceListId.
- `1-N` stores → مخازن الموديول: هذا الجدول أب: صف واحد هنا له أكثر من «مخازن الموديول».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».

### 13. مخازن الموديول (`new_module_stores`)

موديل: `NewModuleStore` · 5 عمود · 3 علاقة

**إيه الجدول؟** أنهي مخازن مسموحة لنسخة نوع المستند.

**امتى بيتستخدم؟** فلترة المخزن في شاشة الفاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| new موديول | `newModuleId` | String | مفتاح أجنبي يربط الصف بجدول «new موديول». |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` new موديول → نسخ أنواع المستندات: كل صف هنا مربوط بصف واحد من «نسخ أنواع المستندات» عبر newModuleId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.

### 14. صلاحية قراءة بين الموديولات (`other_module_rights`)

موديل: `OtherModuleRight` · 5 عمود · 1 علاقة

**إيه الجدول؟** موديول يقدر يقرأ مستندات موديول تاني.

**امتى بيتستخدم؟** إعداد متقدم للصلاحيات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| sanad موديول | `sanadModule` | String | حقل «sanad موديول» على هذا الجدول. |
| read موديول | `readModule` | String | حقل «read موديول» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 16. إشعارات النظام (`system_notifications`)

موديل: `SystemNotification` · 10 عمود · 2 علاقة

**إيه الجدول؟** رسائل داخل التطبيق للمستخدم.

**امتى بيتستخدم؟** جرس الإشعارات في الهيدر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| مسمى | `title` | String | حقل «مسمى» على هذا الجدول. |
| رسالة | `message` | String | حقل «رسالة» على هذا الجدول. |
| نوع | `type` | String | حقل «نوع» على هذا الجدول. |
| تصنيف | `category` | String? | حقل «تصنيف» على هذا الجدول. |
| link url | `linkUrl` | String? | حقل «link url» على هذا الجدول. |
| is read | `isRead` | Boolean | علامة نعم/لا: is read. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` مستخدم → المستخدمون: ربط اختياري بصف واحد من «المستخدمون» عبر userId.

### 41. فترات محاسبية مساعدة (`periods`)

موديل: `Period` · 10 عمود · 1 علاقة

**إيه الجدول؟** تعريف فترة إضافي بجانب السنوات المالية.

**امتى بيتستخدم؟** شاشات الفترات القديمة/المساعدة.

**الشاشات:** الفترات المحاسبية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم | `name` | String | اسم الصف. |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime | نهاية السنة/الفترة/العقد. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| is closed | `isClosed` | Boolean | علامة نعم/لا: is closed. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 109. بروفايل المستند (`document_profiles`)

موديل: `DocumentProfile` · 19 عمود · 5 علاقة

**إيه الجدول؟** بادئة رقم، مخزن/خزينة/مركز افتراضي لكل شاشة.

**امتى بيتستخدم؟** يتطبق لما تفتح مستند جديد.

**الشاشات:** إعدادات المستندات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| slug | `slug` | String | حقل «slug» على هذا الجدول. |
| اسم ar | `nameAr` | String | حقل «اسم ar» على هذا الجدول. |
| اسم en | `nameEn` | String? | حقل «اسم en» على هذا الجدول. |
| base نوع | `baseType` | DocumentBaseType | حقل «base نوع» على هذا الجدول. |
| prefix | `prefix` | String? | حقل «prefix» على هذا الجدول. |
| next رقم | `nextNumber` | Int | حقل «next رقم» على هذا الجدول. |
| افتراضي مخزن | `defaultWarehouseId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي مخزن». |
| lock مخزن | `lockWarehouse` | Boolean | حقل «lock مخزن» على هذا الجدول. |
| افتراضي treasury | `defaultTreasuryId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي treasury». |
| lock treasury | `lockTreasury` | Boolean | حقل «lock treasury» على هذا الجدول. |
| مركز التكلفة الافتراضي | `defaultCostCenterId` | String? | يتملأ تلقائي لو الحساب بيلزم مركز. |
| lock تكلفة مركز | `lockCostCenter` | Boolean | حقل «lock تكلفة مركز» على هذا الجدول. |
| visible columns | `visibleColumns` | Json | حقل «visible columns» على هذا الجدول. |
| show in sidebar | `showInSidebar` | Boolean | علامة نعم/لا: show in sidebar. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` افتراضي مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر defaultWarehouseId.
- `N-0..1` افتراضي treasury → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر defaultTreasuryId.
- `N-0..1` افتراضي تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر defaultCostCenterId.
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».

### 110. إعدادات حركة المستند (`transaction_settings`)

موديل: `TransactionSettings` · 33 عمود · 9 علاقة

**إيه الجدول؟** ترحيل أوتوماتيك، ضريبة، تأثير مخزون، إظهار أعمدة العملة، لكل نوع مستند.

**امتى بيتستخدم؟** الإعدادات المتقدمة + استثناء في خيارات إضافية.

**الشاشات:** إعدادات الحركات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مستند نوع | `documentType` | DocumentBaseType | حقل «مستند نوع» على هذا الجدول. |
| numbering mode | `numberingMode` | NumberingMode | حقل «numbering mode» على هذا الجدول. |
| مسلسل mode | `sequenceMode` | SequenceMode | حقل «مسلسل mode» على هذا الجدول. |
| auto post on save | `autoPostOnSave` | Boolean | حقل «auto post on save» على هذا الجدول. |
| auto طباعة on save | `autoPrintOnSave` | Boolean | حقل «auto طباعة on save» على هذا الجدول. |
| generate حركة on save | `generateEntryOnSave` | Boolean | حقل «generate حركة on save» على هذا الجدول. |
| affect stock | `affectStock` | Boolean | حقل «affect stock» على هذا الجدول. |
| allow صنف سعر override | `allowItemPriceOverride` | Boolean | حقل «allow صنف سعر override» على هذا الجدول. |
| prevent selling below تكلفة | `preventSellingBelowCost` | Boolean | حقل «prevent selling below تكلفة» على هذا الجدول. |
| prevent negative stock | `preventNegativeStock` | Boolean | حقل «prevent negative stock» على هذا الجدول. |
| auto apply vat | `autoApplyVat` | Boolean | حقل «auto apply vat» على هذا الجدول. |
| auto apply wht | `autoApplyWht` | Boolean | حقل «auto apply wht» على هذا الجدول. |
| auto apply development ضريبة | `autoApplyDevelopmentTax` | Boolean | حقل «auto apply development ضريبة» على هذا الجدول. |
| cascading discounts | `cascadingDiscounts` | Boolean | حقل «cascading discounts» على هذا الجدول. |
| show all accounts in عميل field | `showAllAccountsInCustomerField` | Boolean | علامة نعم/لا: show all accounts in عميل field. |
| افتراضي sales حساب | `defaultSalesAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي sales حساب». |
| افتراضي purchase return حساب | `defaultPurchaseReturnAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي purchase return حساب». |
| افتراضي cash حساب | `defaultCashAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي cash حساب». |
| افتراضي بنك أستاذ حساب | `defaultBankGlAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي بنك أستاذ حساب». |
| افتراضي offset حساب | `defaultOffsetAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي offset حساب». |
| افتراضي charges حساب | `defaultChargesAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي charges حساب». |
| مركز التكلفة الافتراضي | `defaultCostCenterId` | String? | يتملأ تلقائي لو الحساب بيلزم مركز. |
| افتراضي مخزن | `defaultWarehouseId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي مخزن». |
| pricing سياسة | `pricingPolicy` | PricingPolicy | حقل «pricing سياسة» على هذا الجدول. |
| تكلفة مركز side | `costCenterSide` | CostCenterPostingSide | حقل «تكلفة مركز side» على هذا الجدول. |
| تكلفة مركز تخصيص هدف | `costCenterAllocationTarget` | CostCenterAllocationTarget | حقل «تكلفة مركز تخصيص هدف» على هذا الجدول. |
| allow standalone returns | `allowStandaloneReturns` | Boolean | حقل «allow standalone returns» على هذا الجدول. |
| enforce original سعر | `enforceOriginalPrice` | Boolean | حقل «enforce original سعر» على هذا الجدول. |
| إظهار أعمدة العملة | `showFxColumns` | Boolean | إعداد الشاشة: إظهار/إخفاء العملة وسعر الصرف. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-0..1` افتراضي sales حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultSalesAccountId.
- `N-0..1` افتراضي purchase return حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultPurchaseReturnAccountId.
- `N-0..1` افتراضي cash حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultCashAccountId.
- `N-0..1` افتراضي بنك أستاذ حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultBankGlAccountId.
- `N-0..1` افتراضي offset حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultOffsetAccountId.
- `N-0..1` افتراضي charges حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر defaultChargesAccountId.
- `N-0..1` افتراضي تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر defaultCostCenterId.
- `N-0..1` افتراضي مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر defaultWarehouseId.
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 214. مفاتيح الـ API (`api_keys`)

موديل: `ApiKey` · 12 عمود · 0 علاقة

**إيه الجدول؟** مفاتيح تكامل خارجي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مفاتيح الـ API.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الاسم | `name` | String | اسم الصف. |
| مفتاح | `key` | String | Encrypted API key |
| مفتاح hash | `keyHash` | String | SHA-256 hash for lookup |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| الشركة | `companyId` | String? | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستأجر القديم | `tenantId` | String? | حقل تراثي قبل نموذج الشركة. التشغيل الحالي بيستخدم companyId. |
| permissions | `permissions` | Json | Array of permission strings |
| expires at | `expiresAt` | DateTime? | ختم زمني لهذا الحدث. |
| last used at | `lastUsedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

### 215. إعدادات المنصة العامة (`system_settings`)

موديل: `SystemSetting` · 9 عمود · 0 علاقة

**إيه الجدول؟** مفاتيح نظام مش مربوطة بشركة واحدة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعدادات المنصة العامة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مفتاح | `key` | String | حقل «مفتاح» على هذا الجدول. |
| value | `value` | String? | حقل «value» على هذا الجدول. |
| نوع | `type` | String | string, number, boolean, json |
| تصنيف | `category` | String? | حقل «تصنيف» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| is public | `isPublic` | Boolean | Can be accessed without auth |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

### 253. مرفقات المستندات (`document_attachments`)

موديل: `DocumentAttachment` · 33 عمود · 12 علاقة

**إيه الجدول؟** ملفات مصورة/PDF مربوطة بأي مستند.

**امتى بيتستخدم؟** زر المرفقات في الشاشات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| original file اسم | `originalFileName` | String | حقل «original file اسم» على هذا الجدول. |
| stored file اسم | `storedFileName` | String | حقل «stored file اسم» على هذا الجدول. |
| file مقاس | `fileSize` | Int | حقل «file مقاس» على هذا الجدول. |
| mime نوع | `mimeType` | String | حقل «mime نوع» على هذا الجدول. |
| storage provider | `storageProvider` | String | حقل «storage provider» على هذا الجدول. |
| storage path مفتاح | `storagePathKey` | String | حقل «storage path مفتاح» على هذا الجدول. |
| file تصنيف | `fileCategory` | DocumentCategory | حقل «file تصنيف» على هذا الجدول. |
| entity نوع | `entityType` | String | حقل «entity نوع» على هذا الجدول. |
| entity | `entityId` | String | مفتاح أجنبي يربط الصف بجدول «entity». |
| file اسم | `fileName` | String | حقل «file اسم» على هذا الجدول. |
| storage path | `storagePath` | String | حقل «storage path» على هذا الجدول. |
| file url | `fileUrl` | String? | حقل «file url» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| tags | `tags` | Json? | حقل «tags» على هذا الجدول. |
| uploaded by | `uploadedById` | String? | مفتاح أجنبي يربط الصف بجدول «uploaded by». |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| subcontract | `subcontractId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| subcontract فاتورة | `subcontractInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract فاتورة». |
| site غرامة | `sitePenaltyId` | String? | مفتاح أجنبي يربط الصف بجدول «site غرامة». |
| خامة reconciliation | `materialReconciliationId` | String? | مفتاح أجنبي يربط الصف بجدول «خامة reconciliation». |
| executive measurement sheet | `executiveMeasurementSheetId` | String? | مفتاح أجنبي يربط الصف بجدول «executive measurement sheet». |
| client عقد | `clientContractId` | String? | مفتاح أجنبي يربط الصف بجدول «client عقد». |
| client فاتورة | `clientInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «client فاتورة». |
| خطاب of ضمان | `letterOfGuaranteeId` | String? | مفتاح أجنبي يربط الصف بجدول «خطاب of ضمان». |
| عقار وحدة | `propertyUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «عقار وحدة». |
| وحدة عقد | `unitContractId` | String? | مفتاح أجنبي يربط الصف بجدول «وحدة عقد». |
| uploaded by مستخدم | `uploadedByUserId` | String | مفتاح أجنبي يربط الصف بجدول «uploaded by مستخدم». |
| is archived | `isArchived` | Boolean | علامة نعم/لا: is archived. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` subcontract → عقود الباطن: ربط اختياري بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` subcontract فاتورة → مطالبات الباطن: ربط اختياري بصف واحد من «مطالبات الباطن» عبر subcontractInvoiceId.
- `N-0..1` site غرامة → غرامات وعيوب الموقع: ربط اختياري بصف واحد من «غرامات وعيوب الموقع» عبر sitePenaltyId.
- `N-0..1` خامة reconciliation → مطابقة خامات الموقع: ربط اختياري بصف واحد من «مطابقة خامات الموقع» عبر materialReconciliationId.
- `N-0..1` executive measurement sheet → حصر تنفيذي: ربط اختياري بصف واحد من «حصر تنفيذي» عبر executiveMeasurementSheetId.
- `N-0..1` client عقد → عقود العميل (مقاولات): ربط اختياري بصف واحد من «عقود العميل (مقاولات)» عبر clientContractId.
- `N-0..1` client فاتورة → فواتير/مطالبات العميل: ربط اختياري بصف واحد من «فواتير/مطالبات العميل» عبر clientInvoiceId.
- `N-0..1` خطاب of ضمان → خطابات ضمان المشروع: ربط اختياري بصف واحد من «خطابات ضمان المشروع» عبر letterOfGuaranteeId.
- `N-0..1` عقار وحدة → وحدات الأملاك: ربط اختياري بصف واحد من «وحدات الأملاك» عبر propertyUnitId.
- `N-0..1` وحدة عقد → عقود الوحدات: ربط اختياري بصف واحد من «عقود الوحدات» عبر unitContractId.

### 254. اشتراكات المستأجر (`tenant_subscriptions`)

موديل: `TenantSubscription` · 13 عمود · 1 علاقة

**إيه الجدول؟** باقة وحدود استخدام (AI، مستخدمين).

**امتى بيتستخدم؟** يُستخدم مع شاشات: اشتراكات المستأجر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| plan نوع | `planType` | String | حقل «plan نوع» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| max branches | `maxBranches` | Int | حقل «max branches» على هذا الجدول. |
| max users | `maxUsers` | Int | حقل «max users» على هذا الجدول. |
| max storage mb | `maxStorageMb` | Int | حقل «max storage mb» على هذا الجدول. |
| allowed modules | `allowedModules` | Json | حقل «allowed modules» على هذا الجدول. |
| license مفتاح hash | `licenseKeyHash` | String? | حقل «license مفتاح hash» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 255. تخطيطات الطباعة (`document_layout_configs`)

موديل: `DocumentLayoutConfig` · 31 عمود · 2 علاقة

**إيه الجدول؟** شكل A4 لكل نوع مستند: شعار، أعمدة، QR.

**امتى بيتستخدم؟** إعدادات نماذج الطباعة.

**الشاشات:** نماذج الطباعة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| الاسم | `name` | String | اسم الصف. |
| is افتراضي | `isDefault` | Boolean | علامة نعم/لا: is افتراضي. |
| مستند نوع | `documentType` | DocumentLayoutType | حقل «مستند نوع» على هذا الجدول. |
| تخطيط preset | `layoutPreset` | DocumentLayoutPreset | حقل «تخطيط preset» على هذا الجدول. |
| table style | `tableStyle` | DocumentTableStyle | حقل «table style» على هذا الجدول. |
| font family | `fontFamily` | String | حقل «font family» على هذا الجدول. |
| primary لون | `primaryColor` | String | حقل «primary لون» على هذا الجدول. |
| secondary لون | `secondaryColor` | String | حقل «secondary لون» على هذا الجدول. |
| text لون | `textColor` | String | حقل «text لون» على هذا الجدول. |
| paper مقاس | `paperSize` | DocumentPaperSize | حقل «paper مقاس» على هذا الجدول. |
| margin مقاس | `marginSize` | DocumentMarginSize | حقل «margin مقاس» على هذا الجدول. |
| logo url | `logoUrl` | String? | حقل «logo url» على هذا الجدول. |
| logo position | `logoPosition` | DocumentLogoPosition | حقل «logo position» على هذا الجدول. |
| logo width | `logoWidth` | Int | حقل «logo width» على هذا الجدول. |
| شركة اسم ar | `companyNameAr` | String? | حقل «شركة اسم ar» على هذا الجدول. |
| شركة اسم en | `companyNameEn` | String? | حقل «شركة اسم en» على هذا الجدول. |
| ضريبة | `taxId` | String? | مفتاح أجنبي يربط الصف بجدول «ضريبة». |
| commercial reg | `commercialReg` | String? | حقل «commercial reg» على هذا الجدول. |
| tagline | `tagline` | String? | حقل «tagline» على هذا الجدول. |
| footer text | `footerText` | String? | حقل «footer text» على هذا الجدول. |
| بنك details | `bankDetails` | Json? | حقل «بنك details» على هذا الجدول. |
| show qr كود | `showQrCode` | Boolean | علامة نعم/لا: show qr كود. |
| show stamp and signatures | `showStampAndSignatures` | Boolean | علامة نعم/لا: show stamp and signatures. |
| signature labels | `signatureLabels` | Json? | حقل «signature labels» على هذا الجدول. |
| watermark text | `watermarkText` | String? | حقل «watermark text» على هذا الجدول. |
| column إعدادات | `columnSettings` | Json? | حقل «column إعدادات» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.

### 266. إعداد واتساب الشركة (`company_whatsapp_configs`)

موديل: `CompanyWhatsappConfig` · 9 عمود · 1 علاقة

**إيه الجدول؟** رقم وربط واتساب الرسمي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعداد واتساب الشركة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| phone رقم | `phoneNumberId` | String | مفتاح أجنبي يربط الصف بجدول «phone رقم». |
| waba | `wabaId` | String? | مفتاح أجنبي يربط الصف بجدول «waba». |
| access token | `accessToken` | String | حقل «access token» على هذا الجدول. |
| webhook verify token | `webhookVerifyToken` | String | حقل «webhook verify token» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

## مستخدمين وصلاحيات

من يدخل، على أنهي فرع، وبأي صلاحية ترحيل/تعديل.

### 15. المستخدمون (`users`)

موديل: `User` · 13 عمود · 11 علاقة

**إيه الجدول؟** حسابات الدخول للشركة الحالية.

**امتى بيتستخدم؟** الصلاحيات والمجموعات والفروع بتتعلق بالمستخدم من هنا.

**الشاشات:** المستخدمون

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| البريد | `email` | String | بريد الدخول أو التواصل. |
| username | `username` | String | حقل «username» على هذا الجدول. |
| password hash | `passwordHash` | String | حقل «password hash» على هذا الجدول. |
| first اسم | `firstName` | String? | حقل «first اسم» على هذا الجدول. |
| last اسم | `lastName` | String? | حقل «last اسم» على هذا الجدول. |
| الهاتف | `phone` | String? | رقم التواصل. |
| preferred language | `preferredLanguage` | String? | حقل «preferred language» على هذا الجدول. |
| avatar url | `avatarUrl` | String? | حقل «avatar url» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` فرع permissions → صلاحية المستخدم على الفرع: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية المستخدم على الفرع».
- `1-N` مجموعة memberships → أعضاء المجموعة: هذا الجدول أب: صف واحد هنا له أكثر من «أعضاء المجموعة».
- `1-N` permissions → صلاحيات الشاشات: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحيات الشاشات».
- `1-N` advanced permissions → صلاحيات متقدمة: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحيات متقدمة».
- `1-N` system notifications → إشعارات النظام: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات النظام».
- `1-N` معتمد وحدة resales → تنازل/إعادة بيع وحدة: هذا الجدول أب: صف واحد هنا له أكثر من «تنازل/إعادة بيع وحدة».
- `1-N` ai conversations → محادثات المساعد: هذا الجدول أب: صف واحد هنا له أكثر من «محادثات المساعد».
- `1-N` ai مراجعة logs → سجل تدقيق الذكاء الاصطناعي: هذا الجدول أب: صف واحد هنا له أكثر من «سجل تدقيق الذكاء الاصطناعي».
- `1-N` ai documents → مستندات معرفة الذكاء: هذا الجدول أب: صف واحد هنا له أكثر من «مستندات معرفة الذكاء».
- `1-N` جولة تقدّم → تقدّم جولة المنتج: هذا الجدول أب: صف واحد هنا له أكثر من «تقدّم جولة المنتج».

### 18. صلاحية المستخدم على الفرع (`user_branch_permissions`)

موديل: `UserBranchPermission` · 6 عمود · 2 علاقة

**إيه الجدول؟** مين يدخل أنهي فرع.

**امتى بيتستخدم؟** منع الترحيل على فرع مش مسموح.

**الشاشات:** صلاحيات الفروع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الفرع | `branchId` | String | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.
- `N-1` فرع → الفروع: كل صف هنا مربوط بصف واحد من «الفروع» عبر branchId.

### 19. مجموعات المستخدمين (`user_groups`)

موديل: `UserGroup` · 16 عمود · 2 علاقة

**إيه الجدول؟** حزمة صلاحيات تتقسم على ناس.

**امتى بيتستخدم؟** تعريف مجموعة محاسب / أمين مخزن.

**الشاشات:** المجموعات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). passwordName |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| password | `password` | String? | Group password (optional) |
| سعر list | `priceList` | String? | حقل «سعر list» على هذا الجدول. |
| hide prices in invoices | `hidePricesInInvoices` | Boolean? | حقل «hide prices in invoices» على هذا الجدول. |
| allow change دفع value | `allowChangePaymentValue` | Boolean? | حقل «allow change دفع value» على هذا الجدول. |
| نقطة بيع manager | `posManager` | Boolean? | حقل «نقطة بيع manager» على هذا الجدول. |
| deactivate | `deactivate` | Boolean? | حقل «deactivate» على هذا الجدول. |
| طالب affairs | `studentAffairs` | Boolean? | حقل «طالب affairs» على هذا الجدول. |
| أتوبيس manager | `busManager` | Boolean? | حقل «أتوبيس manager» على هذا الجدول. |
| طالب accounts | `studentAccounts` | Boolean? | حقل «طالب accounts» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` users → أعضاء المجموعة: هذا الجدول أب: صف واحد هنا له أكثر من «أعضاء المجموعة».

### 20. أعضاء المجموعة (`user_group_members`)

موديل: `UserGroupMember` · 5 عمود · 2 علاقة

**إيه الجدول؟** ربط مستخدم بمجموعة.

**امتى بيتستخدم؟** إضافة/إزالة عضو.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| مستخدم مجموعة | `userGroupId` | String | مفتاح أجنبي يربط الصف بجدول «مستخدم مجموعة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.
- `N-1` مستخدم مجموعة → مجموعات المستخدمين: كل صف هنا مربوط بصف واحد من «مجموعات المستخدمين» عبر userGroupId.

### 21. صلاحيات الشاشات (`user_permissions`)

موديل: `UserPermission` · 10 عمود · 1 علاقة

**إيه الجدول؟** عرض/إضافة/تعديل/حذف/ترحيل لكل مورد.

**امتى بيتستخدم؟** تتتجمع من المجموعة + استثناءات المستخدم.

**الشاشات:** الصلاحيات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| resource | `resource` | String | Limited length for MySQL key constraints |
| إجراء | `action` | String | Limited length for MySQL key constraints |
| موديول | `module` | String? | Optional module filter, limited length |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. Optional branch filter |
| allow | `allow` | Boolean | حقل «allow» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.

### 22. صلاحيات متقدمة (`user_advanced_permissions`)

موديل: `UserAdvancedPermission` · 7 عمود · 1 علاقة

**إيه الجدول؟** بوابات ترحيل عائلات قديمة (RCPost شيكات…).

**امتى بيتستخدم؟** بتتنفذ قبل ترحيل الشيكات والسندات الحساسة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. Optional branch-specific permissions |
| permissions | `permissions` | Json | Flexible JSON for transfer/untransfer permissions |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.

### 53. صلاحية الخزينة/البنك (`bank_box_rights`)

موديل: `BankBoxRight` · 9 عمود · 3 علاقة

**إيه الجدول؟** مين يشوف أو يرحّل على صندوق أو حساب بنكي.

**امتى بيتستخدم؟** منع أمين صندوق من خزينة غيره.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| يقدر يشوف | `canView` | Boolean | صلاحية عرض. |
| يقدر يرحّل | `canPost` | Boolean | صلاحية ترحيل. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` خزينة → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر safeId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.

### 264. تقدّم جولة المنتج (`user_tour_progress`)

موديل: `UserTourProgress` · 10 عمود · 2 علاقة

**إيه الجدول؟** أنهي خطوة أكاديمية المستخدم خلّصها.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تقدّم جولة المنتج.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| موديول slug | `moduleSlug` | String | حقل «موديول slug» على هذا الجدول. |
| is completed | `isCompleted` | Boolean | علامة نعم/لا: is completed. |
| last step index | `lastStepIndex` | Int | حقل «last step index» على هذا الجدول. |
| dismissed count | `dismissedCount` | Int | حقل «dismissed count» على هذا الجدول. |
| completed at | `completedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.

## محاسبة وقيود

قلب الدفاتر: دليل، مراكز، قيود، أرصدة شهرية، أرصدة أطراف.

### 23. دليل الحسابات (`accounts`)

موديل: `Account` · 21 عمود · 34 علاقة

**إيه الجدول؟** شجرة الحسابات. HEADER للتفرع فقط، POSTING هو اللي القيد بيتحرك عليه.

**امتى بيتستخدم؟** إضافة حساب، شجرة الدليل، واختيار الحساب في كل المستندات.

**الشاشات:** دليل الحسابات · بطاقة حساب

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). Account code |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| تصنيف الحساب | `accountType` | String? | نص حر/كود: أصل، التزام، إيراد، مصروف… للتقارير. نوع الحساب |
| الأب | `parentId` | String? | صف الأب في الشجرة (حساب، مركز، مخزن، مجموعة). Parent account |
| جانب قديم | `accountSide` | String? | تسمية تراثية لمدين/دائن. مدين/دائن (legacy caption) |
| طبيعة الحساب | `accountNature` | AccountNature | DEBIT مدين أو CREDIT دائن. بتحدد شكل الرصيد. |
| نوع الحساب | `accountKind` | AccountKind | HEADER رئيسي يتفرّع منه / POSTING حساب حركة يتعمل عليه قيد. |
| أي قائمة | `statementType` | StatementType | BALANCE_SHEET ميزانية أو INCOME_STATEMENT قائمة دخل. |
| إلزام المركز (قديم) | `costCenterRequired` | String? | نص تراثي: إجباري/اختياري/بدون. إجباري/اختياري/بدون (legacy caption) |
| يلزم مركز تكلفة | `requiresCostCenter` | Boolean | لو true الترحيل يفشل من غير مركز على السطر. |
| مركز التكلفة الافتراضي | `defaultCostCenterId` | String? | يتملأ تلقائي لو الحساب بيلزم مركز. |
| جهة التحذير | `warning` | String? | مدين أو دائن أو بدون — ينبّه لو الرصيد انعكس. مدين/دائن/بدون |
| الميزانية | `budget` | Decimal? | رقم مستهدف يُقارن بالفعلي في تقرير الميزانية. |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` أب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر parentId.
- `1-N` children → دليل الحسابات: هذا الجدول أب: صف واحد هنا له أكثر من «دليل الحسابات».
- `N-0..1` افتراضي تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر defaultCostCenterId.
- `1-N` قيد حركة lines → سطور القيود: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القيود».
- `1-N` متكرر قيد lines → سطور القالب المتكرر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القالب المتكرر».
- `1-N` تكلفة مركز movements → حركة مراكز التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «حركة مراكز التكلفة».
- `1-N` عميل main accounts → العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «العملاء».
- `1-N` مورد main accounts → الموردون: هذا الجدول أب: صف واحد هنا له أكثر من «الموردون».
- `1-N` شخص main accounts → الأشخاص: هذا الجدول أب: صف واحد هنا له أكثر من «الأشخاص».
- `1-N` موظف سلفة accounts → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` safes as أستاذ → الخزائن: هذا الجدول أب: صف واحد هنا له أكثر من «الخزائن».
- `1-N` بنك accounts as أستاذ → الحسابات البنكية: هذا الجدول أب: صف واحد هنا له أكثر من «الحسابات البنكية».
- `1-N` cash معاملة offsets → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` cash معاملة lines → بنود سند الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «بنود سند الخزينة».
- `1-N` multi collection lines → تحصيل متعدد للأوراق: هذا الجدول أب: صف واحد هنا له أكثر من «تحصيل متعدد للأوراق».
- `1-N` تكلفة إضافية تكلفة allocations → توزيع التكلفة الإضافية: هذا الجدول أب: صف واحد هنا له أكثر من «توزيع التكلفة الإضافية».
- `1-N` حساب فترة balances → الأرصدة الشهرية للحسابات: هذا الجدول أب: صف واحد هنا له أكثر من «الأرصدة الشهرية للحسابات».
- `1-N` شركة إعدادات rounding → إعدادات الشركة: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات الشركة».
- `1-N` شركة إعدادات تحويل → إعدادات الشركة: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات الشركة».
- `1-N` فاتورة سطر revenue accounts → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` فاتورة adjustment accounts → تسويات على الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات على الفاتورة».
- `1-N` فاتورة adjustment offset accounts → تسويات على الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات على الفاتورة».
- `1-N` معاملة إعدادات sales → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` معاملة إعدادات purchase returns → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` معاملة إعدادات cash → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` معاملة إعدادات بنك أستاذ → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` معاملة إعدادات offset → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` معاملة إعدادات charges → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` مخزن inventory accounts → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».
- `1-N` مخزن تكلفة accounts → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».
- `1-N` مخزن gift accounts → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».

### 24. مراكز التكلفة (`cost_centers`)

موديل: `CostCenter` · 13 عمود · 24 علاقة

**إيه الجدول؟** شجرة مراكز (مشروع/إدارة). السطر المحاسبي يقدر يتعلّم بمركز.

**امتى بيتستخدم؟** بطاقة مركز، دليل المراكز، تقارير تحليل مراكز.

**الشاشات:** مراكز التكلفة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الأب | `parentId` | String? | صف الأب في الشجرة (حساب، مركز، مخزن، مجموعة). |
| كمية budget | `quantityBudget` | Decimal? | حقل «كمية budget» على هذا الجدول. |
| جهة التحذير | `warning` | String? | مدين أو دائن أو بدون — ينبّه لو الرصيد انعكس. مدين/دائن/بدون |
| الميزانية | `budget` | Decimal? | رقم مستهدف يُقارن بالفعلي في تقرير الميزانية. |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` أب → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر parentId.
- `1-N` children → مراكز التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «مراكز التكلفة».
- `1-N` movements → حركة مراكز التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «حركة مراكز التكلفة».
- `1-N` قيد حركة lines → سطور القيود: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القيود».
- `1-N` متكرر قيد lines → سطور القالب المتكرر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القالب المتكرر».
- `1-N` cash معاملة lines → بنود سند الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «بنود سند الخزينة».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` purchase orders → أوامر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر الشراء».
- `1-N` transfers من → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` transfers إلى → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` purchase return → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` سعر عرض → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».
- `1-N` موظف عقد → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».
- `1-N` contracting projects → مشاريع المقاولات: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع المقاولات».
- `1-N` عقاري عقار projects → مشاريع عقارية: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع عقارية».
- `1-N` عقار projects → مشاريع أملاك: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع أملاك».
- `1-N` دراسي grades → الصفوف الدراسية: هذا الجدول أب: صف واحد هنا له أكثر من «الصفوف الدراسية».
- `1-N` فاتورة lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` فاتورة adjustments → تسويات على الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات على الفاتورة».
- `1-N` مستند profiles → بروفايل المستند: هذا الجدول أب: صف واحد هنا له أكثر من «بروفايل المستند».
- `1-N` معاملة إعدادات → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` accounts as افتراضي → دليل الحسابات: هذا الجدول أب: صف واحد هنا له أكثر من «دليل الحسابات».

### 25. حركة مراكز التكلفة (`cost_center_movements`)

موديل: `CostCenterMovement` · 9 عمود · 3 علاقة

**إيه الجدول؟** نسخة من حركة كل حساب×مركز بنفس دقة سطر القيد.

**امتى بيتستخدم؟** أستاذ مركز التكلفة وأرصدة المراكز. بتتحدث مع الترحيل.

**الشاشات:** أستاذ مركز تكلفة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| مركز التكلفة | `costCenterId` | String | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| مدين | `debit` | Decimal | جانب المدين بعملة القيد. |
| دائن | `credit` | Decimal | جانب الدائن بعملة القيد. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.
- `N-1` تكلفة مركز → مراكز التكلفة: كل صف هنا مربوط بصف واحد من «مراكز التكلفة» عبر costCenterId.

### 26. قيود اليومية (`journal_entries`)

موديل: `JournalEntry` · 44 عمود · 36 علاقة

**إيه الجدول؟** رأس القيد: التاريخ، الرقم، مرحّل/ملغي، مصدر المستند.

**امتى بيتستخدم؟** يومية، دفتر أستاذ، وأي ترحيل مستند بيكتب هنا. المرحّل ما يتعدّلش؛ يتنعكس.

**الشاشات:** قيد اليومية · دفتر اليومية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| legacy أستاذ num | `legacyGlNum` | String? | حقل «legacy أستاذ num» على هذا الجدول. |
| رقم القيد/السند | `voucherNumber` | String? | الرقم الظاهر في اليومية أو سند الخزينة. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان عربي | `descriptionAr` | String? | شرح السطر بالعربي. |
| البيان إنجليزي | `descriptionEn` | String? | شرح السطر بالإنجليزي. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| ترحيل حالة | `postingStatus` | String | حقل «ترحيل حالة» على هذا الجدول. |
| مستند حالة | `documentStatus` | String | حقل «مستند حالة» على هذا الجدول. |
| حالة الاعتماد | `workflowStatus` | String | DRAFT → PENDING_APPROVAL → APPROVED → REJECTED → POSTED. |
| workflow submitted at | `workflowSubmittedAt` | DateTime? | ختم زمني لهذا الحدث. |
| مقدّم الاعتماد | `workflowSubmittedBy` | String? | مين رفع المستند للاعتماد. |
| workflow معتمد at | `workflowApprovedAt` | DateTime? | ختم زمني لهذا الحدث. |
| المعتمد | `workflowApprovedBy` | String? | مين وافق. |
| workflow rejected at | `workflowRejectedAt` | DateTime? | ختم زمني لهذا الحدث. |
| الرافض | `workflowRejectedBy` | String? | مين رفض. |
| workflow rejection reason | `workflowRejectionReason` | String? | حقل «workflow rejection reason» على هذا الجدول. |
| is balanced | `isBalanced` | Boolean | علامة نعم/لا: is balanced. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| is cyclic | `isCyclic` | Boolean | علامة نعم/لا: is cyclic. |
| is متكرر | `isRecurring` | Boolean | علامة نعم/لا: is متكرر. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| نوع المصدر | `sourceType` | String? | كود قصير: SI بيع، PI شراء، CR قبض، CKD إيداع شيك… |
| رقم المصدر | `sourceNumber` | String? | رقم المستند الأصلي المنسوخ على القيد. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| معرّف المصدر | `sourceId` | String? | UUID المستند اللي ولّد القيد. |
| تصنيف المصدر | `sourceKind` | JournalSourceType | MANUAL أو SALES_INVOICE أو STOCK_TRANSACTION… |
| حركة نوع | `entryType` | String? | حقل «حركة نوع» على هذا الجدول. |
| مفتاح المصدر النشط | `activeSourceKey` | String? | يمنع قيدين نشطين لنفس المستند. بيتفضى بعد فك الترحيل. |
| عكس أي قيد | `reversalOfJournalEntryId` | String? | لو الصف قيد عكسي، هنا القيد الأصلي. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| أنشأه | `createdBy` | String | المستخدم اللي فتح المستند أول مرة. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `1-N` lines → سطور القيود: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القيود».
- `1-N` violations → مخالفات الترحيل: هذا الجدول أب: صف واحد هنا له أكثر من «مخالفات الترحيل».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` شيك portfolio → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك deposit → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك clear → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك صرف → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك cancel → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك endorse → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` شيك bounce → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` ضريبة declarations → الإقرارات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الإقرارات الضريبية».
- `1-N` ضريبة settlements → تسويات الضريبة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات الضريبة».
- `1-N` نقطة بيع وردية end of day → ورديات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «ورديات نقطة البيع».
- `1-N` نقطة بيع orders → طلبات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «طلبات نقطة البيع».
- `1-N` فاتورة as primary → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` فاتورة as تكلفة → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` stock issues → إذن صرف: هذا الجدول أب: صف واحد هنا له أكثر من «إذن صرف».
- `1-N` stock receipts → إذن إضافة: هذا الجدول أب: صف واحد هنا له أكثر من «إذن إضافة».
- `1-N` stock transfers → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` stock adjustments → تسوية المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «تسوية المخزون».
- `1-N` stocktakings → الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «الجرد».
- `1-N` افتتاحي stocks as قيد → بضاعة أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «بضاعة أول المدة».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».
- `1-N` subcontract invoices → مطالبات الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مطالبات الباطن».
- `1-N` client invoices → فواتير/مطالبات العميل: هذا الجدول أب: صف واحد هنا له أكثر من «فواتير/مطالبات العميل».
- `1-N` مشروع letters of ضمان → خطابات ضمان المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات ضمان المشروع».
- `1-N` post dated cheques → شيكات آجلة للوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «شيكات آجلة للوحدات».
- `1-N` adjustment notes مرحّل → إشعارات تسوية مالية للمشروع: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات تسوية مالية للمشروع».
- `1-N` adjustment notes reversed → إشعارات تسوية مالية للمشروع: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات تسوية مالية للمشروع».
- `N-0..1` reversal of → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر reversalOfJournalEntryId.
- `N-0..1` reversed by → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية».

### 27. سطور القيود (`journal_entry_lines`)

موديل: `JournalEntryLine` · 20 عمود · 4 علاقة

**إيه الجدول؟** مدين/دائن + أساس + حساب + مركز + طرف اختياري.

**امتى بيتستخدم؟** قلب كل التقارير المالية. المجموع مدين = دائن.

**الشاشات:** سطور القيد

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| قيد اليومية | `journalEntryId` | String | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| رقم السطر | `lineNumber` | Int | ترتيب السطر داخل المستند، فريد مع رأس المستند. |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| البيان عربي | `descriptionAr` | String? | شرح السطر بالعربي. |
| البيان إنجليزي | `descriptionEn` | String? | شرح السطر بالإنجليزي. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| مدين | `debit` | Decimal | جانب المدين بعملة القيد. |
| دائن | `credit` | Decimal | جانب الدائن بعملة القيد. |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| مدين أساس | `debitBase` | Decimal | المدين بعد التحويل لعملة الشركة. ده اللي ميزان المراجعة بيجمعه. |
| دائن أساس | `creditBase` | Decimal | الدائن بعد التحويل لعملة الشركة. |
| ضريبة percent كود | `taxPercentCode` | String? | حقل «ضريبة percent كود» على هذا الجدول. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| الطرف على السطر | `partnerId` | String? | عميل أو مورد على سطر القيد (حساب مراقبة مشترك). |
| نوع الطرف | `partnerType` | String? | CUSTOMER أو SUPPLIER. |
| مقيّد بفاتورة | `isTiedToInvoice` | Boolean | السطر بيصفّي فاتورة معيّنة (open item). |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| رقم الفاتورة | `invoiceNumber` | String? | الرقم الظاهر للمستخدم، من مسلسل المستندات. |

**العلاقات:**

- `N-1` قيد حركة → قيود اليومية: كل صف هنا مربوط بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.

### 28. قوالب قيود متكررة (`recurring_journal_entries`)

موديل: `RecurringJournalEntry` · 10 عمود · 2 علاقة

**إيه الجدول؟** قالب مش قيد فعلي، بيتولد منه قيود حسب التكرار.

**امتى بيتستخدم؟** شاشة القيود المتكررة.

**الشاشات:** قيود متكررة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| template اسم ar | `templateNameAr` | String | حقل «template اسم ar» على هذا الجدول. |
| frequency | `frequency` | RecurringFrequency | حقل «frequency» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| last generated at | `lastGeneratedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `1-N` lines → سطور القالب المتكرر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القالب المتكرر».
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 29. سطور القالب المتكرر (`recurring_journal_lines`)

موديل: `RecurringJournalLine` · 7 عمود · 3 علاقة

**إيه الجدول؟** سطور القالب قبل ما يتحول لقيد حقيقي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور القالب المتكرر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| متكرر حركة | `recurringEntryId` | String | مفتاح أجنبي يربط الصف بجدول «متكرر حركة». |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| مدين | `debit` | Decimal | جانب المدين بعملة القيد. |
| دائن | `credit` | Decimal | جانب الدائن بعملة القيد. |

**العلاقات:**

- `N-1` متكرر حركة → قوالب قيود متكررة: كل صف هنا مربوط بصف واحد من «قوالب قيود متكررة» عبر recurringEntryId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.

### 30. الأرصدة الشهرية للحسابات (`account_period_balances`)

موديل: `AccountPeriodBalance` · 9 عمود · 2 علاقة

**إيه الجدول؟** ملخص مدين/دائن لكل حساب في شهر. بيتحدث ذرّيًا مع كل ترحيل.

**امتى بيتستخدم؟** ميزان المراجعة والميزانية لو مفيش فلتر فرع/مركز.

**الشاشات:** ميزان المراجعة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| مالي سنة | `fiscalYear` | Int | حقل «مالي سنة» على هذا الجدول. |
| فترة month | `periodMonth` | Int | حقل «فترة month» على هذا الجدول. |
| إجمالي مدين | `debitTotal` | Decimal | مجموع الفترة في ملخص الأرصدة. |
| إجمالي دائن | `creditTotal` | Decimal | مجموع الفترة في ملخص الأرصدة. |
| صافي الرصيد | `netBalance` | Decimal | مدين ناقص دائن أو العكس حسب طبيعة الحساب. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.

### 31. أرصدة العملاء والموردين (`partner_running_balances`)

موديل: `PartnerRunningBalance` · 13 عمود · 1 علاقة

**إيه الجدول؟** الرصيد الحي لكل طرف وعملة. ده المصدر التشغيلي مش حقل customers.balance.

**امتى بيتستخدم؟** كشف حساب، أعمار ديون، تطابق حساب المراقبة.

**الشاشات:** حسابات العملاء · حسابات الموردين

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الطرف على السطر | `partnerId` | String | عميل أو مورد على سطر القيد (حساب مراقبة مشترك). |
| نوع الطرف | `partnerType` | String | CUSTOMER أو SUPPLIER. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| مدين original | `debitOriginal` | Decimal | حقل «مدين original» على هذا الجدول. |
| ائتمان/دائن original | `creditOriginal` | Decimal | حقل «ائتمان/دائن original» على هذا الجدول. |
| صافي original | `netOriginal` | Decimal | حقل «صافي original» على هذا الجدول. |
| مدين أساس | `debitBase` | Decimal | المدين بعد التحويل لعملة الشركة. ده اللي ميزان المراجعة بيجمعه. |
| دائن أساس | `creditBase` | Decimal | الدائن بعد التحويل لعملة الشركة. |
| صافي base | `netBase` | Decimal | حقل «صافي base» على هذا الجدول. |
| last حركة تاريخ | `lastEntryDate` | DateTime? | حقل «last حركة تاريخ» على هذا الجدول. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 32. مخالفات الترحيل (`gl_posting_violations`)

موديل: `GlPostingViolation` · 8 عمود · 2 علاقة

**إيه الجدول؟** تسجيل ليه الترحيل فشل: حساب ناقص، مركز إجباري…

**امتى بيتستخدم؟** تشخيص أخطاء الترحيل.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| قيد اليومية | `journalEntryId` | String | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مخالفة نوع | `violationType` | String | حقل «مخالفة نوع» على هذا الجدول. |
| حساب كود | `accountCode` | String? | حقل «حساب كود» على هذا الجدول. |
| تكلفة مركز كود | `costCenterCode` | String? | حقل «تكلفة مركز كود» على هذا الجدول. |
| رسالة | `message` | String? | حقل «رسالة» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` قيد حركة → قيود اليومية: كل صف هنا مربوط بصف واحد من «قيود اليومية» عبر journalEntryId.

### 40. العملات (`currencies`)

موديل: `Currency` · 11 عمود · 5 علاقة

**إيه الجدول؟** عملات الشركة وسعر التحويل الحالي.

**امتى بيتستخدم؟** رأس أي مستند فيه عملة. الأساس في إعدادات الشركة.

**الشاشات:** تعريف العملات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | Int? | رقم تسلسلي إضافي أو بديل. |
| الكود | `code` | String | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). e.g., "EGP" |
| symbol | `symbol` | String? | حقل «symbol» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` purchase orders → أوامر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر الشراء».
- `1-N` purchase returns → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` سعر quotes → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».

### 49. تاريخ أسعار التحويل (`exchange_rate_histories`)

موديل: `ExchangeRateHistory` · 9 عمود · 1 علاقة

**إيه الجدول؟** سعر العملة في يوم معيّن.

**امتى بيتستخدم؟** لو حبيت تثبت سعر تاريخي مش السعر الحالي.

**الشاشات:** العملات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر | `rate` | Decimal | حقل «سعر» على هذا الجدول. |
| نوع المصدر | `sourceType` | String | كود قصير: SI بيع، PI شراء، CR قبض، CKD إيداع شيك… |
| معرّف المصدر | `sourceId` | String? | UUID المستند اللي ولّد القيد. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| recorded at | `recordedAt` | DateTime | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

## أطراف (عميل/مورد/مندوب)

كروت العملاء والموردين والمناديب والجداول المساعدة.

### 33. العملاء (`customers`)

موديل: `Customer` · 57 عمود · 27 علاقة

**إيه الجدول؟** كارت العميل: حد ائتمان، مدة سداد، حساب أستاذ، مندوب، قائمة أسعار.

**امتى بيتستخدم؟** بطاقة عميل، دليل العملاء، واختيار العميل في الفاتورة والسند.

**الشاشات:** بطاقة عميل · دليل العملاء

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| عميل نوع | `customerType` | String? | company/individual |
| how | `how` | String? | local/export/exempt |
| جنسية | `nationality` | String? | حقل «جنسية» على هذا الجدول. |
| ضريبة data | `taxData` | Boolean | حقل «ضريبة data» على هذا الجدول. |
| ضريبة authority | `taxAuthority` | String? | حقل «ضريبة authority» على هذا الجدول. |
| ضريبة authority اسم | `taxAuthorityName` | String? | حقل «ضريبة authority اسم» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| fax | `fax` | String? | حقل «fax» على هذا الجدول. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| website | `website` | String? | حقل «website» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| area | `area` | String? | حقل «area» على هذا الجدول. |
| street | `street` | String? | حقل «street» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| po box | `poBox` | String? | حقل «po box» على هذا الجدول. |
| الحساب الرئيسي للطرف | `mainAccountId` | String? | حساب العميل/المورد في الدليل. القيد بيتعمل عليه. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| المندوب/الممثل | `representativeId` | String? | نفس فكرة المندوب في تقارير أخرى. |
| قائمة الأسعار | `priceListId` | String? | الأسعار الافتراضية للعميل/العرض. |
| سعر شريحة | `priceTier` | PriceTier | حقل «سعر شريحة» على هذا الجدول. |
| linked مورد | `linkedSupplierId` | String? | مفتاح أجنبي يربط الصف بجدول «linked مورد». |
| selling سعر | `sellingPrice` | String? | حقل «selling سعر» على هذا الجدول. |
| معاملة نوع | `transactionType` | String? | حقل «معاملة نوع» على هذا الجدول. |
| جهة التحذير | `warning` | String? | مدين أو دائن أو بدون — ينبّه لو الرصيد انعكس. debtor/creditor |
| estimated budget | `estimatedBudget` | Decimal? | حقل «estimated budget» على هذا الجدول. |
| حد الائتمان | `creditLimit` | Decimal? | أقصى مديونية مسموحة للعميل. |
| دفع terms days | `paymentTermsDays` | Int? | حقل «دفع terms days» على هذا الجدول. |
| عميل تصنيف | `customerCategoryId` | String? | مفتاح أجنبي يربط الصف بجدول «عميل تصنيف». |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| رصيد | `balance` | Decimal | حقل «رصيد» على هذا الجدول. |
| contact تاريخ | `contactDate` | DateTime? | حقل «contact تاريخ» على هذا الجدول. |
| contact تاريخ hijri | `contactDateHijri` | String? | حقل «contact تاريخ hijri» على هذا الجدول. |
| gender | `gender` | String? | ذكر/أنثى |
| average سعر | `averagePrice` | Decimal? | حقل «average سعر» على هذا الجدول. |
| role | `role` | String? | الدور (الأول/الثاني/الثالث) |
| marketing channel | `marketingChannelId` | String? | مفتاح أجنبي يربط الصف بجدول «marketing channel». |
| rooms count | `roomsCount` | Int? | حقل «rooms count» على هذا الجدول. |
| عقار area | `propertyArea` | Decimal? | Real estate property area |
| bathrooms count | `bathroomsCount` | Int? | حقل «bathrooms count» على هذا الجدول. |
| facade | `facade` | String? | الواجهة |
| تحويل إلى | `transferTo` | String? | بائع/مدير مبيعات |
| موظف | `employeeId` | String? | الموظف المسؤول |
| follow up تاريخ | `followUpDate` | DateTime? | حقل «follow up تاريخ» على هذا الجدول. |
| follow up تاريخ hijri | `followUpDateHijri` | String? | حقل «follow up تاريخ hijri» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` main حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر mainAccountId.
- `N-0..1` linked مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر linkedSupplierId.
- `N-0..1` عميل تصنيف → تصنيفات العملاء: ربط اختياري بصف واحد من «تصنيفات العملاء» عبر customerCategoryId.
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` electronic فاتورة customers → عملاء الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «عملاء الإي-فاتورة».
- `1-N` سعر quotes → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` نقطة بيع orders → طلبات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «طلبات نقطة البيع».
- `1-N` نقطة بيع terminals افتراضي → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` securities receipts → أوراق قبض (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق قبض (أوراق مالية)».
- `1-N` securities payments → أوراق دفع (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق دفع (أوراق مالية)».
- `1-N` عميل followups → متابعة العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «متابعة العملاء».
- `1-N` عميل contracts → عقود العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «عقود العملاء».
- `1-N` contracting projects → مشاريع المقاولات: هذا الجدول أب: صف واحد هنا له أكثر من «مشاريع المقاولات».
- `1-N` client contracts → عقود العميل (مقاولات): هذا الجدول أب: صف واحد هنا له أكثر من «عقود العميل (مقاولات)».
- `1-N` وحدة contracts → عقود الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الوحدات».
- `1-N` عقاري عقار reservations → حجوزات الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «حجوزات الوحدات».
- `1-N` وحدة resales as seller → تنازل/إعادة بيع وحدة: هذا الجدول أب: صف واحد هنا له أكثر من «تنازل/إعادة بيع وحدة».
- `1-N` وحدة resales as buyer → تنازل/إعادة بيع وحدة: هذا الجدول أب: صف واحد هنا له أكثر من «تنازل/إعادة بيع وحدة».
- `1-N` تأجير صندوق إيجار agreements → اتفاقيات صندوق التأجير: هذا الجدول أب: صف واحد هنا له أكثر من «اتفاقيات صندوق التأجير».
- `1-N` مدرسة students → طلبة المدرسة (كارت مدرسي): هذا الجدول أب: صف واحد هنا له أكثر من «طلبة المدرسة (كارت مدرسي)».
- `N-0..1` linked by مورد → الموردون: ربط اختياري بصف واحد من «الموردون».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».

### 34. تصنيفات العملاء (`customer_categories`)

موديل: `CustomerCategory` · 8 عمود · 2 علاقة

**إيه الجدول؟** مجموعات عملاء للفلترة والتقارير.

**امتى بيتستخدم؟** فلتر أعمار الديون وتقارير الحسابات.

**الشاشات:** مجموعات العملاء

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy كود | `legacyCode` | String | حقل «legacy كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` customers → العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «العملاء».

### 35. تصنيفات الموردين (`supplier_categories`)

موديل: `SupplierCategory` · 8 عمود · 2 علاقة

**إيه الجدول؟** مجموعات موردين.

**امتى بيتستخدم؟** فلتر المشتريات وأعمار الدائنين.

**الشاشات:** مجموعات الموردين

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy كود | `legacyCode` | String | حقل «legacy كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` suppliers → الموردون: هذا الجدول أب: صف واحد هنا له أكثر من «الموردون».

### 36. عقود العملاء (`customer_contracts`)

موديل: `CustomerContract` · 12 عمود · 3 علاقة

**إيه الجدول؟** عقد تجاري مربوط بعميل (مش عقد وحدة عقارية).

**امتى بيتستخدم؟** متابعة التزامات العميل.

**الشاشات:** عقود العملاء

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| العميل | `customerId` | String | طرف القبض/البيع. |
| operations مركز | `operationsCenterId` | String? | مركز العمليات |
| عقد نوع | `contractType` | String? | نقدي/آجل/جزء نقدي وجزء آجل/حسب الصنف |
| cash percentage | `cashPercentage` | Decimal? | حقل «cash percentage» على هذا الجدول. |
| ائتمان/دائن percentage | `creditPercentage` | Decimal? | حقل «ائتمان/دائن percentage» على هذا الجدول. |
| days count | `daysCount` | Int? | حقل «days count» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.
- `1-N` groups → مجموعات عقود العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات عقود العملاء».

### 37. مجموعات عقود العملاء (`customer_contract_groups`)

موديل: `CustomerContractGroup` · 8 عمود · 2 علاقة

**إيه الجدول؟** تجميع عقود تحت مجموعة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مجموعات عقود العملاء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| عميل عقد | `customerContractId` | String | مفتاح أجنبي يربط الصف بجدول «عميل عقد». |
| تصنيف | `categoryId` | String? | مفتاح أجنبي يربط الصف بجدول «تصنيف». |
| مجموعة رقم | `groupNumber` | String? | حقل «مجموعة رقم» على هذا الجدول. |
| مجموعة اسم | `groupName` | String? | حقل «مجموعة اسم» على هذا الجدول. |
| days | `days` | Int? | حقل «days» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` عميل عقد → عقود العملاء: كل صف هنا مربوط بصف واحد من «عقود العملاء» عبر customerContractId.
- `N-0..1` تصنيف → مجموعات الأصناف: ربط اختياري بصف واحد من «مجموعات الأصناف» عبر categoryId.

### 38. الموردون (`suppliers`)

موديل: `Supplier` · 43 عمود · 19 علاقة

**إيه الجدول؟** كارت المورد وحساب الأستاذ وحد الائتمان.

**امتى بيتستخدم؟** فاتورة شراء، أمر شراء، سند صرف، أوراق دفع.

**الشاشات:** بطاقة مورد · دليل الموردين

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| مورد نوع | `supplierType` | String? | company/individual |
| how | `how` | String? | local/export/exempt |
| جنسية | `nationality` | String? | حقل «جنسية» على هذا الجدول. |
| ضريبة data | `taxData` | Boolean | حقل «ضريبة data» على هذا الجدول. |
| ضريبة authority | `taxAuthority` | String? | حقل «ضريبة authority» على هذا الجدول. |
| ضريبة authority اسم | `taxAuthorityName` | String? | حقل «ضريبة authority اسم» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| fax | `fax` | String? | حقل «fax» على هذا الجدول. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| website | `website` | String? | حقل «website» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| area | `area` | String? | حقل «area» على هذا الجدول. |
| street | `street` | String? | حقل «street» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| po box | `poBox` | String? | حقل «po box» على هذا الجدول. |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| file رقم | `fileNumber` | String? | رقم الملف |
| registration رقم | `registrationNumber` | String? | رقم التسجيل |
| financier | `financier` | String? | الممول |
| خصم نوع | `discountType` | String? | نوع الخصم |
| الحساب الرئيسي للطرف | `mainAccountId` | String? | حساب العميل/المورد في الدليل. القيد بيتعمل عليه. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| linked عميل | `linkedCustomerId` | String? | مفتاح أجنبي يربط الصف بجدول «linked عميل». |
| معاملة نوع | `transactionType` | String? | حقل «معاملة نوع» على هذا الجدول. |
| جهة التحذير | `warning` | String? | مدين أو دائن أو بدون — ينبّه لو الرصيد انعكس. debtor/creditor |
| estimated budget | `estimatedBudget` | Decimal? | حقل «estimated budget» على هذا الجدول. |
| حد الائتمان | `creditLimit` | Decimal? | أقصى مديونية مسموحة للعميل. |
| دفع terms days | `paymentTermsDays` | Int? | حقل «دفع terms days» على هذا الجدول. |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| مورد تصنيف | `supplierCategoryId` | String? | مفتاح أجنبي يربط الصف بجدول «مورد تصنيف». |
| رصيد | `balance` | Decimal | حقل «رصيد» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` main حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر mainAccountId.
- `N-0..1` مورد تصنيف → تصنيفات الموردين: ربط اختياري بصف واحد من «تصنيفات الموردين» عبر supplierCategoryId.
- `N-0..1` linked عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر linkedCustomerId.
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` purchase orders → أوامر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر الشراء».
- `1-N` purchase returns → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` صنف offers → عروض الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأصناف».
- `1-N` treasury receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` treasury payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` endorsed cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` securities receipts → أوراق قبض (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق قبض (أوراق مالية)».
- `1-N` securities payments → أوراق دفع (أوراق مالية): هذا الجدول أب: صف واحد هنا له أكثر من «أوراق دفع (أوراق مالية)».
- `1-N` electronic فاتورة customers → عملاء الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «عملاء الإي-فاتورة».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `N-0..1` linked by عميل → العملاء: ربط اختياري بصف واحد من «العملاء».
- `1-N` counterparty offsets → مقاصة طرفين: هذا الجدول أب: صف واحد هنا له أكثر من «مقاصة طرفين».

### 39. المندوبون (`delegates`)

موديل: `Delegate` · 30 عمود · 4 علاقة

**إيه الجدول؟** مندوب مبيعات: عمولة، منطقة، ربط مستخدم.

**امتى بيتستخدم؟** فاتورة البيع وتقارير المناديب.

**الشاشات:** بطاقة مندوب · دليل المندوبين

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| جنسية | `nationality` | String? | حقل «جنسية» على هذا الجدول. |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| fax | `fax` | String? | حقل «fax» على هذا الجدول. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| website | `website` | String? | حقل «website» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| area | `area` | String? | حقل «area» على هذا الجدول. |
| street | `street` | String? | حقل «street» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| po box | `poBox` | String? | حقل «po box» على هذا الجدول. |
| العنوان | `address` | String? | عنوان الطرف. |
| عمولة percentage | `commissionPercentage` | Decimal? | حقل «عمولة percentage» على هذا الجدول. |
| عمولة سياسة | `commissionPolicyId` | String? | مفتاح أجنبي يربط الصف بجدول «عمولة سياسة». |
| مجموعة | `groupId` | String? | مفتاح أجنبي يربط الصف بجدول «مجموعة». |
| sales commissions | `salesCommissionsId` | String? | مفتاح أجنبي يربط الصف بجدول «sales commissions». |
| قائمة الأسعار | `priceListId` | String? | الأسعار الافتراضية للعميل/العرض. |
| role | `role` | String | حقل «role» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` purchase return → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` سعر عرض → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».

### 181. متابعة العملاء (`customer_followups`)

موديل: `CustomerFollowup` · 15 عمود · 2 علاقة

**إيه الجدول؟** مهمة/اتصال متابعة على عميل.

**امتى بيتستخدم؟** من كارت العميل أو قائمة المتابعات.

**الشاشات:** متابعة عميل

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| العميل | `customerId` | String | طرف القبض/البيع. |
| عقار | `propertyId` | String? | مفتاح أجنبي يربط الصف بجدول «عقار». |
| followup تاريخ | `followupDate` | DateTime | حقل «followup تاريخ» على هذا الجدول. |
| followup تاريخ hijri | `followupDateHijri` | String? | حقل «followup تاريخ hijri» على هذا الجدول. |
| followup نوع | `followupType` | String? | call/visit/email/etc. |
| followup data | `followupData` | String? | حقل «followup data» على هذا الجدول. |
| next followup تاريخ | `nextFollowupDate` | DateTime? | حقل «next followup تاريخ» على هذا الجدول. |
| next followup تاريخ hijri | `nextFollowupDateHijri` | String? | حقل «next followup تاريخ hijri» على هذا الجدول. |
| الحالة | `status` | String? | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). active/completed/cancelled |
| موظف | `employeeId` | String? | مفتاح أجنبي يربط الصف بجدول «موظف». |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.

### 182. الجنسيات (`nationalities`)

موديل: `Nationality` · 8 عمود · 2 علاقة

**إيه الجدول؟** جدول مساعد لكارت الموظف/الطالب.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الجنسيات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».

### 183. الديانات (`religions`)

موديل: `Religion` · 8 عمود · 2 علاقة

**إيه الجدول؟** جدول مساعد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الديانات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».

### 184. الحالة الاجتماعية (`marital_statuses`)

موديل: `MaritalStatus` · 8 عمود · 2 علاقة

**إيه الجدول؟** جدول مساعد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الحالة الاجتماعية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».

### 185. المسميات الوظيفية (`job_titles`)

موديل: `JobTitle` · 8 عمود · 3 علاقة

**إيه الجدول؟** مسمى وظيفة الموظف.

**امتى بيتستخدم؟** يُختار على كارت الموظف والعقد.

**الشاشات:** الوظائف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».

### 186. الكادرات الوظيفية (`job_cadres`)

موديل: `JobCadre` · 8 عمود · 2 علاقة

**إيه الجدول؟** درجة/كابينة وظيفية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الكادرات الوظيفية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».

### 187. الإدارات (`departments`)

موديل: `Department` · 9 عمود · 6 علاقة

**إيه الجدول؟** إدارة الموظف أو مركز تنظيمي.

**امتى بيتستخدم؟** فلترة الموظفين وتقارير HR.

**الشاشات:** الإدارات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| management | `managementId` | String? | مفتاح أجنبي يربط الصف بجدول «management». |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».
- `1-N` employees → الموظفون: هذا الجدول أب: صف واحد هنا له أكثر من «الموظفون».
- `N-0..1` management → الإدارات: ربط اختياري بصف واحد من «الإدارات» عبر managementId.
- `1-N` sub departments → الإدارات: هذا الجدول أب: صف واحد هنا له أكثر من «الإدارات».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».

### 188. المدن (`cities`)

موديل: `City` · 8 عمود · 2 علاقة

**إيه الجدول؟** جدول مساعد للعناوين.

**امتى بيتستخدم؟** يُستخدم مع شاشات: المدن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».

### 196. المحصّلون (`collectors`)

موديل: `Collector` · 8 عمود · 1 علاقة

**إيه الجدول؟** شخص تحصيل أقساط/ديون.

**امتى بيتستخدم؟** يُستخدم مع شاشات: المحصّلون.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 246. الموزعون (`distributors`)

موديل: `Distributor` · 23 عمود · 1 علاقة

**إيه الجدول؟** كارت موزع (شبكة توزيع).

**امتى بيتستخدم؟** يُستخدم مع شاشات: إضافة مندوب — موزع.

**الشاشات:** إضافة مندوب — موزع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| جنسية | `nationality` | String? | حقل «جنسية» على هذا الجدول. |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| fax | `fax` | String? | حقل «fax» على هذا الجدول. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| website | `website` | String? | حقل «website» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| area | `area` | String? | حقل «area» على هذا الجدول. |
| street | `street` | String? | حقل «street» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| po box | `poBox` | String? | حقل «po box» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 247. السائقون (`drivers`)

موديل: `Driver` · 23 عمود · 1 علاقة

**إيه الجدول؟** كارت سائق للتوزيع/التوصيل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: السائقون.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| جنسية | `nationality` | String? | حقل «جنسية» على هذا الجدول. |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| phone1 | `phone1` | String? | حقل «phone1» على هذا الجدول. |
| phone2 | `phone2` | String? | حقل «phone2» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| fax | `fax` | String? | حقل «fax» على هذا الجدول. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| website | `website` | String? | حقل «website» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| area | `area` | String? | حقل «area» على هذا الجدول. |
| street | `street` | String? | حقل «street» على هذا الجدول. |
| postal كود | `postalCode` | String? | حقل «postal كود» على هذا الجدول. |
| po box | `poBox` | String? | حقل «po box» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 248. مجموعات الأشخاص (`person_groups`)

موديل: `PersonGroup` · 8 عمود · 2 علاقة

**إيه الجدول؟** تجميع أطراف عامة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مجموعات الأشخاص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy كود | `legacyCode` | String | حقل «legacy كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` persons → الأشخاص: هذا الجدول أب: صف واحد هنا له أكثر من «الأشخاص».

### 249. الأشخاص (`persons`)

موديل: `Person` · 12 عمود · 4 علاقة

**إيه الجدول؟** طرف عام مش لازم عميل أو مورد كلاسيكي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الأشخاص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| legacy كود | `legacyCode` | String | حقل «legacy كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| شخص مجموعة | `personGroupId` | String? | مفتاح أجنبي يربط الصف بجدول «شخص مجموعة». |
| الحساب الرئيسي للطرف | `mainAccountId` | String? | حساب العميل/المورد في الدليل. القيد بيتعمل عليه. |
| قائمة الأسعار | `priceListId` | String? | الأسعار الافتراضية للعميل/العرض. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` شخص مجموعة → مجموعات الأشخاص: ربط اختياري بصف واحد من «مجموعات الأشخاص» عبر personGroupId.
- `N-0..1` main حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر mainAccountId.
- `1-N` صنف prices → أسعار خاصة لشخص: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار خاصة لشخص».

### 250. أسعار خاصة لشخص (`person_item_prices`)

موديل: `PersonItemPrice` · 11 عمود · 4 علاقة

**إيه الجدول؟** سعر صنف مختلف لطرف معيّن.

**امتى بيتستخدم؟** يُستخدم مع شاشات: أسعار خاصة لشخص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| شخص | `personId` | String | مفتاح أجنبي يربط الصف بجدول «شخص». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String? | وحدة القياس على السطر (قطعة، كرتونة…). |
| سعر | `price` | Decimal | حقل «سعر» على هذا الجدول. |
| خصم pct | `discountPct` | Decimal? | حقل «خصم pct» على هذا الجدول. |
| valid من | `validFrom` | DateTime? | حقل «valid من» على هذا الجدول. |
| valid إلى | `validTo` | DateTime? | حقل «valid إلى» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` شخص → الأشخاص: كل صف هنا مربوط بصف واحد من «الأشخاص» عبر personId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر unitId.

## خزينة وبنوك وشيكات

خزينة، بنك، شيكات، أوراق مالية، تخصيص سداد، نقطة بيع.

### 42. البنوك (`banks`)

موديل: `Bank` · 8 عمود · 4 علاقة

**إيه الجدول؟** كارت البنك (اسم، سويفت…).

**امتى بيتستخدم؟** أبو الحسابات البنكية.

**الشاشات:** بطاقة بنك

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` بنك accounts → الحسابات البنكية: هذا الجدول أب: صف واحد هنا له أكثر من «الحسابات البنكية».
- `1-N` receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».

### 43. الحسابات البنكية (`bank_accounts`)

موديل: `BankAccount` · 14 عمود · 12 علاقة

**إيه الجدول؟** حساب تشغيلي مربوط بحساب أستاذ.

**امتى بيتستخدم؟** سندات بنك، شيكات صادرة، حركة بنك.

**الشاشات:** حساب بنكي

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| البنك | `bankId` | String | كارت البنك الأب. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| حساب رقم | `accountNumber` | String? | حقل «حساب رقم» على هذا الجدول. |
| iban | `iban` | String? | حقل «iban» على هذا الجدول. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| رصيد | `balance` | Decimal | حقل «رصيد» على هذا الجدول. |
| حساب الأستاذ | `glAccountId` | String? | حساب الدليل المربوط بالخزينة أو البنك أو المخزن. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` بنك → البنوك: كل صف هنا مربوط بصف واحد من «البنوك» عبر bankId.
- `N-0..1` أستاذ حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر glAccountId.
- `1-N` receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `1-N` بنك box rights → صلاحية الخزينة/البنك: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية الخزينة/البنك».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` نقطة بيع terminals → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `1-N` ضمان letters → خطابات الضمان (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان (مسار تجارة)».
- `1-N` مشروع letters of ضمان → خطابات ضمان المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات ضمان المشروع».

### 44. الخزائن (`safes`)

موديل: `Safe` · 11 عمود · 9 علاقة

**إيه الجدول؟** صناديق نقدية، كل صندوق له حساب GL.

**امتى بيتستخدم؟** سند قبض/صرف نقدي، تقرير الخزينة.

**الشاشات:** بطاقة خزينة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| رصيد | `balance` | Decimal | حقل «رصيد» على هذا الجدول. |
| حساب الأستاذ | `glAccountId` | String? | حساب الدليل المربوط بالخزينة أو البنك أو المخزن. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` أستاذ حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر glAccountId.
- `1-N` receipts → سندات قبض قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات قبض قديمة».
- `1-N` payments → سندات صرف قديمة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات صرف قديمة».
- `1-N` بنك box rights → صلاحية الخزينة/البنك: هذا الجدول أب: صف واحد هنا له أكثر من «صلاحية الخزينة/البنك».
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` نقطة بيع terminals → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` branches افتراضي for → الفروع: هذا الجدول أب: صف واحد هنا له أكثر من «الفروع».
- `1-N` مستند profiles → بروفايل المستند: هذا الجدول أب: صف واحد هنا له أكثر من «بروفايل المستند».

### 45. سندات قبض قديمة (`treasury_receipts`)

موديل: `TreasuryReceipt` · 30 عمود · 10 علاقة

**إيه الجدول؟** جدول قبض أقدم. الشاشة الحالية غالبًا cash_transactions.

**امتى بيتستخدم؟** تقارير قبض تراثية وإيصالات مؤقتة.

**الشاشات:** سند قبض

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| رقم القيد/السند | `voucherNumber` | String? | الرقم الظاهر في اليومية أو سند الخزينة. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| قبض/إذن نوع | `receiptType` | String | 'cash' | 'bank' | 'safe' | 'party' |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |
| البنك | `bankId` | String? | كارت البنك الأب. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` خزينة → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر safeId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-0..1` cash معاملة → سندات وأوامر الخزينة: ربط اختياري بصف واحد من «سندات وأوامر الخزينة».
- `N-0..1` بنك → البنوك: ربط اختياري بصف واحد من «البنوك» عبر bankId.

### 46. سندات صرف قديمة (`treasury_payments`)

موديل: `TreasuryPayment` · 30 عمود · 10 علاقة

**إيه الجدول؟** جدول صرف أقدم موازي للقبض القديم.

**امتى بيتستخدم؟** تقارير صرف تراثية.

**الشاشات:** سند صرف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| رقم القيد/السند | `voucherNumber` | String? | الرقم الظاهر في اليومية أو سند الخزينة. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| دفع نوع | `paymentType` | String | 'cash' | 'bank' | 'safe' | 'party' |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |
| البنك | `bankId` | String? | كارت البنك الأب. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` خزينة → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر safeId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-0..1` cash معاملة → سندات وأوامر الخزينة: ربط اختياري بصف واحد من «سندات وأوامر الخزينة».
- `N-0..1` بنك → البنوك: ربط اختياري بصف واحد من «البنوك» عبر bankId.

### 47. سندات وأوامر الخزينة (`cash_transactions`)

موديل: `CashTransaction` · 41 عمود · 20 علاقة

**إيه الجدول؟** المستند الموحّد: قبض أو صرف، أمر أو سند فعلي.

**امتى بيتستخدم؟** أمر صرف/توريد، سند قبض/صرف نقدي أو بنكي. الأمر PENDING لحد ما سند يتنفّذه.

**الشاشات:** سند قبض · سند صرف · أمر صرف · أمر توريد

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| نوع الحركة | `transactionKind` | String | RECEIPT قبض أو PAYMENT صرف. |
| رقم القيد/السند | `voucherNumber` | String? | الرقم الظاهر في اليومية أو سند الخزينة. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الحساب المقابل | `offsetAccountId` | String? | الطرف الثاني في السند (عميل، إيراد، مصروف…). |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| بنك reference | `bankReference` | String? | حقل «بنك reference» على هذا الجدول. |
| value تاريخ | `valueDate` | DateTime? | حقل «value تاريخ» على هذا الجدول. |
| is متكرر | `isRecurring` | Boolean | علامة نعم/لا: is متكرر. |
| دور المستند | `documentRole` | String | ORDER أمر تنفيذ أو VOUCHER السند الفعلي اللي بيترحّل. |
| إدارة | `departmentId` | String? | مفتاح أجنبي يربط الصف بجدول «إدارة». |
| الأمر المصدر | `sourceOrderId` | String? | السند اتنفّذ من أمر قبض/صرف. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| treasury قبض/إذن | `treasuryReceiptId` | String? | مفتاح أجنبي يربط الصف بجدول «treasury قبض/إذن». |
| treasury دفع | `treasuryPaymentId` | String? | مفتاح أجنبي يربط الصف بجدول «treasury دفع». |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| حالة تنفيذ الأمر | `executionStatus` | OrderExecutionStatus | PENDING منتظر / COMPLETED اتنفّذ بسند / CANCELLED. |
| executed at | `executedAt` | DateTime? | ختم زمني لهذا الحدث. |
| executed by | `executedBy` | String? | حقل «executed by» على هذا الجدول. |
| أنشأه | `createdBy` | String? | المستخدم اللي فتح المستند أول مرة. |
| حالة الاعتماد | `workflowStatus` | String | DRAFT → PENDING_APPROVAL → APPROVED → REJECTED → POSTED. |
| approval state | `approvalState` | Json? | حقل «approval state» على هذا الجدول. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |
| فاتورة قسط | `invoiceInstallmentId` | String? | مفتاح أجنبي يربط الصف بجدول «فاتورة قسط». |

**العلاقات:**

- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` offset حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر offsetAccountId.
- `N-0..1` خزينة → الخزائن: ربط اختياري بصف واحد من «الخزائن» عبر safeId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.
- `N-0..1` فاتورة قسط → أقساط الفاتورة: ربط اختياري بصف واحد من «أقساط الفاتورة» عبر invoiceInstallmentId.
- `N-0..1` treasury قبض/إذن → سندات قبض قديمة: ربط اختياري بصف واحد من «سندات قبض قديمة» عبر treasuryReceiptId.
- `N-0..1` treasury دفع → سندات صرف قديمة: ربط اختياري بصف واحد من «سندات صرف قديمة» عبر treasuryPaymentId.
- `1-N` وحدة installments → أقساط الوحدة: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط الوحدة».
- `1-N` مدرسة مصروف دراسي installments → أقساط المصروفات: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط المصروفات».
- `1-N` دفع allocations → تخصيصات السداد: هذا الجدول أب: صف واحد هنا له أكثر من «تخصيصات السداد».
- `1-N` lines → بنود سند الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «بنود سند الخزينة».
- `N-0..1` إدارة → الإدارات: ربط اختياري بصف واحد من «الإدارات» عبر departmentId.
- `N-0..1` مصدر أمر → سندات وأوامر الخزينة: ربط اختياري بصف واحد من «سندات وأوامر الخزينة» عبر sourceOrderId.
- `1-N` vouchers من أمر → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».

### 48. بنود سند الخزينة (`cash_transaction_lines`)

موديل: `CashTransactionLine` · 15 عمود · 5 علاقة

**إيه الجدول؟** حسابات متعددة + مراكز + ربط فاتورة على نفس السند.

**امتى بيتستخدم؟** توزيع المبلغ على أكثر من حساب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| cash معاملة | `cashTransactionId` | String | مفتاح أجنبي يربط الصف بجدول «cash معاملة». |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| حركة side | `entrySide` | String | حقل «حركة side» على هذا الجدول. |
| مقيّد بفاتورة | `isTiedToInvoice` | Boolean | السطر بيصفّي فاتورة معيّنة (open item). |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` cash معاملة → سندات وأوامر الخزينة: كل صف هنا مربوط بصف واحد من «سندات وأوامر الخزينة» عبر cashTransactionId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.

### 50. تخصيصات السداد (`payment_allocations`)

موديل: `PaymentAllocation` · 9 عمود · 4 علاقة

**إيه الجدول؟** السند صفّى قد إيه من فاتورة معيّنة (open-item).

**امتى بيتستخدم؟** تحصيل فاتورة، أعمار الديون، المتبقي.

**الشاشات:** تحصيل فاتورة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| cash معاملة | `cashTransactionId` | String | مفتاح أجنبي يربط الصف بجدول «cash معاملة». |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| counterparty offset | `counterpartyOffsetId` | String? | مفتاح أجنبي يربط الصف بجدول «counterparty offset». |
| allocated مبلغ | `allocatedAmount` | Decimal | حقل «allocated مبلغ» على هذا الجدول. |
| allocated at | `allocatedAt` | DateTime | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` cash معاملة → سندات وأوامر الخزينة: كل صف هنا مربوط بصف واحد من «سندات وأوامر الخزينة» عبر cashTransactionId.
- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.
- `N-0..1` counterparty offset → مقاصة طرفين: ربط اختياري بصف واحد من «مقاصة طرفين» عبر counterpartyOffsetId.

### 51. مقاصة طرفين (`counterparty_offsets`)

موديل: `CounterpartyOffset` · 14 عمود · 7 علاقة

**إيه الجدول؟** تقفيل رصيد عميل مقابل مورد لنفس الجهة.

**امتى بيتستخدم؟** شاشة المقاصة.

**الشاشات:** مقاصة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| رقم القيد/السند | `voucherNumber` | String? | الرقم الظاهر في اليومية أو سند الخزينة. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| العميل | `customerId` | String | طرف القبض/البيع. |
| المورد | `supplierId` | String | طرف الدفع/الشراء. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| أنشأه | `createdBy` | String? | المستخدم اللي فتح المستند أول مرة. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.
- `N-1` مورد → الموردون: كل صف هنا مربوط بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` دفع allocations → تخصيصات السداد: هذا الجدول أب: صف واحد هنا له أكثر من «تخصيصات السداد».

### 52. الشيكات (`cheques`)

موديل: `Cheque` · 27 عمود · 16 علاقة

**إيه الجدول؟** دورة ورقة القبض/الدفع: في الخزينة، إيداع، تحصيل، تظهير، ارتداد، إلغاء.

**امتى بيتستخدم؟** صفحات أوراق القبض والدفع. كل حالة تولّد/تعكس قيد.

**الشاشات:** أوراق القبض · أوراق الدفع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| الاتجاه | `direction` | ChequeDirection | INWARD قبض وارد أو OUTWARD صرف صادر (شيكات). |
| الحالة | `status` | ChequeStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| رقم الشيك | `chequeNumber` | String | الرقم المطبوع على الورقة. |
| البنك المسحوب عليه | `bankName` | String? | اسم البنك المكتوب على الشيك. |
| تاريخ الاستحقاق | `dueDate` | DateTime? | متى يستحق الشيك أو القسط أو الفاتورة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| portfolio قيد حركة | `portfolioJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «portfolio قيد حركة». |
| deposit قيد حركة | `depositJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «deposit قيد حركة». |
| clear قيد حركة | `clearJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «clear قيد حركة». |
| صرف قيد حركة | `issueJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «صرف قيد حركة». |
| cancel قيد حركة | `cancelJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «cancel قيد حركة». |
| endorsed مورد | `endorsedSupplierId` | String? | مفتاح أجنبي يربط الصف بجدول «endorsed مورد». |
| endorse قيد حركة | `endorseJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «endorse قيد حركة». |
| bounce قيد حركة | `bounceJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «bounce قيد حركة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` endorsed مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر endorsedSupplierId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.
- `N-0..1` portfolio قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر portfolioJournalEntryId.
- `N-0..1` deposit قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر depositJournalEntryId.
- `N-0..1` clear قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر clearJournalEntryId.
- `N-0..1` صرف قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر issueJournalEntryId.
- `N-0..1` cancel قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر cancelJournalEntryId.
- `N-0..1` bounce قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر bounceJournalEntryId.
- `N-0..1` endorse قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر endorseJournalEntryId.
- `1-N` وحدة installments → أقساط الوحدة: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط الوحدة».

### 54. أوراق قبض (أوراق مالية) (`securities_receipts`)

موديل: `SecuritiesReceipt` · 31 عمود · 3 علاقة

**إيه الجدول؟** كمبيالة/سند إذني وارد.

**امتى بيتستخدم؟** شاشة الأوراق المالية الواردة.

**الشاشات:** أوراق قبض

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| قبض/إذن رقم | `receiptNumber` | String? | حقل «قبض/إذن رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| security نوع | `securityType` | String | 'check' | 'promissory-note' | 'bond' | 'other' |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| issuer اسم | `issuerName` | String? | علامة نعم/لا: issuer اسم. |
| issuer بنك | `issuerBank` | String? | علامة نعم/لا: issuer بنك. |
| security رقم | `securityNumber` | String? | حقل «security رقم» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime? | متى يستحق الشيك أو القسط أو الفاتورة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| entity اسم | `entityName` | String? | حقل «entity اسم» على هذا الجدول. |
| destination حساب | `destinationAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «destination حساب». |
| عمولة مبلغ | `commissionAmount` | Decimal? | حقل «عمولة مبلغ» على هذا الجدول. |
| عمولة حساب | `commissionAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «عمولة حساب». |
| is received | `isReceived` | Boolean | علامة نعم/لا: is received. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.

### 55. أوراق دفع (أوراق مالية) (`securities_payments`)

موديل: `SecuritiesPayment` · 31 عمود · 3 علاقة

**إيه الجدول؟** كمبيالة/سند صادر.

**امتى بيتستخدم؟** شاشة الأوراق المالية الصادرة.

**الشاشات:** أوراق دفع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| دفع رقم | `paymentNumber` | String? | حقل «دفع رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| security نوع | `securityType` | String | 'check' | 'promissory-note' | 'bond' | 'other' |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| payee اسم | `payeeName` | String? | حقل «payee اسم» على هذا الجدول. |
| payee بنك | `payeeBank` | String? | حقل «payee بنك» على هذا الجدول. |
| security رقم | `securityNumber` | String? | حقل «security رقم» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime? | متى يستحق الشيك أو القسط أو الفاتورة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| entity اسم | `entityName` | String? | حقل «entity اسم» على هذا الجدول. |
| destination حساب | `destinationAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «destination حساب». |
| عمولة مبلغ | `commissionAmount` | Decimal? | حقل «عمولة مبلغ» على هذا الجدول. |
| عمولة حساب | `commissionAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «عمولة حساب». |
| is paid | `isPaid` | Boolean | علامة نعم/لا: is paid. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.

### 56. تحصيل متعدد للأوراق (`multi_collection_lines`)

موديل: `MultiCollectionLine` · 11 عمود · 1 علاقة

**إيه الجدول؟** توزيع تحصيل ورقة على أكثر من حساب.

**امتى بيتستخدم؟** تحصيل متعدد.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| paper تصنيف | `paperKind` | String | PAYMENT | RECEIPT |
| paper | `paperId` | String | مفتاح أجنبي يربط الصف بجدول «paper». |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| collection تاريخ | `collectionDate` | DateTime | حقل «collection تاريخ» على هذا الجدول. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.

### 57. تجديد الأوراق (`securities_renewals`)

موديل: `SecuritiesRenewal` · 22 عمود · 1 علاقة

**إيه الجدول؟** تمديد تاريخ استحقاق ورقة مالية.

**امتى بيتستخدم؟** تجديد ورقة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| renewal رقم | `renewalNumber` | String? | حقل «renewal رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| original security | `originalSecurityId` | String? | Reference to receipt or payment |
| original security نوع | `originalSecurityType` | String? | 'receipt' | 'payment' |
| new due تاريخ | `newDueDate` | DateTime? | حقل «new due تاريخ» على هذا الجدول. |
| new مبلغ | `newAmount` | Decimal? | حقل «new مبلغ» على هذا الجدول. |
| renewal مصروف دراسي | `renewalFee` | Decimal? | حقل «renewal مصروف دراسي» على هذا الجدول. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 164. شيكات آجلة للوحدات (`post_dated_cheques`)

موديل: `PostDatedCheque` · 15 عمود · 4 علاقة

**إيه الجدول؟** شيكات أقساط عقارية (مش محفظة الخزينة العامة).

**امتى بيتستخدم؟** يُستخدم مع شاشات: شيكات آجلة للوحدات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| وحدة عقد | `unitContractId` | String | مفتاح أجنبي يربط الصف بجدول «وحدة عقد». |
| وحدة قسط | `unitInstallmentId` | String? | مفتاح أجنبي يربط الصف بجدول «وحدة قسط». |
| رقم الشيك | `chequeNumber` | String | الرقم المطبوع على الورقة. |
| البنك المسحوب عليه | `bankName` | String | اسم البنك المكتوب على الشيك. |
| drawer اسم | `drawerName` | String | حقل «drawer اسم» على هذا الجدول. |
| شيك تاريخ | `chequeDate` | DateTime | حقل «شيك تاريخ» على هذا الجدول. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| الحالة | `status` | PostDatedChequeStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| collection تاريخ | `collectionDate` | DateTime? | حقل «collection تاريخ» على هذا الجدول. |
| bounced reason | `bouncedReason` | String? | حقل «bounced reason» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` عقد → عقود الوحدات: كل صف هنا مربوط بصف واحد من «عقود الوحدات» عبر unitContractId.
- `N-0..1` قسط → أقساط الوحدة: ربط اختياري بصف واحد من «أقساط الوحدة» عبر unitInstallmentId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.

### 223. نقاط البيع (`pos_terminals`)

موديل: `PosTerminal` · 12 عمود · 7 علاقة

**إيه الجدول؟** جهاز/صندوق POS.

**امتى بيتستخدم؟** يُستخدم مع شاشات: نقاط البيع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الخزينة | `safeId` | String | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| افتراضي عميل | `defaultCustomerId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي عميل». |
| الاسم | `name` | String | اسم الصف. |
| device كود | `deviceCode` | String? | حقل «device كود» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فرع → الفروع: كل صف هنا مربوط بصف واحد من «الفروع» عبر branchId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-1` خزينة → الخزائن: كل صف هنا مربوط بصف واحد من «الخزائن» عبر safeId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` افتراضي عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر defaultCustomerId.
- `1-N` shifts → ورديات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «ورديات نقطة البيع».

### 224. ورديات نقطة البيع (`pos_shifts`)

موديل: `PosShift` · 23 عمود · 6 علاقة

**إيه الجدول؟** فتح/قفل وردية مع جرد نقدية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: ورديات نقطة البيع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| terminal | `terminalId` | String | مفتاح أجنبي يربط الصف بجدول «terminal». |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| وردية رقم | `shiftNumber` | String? | حقل «وردية رقم» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| opened at | `openedAt` | DateTime | ختم زمني لهذا الحدث. |
| closed at | `closedAt` | DateTime? | ختم زمني لهذا الحدث. |
| افتتاحي cash | `openingCash` | Decimal | حقل «افتتاحي cash» على هذا الجدول. |
| ختامي cash declared | `closingCashDeclared` | Decimal? | حقل «ختامي cash declared» على هذا الجدول. |
| ختامي cash system | `closingCashSystem` | Decimal? | حقل «ختامي cash system» على هذا الجدول. |
| cash variance | `cashVariance` | Decimal? | حقل «cash variance» على هذا الجدول. |
| إجمالي cash sales | `totalCashSales` | Decimal | حقل «إجمالي cash sales» على هذا الجدول. |
| إجمالي card sales | `totalCardSales` | Decimal | حقل «إجمالي card sales» على هذا الجدول. |
| إجمالي ائتمان/دائن sales | `totalCreditSales` | Decimal | حقل «إجمالي ائتمان/دائن sales» على هذا الجدول. |
| إجمالي merchandise | `totalMerchandise` | Decimal | حقل «إجمالي merchandise» على هذا الجدول. |
| إجمالي ضريبة مبلغ | `totalTaxAmount` | Decimal | حقل «إجمالي ضريبة مبلغ» على هذا الجدول. |
| إجمالي cogs | `totalCogs` | Decimal | حقل «إجمالي cogs» على هذا الجدول. |
| end of day قيد حركة | `endOfDayJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «end of day قيد حركة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فرع → الفروع: كل صف هنا مربوط بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-1` terminal → نقاط البيع: كل صف هنا مربوط بصف واحد من «نقاط البيع» عبر terminalId.
- `N-0..1` end of day قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر endOfDayJournalEntryId.
- `1-N` orders → طلبات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «طلبات نقطة البيع».

### 225. طلبات نقطة البيع (`pos_orders`)

موديل: `PosOrder` · 23 عمود · 8 علاقة

**إيه الجدول؟** إيصال بيع سريع، يقدر يتحول لفاتورة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: طلبات نقطة البيع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| وردية | `shiftId` | String | مفتاح أجنبي يربط الصف بجدول «وردية». |
| أمر رقم | `orderNumber` | String | حقل «أمر رقم» على هذا الجدول. |
| أمر نوع | `orderType` | String | حقل «أمر نوع» على هذا الجدول. |
| original أمر | `originalOrderId` | String? | مفتاح أجنبي يربط الصف بجدول «original أمر». |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| barcode ref | `barcodeRef` | String? | حقل «barcode ref» على هذا الجدول. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| الخصم | `discountAmount` | Decimal | قيمة الخصم على الرأس أو السطر. |
| الضريبة | `taxAmount` | Decimal | قيمة الضريبة المحسوبة. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| cash مبلغ | `cashAmount` | Decimal | حقل «cash مبلغ» على هذا الجدول. |
| card مبلغ | `cardAmount` | Decimal | حقل «card مبلغ» على هذا الجدول. |
| ائتمان/دائن مبلغ | `creditAmount` | Decimal | حقل «ائتمان/دائن مبلغ» على هذا الجدول. |
| دفع method | `paymentMethod` | String | حقل «دفع method» على هذا الجدول. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` وردية → ورديات نقطة البيع: كل صف هنا مربوط بصف واحد من «ورديات نقطة البيع» عبر shiftId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` original أمر → طلبات نقطة البيع: ربط اختياري بصف واحد من «طلبات نقطة البيع» عبر originalOrderId.
- `1-N` returns → طلبات نقطة البيع: هذا الجدول أب: صف واحد هنا له أكثر من «طلبات نقطة البيع».
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور طلب POS: هذا الجدول أب: صف واحد هنا له أكثر من «سطور طلب POS».
- `1-N` e فاتورة documents → مستندات البوابة الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «مستندات البوابة الضريبية».

### 226. سطور طلب POS (`pos_order_lines`)

موديل: `PosOrderLine` · 13 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور طلب POS.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| أمر | `orderId` | String | مفتاح أجنبي يربط الصف بجدول «أمر». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر | `price` | Decimal | حقل «سعر» على هذا الجدول. |
| خصم percent | `discountPercent` | Decimal? | حقل «خصم percent» على هذا الجدول. |
| الخصم | `discountAmount` | Decimal | قيمة الخصم على الرأس أو السطر. |
| ضريبة percent | `taxPercent` | Decimal | حقل «ضريبة percent» على هذا الجدول. |
| الضريبة | `taxAmount` | Decimal | قيمة الضريبة المحسوبة. |
| إجمالي السطر | `lineTotal` | Decimal | كمية × سعر بعد خصم السطر. |
| وحدة تكلفة | `unitCost` | Decimal | حقل «وحدة تكلفة» على هذا الجدول. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |

**العلاقات:**

- `N-1` أمر → طلبات نقطة البيع: كل صف هنا مربوط بصف واحد من «طلبات نقطة البيع» عبر orderId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.

## مخازن وأصناف

أصناف، مخازن، أذون، جرد، دفتر حركة، رصيد حي.

### 58. وحدات القياس (`units`)

موديل: `Unit` · 8 عمود · 14 علاقة

**إيه الجدول؟** قطعة، كجم، كرتونة…

**امتى بيتستخدم؟** بطاقة الصنف وتحويل الوحدات.

**الشاشات:** الوحدات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` صنف units → وحدات الصنف: هذا الجدول أب: صف واحد هنا له أكثر من «وحدات الصنف».
- `1-N` صنف prices → أسعار الأصناف في القائمة: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار الأصناف في القائمة».
- `1-N` فاتورة lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` فاتورة سطر base units → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` stocktaking lines → سطور الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الجرد».
- `1-N` purchase أمر lines → سطور أمر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أمر الشراء».
- `1-N` purchase أمر base units → سطور أمر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أمر الشراء».
- `1-N` سعر عرض lines → سطور عرض السعر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور عرض السعر».
- `1-N` سعر عرض base units → سطور عرض السعر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور عرض السعر».
- `1-N` صنف offers → عروض الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأصناف».
- `1-N` purchase return سطر → سطور مرتجع الشراء القديم: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مرتجع الشراء القديم».
- `1-N` شخص صنف prices → أسعار خاصة لشخص: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار خاصة لشخص».
- `1-N` نقطة بيع أمر lines → سطور طلب POS: هذا الجدول أب: صف واحد هنا له أكثر من «سطور طلب POS».

### 59. مجموعات الأصناف (`item_categories`)

موديل: `ItemCategory` · 16 عمود · 5 علاقة

**إيه الجدول؟** شجرة تصنيف الأصناف.

**امتى بيتستخدم؟** فلترة الأصناف والتقارير.

**الشاشات:** مجموعات الأصناف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| مجموعة نوع | `groupType` | String? | حقل «مجموعة نوع» على هذا الجدول. |
| أب تصنيف | `parentCategoryId` | String? | مفتاح أجنبي يربط الصف بجدول «أب تصنيف». |
| is featured | `isFeatured` | Boolean | علامة نعم/لا: is featured. |
| is ضريبة exempt | `isTaxExempt` | Boolean | علامة نعم/لا: is ضريبة exempt. |
| ضريبة سعر | `taxRate` | Decimal? | حقل «ضريبة سعر» على هذا الجدول. |
| افتراضي inventory حساب | `defaultInventoryAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي inventory حساب». |
| افتراضي sales حساب | `defaultSalesAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي sales حساب». |
| افتراضي cogs حساب | `defaultCogsAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي cogs حساب». |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` أب تصنيف → مجموعات الأصناف: ربط اختياري بصف واحد من «مجموعات الأصناف» عبر parentCategoryId.
- `1-N` فرع categories → مجموعات الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات الأصناف».
- `1-N` items → الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «الأصناف».
- `1-N` عقد groups → مجموعات عقود العملاء: هذا الجدول أب: صف واحد هنا له أكثر من «مجموعات عقود العملاء».

### 60. الأصناف (`items`)

موديل: `Item` · 66 عمود · 37 علاقة

**إيه الجدول؟** كارت الصنف: باركود، أسعار، تكلفة، حسابات مبيعات/تكلفة، خدمة أو مخزني.

**امتى بيتستخدم؟** كل فاتورة وإذن مخزن بيختار صنف من هنا.

**الشاشات:** بطاقة صنف · دليل الأصناف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الحساب الرئيسي للطرف | `mainAccountId` | String? | حساب العميل/المورد في الدليل. القيد بيتعمل عليه. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| specifications | `specifications` | String? | حقل «specifications» على هذا الجدول. |
| صنف نوع | `itemType` | String? | normal/pack-sheet/pack-kilo/roll |
| weight | `weight` | Decimal? | حقل «weight» على هذا الجدول. |
| تصنيف | `categoryId` | String? | مفتاح أجنبي يربط الصف بجدول «تصنيف». |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| sales حساب | `salesAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «sales حساب». |
| cogs حساب | `cogsAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «cogs حساب». |
| افتراضي ضريبة percent | `defaultTaxPercent` | Decimal? | حقل «افتراضي ضريبة percent» على هذا الجدول. |
| ضريبة exemption reason | `taxExemptionReason` | String? | حقل «ضريبة exemption reason» على هذا الجدول. |
| manufacturer | `manufacturerId` | String? | مفتاح أجنبي يربط الصف بجدول «manufacturer». |
| لون | `colorId` | String? | مفتاح أجنبي يربط الصف بجدول «لون». |
| country of origin | `countryOfOrigin` | String? | حقل «country of origin» على هذا الجدول. |
| quality | `quality` | String? | حقل «quality» على هذا الجدول. |
| مقاس | `size` | String? | حقل «مقاس» على هذا الجدول. |
| property1 | `property1` | String? | حقل «property1» على هذا الجدول. |
| property2 | `property2` | String? | حقل «property2» على هذا الجدول. |
| property3 | `property3` | String? | حقل «property3» على هذا الجدول. |
| property4 | `property4` | String? | حقل «property4» على هذا الجدول. |
| property5 | `property5` | String? | حقل «property5» على هذا الجدول. |
| use expiration تاريخ | `useExpirationDate` | Boolean | حقل «use expiration تاريخ» على هذا الجدول. |
| inactive صنف | `inactiveItem` | Boolean | حقل «inactive صنف» على هذا الجدول. |
| not subject إلى terms | `notSubjectToTerms` | Boolean | حقل «not subject إلى terms» على هذا الجدول. |
| cannot be returned | `cannotBeReturned` | Boolean | علامة نعم/لا: cannot be returned. |
| no sell below تكلفة | `noSellBelowCost` | Boolean | حقل «no sell below تكلفة» على هذا الجدول. |
| use مسلسل رقم | `useSerialNumber` | Boolean | حقل «use مسلسل رقم» على هذا الجدول. |
| clothing صنف | `clothingItem` | Boolean | حقل «clothing صنف» على هذا الجدول. |
| upper limit | `upperLimit` | Decimal? | حقل «upper limit» على هذا الجدول. |
| أمر limit | `orderLimit` | Decimal? | حقل «أمر limit» على هذا الجدول. |
| أمر limit percentage | `orderLimitPercentage` | Decimal? | حقل «أمر limit percentage» على هذا الجدول. |
| lower limit | `lowerLimit` | Decimal? | حقل «lower limit» على هذا الجدول. |
| beginning رصيد | `beginningBalance` | Decimal? | حقل «beginning رصيد» على هذا الجدول. |
| beginning تكلفة سعر | `beginningCostPrice` | Decimal? | حقل «beginning تكلفة سعر» على هذا الجدول. |
| سعر retail | `priceRetail` | Decimal | حقل «سعر retail» على هذا الجدول. |
| سعر semi wholesale | `priceSemiWholesale` | Decimal | حقل «سعر semi wholesale» على هذا الجدول. |
| سعر wholesale | `priceWholesale` | Decimal | حقل «سعر wholesale» على هذا الجدول. |
| سعر projects | `priceProjects` | Decimal | حقل «سعر projects» على هذا الجدول. |
| is service | `isService` | Boolean | علامة نعم/لا: is service. |
| is تجميع | `isAssembly` | Boolean | علامة نعم/لا: is تجميع. |
| is ضريبة exempt | `isTaxExempt` | Boolean | علامة نعم/لا: is ضريبة exempt. |
| consumer سعر | `consumerPrice` | Decimal | حقل «consumer سعر» على هذا الجدول. |
| retail سعر | `retailPrice` | Decimal | حقل «retail سعر» على هذا الجدول. |
| representative سعر | `representativePrice` | Decimal | حقل «representative سعر» على هذا الجدول. |
| export سعر | `exportPrice` | Decimal | حقل «export سعر» على هذا الجدول. |
| متوسط التكلفة | `averageCost` | Decimal | تكلفة الوحدة المتحركة في المخزن. |
| last purchase سعر | `lastPurchasePrice` | Decimal | حقل «last purchase سعر» على هذا الجدول. |
| سعر mode | `priceMode` | String? | حقل «سعر mode» على هذا الجدول. |
| سعر عملة | `priceCurrency` | String? | حقل «سعر عملة» على هذا الجدول. |
| extra تجميع تكلفة | `extraAssemblyCost` | Decimal? | حقل «extra تجميع تكلفة» على هذا الجدول. |
| extra تجميع تكلفة pct | `extraAssemblyCostPct` | Decimal? | حقل «extra تجميع تكلفة pct» على هذا الجدول. |
| purchase count | `purchaseCount` | Int? | حقل «purchase count» على هذا الجدول. |
| min purchase qty | `minPurchaseQty` | Decimal? | حقل «min purchase qty» على هذا الجدول. |
| تجميع components | `assemblyComponents` | Json? | حقل «تجميع components» على هذا الجدول. |
| preferred suppliers | `preferredSuppliers` | Json? | حقل «preferred suppliers» على هذا الجدول. |
| image url | `imageUrl` | String? | حقل «image url» على هذا الجدول. |
| افتراضي مخزن | `defaultWarehouseId` | String? | مفتاح أجنبي يربط الصف بجدول «افتراضي مخزن». |
| سعر مصدر | `priceSource` | String? | price_list | item_card |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` تصنيف → مجموعات الأصناف: ربط اختياري بصف واحد من «مجموعات الأصناف» عبر categoryId.
- `1-N` units → وحدات الصنف: هذا الجدول أب: صف واحد هنا له أكثر من «وحدات الصنف».
- `1-N` prices → أسعار الأصناف في القائمة: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار الأصناف في القائمة».
- `1-N` quantities → كمية الصنف في الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «كمية الصنف في الموقع».
- `1-N` مخزن balances → رصيد الصنف في المخزن: هذا الجدول أب: صف واحد هنا له أكثر من «رصيد الصنف في المخزن».
- `1-N` فاتورة lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` electronic فاتورة items → أصناف الإي-فاتورة (كتالوج): هذا الجدول أب: صف واحد هنا له أكثر من «أصناف الإي-فاتورة (كتالوج)».
- `1-N` افتتاحي stock lines → سطور أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أول المدة».
- `1-N` stocktaking lines → سطور الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الجرد».
- `1-N` تحويل lines → سطور التحويل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التحويل».
- `1-N` assembled items → سطور ناتج التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «سطور ناتج التجميع».
- `1-N` مكون items → مكونات التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «مكونات التجميع».
- `1-N` disassembled items → سطور ناتج التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «سطور ناتج التفكيك».
- `1-N` disassembly components → مصدر التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «مصدر التفكيك».
- `1-N` قبض/إذن lines → سطور إذن الإضافة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الإضافة».
- `1-N` صرف lines → سطور إذن الصرف: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الصرف».
- `1-N` adjustment lines → سطور التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية».
- `1-N` other adjustment lines → سطور التسوية الأخرى: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية الأخرى».
- `1-N` purchase return lines → سطور مرتجع الشراء القديم: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مرتجع الشراء القديم».
- `1-N` سعر عرض lines → سطور عرض السعر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور عرض السعر».
- `1-N` صنف offers من → عروض الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأصناف».
- `1-N` صنف offers إلى → عروض الأصناف: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأصناف».
- `1-N` purchase أمر سطر → سطور أمر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أمر الشراء».
- `1-N` تكلفة تاريخ → تاريخ تكلفة الصنف: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ تكلفة الصنف».
- `1-N` inventory movements → دفتر حركة المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «دفتر حركة المخزون».
- `1-N` شخص صنف prices → أسعار خاصة لشخص: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار خاصة لشخص».
- `1-N` نقطة بيع أمر lines → سطور طلب POS: هذا الجدول أب: صف واحد هنا له أكثر من «سطور طلب POS».
- `1-N` lc قبض/إذن lines → سطور استلام بضاعة الاعتماد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور استلام بضاعة الاعتماد».
- `1-N` مكونات as finished → قوائم المكونات BOM: هذا الجدول أب: صف واحد هنا له أكثر من «قوائم المكونات BOM».
- `1-N` مكونات as raw → سطور قائمة المكونات: هذا الجدول أب: صف واحد هنا له أكثر من «سطور قائمة المكونات».
- `1-N` تشغيل finished → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `1-N` تشغيل صرف lines → سطور صرف الخام: هذا الجدول أب: صف واحد هنا له أكثر من «سطور صرف الخام».
- `1-N` تكلفة إضافية تكلفة تخصيص lines → سطور توزيع التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور توزيع التكلفة».
- `1-N` خامة reconciliation logs → مطابقة خامات الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «مطابقة خامات الموقع».
- `1-N` عمولة كمية lines → عمولة المندوب بالكمية: هذا الجدول أب: صف واحد هنا له أكثر من «عمولة المندوب بالكمية».
- `1-N` أمر limit lines → سطور حدود الطلب: هذا الجدول أب: صف واحد هنا له أكثر من «سطور حدود الطلب».

### 61. وحدات الصنف (`item_units`)

موديل: `ItemUnit` · 6 عمود · 2 علاقة

**إيه الجدول؟** وحدات بديلة للصنف ومعامل التحويل للأساس.

**امتى بيتستخدم؟** البيع بكرتونة والصرف بالقطعة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| conversion factor | `conversionFactor` | Decimal | حقل «conversion factor» على هذا الجدول. |
| is factor fixed | `isFactorFixed` | Boolean | علامة نعم/لا: is factor fixed. |
| is base وحدة | `isBaseUnit` | Boolean | علامة نعم/لا: is base وحدة. |

**العلاقات:**

- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.

### 62. قوائم الأسعار (`price_lists`)

موديل: `PriceList` · 12 عمود · 3 علاقة

**إيه الجدول؟** رأس قائمة أسعار.

**امتى بيتستخدم؟** تسعير عميل أو عرض.

**الشاشات:** قوائم الأسعار

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| خصم percentage | `discountPercentage` | Decimal? | حقل «خصم percentage» على هذا الجدول. |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر mode | `priceMode` | String? | حقل «سعر mode» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` prices → أسعار الأصناف في القائمة: هذا الجدول أب: صف واحد هنا له أكثر من «أسعار الأصناف في القائمة».
- `1-N` new modules → نسخ أنواع المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «نسخ أنواع المستندات».

### 63. أسعار الأصناف في القائمة (`item_prices`)

موديل: `ItemPrice` · 12 عمود · 3 علاقة

**إيه الجدول؟** سعر الصنف داخل قائمة.

**امتى بيتستخدم؟** يتملأ تلقائي في فاتورة البيع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| قائمة الأسعار | `priceListId` | String | الأسعار الافتراضية للعميل/العرض. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| سعر | `price` | Decimal | حقل «سعر» على هذا الجدول. |
| خصم | `discount` | Decimal? | حقل «خصم» على هذا الجدول. |
| wholesale | `wholesale` | Decimal? | حقل «wholesale» على هذا الجدول. |
| semi wholesale | `semiWholesale` | Decimal? | حقل «semi wholesale» على هذا الجدول. |
| export سعر | `exportPrice` | Decimal? | حقل «export سعر» على هذا الجدول. |
| representative سعر | `representativePrice` | Decimal? | حقل «representative سعر» على هذا الجدول. |
| retail سعر | `retailPrice` | Decimal? | حقل «retail سعر» على هذا الجدول. |
| consumer سعر | `consumerPrice` | Decimal? | حقل «consumer سعر» على هذا الجدول. |

**العلاقات:**

- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` سعر list → قوائم الأسعار: كل صف هنا مربوط بصف واحد من «قوائم الأسعار» عبر priceListId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.

### 64. المخازن (`warehouses`)

موديل: `Warehouse` · 17 عمود · 36 علاقة

**إيه الجدول؟** شجرة مخازن + حساب مخزون وتكلفة وهدايا.

**امتى بيتستخدم؟** كل حركة مخزنية وفاتورة تختار مخزن.

**الشاشات:** بطاقة مخزن

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| legacy store كود | `legacyStoreCode` | String? | حقل «legacy store كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| store نوع | `storeType` | String? | حقل «store نوع» على هذا الجدول. |
| المخزن الأب | `parentWarehouseId` | String? | لو المخزن فرع من مخزن أكبر. |
| inventory حساب | `inventoryAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «inventory حساب». |
| تكلفة حساب | `costAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «تكلفة حساب». |
| gift حساب | `giftAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «gift حساب». |
| العنوان | `address` | String? | عنوان الطرف. |
| keeper اسم | `keeperName` | String? | حقل «keeper اسم» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` أب مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر parentWarehouseId.
- `1-N` فرع warehouses → المخازن: هذا الجدول أب: صف واحد هنا له أكثر من «المخازن».
- `N-0..1` inventory حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر inventoryAccountId.
- `N-0..1` تكلفة حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر costAccountId.
- `N-0..1` gift حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر giftAccountId.
- `1-N` branches افتراضي for → الفروع: هذا الجدول أب: صف واحد هنا له أكثر من «الفروع».
- `1-N` locations → مواقع داخل المخزن: هذا الجدول أب: صف واحد هنا له أكثر من «مواقع داخل المخزن».
- `1-N` quantities → كمية الصنف في الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «كمية الصنف في الموقع».
- `1-N` مخزن balances → رصيد الصنف في المخزن: هذا الجدول أب: صف واحد هنا له أكثر من «رصيد الصنف في المخزن».
- `1-N` invoices → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` افتتاحي stock lines → سطور أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أول المدة».
- `1-N` stocktaking → الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «الجرد».
- `1-N` stocktaking lines → سطور الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الجرد».
- `1-N` transfers من → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` transfers إلى → التحويل المخزني: هذا الجدول أب: صف واحد هنا له أكثر من «التحويل المخزني».
- `1-N` assemblies → التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «التجميع».
- `1-N` disassemblies → التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «التفكيك».
- `1-N` receipts → إذن إضافة: هذا الجدول أب: صف واحد هنا له أكثر من «إذن إضافة».
- `1-N` issues → إذن صرف: هذا الجدول أب: صف واحد هنا له أكثر من «إذن صرف».
- `1-N` adjustments → تسوية المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «تسوية المخزون».
- `1-N` other adjustments → تسويات مخزنية أخرى: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات مخزنية أخرى».
- `1-N` purchase orders → أوامر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر الشراء».
- `1-N` purchase returns → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `1-N` سعر quotes → عروض الأسعار: هذا الجدول أب: صف واحد هنا له أكثر من «عروض الأسعار».
- `1-N` inventory movements → دفتر حركة المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «دفتر حركة المخزون».
- `1-N` new موديول stores → مخازن الموديول: هذا الجدول أب: صف واحد هنا له أكثر من «مخازن الموديول».
- `1-N` نقطة بيع terminals → نقاط البيع: هذا الجدول أب: صف واحد هنا له أكثر من «نقاط البيع».
- `1-N` letters of ائتمان/دائن → خطابات الاعتماد (مسار تجارة): هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الاعتماد (مسار تجارة)».
- `1-N` تشغيل orders raw → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `1-N` تشغيل orders finished → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».
- `1-N` فاتورة lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` مستند profiles → بروفايل المستند: هذا الجدول أب: صف واحد هنا له أكثر من «بروفايل المستند».
- `1-N` معاملة إعدادات → إعدادات حركة المستند: هذا الجدول أب: صف واحد هنا له أكثر من «إعدادات حركة المستند».
- `1-N` صنف أمر limit lists → قوائم حدود الطلب: هذا الجدول أب: صف واحد هنا له أكثر من «قوائم حدود الطلب».

### 65. مواقع داخل المخزن (`locations`)

موديل: `Location` · 7 عمود · 12 علاقة

**إيه الجدول؟** رف/موقع داخل المخزن.

**امتى بيتستخدم؟** كمية الصنف على الموقع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `1-N` quantities → كمية الصنف في الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «كمية الصنف في الموقع».
- `1-N` افتتاحي stock lines → سطور أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أول المدة».
- `1-N` stocktaking lines → سطور الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الجرد».
- `1-N` تحويل lines من → سطور التحويل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التحويل».
- `1-N` تحويل lines إلى → سطور التحويل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التحويل».
- `1-N` قبض/إذن lines → سطور إذن الإضافة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الإضافة».
- `1-N` صرف lines → سطور إذن الصرف: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الصرف».
- `1-N` adjustment lines → سطور التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية».
- `1-N` other adjustment lines → سطور التسوية الأخرى: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية الأخرى».
- `1-N` purchase return سطر → سطور مرتجع الشراء القديم: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مرتجع الشراء القديم».
- `1-N` inventory movements → دفتر حركة المخزون: هذا الجدول أب: صف واحد هنا له أكثر من «دفتر حركة المخزون».

### 66. كمية الصنف في الموقع (`item_quantities`)

موديل: `ItemQuantity` · 5 عمود · 3 علاقة

**إيه الجدول؟** تفصيل الرصيد على الموقع مش المخزن كله.

**امتى بيتستخدم؟** جرد دقيق.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |

**العلاقات:**

- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 67. قوائم حدود الطلب (`item_order_limit_lists`)

موديل: `ItemOrderLimitList` · 8 عمود · 3 علاقة

**إيه الجدول؟** رأس قائمة حد أدنى/أقصى للطلب.

**امتى بيتستخدم؟** تنبيه إعادة الطلب.

**الشاشات:** حدود الطلب

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `1-N` lines → سطور حدود الطلب: هذا الجدول أب: صف واحد هنا له أكثر من «سطور حدود الطلب».

### 68. سطور حدود الطلب (`item_order_limit_lines`)

موديل: `ItemOrderLimitLine` · 4 عمود · 2 علاقة

**إيه الجدول؟** الحد لكل صنف.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور حدود الطلب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| list | `listId` | String | مفتاح أجنبي يربط الصف بجدول «list». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| أمر limit | `orderLimit` | Decimal | حقل «أمر limit» على هذا الجدول. |

**العلاقات:**

- `N-1` list → قوائم حدود الطلب: كل صف هنا مربوط بصف واحد من «قوائم حدود الطلب» عبر listId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.

### 69. ألوان الملابس (`clothing_colors`)

موديل: `ClothingColor` · 9 عمود · 2 علاقة

**إيه الجدول؟** تباين لون للصنف.

**امتى بيتستخدم؟** أصناف أزياء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| hex | `hex` | String? | حقل «hex» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` combos → تركيبات لون×مقاس: هذا الجدول أب: صف واحد هنا له أكثر من «تركيبات لون×مقاس».

### 70. مقاسات الملابس (`clothing_sizes`)

موديل: `ClothingSize` · 9 عمود · 2 علاقة

**إيه الجدول؟** تباين مقاس.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مقاسات الملابس.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| sort أمر | `sortOrder` | Int | حقل «sort أمر» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` combos → تركيبات لون×مقاس: هذا الجدول أب: صف واحد هنا له أكثر من «تركيبات لون×مقاس».

### 71. تركيبات لون×مقاس (`clothing_combos`)

موديل: `ClothingCombo` · 8 عمود · 3 علاقة

**إيه الجدول؟** SKU مركب.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تركيبات لون×مقاس.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| لون | `colorId` | String | مفتاح أجنبي يربط الصف بجدول «لون». |
| مقاس | `sizeId` | String | مفتاح أجنبي يربط الصف بجدول «مقاس». |
| barcode | `barcode` | String? | حقل «barcode» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` لون → ألوان الملابس: كل صف هنا مربوط بصف واحد من «ألوان الملابس» عبر colorId.
- `N-1` مقاس → مقاسات الملابس: كل صف هنا مربوط بصف واحد من «مقاسات الملابس» عبر sizeId.

### 72. رصيد الصنف في المخزن (`item_warehouse_balances`)

موديل: `ItemWarehouseBalance` · 8 عمود · 3 علاقة

**إيه الجدول؟** الرصيد الحي: كمية، محجوز، متوسط تكلفة. مفتاح شركة+صنف+مخزن.

**امتى بيتستخدم؟** تقرير أرصدة المخزون. بيتحدث مع كل ترحيل مخزني.

**الشاشات:** أرصدة المخزون

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الكمية المتاحة | `quantityOnHand` | Decimal | الرصيد الحي للصنف في المخزن. |
| الكمية المحجوزة | `reservedQuantity` | Decimal | محجوزة لأوامر/عروض ولم تُصرف بعد. |
| متوسط التكلفة | `averageCost` | Decimal | تكلفة الوحدة المتحركة في المخزن. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.

### 73. بضاعة أول المدة (`opening_stocks`)

موديل: `OpeningStock` · 19 عمود · 3 علاقة

**إيه الجدول؟** رأس مستند رصيد أول المدة.

**امتى بيتستخدم؟** افتتاح المخزن في أول السنة.

**الشاشات:** بضاعة أول المدة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور أول المدة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أول المدة».

### 74. سطور أول المدة (`opening_stock_lines`)

موديل: `OpeningStockLine` · 10 عمود · 4 علاقة

**إيه الجدول؟** صنف وكمية وتكلفة الافتتاح.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور أول المدة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| افتتاحي stock | `openingStockId` | String | مفتاح أجنبي يربط الصف بجدول «افتتاحي stock». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` افتتاحي stock → بضاعة أول المدة: كل صف هنا مربوط بصف واحد من «بضاعة أول المدة» عبر openingStockId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 75. الجرد (`stocktaking`)

موديل: `Stocktaking` · 21 عمود · 4 علاقة

**إيه الجدول؟** رأس مقارنة الفعلي بالدفتري.

**امتى بيتستخدم؟** بعد الاعتماد يولّد تسوية وفروق.

**الشاشات:** الجرد

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| إجمالي shortage | `totalShortage` | Decimal | حقل «إجمالي shortage» على هذا الجدول. |
| إجمالي increase | `totalIncrease` | Decimal | حقل «إجمالي increase» على هذا الجدول. |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور الجرد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الجرد».

### 76. سطور الجرد (`stocktaking_lines`)

موديل: `StocktakingLine` · 15 عمود · 5 علاقة

**إيه الجدول؟** الكمية الدفترية مقابل الفعلية والفرق.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور الجرد.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| stocktaking | `stocktakingId` | String | مفتاح أجنبي يربط الصف بجدول «stocktaking». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الوحدة | `unitId` | String? | وحدة القياس على السطر (قطعة، كرتونة…). |
| book كمية | `bookQuantity` | Decimal | System quantity |
| actual كمية | `actualQuantity` | Decimal | Physical count |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| shortage كمية | `shortageQuantity` | Decimal? | When actual < book |
| increase كمية | `increaseQuantity` | Decimal? | When actual > book |
| shortage إجمالي | `shortageTotal` | Decimal? | حقل «shortage إجمالي» على هذا الجدول. |
| increase إجمالي | `increaseTotal` | Decimal? | حقل «increase إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` stocktaking → الجرد: كل صف هنا مربوط بصف واحد من «الجرد» عبر stocktakingId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.
- `N-0..1` وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر unitId.

### 77. التحويل المخزني (`transfers`)

موديل: `Transfer` · 23 عمود · 7 علاقة

**إيه الجدول؟** نقل كمية من مخزن لمخزن.

**امتى بيتستخدم؟** يولد حركتين +/− وقيد لو مطلوب.

**الشاشات:** تحويل مخزني

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| من مخزن | `fromWarehouseId` | String | مفتاح أجنبي يربط الصف بجدول «من مخزن». |
| إلى مخزن | `toWarehouseId` | String | مفتاح أجنبي يربط الصف بجدول «إلى مخزن». |
| من تكلفة مركز | `fromCostCenterId` | String? | مفتاح أجنبي يربط الصف بجدول «من تكلفة مركز». |
| إلى تكلفة مركز | `toCostCenterId` | String? | مفتاح أجنبي يربط الصف بجدول «إلى تكلفة مركز». |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` من مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر fromWarehouseId.
- `N-1` إلى مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر toWarehouseId.
- `N-0..1` من تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر fromCostCenterId.
- `N-0..1` إلى تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر toCostCenterId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور التحويل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التحويل».

### 78. سطور التحويل (`transfer_lines`)

موديل: `TransferLine` · 10 عمود · 4 علاقة

**إيه الجدول؟** الأصناف والكميات المحوّلة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور التحويل.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تحويل | `transferId` | String | مفتاح أجنبي يربط الصف بجدول «تحويل». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| من موقع | `fromLocationId` | String? | مفتاح أجنبي يربط الصف بجدول «من موقع». |
| إلى موقع | `toLocationId` | String? | مفتاح أجنبي يربط الصف بجدول «إلى موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` تحويل → التحويل المخزني: كل صف هنا مربوط بصف واحد من «التحويل المخزني» عبر transferId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` من موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر fromLocationId.
- `N-0..1` إلى موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر toLocationId.

### 79. التجميع (`assemblies`)

موديل: `Assembly` · 18 عمود · 3 علاقة

**إيه الجدول؟** مكونات تتحول لصنف تام.

**امتى بيتستخدم؟** صرف خام + إضافة تام.

**الشاشات:** تجميع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `1-N` lines → سطور ناتج التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «سطور ناتج التجميع».

### 80. سطور ناتج التجميع (`assembly_lines`)

موديل: `AssemblyLine` · 8 عمود · 3 علاقة

**إيه الجدول؟** الأصناف الناتجة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور ناتج التجميع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تجميع | `assemblyId` | String | مفتاح أجنبي يربط الصف بجدول «تجميع». |
| assembled صنف | `assembledItemId` | String | مفتاح أجنبي يربط الصف بجدول «assembled صنف». |
| assembled كمية | `assembledQuantity` | Decimal | حقل «assembled كمية» على هذا الجدول. |
| assembled وحدة سعر | `assembledUnitPrice` | Decimal? | حقل «assembled وحدة سعر» على هذا الجدول. |
| assembled إجمالي | `assembledTotal` | Decimal? | حقل «assembled إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` تجميع → التجميع: كل صف هنا مربوط بصف واحد من «التجميع» عبر assemblyId.
- `N-1` assembled صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر assembledItemId.
- `1-N` components → مكونات التجميع: هذا الجدول أب: صف واحد هنا له أكثر من «مكونات التجميع».

### 81. مكونات التجميع (`assembly_components`)

موديل: `AssemblyComponent` · 8 عمود · 2 علاقة

**إيه الجدول؟** الخامات المستهلكة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مكونات التجميع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تجميع سطر | `assemblyLineId` | String | مفتاح أجنبي يربط الصف بجدول «تجميع سطر». |
| مكون صنف | `componentItemId` | String | مفتاح أجنبي يربط الصف بجدول «مكون صنف». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` تجميع سطر → سطور ناتج التجميع: كل صف هنا مربوط بصف واحد من «سطور ناتج التجميع» عبر assemblyLineId.
- `N-1` مكون صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر componentItemId.

### 82. التفكيك (`disassemblies`)

موديل: `Disassembly` · 18 عمود · 3 علاقة

**إيه الجدول؟** عكس التجميع: تام يتكسر لمكونات.

**امتى بيتستخدم؟** صرف تام وإضافة مكونات.

**الشاشات:** تفكيك

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `1-N` lines → سطور ناتج التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «سطور ناتج التفكيك».

### 83. سطور ناتج التفكيك (`disassembly_lines`)

موديل: `DisassemblyLine` · 8 عمود · 3 علاقة

**إيه الجدول؟** المكونات الناتجة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور ناتج التفكيك.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| disassembly | `disassemblyId` | String | مفتاح أجنبي يربط الصف بجدول «disassembly». |
| disassembled صنف | `disassembledItemId` | String | مفتاح أجنبي يربط الصف بجدول «disassembled صنف». |
| disassembled كمية | `disassembledQuantity` | Decimal | حقل «disassembled كمية» على هذا الجدول. |
| disassembled وحدة سعر | `disassembledUnitPrice` | Decimal? | حقل «disassembled وحدة سعر» على هذا الجدول. |
| disassembled إجمالي | `disassembledTotal` | Decimal? | حقل «disassembled إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` disassembly → التفكيك: كل صف هنا مربوط بصف واحد من «التفكيك» عبر disassemblyId.
- `N-1` disassembled صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر disassembledItemId.
- `1-N` components → مصدر التفكيك: هذا الجدول أب: صف واحد هنا له أكثر من «مصدر التفكيك».

### 84. مصدر التفكيك (`disassembly_components`)

موديل: `DisassemblyComponent` · 8 عمود · 2 علاقة

**إيه الجدول؟** الصنف التام الذي فُك.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مصدر التفكيك.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| disassembly سطر | `disassemblyLineId` | String | مفتاح أجنبي يربط الصف بجدول «disassembly سطر». |
| مكون صنف | `componentItemId` | String | مفتاح أجنبي يربط الصف بجدول «مكون صنف». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. Quantity per disassembled item |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` disassembly سطر → سطور ناتج التفكيك: كل صف هنا مربوط بصف واحد من «سطور ناتج التفكيك» عبر disassemblyLineId.
- `N-1` مكون صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر componentItemId.

### 85. إذن إضافة (`receipts`)

موديل: `Receipt` · 20 عمود · 4 علاقة

**إيه الجدول؟** دخول بضاعة للمخزن (مش فاتورة شراء بالضرورة).

**امتى بيتستخدم؟** بعد الترحيل: حركة + رصيد + قيد مخزون.

**الشاشات:** إذن إضافة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور إذن الإضافة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الإضافة».

### 86. سطور إذن الإضافة (`receipt_lines`)

موديل: `ReceiptLine` · 9 عمود · 3 علاقة

**إيه الجدول؟** أصناف داخلة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور إذن الإضافة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| قبض/إذن | `receiptId` | String | مفتاح أجنبي يربط الصف بجدول «قبض/إذن». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` قبض/إذن → إذن إضافة: كل صف هنا مربوط بصف واحد من «إذن إضافة» عبر receiptId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 87. إذن صرف (`issues`)

موديل: `Issue` · 20 عمود · 4 علاقة

**إيه الجدول؟** خروج بضاعة من المخزن.

**امتى بيتستخدم؟** صرف عيني أو تشغيل.

**الشاشات:** إذن صرف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور إذن الصرف: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إذن الصرف».

### 88. سطور إذن الصرف (`issue_lines`)

موديل: `IssueLine` · 9 عمود · 3 علاقة

**إيه الجدول؟** أصناف خارجة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور إذن الصرف.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| صرف | `issueId` | String | مفتاح أجنبي يربط الصف بجدول «صرف». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` صرف → إذن صرف: كل صف هنا مربوط بصف واحد من «إذن صرف» عبر issueId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 89. تسوية المخزون (`adjustments`)

موديل: `Adjustment` · 20 عمود · 4 علاقة

**إيه الجدول؟** زيادة أو عجز يدوي.

**امتى بيتستخدم؟** بعد جرد أو تصحيح خطأ.

**الشاشات:** تسوية مخزون

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` lines → سطور التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية».

### 90. سطور التسوية (`adjustment_lines`)

موديل: `AdjustmentLine` · 11 عمود · 3 علاقة

**إيه الجدول؟** فرق الكمية والتكلفة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور التسوية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| adjustment | `adjustmentId` | String | مفتاح أجنبي يربط الصف بجدول «adjustment». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| book كمية | `bookQuantity` | Decimal | System quantity (القيمة الدفترية) |
| actual كمية | `actualQuantity` | Decimal | Desired quantity (القيمة الفعلية) |
| adjustment كمية | `adjustmentQuantity` | Decimal | actualQuantity - bookQuantity (positive = increase, negative = decrease) |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| adjustment إجمالي | `adjustmentTotal` | Decimal? | حقل «adjustment إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` adjustment → تسوية المخزون: كل صف هنا مربوط بصف واحد من «تسوية المخزون» عبر adjustmentId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 91. توزيع التكلفة الإضافية (`landed_cost_allocations`)

موديل: `LandedCostAllocation` · 17 عمود · 4 علاقة

**إيه الجدول؟** شحن/جمارك تتوزع على تكلفة الأصناف.

**امتى بيتستخدم؟** فاتورة استيراد.

**الشاشات:** تكلفة إضافية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| expense حساب | `expenseAccountId` | String | مفتاح أجنبي يربط الصف بجدول «expense حساب». |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.
- `N-1` expense حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر expenseAccountId.
- `1-N` lines → سطور توزيع التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور توزيع التكلفة».

### 92. سطور توزيع التكلفة (`landed_cost_allocation_lines`)

موديل: `LandedCostAllocationLine` · 8 عمود · 3 علاقة

**إيه الجدول؟** نصيب كل صنف من المصروف.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور توزيع التكلفة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تخصيص | `allocationId` | String | مفتاح أجنبي يربط الصف بجدول «تخصيص». |
| فاتورة سطر | `invoiceLineId` | String | مفتاح أجنبي يربط الصف بجدول «فاتورة سطر». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| merchandise value | `merchandiseValue` | Decimal | this line's share of the invoice's merchandise value (the allocation base) |
| allocated مبلغ | `allocatedAmount` | Decimal | landed cost allocated to this line |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. snapshot of invoiceLine.baseQuantity at allocation time |
| وحدة تكلفة added | `unitCostAdded` | Decimal | allocatedAmount / quantity — what got added to the item's average cost |

**العلاقات:**

- `N-1` تخصيص → توزيع التكلفة الإضافية: كل صف هنا مربوط بصف واحد من «توزيع التكلفة الإضافية» عبر allocationId.
- `N-1` فاتورة سطر → سطور الفاتورة: كل صف هنا مربوط بصف واحد من «سطور الفاتورة» عبر invoiceLineId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.

### 93. تسويات مخزنية أخرى (`other_adjustments`)

موديل: `OtherAdjustment` · 18 عمود · 3 علاقة

**إيه الجدول؟** تسوية بحساب مقابل حر.

**امتى بيتستخدم؟** حالات مش مغطاة بالتسوية العادية.

**الشاشات:** تسوية أخرى

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `1-N` lines → سطور التسوية الأخرى: هذا الجدول أب: صف واحد هنا له أكثر من «سطور التسوية الأخرى».

### 94. سطور التسوية الأخرى (`other_adjustment_lines`)

موديل: `OtherAdjustmentLine` · 10 عمود · 4 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور التسوية الأخرى.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| other adjustment | `otherAdjustmentId` | String | مفتاح أجنبي يربط الصف بجدول «other adjustment». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| adjustment نوع | `adjustmentType` | String | 'addition' or 'discount' |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` other adjustment → تسويات مخزنية أخرى: كل صف هنا مربوط بصف واحد من «تسويات مخزنية أخرى» عبر otherAdjustmentId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.
- `1-N` sources → مصادر التسوية الأخرى: هذا الجدول أب: صف واحد هنا له أكثر من «مصادر التسوية الأخرى».

### 95. مصادر التسوية الأخرى (`other_adjustment_sources`)

موديل: `OtherAdjustmentSource` · 6 عمود · 1 علاقة

**إيه الجدول؟** المستند اللي سبّب التسوية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مصادر التسوية الأخرى.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| other adjustment سطر | `otherAdjustmentLineId` | String | مفتاح أجنبي يربط الصف بجدول «other adjustment سطر». |
| مصدر | `source` | String | Source name (المصدر) |
| percentage | `percentage` | Decimal | Percentage (النسبة %) |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` other adjustment سطر → سطور التسوية الأخرى: كل صف هنا مربوط بصف واحد من «سطور التسوية الأخرى» عبر otherAdjustmentLineId.

### 105. عروض الأصناف (`item_offers`)

موديل: `ItemOffer` · 28 عمود · 5 علاقة

**إيه الجدول؟** خصم/هدية على صنف لفترة.

**امتى بيتستخدم؟** يسري عند البيع لو التواريخ مطابقة.

**الشاشات:** عروض الأصناف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| اسم ar | `nameAr` | String? | حقل «اسم ar» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| how | `how` | String | 'additional-quantity', 'discount-percentage', 'invoice-value' |
| نوع | `type` | String | 'purchases' or 'sales' |
| مصدر | `source` | String | 'input-units', 'suppliers', 'customers', 'all' |
| من صنف | `fromItemId` | String? | The item that triggers the offer |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. Required quantity to trigger offer |
| percentage | `percentage` | Decimal? | Discount percentage |
| عرض صنف كمية | `offerQuantity` | Decimal? | Gift quantity (Buy X Get Y) |
| إلى صنف | `toItemId` | String? | Gift item (Buy X Get Y) |
| فاتورة value | `invoiceValue` | Decimal? | Invoice value threshold |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الوحدة | `unitId` | String? | وحدة القياس على السطر (قطعة، كرتونة…). |
| apply إلى all parties | `applyToAllParties` | Boolean | حقل «apply إلى all parties» على هذا الجدول. |
| apply إلى all patterns | `applyToAllPatterns` | Boolean | حقل «apply إلى all patterns» على هذا الجدول. |
| هدف party ids | `targetPartyIds` | Json? | حقل «هدف party ids» على هذا الجدول. |
| هدف pattern ids | `targetPatternIds` | Json? | حقل «هدف pattern ids» على هذا الجدول. |
| من تاريخ | `fromDate` | DateTime | حقل «من تاريخ» على هذا الجدول. |
| من تاريخ hijri | `fromDateHijri` | String? | حقل «من تاريخ hijri» على هذا الجدول. |
| إلى تاريخ | `toDate` | DateTime | حقل «إلى تاريخ» على هذا الجدول. |
| إلى تاريخ hijri | `toDateHijri` | String? | حقل «إلى تاريخ hijri» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` من صنف → الأصناف: ربط اختياري بصف واحد من «الأصناف» عبر fromItemId.
- `N-0..1` إلى صنف → الأصناف: ربط اختياري بصف واحد من «الأصناف» عبر toItemId.
- `N-0..1` مصدر مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` مصدر وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر unitId.

### 162. عقود الوحدات (`unit_contracts`)

موديل: `UnitContract` · 26 عمود · 10 علاقة

**إيه الجدول؟** عقد بيع وحدة بأقساط.

**امتى بيتستخدم؟** يولّد أقساط وشيكات آجلة.

**الشاشات:** عقد وحدة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| عقار وحدة | `propertyUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «عقار وحدة». |
| العميل | `customerId` | String | طرف القبض/البيع. |
| عقد رقم | `contractNumber` | String | حقل «عقد رقم» على هذا الجدول. |
| عقد تاريخ | `contractDate` | DateTime | حقل «عقد تاريخ» على هذا الجدول. |
| delivery تاريخ | `deliveryDate` | DateTime? | حقل «delivery تاريخ» على هذا الجدول. |
| إجمالي عقد مبلغ | `totalContractAmount` | Decimal | حقل «إجمالي عقد مبلغ» على هذا الجدول. |
| إجمالي selling سعر | `totalSellingPrice` | Decimal | حقل «إجمالي selling سعر» على هذا الجدول. |
| down دفع | `downPayment` | Decimal | حقل «down دفع» على هذا الجدول. |
| maintenance مبلغ | `maintenanceAmount` | Decimal | حقل «maintenance مبلغ» على هذا الجدول. |
| maintenance deposit | `maintenanceDeposit` | Decimal | حقل «maintenance deposit» على هذا الجدول. |
| الخصم | `discountAmount` | Decimal | قيمة الخصم على الرأس أو السطر. |
| financing interest | `financingInterest` | Decimal | حقل «financing interest» على هذا الجدول. |
| outstanding ar رصيد | `outstandingArBalance` | Decimal | حقل «outstanding ar رصيد» على هذا الجدول. |
| unearned revenue رصيد | `unearnedRevenueBalance` | Decimal | حقل «unearned revenue رصيد» على هذا الجدول. |
| دفع plan نوع | `paymentPlanType` | UnitPaymentPlanType | حقل «دفع plan نوع» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| إعادة بيع lock | `resaleLock` | Boolean | حقل «إعادة بيع lock» على هذا الجدول. |
| عقد قيد حركة | `contractJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «عقد قيد حركة». |
| handover قيد حركة | `handoverJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «handover قيد حركة». |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| handover at | `handoverAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` وحدة → وحدات عقارية: كل صف هنا مربوط بصف واحد من «وحدات عقارية» عبر unitId.
- `N-0..1` عقار وحدة → وحدات الأملاك: ربط اختياري بصف واحد من «وحدات الأملاك» عبر propertyUnitId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.
- `1-N` installments → أقساط الوحدة: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط الوحدة».
- `1-N` post dated cheques → شيكات آجلة للوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «شيكات آجلة للوحدات».
- `1-N` إعادة بيع transfers → تنازل/إعادة بيع وحدة: هذا الجدول أب: صف واحد هنا له أكثر من «تنازل/إعادة بيع وحدة».
- `1-N` فسخ settlements → تسوية فسخ الوحدة: هذا الجدول أب: صف واحد هنا له أكثر من «تسوية فسخ الوحدة».
- `1-N` تأجير agreements → اتفاقيات صندوق التأجير: هذا الجدول أب: صف واحد هنا له أكثر من «اتفاقيات صندوق التأجير».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 163. أقساط الوحدة (`unit_installments`)

موديل: `UnitInstallment` · 18 عمود · 4 علاقة

**إيه الجدول؟** جدول سداد العقد.

**امتى بيتستخدم؟** كل قسط ممكن يرتبط بشيك.

**الشاشات:** أقساط الوحدة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| عقد | `contractId` | String | مفتاح أجنبي يربط الصف بجدول «عقد». |
| قسط نوع | `installmentType` | UnitInstallmentType | حقل «قسط نوع» على هذا الجدول. |
| قسط رقم | `installmentNumber` | Int | حقل «قسط رقم» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime | متى يستحق الشيك أو القسط أو الفاتورة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| original مبلغ | `originalAmount` | Decimal | حقل «original مبلغ» على هذا الجدول. |
| المدفوع | `paidAmount` | Decimal | كام اتصفى من الفاتورة بسندات أو تخصيصات. |
| رصيد | `balance` | Decimal | حقل «رصيد» على هذا الجدول. |
| daily late مصروف دراسي سعر | `dailyLateFeeRate` | Decimal | حقل «daily late مصروف دراسي سعر» على هذا الجدول. |
| accumulated late مصروف دراسي | `accumulatedLateFee` | Decimal | حقل «accumulated late مصروف دراسي» على هذا الجدول. |
| interest portion | `interestPortion` | Decimal | حقل «interest portion» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| شيك | `chequeId` | String? | مفتاح أجنبي يربط الصف بجدول «شيك». |
| دفع معاملة | `paymentTransactionId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع معاملة». |
| paid at | `paidAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` عقد → عقود الوحدات: كل صف هنا مربوط بصف واحد من «عقود الوحدات» عبر contractId.
- `N-0..1` شيك → الشيكات: ربط اختياري بصف واحد من «الشيكات» عبر chequeId.
- `N-0..1` دفع معاملة → سندات وأوامر الخزينة: ربط اختياري بصف واحد من «سندات وأوامر الخزينة» عبر paymentTransactionId.
- `1-N` post dated cheques → شيكات آجلة للوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «شيكات آجلة للوحدات».

### 165. تنازل/إعادة بيع وحدة (`unit_resale_transfers`)

موديل: `UnitResaleTransfer` · 12 عمود · 4 علاقة

**إيه الجدول؟** نقل العقد لمشترٍ جديد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تنازل/إعادة بيع وحدة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| وحدة عقد | `unitContractId` | String | مفتاح أجنبي يربط الصف بجدول «وحدة عقد». |
| seller عميل | `sellerCustomerId` | String | مفتاح أجنبي يربط الصف بجدول «seller عميل». |
| new buyer عميل | `newBuyerCustomerId` | String | مفتاح أجنبي يربط الصف بجدول «new buyer عميل». |
| current وحدة market value | `currentUnitMarketValue` | Decimal | حقل «current وحدة market value» على هذا الجدول. |
| assignment مصروف دراسي سعر | `assignmentFeeRate` | Decimal | حقل «assignment مصروف دراسي سعر» على هذا الجدول. |
| assignment مصروف دراسي مبلغ | `assignmentFeeAmount` | Decimal | حقل «assignment مصروف دراسي مبلغ» على هذا الجدول. |
| is assignment مصروف دراسي paid | `isAssignmentFeePaid` | Boolean | علامة نعم/لا: is assignment مصروف دراسي paid. |
| clearance حالة | `clearanceStatus` | UnitResaleClearanceStatus | حقل «clearance حالة» على هذا الجدول. |
| معتمد by مستخدم | `approvedByUserId` | String? | مفتاح أجنبي يربط الصف بجدول «معتمد by مستخدم». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` عقد → عقود الوحدات: كل صف هنا مربوط بصف واحد من «عقود الوحدات» عبر unitContractId.
- `N-1` seller → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر sellerCustomerId.
- `N-1` new buyer → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر newBuyerCustomerId.
- `N-0..1` معتمد by → المستخدمون: ربط اختياري بصف واحد من «المستخدمون» عبر approvedByUserId.

### 166. تسوية فسخ الوحدة (`unit_cancellation_settlements`)

موديل: `UnitCancellationSettlement` · 10 عمود · 1 علاقة

**إيه الجدول؟** حساب غرامة وردّ عند الإلغاء.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تسوية فسخ الوحدة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| وحدة عقد | `unitContractId` | String | مفتاح أجنبي يربط الصف بجدول «وحدة عقد». |
| فسخ تاريخ | `cancellationDate` | DateTime | علامة نعم/لا: فسخ تاريخ. |
| إجمالي مبلغ paid by client | `totalAmountPaidByClient` | Decimal | حقل «إجمالي مبلغ paid by client» على هذا الجدول. |
| forfeiture غرامة سعر | `forfeiturePenaltyRate` | Decimal | حقل «forfeiture غرامة سعر» على هذا الجدول. |
| forfeiture غرامة مبلغ | `forfeiturePenaltyAmount` | Decimal | حقل «forfeiture غرامة مبلغ» على هذا الجدول. |
| صافي refundable إلى client | `netRefundableToClient` | Decimal | حقل «صافي refundable إلى client» على هذا الجدول. |
| refund حالة | `refundStatus` | UnitRefundStatus | حقل «refund حالة» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` عقد → عقود الوحدات: كل صف هنا مربوط بصف واحد من «عقود الوحدات» عبر unitContractId.

### 208. الأرقام التسلسلية (`serial_numbers`)

موديل: `SerialNumber` · 8 عمود · 1 علاقة

**إيه الجدول؟** سيريال قطعة للصنف.

**امتى بيتستخدم؟** تتبع قطعة في الضمان/المخزن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مستند نوع | `documentType` | String | e.g., 'INV', 'JE', 'TR', etc. |
| السنة | `year` | Int? | السنة الرقمية للملخص أو الفترة. Year for year-based numbering |
| مسلسل | `sequence` | Int | حقل «مسلسل» على هذا الجدول. |
| last used | `lastUsed` | DateTime | حقل «last used» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 239. أنواع إضافات/خصومات أخرى (`other_addition_discount_types`)

موديل: `OtherAdditionDiscountType` · 12 عمود · 2 علاقة

**إيه الجدول؟** نوع حركة إضافية على الفاتورة أو الأجر.

**امتى بيتستخدم؟** يُستخدم مع شاشات: أنواع إضافات/خصومات أخرى.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم | `name` | String | اسم الصف. e.g., "دمغة" |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). Reference to Account |
| الحساب المقابل | `offsetAccountId` | String? | الطرف الثاني في السند (عميل، إيراد، مصروف…). |
| abbreviation | `abbreviation` | String? | e.g., "دمغة" |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| base | `base` | String? | 'amount' | 'discount-origin' (أصل المبلغ | أصل - خصم الصنف) |
| نوع | `type` | String? | 'addition' | 'discount' (إضافة | خصم) |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` percentages → نسب الإضافة/الخصم: هذا الجدول أب: صف واحد هنا له أكثر من «نسب الإضافة/الخصم».

### 240. نسب الإضافة/الخصم (`other_addition_discount_percentages`)

موديل: `OtherAdditionDiscountPercentage` · 8 عمود · 1 علاقة

**إيه الجدول؟** النسبة الافتراضية للنوع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: نسب الإضافة/الخصم.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| other addition خصم نوع | `otherAdditionDiscountTypeId` | String | مفتاح أجنبي يربط الصف بجدول «other addition خصم نوع». |
| مصدر | `source` | String | default | activities | items | groups | suppliers | customers |
| معرّف المصدر | `sourceId` | String? | UUID المستند اللي ولّد القيد. |
| مصدر اسم | `sourceName` | String? | حقل «مصدر اسم» على هذا الجدول. |
| percentage | `percentage` | Decimal | Percentage value |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` other addition خصم نوع → أنواع إضافات/خصومات أخرى: كل صف هنا مربوط بصف واحد من «أنواع إضافات/خصومات أخرى» عبر otherAdditionDiscountTypeId.

### 251. تاريخ تكلفة الصنف (`item_cost_history`)

موديل: `ItemCostHistory` · 13 عمود · 3 علاقة

**إيه الجدول؟** متوسط التكلفة بعد كل حركة مؤثرة.

**امتى بيتستخدم؟** تحليل التكلفة عبر الزمن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| المسلسل | `serial` | Int | رقم تسلسلي إضافي أو بديل. |
| تكلفة | `cost` | Decimal | حقل «تكلفة» على هذا الجدول. |
| effective at | `effectiveAt` | DateTime | ختم زمني لهذا الحدث. |
| مستند تاريخ | `documentDate` | DateTime | حقل «مستند تاريخ» على هذا الجدول. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| نوع المصدر | `sourceType` | String | كود قصير: SI بيع، PI شراء، CR قبض، CKD إيداع شيك… |
| رقم المصدر | `sourceNumber` | String | رقم المستند الأصلي المنسوخ على القيد. |
| سنة المصدر | `sourceYearId` | String | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فرع → الفروع: كل صف هنا مربوط بصف واحد من «الفروع» عبر branchId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.

### 252. دفتر حركة المخزون (`inventory_movements`)

موديل: `InventoryMovement` · 17 عمود · 5 علاقة

**إيه الجدول؟** كل +/− مخزني، لا يُمسح. المصدر والمستند والتكلفة الناتجة.

**امتى بيتستخدم؟** كارت الصنف وحركة المخزن. الرصيد الحي مش هنا؛ هنا التاريخ.

**الشاشات:** حركة الأصناف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| فرق الحركة | `quantityDelta` | Decimal | بالموجب دخول، بالسالب خروج، في دفتر المخزون. |
| وحدة تكلفة | `unitCost` | Decimal? | حقل «وحدة تكلفة» على هذا الجدول. |
| resulting average تكلفة | `resultingAverageCost` | Decimal? | حقل «resulting average تكلفة» على هذا الجدول. |
| حركة نوع | `movementType` | String | حقل «حركة نوع» على هذا الجدول. |
| نوع المصدر | `sourceType` | String? | كود قصير: SI بيع، PI شراء، CR قبض، CKD إيداع شيك… |
| رقم المصدر | `sourceNumber` | String? | رقم المستند الأصلي المنسوخ على القيد. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| مصدر مستند | `sourceDocumentId` | String? | مفتاح أجنبي يربط الصف بجدول «مصدر مستند». |
| مستند تاريخ | `documentDate` | DateTime | حقل «مستند تاريخ» على هذا الجدول. |
| effective at | `effectiveAt` | DateTime | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

## بيع وشراء وفواتير

فواتير بيع/شراء ومرتجعات، أوامر، عروض، عمولات.

### 96. أوامر الشراء (`purchase_orders`)

موديل: `PurchaseOrder` · 28 عمود · 8 علاقة

**إيه الجدول؟** طلب شراء من مورد قبل الفاتورة.

**امتى بيتستخدم؟** يتحول لفاتورة شراء.

**الشاشات:** أمر شراء

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| أمر رقم | `orderNumber` | String? | حقل «أمر رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| المورد | `supplierId` | String | طرف الدفع/الشراء. |
| المخزن | `warehouseId` | String? | المخزن اللي الكمية بتتحرك منه أو إليه. |
| العملة | `currencyId` | String? | ربط بجدول العملات. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| expected delivery تاريخ | `expectedDeliveryDate` | DateTime? | حقل «expected delivery تاريخ» على هذا الجدول. |
| expected delivery تاريخ hijri | `expectedDeliveryDateHijri` | String? | حقل «expected delivery تاريخ hijri» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| إجمالي خصم | `totalDiscount` | Decimal | حقل «إجمالي خصم» على هذا الجدول. |
| إجمالي ضريبة | `totalTax` | Decimal | حقل «إجمالي ضريبة» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. Link to converted invoice |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مورد → الموردون: كل صف هنا مربوط بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` عملة → العملات: ربط اختياري بصف واحد من «العملات» عبر currencyId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.
- `1-N` lines → سطور أمر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «سطور أمر الشراء».
- `1-N` conditions → شروط أمر الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «شروط أمر الشراء».

### 97. سطور أمر الشراء (`purchase_order_lines`)

موديل: `PurchaseOrderLine` · 16 عمود · 4 علاقة

**إيه الجدول؟** أصناف وكميات مطلوبة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور أمر الشراء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| purchase أمر | `purchaseOrderId` | String | مفتاح أجنبي يربط الصف بجدول «purchase أمر». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String? | وحدة القياس على السطر (قطعة، كرتونة…). |
| base وحدة | `baseUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «base وحدة». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| base كمية | `baseQuantity` | Decimal? | Converted to base unit |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| خصم percentage | `discountPercentage` | Decimal? | حقل «خصم percentage» على هذا الجدول. |
| خصم value | `discountValue` | Decimal? | حقل «خصم value» على هذا الجدول. |
| ضريبة percentage | `taxPercentage` | Decimal? | حقل «ضريبة percentage» على هذا الجدول. |
| ضريبة value | `taxValue` | Decimal? | حقل «ضريبة value» على هذا الجدول. |
| صافي إجمالي | `netTotal` | Decimal? | حقل «صافي إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` purchase أمر → أوامر الشراء: كل صف هنا مربوط بصف واحد من «أوامر الشراء» عبر purchaseOrderId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-0..1` وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر unitId.
- `N-0..1` base وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر baseUnitId.

### 98. شروط أمر الشراء (`purchase_order_conditions`)

موديل: `PurchaseOrderCondition` · 5 عمود · 1 علاقة

**إيه الجدول؟** نصوص شروط/تعاقد على الأمر.

**امتى بيتستخدم؟** يُستخدم مع شاشات: شروط أمر الشراء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| purchase أمر | `purchaseOrderId` | String | مفتاح أجنبي يربط الصف بجدول «purchase أمر». |
| condition | `condition` | String | حقل «condition» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` purchase أمر → أوامر الشراء: كل صف هنا مربوط بصف واحد من «أوامر الشراء» عبر purchaseOrderId.

### 99. مرتجع المشتريات (جدول قديم) (`purchase_returns`)

موديل: `PurchaseReturn` · 29 عمود · 9 علاقة

**إيه الجدول؟** مستند مرتجع شراء تراثي. المسار الحالي غالبًا invoices بـ PURCHASE_RETURN.

**امتى بيتستخدم؟** تقارير المردود القديمة.

**الشاشات:** مرتجع مشتريات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| return رقم | `returnNumber` | String? | حقل «return رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| original فاتورة | `originalInvoiceId` | String? | Reference to original purchase invoice |
| المورد | `supplierId` | String | طرف الدفع/الشراء. |
| المخزن | `warehouseId` | String | المخزن اللي الكمية بتتحرك منه أو إليه. |
| العملة | `currencyId` | String? | ربط بجدول العملات. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| دفع method | `paymentMethod` | String? | 'cash' or 'credit' |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| المندوب | `delegateId` | String? | مندوب المبيعات المرتبط بالفاتورة أو العميل. |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| إجمالي خصم | `totalDiscount` | Decimal | حقل «إجمالي خصم» على هذا الجدول. |
| إجمالي ضريبة | `totalTax` | Decimal | حقل «إجمالي ضريبة» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مورد → الموردون: كل صف هنا مربوط بصف واحد من «الموردون» عبر supplierId.
- `N-1` مخزن → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` عملة → العملات: ربط اختياري بصف واحد من «العملات» عبر currencyId.
- `N-0..1` original فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر originalInvoiceId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` مندوب → المندوبون: ربط اختياري بصف واحد من «المندوبون» عبر delegateId.
- `1-N` lines → سطور مرتجع الشراء القديم: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مرتجع الشراء القديم».
- `1-N` conditions → شروط مرتجع الشراء: هذا الجدول أب: صف واحد هنا له أكثر من «شروط مرتجع الشراء».

### 100. سطور مرتجع الشراء القديم (`purchase_return_lines`)

موديل: `PurchaseReturnLine` · 17 عمود · 4 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور مرتجع الشراء القديم.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| purchase return | `purchaseReturnId` | String | مفتاح أجنبي يربط الصف بجدول «purchase return». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| موقع | `locationId` | String? | مفتاح أجنبي يربط الصف بجدول «موقع». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| base كمية | `baseQuantity` | Decimal | حقل «base كمية» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal | حقل «إجمالي» على هذا الجدول. |
| خصم percentage | `discountPercentage` | Decimal? | حقل «خصم percentage» على هذا الجدول. |
| خصم value | `discountValue` | Decimal | حقل «خصم value» على هذا الجدول. |
| ضريبة percentage | `taxPercentage` | Decimal? | حقل «ضريبة percentage» على هذا الجدول. |
| ضريبة value | `taxValue` | Decimal | حقل «ضريبة value» على هذا الجدول. |
| صافي إجمالي | `netTotal` | Decimal | حقل «صافي إجمالي» على هذا الجدول. |
| original فاتورة سطر | `originalInvoiceLineId` | String? | Reference to original purchase invoice line |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` purchase return → مرتجع المشتريات (جدول قديم): كل صف هنا مربوط بصف واحد من «مرتجع المشتريات (جدول قديم)» عبر purchaseReturnId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.
- `N-0..1` موقع → مواقع داخل المخزن: ربط اختياري بصف واحد من «مواقع داخل المخزن» عبر locationId.

### 101. شروط مرتجع الشراء (`purchase_return_conditions`)

موديل: `PurchaseReturnCondition` · 5 عمود · 1 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: شروط مرتجع الشراء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| purchase return | `purchaseReturnId` | String | مفتاح أجنبي يربط الصف بجدول «purchase return». |
| condition | `condition` | String | حقل «condition» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` purchase return → مرتجع المشتريات (جدول قديم): كل صف هنا مربوط بصف واحد من «مرتجع المشتريات (جدول قديم)» عبر purchaseReturnId.

### 102. عروض الأسعار (`price_quotes`)

موديل: `PriceQuote` · 33 عمود · 9 علاقة

**إيه الجدول؟** عرض للعميل قبل أمر البيع/الفاتورة.

**امتى بيتستخدم؟** يتحول لفاتورة بيع.

**الشاشات:** عرض سعر

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| عرض رقم | `quoteNumber` | String? | حقل «عرض رقم» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| العميل | `customerId` | String | طرف القبض/البيع. |
| المخزن | `warehouseId` | String? | المخزن اللي الكمية بتتحرك منه أو إليه. |
| العملة | `currencyId` | String? | ربط بجدول العملات. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| دفع method | `paymentMethod` | String? | 'cash' or 'credit' |
| is sales ضريبة فاتورة | `isSalesTaxInvoice` | Boolean | علامة نعم/لا: is sales ضريبة فاتورة. |
| المندوب | `delegateId` | String? | مندوب المبيعات المرتبط بالفاتورة أو العميل. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| valid until | `validUntil` | DateTime? | Quote expiration date |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| إجمالي خصم | `totalDiscount` | Decimal | حقل «إجمالي خصم» على هذا الجدول. |
| إجمالي ضريبة | `totalTax` | Decimal | حقل «إجمالي ضريبة» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| وقت الاعتماد | `approvedAt` | DateTime? | متى اتعمد المستند. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| is converted | `isConverted` | Boolean | علامة نعم/لا: is converted. |
| converted at | `convertedAt` | DateTime? | ختم زمني لهذا الحدث. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. Link to converted invoice |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` عملة → العملات: ربط اختياري بصف واحد من «العملات» عبر currencyId.
- `N-0..1` مندوب → المندوبون: ربط اختياري بصف واحد من «المندوبون» عبر delegateId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.
- `1-N` lines → سطور عرض السعر: هذا الجدول أب: صف واحد هنا له أكثر من «سطور عرض السعر».
- `1-N` conditions → شروط العرض: هذا الجدول أب: صف واحد هنا له أكثر من «شروط العرض».

### 103. سطور عرض السعر (`price_quote_lines`)

موديل: `PriceQuoteLine` · 16 عمود · 4 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور عرض السعر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| سعر عرض | `priceQuoteId` | String | مفتاح أجنبي يربط الصف بجدول «سعر عرض». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| base وحدة | `baseUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «base وحدة». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| base كمية | `baseQuantity` | Decimal | Converted to base unit |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي | `total` | Decimal | حقل «إجمالي» على هذا الجدول. |
| خصم percentage | `discountPercentage` | Decimal? | حقل «خصم percentage» على هذا الجدول. |
| خصم value | `discountValue` | Decimal | حقل «خصم value» على هذا الجدول. |
| ضريبة percentage | `taxPercentage` | Decimal? | حقل «ضريبة percentage» على هذا الجدول. |
| ضريبة value | `taxValue` | Decimal | حقل «ضريبة value» على هذا الجدول. |
| صافي إجمالي | `netTotal` | Decimal | حقل «صافي إجمالي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` سعر عرض → عروض الأسعار: كل صف هنا مربوط بصف واحد من «عروض الأسعار» عبر priceQuoteId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.
- `N-0..1` base وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر baseUnitId.

### 104. شروط العرض (`price_quote_conditions`)

موديل: `PriceQuoteCondition` · 5 عمود · 1 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: شروط العرض.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| سعر عرض | `priceQuoteId` | String | مفتاح أجنبي يربط الصف بجدول «سعر عرض». |
| condition | `condition` | String | حقل «condition» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` سعر عرض → عروض الأسعار: كل صف هنا مربوط بصف واحد من «عروض الأسعار» عبر priceQuoteId.

### 106. الفواتير (`invoices`)

موديل: `Invoice` · 75 عمود · 31 علاقة

**إيه الجدول؟** جدول واحد للبيع والشراء ومردودهما. النوع في invoiceKind.

**امتى بيتستخدم؟** فاتورة مبيعات/مشتريات/مرتجع. الترحيل يولّد قيد إيراد/تكلفة ويحدّث المتبقي.

**الشاشات:** فاتورة مبيعات · فاتورة مشتريات · مرتجع مبيعات · مرتجع مشتريات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| رقم الفاتورة | `invoiceNumber` | String? | الرقم الظاهر للمستخدم، من مسلسل المستندات. |
| نوع الفاتورة | `invoiceKind` | String? | SALE بيع / PURCHASE شراء / SALE_RETURN مرتجع بيع / PURCHASE_RETURN مرتجع شراء. |
| نوع قديم | `invoiceType` | String | حقل تراثي موازي لـ invoiceKind. التقارير بتقرأ الاتنين. sales/purchase/return |
| موديول كود | `moduleCode` | String? | حقل «موديول كود» على هذا الجدول. |
| new موديول | `newModuleId` | String? | مفتاح أجنبي يربط الصف بجدول «new موديول». |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| تاريخ الاستحقاق | `dueDate` | DateTime? | متى يستحق الشيك أو القسط أو الفاتورة. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| المخزن | `warehouseId` | String? | المخزن اللي الكمية بتتحرك منه أو إليه. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| المندوب/الممثل | `representativeId` | String? | نفس فكرة المندوب في تقارير أخرى. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| الخصم | `discountAmount` | Decimal | قيمة الخصم على الرأس أو السطر. |
| header خصم percent | `headerDiscountPercent` | Decimal? | حقل «header خصم percent» على هذا الجدول. |
| development مصروف دراسي سعر | `developmentFeeRate` | Decimal? | حقل «development مصروف دراسي سعر» على هذا الجدول. |
| development مصروف دراسي مبلغ | `developmentFeeAmount` | Decimal | حقل «development مصروف دراسي مبلغ» على هذا الجدول. |
| pricing calculation basis | `pricingCalculationBasis` | String? | حقل «pricing calculation basis» على هذا الجدول. |
| الضريبة | `taxAmount` | Decimal | قيمة الضريبة المحسوبة. |
| خصم منبع ضريبة مبلغ | `withholdingTaxAmount` | Decimal | حقل «خصم منبع ضريبة مبلغ» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| المدفوع | `paidAmount` | Decimal | كام اتصفى من الفاتورة بسندات أو تخصيصات. |
| المتبقي | `remainingAmount` | Decimal | الصافي ناقص المدفوع. أساس أعمار الديون. |
| حالة السداد | `paymentStatus` | String? | UNPAID / PARTIALLY_PAID / PAID. |
| حالة الاعتماد | `workflowStatus` | String | DRAFT → PENDING_APPROVAL → APPROVED → REJECTED → POSTED. |
| workflow submitted at | `workflowSubmittedAt` | DateTime? | ختم زمني لهذا الحدث. |
| مقدّم الاعتماد | `workflowSubmittedBy` | String? | مين رفع المستند للاعتماد. |
| workflow معتمد at | `workflowApprovedAt` | DateTime? | ختم زمني لهذا الحدث. |
| المعتمد | `workflowApprovedBy` | String? | مين وافق. |
| workflow rejected at | `workflowRejectedAt` | DateTime? | ختم زمني لهذا الحدث. |
| الرافض | `workflowRejectedBy` | String? | مين رفض. |
| workflow rejection reason | `workflowRejectionReason` | String? | حقل «workflow rejection reason» على هذا الجدول. |
| أنشأه | `createdBy` | String? | المستخدم اللي فتح المستند أول مرة. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| رحّله مين | `postedBy` | String? | معرّف المستخدم اللي ضغط ترحيل. |
| معتمد | `isApproved` | Boolean | عدّى مسار الاعتماد. لو مفيش مسار متعرّف في الشركة، الاعتماد مش بيتفرض. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| is sales ضريبة فاتورة | `isSalesTaxInvoice` | Boolean | علامة نعم/لا: is sales ضريبة فاتورة. |
| allow return | `allowReturn` | Boolean | حقل «allow return» على هذا الجدول. |
| return days | `returnDays` | Int? | حقل «return days» على هذا الجدول. |
| ضريبة treatment نوع | `taxTreatmentType` | String? | حقل «ضريبة treatment نوع» على هذا الجدول. |
| is delivered | `isDelivered` | Boolean | علامة نعم/لا: is delivered. |
| handover تاريخ | `handoverDate` | DateTime? | حقل «handover تاريخ» على هذا الجدول. |
| دفع method | `paymentMethod` | String? | cash/credit/split |
| دفع splits | `paymentSplits` | Json? | حقل «دفع splits» على هذا الجدول. |
| ملاحظات داخلية | `internalNotes` | Json? | للفريق فقط، مش للعميل. |
| البائع | `sellerId` | String? | مستخدم/مندوب إضافي على الفاتورة. |
| العملة | `currencyId` | String? | ربط بجدول العملات. |
| record | `record` | String? | رقم القيد (Journal Entry Reference) |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| قيد التكلفة | `costJournalEntryId` | String? | قيد تكلفة المخزون المرافق لفاتورة البيع. |
| converted فاتورة | `convertedInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «converted فاتورة». |
| original فاتورة | `originalInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «original فاتورة». |
| original فاتورة رقم | `originalInvoiceNumber` | String? | حقل «original فاتورة رقم» على هذا الجدول. |
| نوع المصدر | `sourceType` | SourceDocumentType | كود قصير: SI بيع، PI شراء، CR قبض، CKD إيداع شيك… |
| معرّف المصدر | `sourceId` | String? | UUID المستند اللي ولّد القيد. |
| رقم المصدر | `sourceNumber` | String? | رقم المستند الأصلي المنسوخ على القيد. |
| ضريبة signature | `taxSignature` | String? | حقل «ضريبة signature» على هذا الجدول. |
| ضريبة hash | `taxHash` | String? | حقل «ضريبة hash» على هذا الجدول. |
| ضريبة submitted | `taxSubmitted` | Boolean | حقل «ضريبة submitted» على هذا الجدول. |
| ضريبة submission | `taxSubmissionId` | String? | مفتاح أجنبي يربط الصف بجدول «ضريبة submission». |
| الإصدار | `version` | Int | قفل تفاؤلي: لو اتنين عدّلوا نفس المسودة، التاني يفشل ويتحدّث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |
| مستند بروفايل | `documentProfileId` | String? | مفتاح أجنبي يربط الصف بجدول «مستند بروفايل». |

**العلاقات:**

- `1-N` e فاتورة documents → مستندات البوابة الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «مستندات البوابة الضريبية».
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` new موديول → نسخ أنواع المستندات: ربط اختياري بصف واحد من «نسخ أنواع المستندات» عبر newModuleId.
- `N-0..1` مستند بروفايل → بروفايل المستند: ربط اختياري بصف واحد من «بروفايل المستند» عبر documentProfileId.
- `N-0..1` مندوب → المندوبون: ربط اختياري بصف واحد من «المندوبون» عبر representativeId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` عملة → العملات: ربط اختياري بصف واحد من «العملات» عبر currencyId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-0..1` تكلفة قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر costJournalEntryId.
- `1-N` lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».
- `1-N` adjustments → تسويات على الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات على الفاتورة».
- `1-N` conditions → شروط الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «شروط الفاتورة».
- `1-N` settlements → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».
- `1-N` دفع allocations → تخصيصات السداد: هذا الجدول أب: صف واحد هنا له أكثر من «تخصيصات السداد».
- `1-N` cash معاملة lines → بنود سند الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «بنود سند الخزينة».
- `1-N` tied قيد lines → سطور القيود: هذا الجدول أب: صف واحد هنا له أكثر من «سطور القيود».
- `1-N` تسوية cheques → الشيكات: هذا الجدول أب: صف واحد هنا له أكثر من «الشيكات».
- `N-0..1` purchase أمر → أوامر الشراء: ربط اختياري بصف واحد من «أوامر الشراء».
- `1-N` purchase returns → مرتجع المشتريات (جدول قديم): هذا الجدول أب: صف واحد هنا له أكثر من «مرتجع المشتريات (جدول قديم)».
- `N-0..1` سعر عرض → عروض الأسعار: ربط اختياري بصف واحد من «عروض الأسعار».
- `1-N` تكلفة إضافية تكلفة allocations → توزيع التكلفة الإضافية: هذا الجدول أب: صف واحد هنا له أكثر من «توزيع التكلفة الإضافية».
- `N-0..1` converted فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر convertedInvoiceId.
- `N-0..1` converted من فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير».
- `N-0..1` original فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر originalInvoiceId.
- `1-N` returns → الفواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الفواتير».
- `1-N` installments → أقساط الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط الفاتورة».

### 107. أقساط الفاتورة (`invoice_installments`)

موديل: `InvoiceInstallment` · 13 عمود · 2 علاقة

**إيه الجدول؟** جدول سداد الفاتورة على دفعات.

**امتى بيتستخدم؟** فاتورة تقسيط.

**الشاشات:** أقساط الفاتورة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| قسط رقم | `installmentNumber` | Int | حقل «قسط رقم» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime | متى يستحق الشيك أو القسط أو الفاتورة. |
| hijri due تاريخ | `hijriDueDate` | String? | حقل «hijri due تاريخ» على هذا الجدول. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| المدفوع | `paidAmount` | Decimal | كام اتصفى من الفاتورة بسندات أو تخصيصات. |
| is paid | `isPaid` | Boolean | علامة نعم/لا: is paid. |
| الحالة | `status` | InvoiceInstallmentStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| دفع تاريخ | `paymentDate` | DateTime? | حقل «دفع تاريخ» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.
- `1-N` cash transactions → سندات وأوامر الخزينة: هذا الجدول أب: صف واحد هنا له أكثر من «سندات وأوامر الخزينة».

### 108. تسويات على الفاتورة (`invoice_adjustments`)

موديل: `InvoiceAdjustment` · 15 عمود · 5 علاقة

**إيه الجدول؟** إضافة/خصم محاسبي على رأس الفاتورة (نولون، نزول…).

**امتى بيتستخدم؟** سطور التسوية في شاشة الفاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| نوع | `type` | AdjustmentType | حقل «نوع» على هذا الجدول. |
| calc نوع | `calcType` | CalculationType | حقل «calc نوع» على هذا الجدول. |
| سعر | `rate` | Decimal? | حقل «سعر» على هذا الجدول. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| عملة | `currency` | String | حقل «عملة» على هذا الجدول. |
| سعر التحويل | `exchangeRate` | Decimal? | كم وحدة أساس لكل وحدة من عملة المستند. |
| الحساب | `accountId` | String | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| الحساب المقابل | `offsetAccountId` | String? | الطرف الثاني في السند (عميل، إيراد، مصروف…). |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.
- `N-1` حساب → دليل الحسابات: كل صف هنا مربوط بصف واحد من «دليل الحسابات» عبر accountId.
- `N-0..1` offset حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر offsetAccountId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.

### 111. سطور الفاتورة (`invoice_lines`)

موديل: `InvoiceLine` · 32 عمود · 10 علاقة

**إيه الجدول؟** صنف، كمية، سعر، ضريبة، مخزن، مركز، حساب إيراد.

**امتى بيتستخدم؟** مجموع السطور = إجمالي الفاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| base كمية | `baseQuantity` | Decimal | حقل «base كمية» على هذا الجدول. |
| base وحدة | `baseUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «base وحدة». |
| conversion factor | `conversionFactor` | Decimal? | حقل «conversion factor» على هذا الجدول. |
| سعر | `price` | Decimal | حقل «سعر» على هذا الجدول. |
| إجمالي | `total` | Decimal | حقل «إجمالي» على هذا الجدول. |
| خصم percent | `discountPercent` | Decimal? | حقل «خصم percent» على هذا الجدول. |
| الخصم | `discountAmount` | Decimal? | قيمة الخصم على الرأس أو السطر. |
| ضريبة percent | `taxPercent` | Decimal? | حقل «ضريبة percent» على هذا الجدول. |
| الضريبة | `taxAmount` | Decimal? | قيمة الضريبة المحسوبة. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| وحدة تكلفة at صرف | `unitCostAtIssue` | Decimal? | حقل «وحدة تكلفة at صرف» على هذا الجدول. |
| original فاتورة سطر | `originalInvoiceLineId` | String? | مفتاح أجنبي يربط الصف بجدول «original فاتورة سطر». |
| header خصم allocated | `headerDiscountAllocated` | Decimal? | حقل «header خصم allocated» على هذا الجدول. |
| batch رقم | `batchNumber` | String? | حقل «batch رقم» على هذا الجدول. |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| تشغيل تاريخ | `productionDate` | DateTime? | حقل «تشغيل تاريخ» على هذا الجدول. |
| مسلسل numbers | `serialNumbers` | String? | حقل «مسلسل numbers» على هذا الجدول. |
| سطر notes | `lineNotes` | String? | حقل «سطر notes» على هذا الجدول. |
| ضريبة exemption reason | `taxExemptionReason` | String? | حقل «ضريبة exemption reason» على هذا الجدول. |
| المخزن | `warehouseId` | String? | المخزن اللي الكمية بتتحرك منه أو إليه. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| خصم منبع ضريبة سعر | `withholdingTaxRate` | Decimal? | حقل «خصم منبع ضريبة سعر» على هذا الجدول. |
| خصم منبع ضريبة مبلغ | `withholdingTaxAmount` | Decimal? | حقل «خصم منبع ضريبة مبلغ» على هذا الجدول. |
| batch allocations | `batchAllocations` | Json? | حقل «batch allocations» على هذا الجدول. |
| لون | `color` | String? | حقل «لون» على هذا الجدول. |
| مقاس | `size` | String? | حقل «مقاس» على هذا الجدول. |
| custom revenue حساب | `customRevenueAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «custom revenue حساب». |

**العلاقات:**

- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `N-1` وحدة → وحدات القياس: كل صف هنا مربوط بصف واحد من «وحدات القياس» عبر unitId.
- `N-0..1` base وحدة → وحدات القياس: ربط اختياري بصف واحد من «وحدات القياس» عبر baseUnitId.
- `N-0..1` مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر warehouseId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` custom revenue حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر customRevenueAccountId.
- `1-N` تكلفة إضافية تكلفة تخصيص lines → سطور توزيع التكلفة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور توزيع التكلفة».
- `N-0..1` original فاتورة سطر → سطور الفاتورة: ربط اختياري بصف واحد من «سطور الفاتورة» عبر originalInvoiceLineId.
- `1-N` return lines → سطور الفاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الفاتورة».

### 112. شروط الفاتورة (`invoice_conditions`)

موديل: `InvoiceCondition` · 5 عمود · 1 علاقة

**إيه الجدول؟** نصوص تطبع في ذيل الفاتورة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: شروط الفاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| condition | `condition` | String | حقل «condition» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` فاتورة → الفواتير: كل صف هنا مربوط بصف واحد من «الفواتير» عبر invoiceId.

### 241. عمولة المندوب بالكمية (`representative_commission_quantities`)

موديل: `RepresentativeCommissionQuantity` · 14 عمود · 2 علاقة

**إيه الجدول؟** شريحة عمولة حسب عدد الوحدات.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عمولة المندوب بالكمية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الصنف | `itemId` | String? | الصنف المخزني أو الخدمي على السطر. |
| صنف اسم | `itemName` | String? | حقل «صنف اسم» على هذا الجدول. |
| سياسة اسم | `policyName` | String? | حقل «سياسة اسم» على هذا الجدول. |
| days | `days` | Int? | حقل «days» على هذا الجدول. |
| عمولة before | `commissionBefore` | Decimal? | حقل «عمولة before» على هذا الجدول. |
| عمولة after | `commissionAfter` | Decimal? | حقل «عمولة after» على هذا الجدول. |
| cash سعر | `cashRate` | Decimal? | حقل «cash سعر» على هذا الجدول. |
| ائتمان/دائن سعر | `creditRate` | Decimal? | حقل «ائتمان/دائن سعر» على هذا الجدول. |
| percent | `percent` | Decimal? | حقل «percent» على هذا الجدول. |
| هدف | `target` | Decimal? | حقل «هدف» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` صنف → الأصناف: ربط اختياري بصف واحد من «الأصناف» عبر itemId.

### 242. عمولة المندوب بالقيمة (`representative_commission_values`)

موديل: `RepresentativeCommissionValue` · 8 عمود · 2 علاقة

**إيه الجدول؟** رأس سياسة قيمة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عمولة المندوب بالقيمة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم | `name` | String | اسم الصف. |
| هدف | `target` | Decimal? | حقل «هدف» على هذا الجدول. |
| هدف percentage | `targetPercentage` | Decimal? | حقل «هدف percentage» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` tiers → شرائح عمولة القيمة: هذا الجدول أب: صف واحد هنا له أكثر من «شرائح عمولة القيمة».

### 243. شرائح عمولة القيمة (`representative_commission_value_tiers`)

موديل: `RepresentativeCommissionValueTier` · 5 عمود · 1 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: شرائح عمولة القيمة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| سياسة | `policyId` | String | مفتاح أجنبي يربط الصف بجدول «سياسة». |
| days | `days` | Int? | حقل «days» على هذا الجدول. |
| عمولة pct | `commissionPct` | Decimal? | حقل «عمولة pct» على هذا الجدول. |
| sort أمر | `sortOrder` | Int | حقل «sort أمر» على هذا الجدول. |

**العلاقات:**

- `N-1` سياسة → عمولة المندوب بالقيمة: كل صف هنا مربوط بصف واحد من «عمولة المندوب بالقيمة» عبر policyId.

### 244. سياسات عمولة المندوب (`representative_commission_policies`)

موديل: `RepresentativeCommissionPolicy` · 7 عمود · 2 علاقة

**إيه الجدول؟** سياسة مربوطة بمندوب/فترة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سياسات عمولة المندوب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` tiers → شرائح سياسة العمولة: هذا الجدول أب: صف واحد هنا له أكثر من «شرائح سياسة العمولة».

### 245. شرائح سياسة العمولة (`representative_commission_policy_tiers`)

موديل: `RepresentativeCommissionPolicyTier` · 8 عمود · 1 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: شرائح سياسة العمولة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| سياسة | `policyId` | String | مفتاح أجنبي يربط الصف بجدول «سياسة». |
| هدف slice | `targetSlice` | String? | حقل «هدف slice» على هذا الجدول. |
| هدف pct | `targetPct` | Decimal? | حقل «هدف pct» على هذا الجدول. |
| عمولة pct | `commissionPct` | Decimal? | حقل «عمولة pct» على هذا الجدول. |
| bonus pct | `bonusPct` | Decimal? | حقل «bonus pct» على هذا الجدول. |
| increase pct | `increasePct` | Decimal? | حقل «increase pct» على هذا الجدول. |
| sort أمر | `sortOrder` | Int | حقل «sort أمر» على هذا الجدول. |

**العلاقات:**

- `N-1` سياسة → سياسات عمولة المندوب: كل صف هنا مربوط بصف واحد من «سياسات عمولة المندوب» عبر policyId.

## موارد بشرية

موظف، عقد، مسير، سلف، إجازات، نهاية خدمة.

### 113. الموظفون (`employees`)

موديل: `Employee` · 51 عمود · 19 علاقة

**إيه الجدول؟** كارت الموظف: وظيفة، إدارة، حساب سلفة.

**امتى بيتستخدم؟** كل مسيرات الرواتب والإجازات.

**الشاشات:** بطاقة موظف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| موظف | `employeeId` | String? | مفتاح أجنبي يربط الصف بجدول «موظف». |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| gender | `gender` | String? | حقل «gender» على هذا الجدول. |
| جنسية | `nationalityId` | String? | مفتاح أجنبي يربط الصف بجدول «جنسية». |
| ديانة | `religionId` | String? | مفتاح أجنبي يربط الصف بجدول «ديانة». |
| حالة اجتماعية حالة | `maritalStatusId` | String? | مفتاح أجنبي يربط الصف بجدول «حالة اجتماعية حالة». |
| birth تاريخ | `birthDate` | DateTime? | حقل «birth تاريخ» على هذا الجدول. |
| دراسي qualification | `academicQualification` | String? | حقل «دراسي qualification» على هذا الجدول. |
| specialization | `specialization` | String? | حقل «specialization» على هذا الجدول. |
| university | `university` | String? | حقل «university» على هذا الجدول. |
| passport رقم | `passportNumber` | String? | حقل «passport رقم» على هذا الجدول. |
| insurance سياسة رقم | `insurancePolicyNumber` | String? | حقل «insurance سياسة رقم» على هذا الجدول. |
| social insurance | `socialInsurance` | String? | حقل «social insurance» على هذا الجدول. |
| سلفة حساب | `advanceAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «سلفة حساب». |
| fingerprint رقم | `fingerprintNumber` | String? | حقل «fingerprint رقم» على هذا الجدول. |
| identity رقم | `identityNumber` | String? | حقل «identity رقم» على هذا الجدول. |
| identity صرف تاريخ | `identityIssueDate` | DateTime? | حقل «identity صرف تاريخ» على هذا الجدول. |
| identity صرف تاريخ hijri | `identityIssueDateHijri` | String? | حقل «identity صرف تاريخ hijri» على هذا الجدول. |
| identity expiry تاريخ | `identityExpiryDate` | DateTime? | حقل «identity expiry تاريخ» على هذا الجدول. |
| identity expiry تاريخ hijri | `identityExpiryDateHijri` | String? | حقل «identity expiry تاريخ hijri» على هذا الجدول. |
| passport صرف تاريخ | `passportIssueDate` | DateTime? | حقل «passport صرف تاريخ» على هذا الجدول. |
| passport صرف تاريخ hijri | `passportIssueDateHijri` | String? | حقل «passport صرف تاريخ hijri» على هذا الجدول. |
| passport expiry تاريخ | `passportExpiryDate` | DateTime? | حقل «passport expiry تاريخ» على هذا الجدول. |
| passport expiry تاريخ hijri | `passportExpiryDateHijri` | String? | حقل «passport expiry تاريخ hijri» على هذا الجدول. |
| graduation تاريخ | `graduationDate` | DateTime? | حقل «graduation تاريخ» على هذا الجدول. |
| graduation تاريخ hijri | `graduationDateHijri` | String? | حقل «graduation تاريخ hijri» على هذا الجدول. |
| insurance صرف تاريخ | `insuranceIssueDate` | DateTime? | حقل «insurance صرف تاريخ» على هذا الجدول. |
| insurance صرف تاريخ hijri | `insuranceIssueDateHijri` | String? | حقل «insurance صرف تاريخ hijri» على هذا الجدول. |
| insurance expiry تاريخ | `insuranceExpiryDate` | DateTime? | حقل «insurance expiry تاريخ» على هذا الجدول. |
| insurance expiry تاريخ hijri | `insuranceExpiryDateHijri` | String? | حقل «insurance expiry تاريخ hijri» على هذا الجدول. |
| mobile | `mobile` | String? | حقل «mobile» على هذا الجدول. |
| home phone | `homePhone` | String? | حقل «home phone» على هذا الجدول. |
| work phone | `workPhone` | String? | حقل «work phone» على هذا الجدول. |
| العنوان | `address` | String? | عنوان الطرف. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| join تاريخ | `joinDate` | DateTime? | حقل «join تاريخ» على هذا الجدول. |
| basic راتب | `basicSalary` | Decimal? | حقل «basic راتب» على هذا الجدول. |
| fixed allowances | `fixedAllowances` | Decimal? | حقل «fixed allowances» على هذا الجدول. |
| social insurance enrolled | `socialInsuranceEnrolled` | Boolean | حقل «social insurance enrolled» على هذا الجدول. |
| ضريبة exemption مبلغ | `taxExemptionAmount` | Decimal? | حقل «ضريبة exemption مبلغ» على هذا الجدول. |
| وظيفة مسمى | `jobTitleId` | String? | مفتاح أجنبي يربط الصف بجدول «وظيفة مسمى». |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| إدارة | `departmentId` | String? | مفتاح أجنبي يربط الصف بجدول «إدارة». |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` إدارة → الإدارات: ربط اختياري بصف واحد من «الإدارات» عبر departmentId.
- `N-0..1` وظيفة مسمى → المسميات الوظيفية: ربط اختياري بصف واحد من «المسميات الوظيفية» عبر jobTitleId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `N-0..1` جنسية → الجنسيات: ربط اختياري بصف واحد من «الجنسيات» عبر nationalityId.
- `N-0..1` ديانة → الديانات: ربط اختياري بصف واحد من «الديانات» عبر religionId.
- `N-0..1` حالة اجتماعية حالة → الحالة الاجتماعية: ربط اختياري بصف واحد من «الحالة الاجتماعية» عبر maritalStatusId.
- `N-0..1` سلفة حساب → دليل الحسابات: ربط اختياري بصف واحد من «دليل الحسابات» عبر advanceAccountId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».
- `1-N` procedures → إجراءات شؤون الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «إجراءات شؤون الموظفين».
- `1-N` advances → سلف الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «سلف الموظفين».
- `1-N` monthly salaries → الرواتب الشهرية (مستند): هذا الجدول أب: صف واحد هنا له أكثر من «الرواتب الشهرية (مستند)».
- `1-N` سكن allowance clearances → إخلاء بدل السكن: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء بدل السكن».
- `1-N` end of service clearances → إخلاء نهاية الخدمة: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء نهاية الخدمة».
- `1-N` annual إجازة entitlements clearances → إخلاء رصيد الإجازات: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء رصيد الإجازات».
- `1-N` end of service disbursements → صرف نهاية الخدمة: هذا الجدول أب: صف واحد هنا له أكثر من «صرف نهاية الخدمة».
- `1-N` annual إجازة entitlements disbursements → صرف مقابل الإجازة: هذا الجدول أب: صف واحد هنا له أكثر من «صرف مقابل الإجازة».
- `1-N` سكن allowance entitlements disbursements → صرف بدل السكن: هذا الجدول أب: صف واحد هنا له أكثر من «صرف بدل السكن».
- `1-N` مسير run items → سطور المسير: هذا الجدول أب: صف واحد هنا له أكثر من «سطور المسير».

### 114. عقود الموظفين (`employee_contracts`)

موديل: `EmployeeContract` · 30 عمود · 11 علاقة

**إيه الجدول؟** راتب أساسي، بدلات، تاريخ تعيين.

**امتى بيتستخدم؟** أساس حساب المسير.

**الشاشات:** عقد موظف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| عقد start تاريخ | `contractStartDate` | DateTime | حقل «عقد start تاريخ» على هذا الجدول. |
| عقد start تاريخ hijri | `contractStartDateHijri` | String? | حقل «عقد start تاريخ hijri» على هذا الجدول. |
| عقد end تاريخ | `contractEndDate` | DateTime? | حقل «عقد end تاريخ» على هذا الجدول. |
| عقد end تاريخ hijri | `contractEndDateHijri` | String? | حقل «عقد end تاريخ hijri» على هذا الجدول. |
| wage سياسة | `wagePolicyId` | String? | مفتاح أجنبي يربط الصف بجدول «wage سياسة». |
| basic راتب | `basicSalary` | Decimal? | حقل «basic راتب» على هذا الجدول. |
| insurance راتب | `insuranceSalary` | Decimal? | حقل «insurance راتب» على هذا الجدول. |
| insurance percentage | `insurancePercentage` | Decimal? | حقل «insurance percentage» على هذا الجدول. |
| دفع method | `paymentMethod` | String? | fund/bank |
| موظف responsibility | `employeeResponsibility` | Decimal? | حقل «موظف responsibility» على هذا الجدول. |
| شركة responsibility | `companyResponsibility` | Decimal? | حقل «شركة responsibility» على هذا الجدول. |
| إجازة رصيد | `leaveBalance` | Decimal? | حقل «إجازة رصيد» على هذا الجدول. |
| إدارة | `departmentId` | String? | مفتاح أجنبي يربط الصف بجدول «إدارة». |
| section | `sectionId` | String? | مفتاح أجنبي يربط الصف بجدول «section». |
| وظيفة cadre | `jobCadreId` | String? | مفتاح أجنبي يربط الصف بجدول «وظيفة cadre». |
| وظيفة مسمى | `jobTitleId` | String? | مفتاح أجنبي يربط الصف بجدول «وظيفة مسمى». |
| مدينة | `cityId` | String? | مفتاح أجنبي يربط الصف بجدول «مدينة». |
| work فرع | `workBranchId` | String? | مفتاح أجنبي يربط الصف بجدول «work فرع». |
| راتب فرع | `salaryBranchId` | String? | مفتاح أجنبي يربط الصف بجدول «راتب فرع». |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| auto renewal | `autoRenewal` | Boolean | حقل «auto renewal» على هذا الجدول. |
| attendance سياسة | `attendancePolicy` | Boolean | حقل «attendance سياسة» على هذا الجدول. |
| income ضريبة | `incomeTax` | Boolean | حقل «income ضريبة» على هذا الجدول. |
| general notes | `generalNotes` | String? | حقل «general notes» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.
- `N-0..1` wage سياسة → سياسات الأجور: ربط اختياري بصف واحد من «سياسات الأجور» عبر wagePolicyId.
- `N-0..1` إدارة → الإدارات: ربط اختياري بصف واحد من «الإدارات» عبر departmentId.
- `N-0..1` وظيفة مسمى → المسميات الوظيفية: ربط اختياري بصف واحد من «المسميات الوظيفية» عبر jobTitleId.
- `N-0..1` وظيفة cadre → الكادرات الوظيفية: ربط اختياري بصف واحد من «الكادرات الوظيفية» عبر jobCadreId.
- `N-0..1` مدينة → المدن: ربط اختياري بصف واحد من «المدن» عبر cityId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `1-N` monthly salaries → الرواتب الشهرية (مستند): هذا الجدول أب: صف واحد هنا له أكثر من «الرواتب الشهرية (مستند)».
- `1-N` سكن allowance clearances → إخلاء بدل السكن: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء بدل السكن».
- `1-N` end of service clearances → إخلاء نهاية الخدمة: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء نهاية الخدمة».
- `1-N` annual إجازة entitlements clearances → إخلاء رصيد الإجازات: هذا الجدول أب: صف واحد هنا له أكثر من «إخلاء رصيد الإجازات».

### 115. إجراءات شؤون الموظفين (`employee_procedures`)

موديل: `EmployeeProcedure` · 12 عمود · 1 علاقة

**إيه الجدول؟** جزاء، ترقية، نقل…

**امتى بيتستخدم؟** متابعة قرارات HR.

**الشاشات:** إجراءات الموظفين

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| procedure نوع | `procedureType` | String | warning/reward/penalty/transfer/promotion/etc. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المبلغ | `amount` | Decimal? | قيمة الصف بعملة المستند. |
| وحدة | `unit` | String? | e.g., "جنية", "دولار", "نسبة" |
| reason | `reason` | String? | حقل «reason» على هذا الجدول. |
| أنشأه | `createdBy` | String | المستخدم اللي فتح المستند أول مرة. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

### 116. سلف الموظفين (`employee_advances`)

موديل: `EmployeeAdvance` · 17 عمود · 1 علاقة

**إيه الجدول؟** سلفة مربوطة بحساب سلفة.

**امتى بيتستخدم؟** تُخصم من المسير أو تُسوّى بسند.

**الشاشات:** سلفة موظف

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| value | `value` | Decimal | حقل «value» على هذا الجدول. |
| monthly قسط | `monthlyInstallment` | Decimal? | حقل «monthly قسط» على هذا الجدول. |
| من month | `fromMonth` | String? | حقل «من month» على هذا الجدول. |
| إلى سنة | `toYear` | String? | حقل «إلى سنة» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| دفع method | `paymentMethod` | String? | fund/bank |
| المتبقي | `remainingAmount` | Decimal? | الصافي ناقص المدفوع. أساس أعمار الديون. |
| is settled | `isSettled` | Boolean | علامة نعم/لا: is settled. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

### 117. إعدادات الموارد البشرية (`hr_settings`)

موديل: `HrSettings` · 13 عمود · 1 علاقة

**إيه الجدول؟** حسابات الرواتب والبدلات والإجازات الافتراضية.

**امتى بيتستخدم؟** تُقرأ عند ترحيل المسير والإجازات.

**الشاشات:** إعدادات HR

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| salaries expense حساب كود | `salariesExpenseAccountCode` | String? | حقل «salaries expense حساب كود» على هذا الجدول. |
| employer insurance expense حساب كود | `employerInsuranceExpenseAccountCode` | String? | حقل «employer insurance expense حساب كود» على هذا الجدول. |
| social insurance payable حساب كود | `socialInsurancePayableAccountCode` | String? | حقل «social insurance payable حساب كود» على هذا الجدول. |
| مسير ضريبة payable حساب كود | `payrollTaxPayableAccountCode` | String? | حقل «مسير ضريبة payable حساب كود» على هذا الجدول. |
| موظف advances حساب كود | `employeeAdvancesAccountCode` | String? | حقل «موظف advances حساب كود» على هذا الجدول. |
| accrued مسير حساب كود | `accruedPayrollAccountCode` | String? | حقل «accrued مسير حساب كود» على هذا الجدول. |
| موظف insurance سعر | `employeeInsuranceRate` | Decimal | حقل «موظف insurance سعر» على هذا الجدول. |
| employer insurance سعر | `employerInsuranceRate` | Decimal | حقل «employer insurance سعر» على هذا الجدول. |
| مسير ضريبة flat سعر | `payrollTaxFlatRate` | Decimal | حقل «مسير ضريبة flat سعر» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 118. تشغيل المسير (`payroll_runs`)

موديل: `PayrollRun` · 21 عمود · 4 علاقة

**إيه الجدول؟** رأس مسير شهر: من/إلى، حالة الاعتماد.

**امتى بيتستخدم؟** بعد الترحيل يولّد قيود رواتب.

**الشاشات:** مسير الرواتب

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| فترة month | `periodMonth` | Int | حقل «فترة month» على هذا الجدول. |
| فترة سنة | `periodYear` | Int | حقل «فترة سنة» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| إجمالي gross | `totalGross` | Decimal | حقل «إجمالي gross» على هذا الجدول. |
| إجمالي صافي | `totalNet` | Decimal | حقل «إجمالي صافي» على هذا الجدول. |
| إجمالي employer insurance | `totalEmployerInsurance` | Decimal | حقل «إجمالي employer insurance» على هذا الجدول. |
| إجمالي موظف insurance | `totalEmployeeInsurance` | Decimal | حقل «إجمالي موظف insurance» على هذا الجدول. |
| إجمالي ضريبة | `totalTax` | Decimal | حقل «إجمالي ضريبة» على هذا الجدول. |
| إجمالي سلفة deduction | `totalAdvanceDeduction` | Decimal | حقل «إجمالي سلفة deduction» على هذا الجدول. |
| accrual قيد حركة | `accrualJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «accrual قيد حركة». |
| دفع قيد حركة | `paymentJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع قيد حركة». |
| دفع خزينة | `paymentSafeId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع خزينة». |
| دفع بنك حساب | `paymentBankAccountId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع بنك حساب». |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| paid at | `paidAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `1-N` items → سطور المسير: هذا الجدول أب: صف واحد هنا له أكثر من «سطور المسير».

### 119. سطور المسير (`payroll_run_items`)

موديل: `PayrollRunItem` · 16 عمود · 2 علاقة

**إيه الجدول؟** صافي كل موظف في هذا التشغيل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور المسير.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مسير run | `payrollRunId` | String | مفتاح أجنبي يربط الصف بجدول «مسير run». |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| basic راتب | `basicSalary` | Decimal | حقل «basic راتب» على هذا الجدول. |
| allowances | `allowances` | Decimal | حقل «allowances» على هذا الجدول. |
| overtime | `overtime` | Decimal | حقل «overtime» على هذا الجدول. |
| absence deduction | `absenceDeduction` | Decimal | حقل «absence deduction» على هذا الجدول. |
| other deductions | `otherDeductions` | Decimal | حقل «other deductions» على هذا الجدول. |
| gross راتب | `grossSalary` | Decimal | حقل «gross راتب» على هذا الجدول. |
| employer insurance | `employerInsurance` | Decimal | حقل «employer insurance» على هذا الجدول. |
| موظف insurance | `employeeInsurance` | Decimal | حقل «موظف insurance» على هذا الجدول. |
| ضريبة | `tax` | Decimal | حقل «ضريبة» على هذا الجدول. |
| سلفة deduction | `advanceDeduction` | Decimal | حقل «سلفة deduction» على هذا الجدول. |
| صافي راتب | `netSalary` | Decimal | حقل «صافي راتب» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مسير run → تشغيل المسير: كل صف هنا مربوط بصف واحد من «تشغيل المسير» عبر payrollRunId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

### 177. الرواتب الشهرية (مستند) (`monthly_salaries`)

موديل: `MonthlySalary` · 26 عمود · 3 علاقة

**إيه الجدول؟** مستند راتب شهر لموظف أو مجموعة.

**امتى بيتستخدم؟** يُصرف بعد المسير.

**الشاشات:** راتب شهري

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| عقد | `contractId` | String? | مفتاح أجنبي يربط الصف بجدول «عقد». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| فترة سنة | `periodYear` | String | حقل «فترة سنة» على هذا الجدول. |
| فترة month | `periodMonth` | String | حقل «فترة month» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| work days | `workDays` | Decimal? | حقل «work days» على هذا الجدول. |
| basic راتب | `basicSalary` | Decimal | حقل «basic راتب» على هذا الجدول. |
| إجمالي allowances | `totalAllowances` | Decimal? | حقل «إجمالي allowances» على هذا الجدول. |
| إجمالي deductions | `totalDeductions` | Decimal? | حقل «إجمالي deductions» على هذا الجدول. |
| additions | `additions` | Decimal? | حقل «additions» على هذا الجدول. |
| discounts | `discounts` | Decimal? | حقل «discounts» على هذا الجدول. |
| overtime | `overtime` | Decimal? | حقل «overtime» على هذا الجدول. |
| absence | `absence` | Decimal? | حقل «absence» على هذا الجدول. |
| advances | `advances` | Decimal? | حقل «advances» على هذا الجدول. |
| موظف insurance | `employeeInsurance` | Decimal? | حقل «موظف insurance» على هذا الجدول. |
| شركة insurance | `companyInsurance` | Decimal? | حقل «شركة insurance» على هذا الجدول. |
| صافي راتب | `netSalary` | Decimal | حقل «صافي راتب» على هذا الجدول. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.
- `N-0..1` عقد → عقود الموظفين: ربط اختياري بصف واحد من «عقود الموظفين» عبر contractId.

### 178. إخلاء بدل السكن (`housing_allowance_clearances`)

موديل: `HousingAllowanceClearance` · 20 عمود · 3 علاقة

**إيه الجدول؟** تصفية بدل سكن.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إخلاء بدل السكن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| عقد | `contractId` | String? | مفتاح أجنبي يربط الصف بجدول «عقد». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| days since last disbursement | `daysSinceLastDisbursement` | Int? | حقل «days since last disbursement» على هذا الجدول. |
| months since last disbursement | `monthsSinceLastDisbursement` | Int? | حقل «months since last disbursement» على هذا الجدول. |
| available additions | `availableAdditions` | Decimal? | حقل «available additions» على هذا الجدول. |
| monthly راتب | `monthlySalary` | Decimal? | حقل «monthly راتب» على هذا الجدول. |
| إجمالي value | `totalValue` | Decimal? | حقل «إجمالي value» على هذا الجدول. |
| إجمالي راتب | `totalSalary` | Decimal? | حقل «إجمالي راتب» على هذا الجدول. |
| allowance مبلغ | `allowanceAmount` | Decimal | حقل «allowance مبلغ» على هذا الجدول. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.
- `N-0..1` عقد → عقود الموظفين: ربط اختياري بصف واحد من «عقود الموظفين» عبر contractId.

### 179. إخلاء نهاية الخدمة (`end_of_service_clearances`)

موديل: `EndOfServiceClearance` · 24 عمود · 3 علاقة

**إيه الجدول؟** حساب مكافأة نهاية الخدمة قبل الصرف.

**امتى بيتستخدم؟** بعد الاعتماد يُصرف بسند.

**الشاشات:** نهاية الخدمة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| عقد | `contractId` | String? | مفتاح أجنبي يربط الصف بجدول «عقد». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| work days | `workDays` | Decimal? | حقل «work days» على هذا الجدول. |
| absence days | `absenceDays` | Decimal? | حقل «absence days» على هذا الجدول. |
| years of work | `yearsOfWork` | Decimal? | حقل «years of work» على هذا الجدول. |
| صافي work days | `netWorkDays` | Decimal? | حقل «صافي work days» على هذا الجدول. |
| vacation days | `vacationDays` | Decimal? | حقل «vacation days» على هذا الجدول. |
| due days | `dueDays` | Decimal? | حقل «due days» على هذا الجدول. |
| due days value | `dueDaysValue` | Decimal? | حقل «due days value» على هذا الجدول. |
| monthly راتب | `monthlySalary` | Decimal? | حقل «monthly راتب» على هذا الجدول. |
| إجمالي value | `totalValue` | Decimal? | حقل «إجمالي value» على هذا الجدول. |
| vacation days value | `vacationDaysValue` | Decimal? | حقل «vacation days value» على هذا الجدول. |
| eos مبلغ | `eosAmount` | Decimal | حقل «eos مبلغ» على هذا الجدول. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.
- `N-0..1` عقد → عقود الموظفين: ربط اختياري بصف واحد من «عقود الموظفين» عبر contractId.

### 180. إخلاء رصيد الإجازات (`annual_leave_entitlements_clearances`)

موديل: `AnnualLeaveEntitlementsClearance` · 33 عمود · 3 علاقة

**إيه الجدول؟** تصفية رصيد الإجازة السنوية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إخلاء رصيد الإجازات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| عقد | `contractId` | String? | مفتاح أجنبي يربط الصف بجدول «عقد». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| من تاريخ | `fromDate` | DateTime? | حقل «من تاريخ» على هذا الجدول. |
| من تاريخ hijri | `fromDateHijri` | String? | حقل «من تاريخ hijri» على هذا الجدول. |
| إلى تاريخ | `toDate` | DateTime? | حقل «إلى تاريخ» على هذا الجدول. |
| إلى تاريخ hijri | `toDateHijri` | String? | حقل «إلى تاريخ hijri» على هذا الجدول. |
| last direct تاريخ | `lastDirectDate` | DateTime? | حقل «last direct تاريخ» على هذا الجدول. |
| last direct تاريخ hijri | `lastDirectDateHijri` | String? | حقل «last direct تاريخ hijri» على هذا الجدول. |
| work days | `workDays` | Decimal? | حقل «work days» على هذا الجدول. |
| due days | `dueDays` | Decimal? | حقل «due days» على هذا الجدول. |
| previous رصيد | `previousBalance` | Decimal? | حقل «previous رصيد» على هذا الجدول. |
| إجمالي available days | `totalAvailableDays` | Decimal? | حقل «إجمالي available days» على هذا الجدول. |
| monthly راتب | `monthlySalary` | Decimal? | حقل «monthly راتب» على هذا الجدول. |
| available allowances | `availableAllowances` | Decimal? | حقل «available allowances» على هذا الجدول. |
| إجمالي value | `totalValue` | Decimal? | حقل «إجمالي value» على هذا الجدول. |
| due tickets | `dueTickets` | Decimal? | حقل «due tickets» على هذا الجدول. |
| added value | `addedValue` | Decimal? | حقل «added value» على هذا الجدول. |
| required days | `requiredDays` | Decimal? | حقل «required days» على هذا الجدول. |
| deducted value | `deductedValue` | Decimal? | حقل «deducted value» على هذا الجدول. |
| إجازة entitlements | `leaveEntitlements` | Decimal? | حقل «إجازة entitlements» على هذا الجدول. |
| إجمالي entitlements | `totalEntitlements` | Decimal? | حقل «إجمالي entitlements» على هذا الجدول. |
| entitlement days | `entitlementDays` | Decimal | حقل «entitlement days» على هذا الجدول. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.
- `N-0..1` عقد → عقود الموظفين: ربط اختياري بصف واحد من «عقود الموظفين» عبر contractId.

### 189. سياسات الأجور (`wage_policies`)

موديل: `WagePolicy` · 8 عمود · 2 علاقة

**إيه الجدول؟** قاعدة احتساب الأجر.

**امتى بيتستخدم؟** تُربط بعقد الموظف.

**الشاشات:** سياسات الأجور

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` contracts → عقود الموظفين: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الموظفين».

### 190. البدلات (`allowances`)

موديل: `Allowance` · 8 عمود · 1 علاقة

**إيه الجدول؟** أنواع البدلات على العقد/المسير.

**امتى بيتستخدم؟** يُستخدم مع شاشات: البدلات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 191. الاستقطاعات (`deductions`)

موديل: `Deduction` · 8 عمود · 1 علاقة

**إيه الجدول؟** أنواع الخصم من الراتب.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الاستقطاعات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 235. صرف نهاية الخدمة (`end_of_service_disbursements`)

موديل: `EndOfServiceDisbursement` · 14 عمود · 2 علاقة

**إيه الجدول؟** سند صرف بعد الإخلاء.

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرف نهاية الخدمة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| دفع method | `paymentMethod` | String? | 'fund' | 'bank' |
| vacation | `vacationId` | String? | Reference to EndOfServiceClearance or vacation type |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

### 236. صرف مقابل الإجازة (`annual_leave_entitlements_disbursements`)

موديل: `AnnualLeaveEntitlementsDisbursement` · 14 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرف مقابل الإجازة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| دفع method | `paymentMethod` | String? | 'fund' | 'bank' |
| vacation | `vacationId` | String? | Reference to AnnualLeaveEntitlementsClearance |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

### 237. صرف الرواتب الشهرية (`monthly_salaries_disbursements`)

موديل: `MonthlySalariesDisbursement` · 10 عمود · 1 علاقة

**إيه الجدول؟** سند دفع المسير.

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرف الرواتب الشهرية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الشهر | `month` | String | شهر الملخص (1–12) في أرصدة الحسابات. e.g., "يناير", "فبراير" |
| السنة | `year` | String | السنة الرقمية للملخص أو الفترة. e.g., "2025" |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 238. صرف بدل السكن (`housing_allowance_entitlements_disbursements`)

موديل: `HousingAllowanceEntitlementsDisbursement` · 14 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرف بدل السكن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| موظف | `employeeId` | String | مفتاح أجنبي يربط الصف بجدول «موظف». |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| دفع method | `paymentMethod` | String? | 'fund' | 'bank' |
| سكن ref | `housingRef` | String? | Reference to HousingAllowanceClearance or type |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| record | `record` | String? | حقل «record» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` موظف → الموظفون: كل صف هنا مربوط بصف واحد من «الموظفون» عبر employeeId.

## تصنيع

قائمة مكونات وأوامر تشغيل وصرف خام.

### 120. إعدادات التصنيع (`manufacturing_settings`)

موديل: `ManufacturingSettings` · 9 عمود · 1 علاقة

**إيه الجدول؟** حسابات الإنتاج والانحراف الافتراضية.

**امتى بيتستخدم؟** تُقرأ عند ترحيل أمر التشغيل.

**الشاشات:** إعدادات التصنيع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| wip materials حساب كود | `wipMaterialsAccountCode` | String? | حقل «wip materials حساب كود» على هذا الجدول. |
| wip labor overhead حساب كود | `wipLaborOverheadAccountCode` | String? | حقل «wip labor overhead حساب كود» على هذا الجدول. |
| raw inventory حساب كود | `rawInventoryAccountCode` | String? | حقل «raw inventory حساب كود» على هذا الجدول. |
| finished goods حساب كود | `finishedGoodsAccountCode` | String? | حقل «finished goods حساب كود» على هذا الجدول. |
| overhead absorption حساب كود | `overheadAbsorptionAccountCode` | String? | حقل «overhead absorption حساب كود» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 121. قوائم المكونات BOM (`bill_of_materials`)

موديل: `BillOfMaterials` · 10 عمود · 4 علاقة

**إيه الجدول؟** وصفة: تام ← خامات.

**امتى بيتستخدم؟** أمر التشغيل بيسحب منها.

**الشاشات:** قائمة مكونات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الاسم | `name` | String | اسم الصف. |
| finished صنف | `finishedItemId` | String | مفتاح أجنبي يربط الصف بجدول «finished صنف». |
| base كمية | `baseQuantity` | Decimal | حقل «base كمية» على هذا الجدول. |
| standard labor تكلفة | `standardLaborCost` | Decimal | حقل «standard labor تكلفة» على هذا الجدول. |
| standard overhead تكلفة | `standardOverheadCost` | Decimal | حقل «standard overhead تكلفة» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` finished صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر finishedItemId.
- `1-N` lines → سطور قائمة المكونات: هذا الجدول أب: صف واحد هنا له أكثر من «سطور قائمة المكونات».
- `1-N` تشغيل orders → أوامر التشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «أوامر التشغيل».

### 122. سطور قائمة المكونات (`bom_lines`)

موديل: `BomLine` · 8 عمود · 2 علاقة

**إيه الجدول؟** خامة وكمية لكل وحدة تام.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور قائمة المكونات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مكونات | `bomId` | String | مفتاح أجنبي يربط الصف بجدول «مكونات». |
| raw صنف | `rawItemId` | String | مفتاح أجنبي يربط الصف بجدول «raw صنف». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| scrap percentage | `scrapPercentage` | Decimal | حقل «scrap percentage» على هذا الجدول. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مكونات → قوائم المكونات BOM: كل صف هنا مربوط بصف واحد من «قوائم المكونات BOM» عبر bomId.
- `N-1` raw صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر rawItemId.

### 123. أوامر التشغيل (`production_orders`)

موديل: `ProductionOrder` · 24 عمود · 8 علاقة

**إيه الجدول؟** أمر تصنيع بكمية وخطة.

**امتى بيتستخدم؟** يصرف خام ويستلم تام.

**الشاشات:** أمر تشغيل

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| أمر رقم | `orderNumber` | String | حقل «أمر رقم» على هذا الجدول. |
| مكونات | `bomId` | String | مفتاح أجنبي يربط الصف بجدول «مكونات». |
| finished صنف | `finishedItemId` | String | مفتاح أجنبي يربط الصف بجدول «finished صنف». |
| planned كمية | `plannedQuantity` | Decimal | حقل «planned كمية» على هذا الجدول. |
| actual كمية | `actualQuantity` | Decimal? | حقل «actual كمية» على هذا الجدول. |
| مخزن معرّف raw | `warehouseIdRaw` | String | حقل «مخزن معرّف raw» على هذا الجدول. |
| مخزن معرّف finished | `warehouseIdFinished` | String | حقل «مخزن معرّف finished» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| إجمالي خامة تكلفة | `totalMaterialCost` | Decimal | حقل «إجمالي خامة تكلفة» على هذا الجدول. |
| إجمالي labor تكلفة | `totalLaborCost` | Decimal | حقل «إجمالي labor تكلفة» على هذا الجدول. |
| إجمالي overhead تكلفة | `totalOverheadCost` | Decimal | حقل «إجمالي overhead تكلفة» على هذا الجدول. |
| وحدة تكلفة | `unitCost` | Decimal? | حقل «وحدة تكلفة» على هذا الجدول. |
| materials صرف قيد حركة | `materialsIssueJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «materials صرف قيد حركة». |
| labor overhead قيد حركة | `laborOverheadJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «labor overhead قيد حركة». |
| completion قيد حركة | `completionJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «completion قيد حركة». |
| released at | `releasedAt` | DateTime? | ختم زمني لهذا الحدث. |
| completed at | `completedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-1` مكونات → قوائم المكونات BOM: كل صف هنا مربوط بصف واحد من «قوائم المكونات BOM» عبر bomId.
- `N-1` finished صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر finishedItemId.
- `N-1` مخزن raw → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseIdRaw.
- `N-1` مخزن finished → المخازن: كل صف هنا مربوط بصف واحد من «المخازن» عبر warehouseIdFinished.
- `1-N` خامة issues → صرف خام للتشغيل: هذا الجدول أب: صف واحد هنا له أكثر من «صرف خام للتشغيل».

### 124. صرف خام للتشغيل (`production_material_issues`)

موديل: `ProductionMaterialIssue` · 7 عمود · 2 علاقة

**إيه الجدول؟** رأس إذن صرف خامات على أمر.

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرف خام للتشغيل.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تشغيل أمر | `productionOrderId` | String | مفتاح أجنبي يربط الصف بجدول «تشغيل أمر». |
| صرف تاريخ | `issueDate` | DateTime | علامة نعم/لا: صرف تاريخ. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| إجمالي تكلفة | `totalCost` | Decimal | حقل «إجمالي تكلفة» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` تشغيل أمر → أوامر التشغيل: كل صف هنا مربوط بصف واحد من «أوامر التشغيل» عبر productionOrderId.
- `1-N` lines → سطور صرف الخام: هذا الجدول أب: صف واحد هنا له أكثر من «سطور صرف الخام».

### 125. سطور صرف الخام (`production_material_issue_lines`)

موديل: `ProductionMaterialIssueLine` · 8 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور صرف الخام.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| خامة صرف | `materialIssueId` | String | مفتاح أجنبي يربط الصف بجدول «خامة صرف». |
| raw صنف | `rawItemId` | String | مفتاح أجنبي يربط الصف بجدول «raw صنف». |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| وحدة تكلفة | `unitCost` | Decimal | حقل «وحدة تكلفة» على هذا الجدول. |
| إجمالي تكلفة | `totalCost` | Decimal | حقل «إجمالي تكلفة» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` خامة صرف → صرف خام للتشغيل: كل صف هنا مربوط بصف واحد من «صرف خام للتشغيل» عبر materialIssueId.
- `N-1` raw صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر rawItemId.

## مقاولات ومستخلصات

مشاريع، مستخلصات، مقاول باطن، حصر، خطابات ضمان.

### 126. إعدادات المقاولات (`contracting_settings`)

موديل: `ContractingSettings` · 19 عمود · 1 علاقة

**إيه الجدول؟** حسابات المشروع والمستخلص والضمان.

**امتى بيتستخدم؟** تُقرأ عند ترحيل المستخلص وخطابات الضمان.

**الشاشات:** إعدادات المقاولات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| contracting revenue حساب كود | `contractingRevenueAccountCode` | String? | حقل «contracting revenue حساب كود» على هذا الجدول. |
| مشروع expense حساب كود | `projectExpenseAccountCode` | String? | حقل «مشروع expense حساب كود» على هذا الجدول. |
| client receivable حساب كود | `clientReceivableAccountCode` | String? | حقل «client receivable حساب كود» على هذا الجدول. |
| subcontractor payable حساب كود | `subcontractorPayableAccountCode` | String? | حقل «subcontractor payable حساب كود» على هذا الجدول. |
| عميل سلفة حساب كود | `customerAdvanceAccountCode` | String? | حقل «عميل سلفة حساب كود» على هذا الجدول. |
| subcontractor سلفة حساب كود | `subcontractorAdvanceAccountCode` | String? | حقل «subcontractor سلفة حساب كود» على هذا الجدول. |
| retention held by others حساب كود | `retentionHeldByOthersAccountCode` | String? | حقل «retention held by others حساب كود» على هذا الجدول. |
| retention withheld for others حساب كود | `retentionWithheldForOthersAccountCode` | String? | حقل «retention withheld for others حساب كود» على هذا الجدول. |
| output vat حساب كود | `outputVatAccountCode` | String? | حقل «output vat حساب كود» على هذا الجدول. |
| wht asset حساب كود | `whtAssetAccountCode` | String? | حقل «wht asset حساب كود» على هذا الجدول. |
| wht payable حساب كود | `whtPayableAccountCode` | String? | حقل «wht payable حساب كود» على هذا الجدول. |
| افتراضي vat سعر | `defaultVatRate` | Decimal | حقل «افتراضي vat سعر» على هذا الجدول. |
| افتراضي wht سعر | `defaultWhtRate` | Decimal | حقل «افتراضي wht سعر» على هذا الجدول. |
| input vat حساب كود | `inputVatAccountCode` | String? | حقل «input vat حساب كود» على هذا الجدول. |
| penalties expense حساب كود | `penaltiesExpenseAccountCode` | String? | حقل «penalties expense حساب كود» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 127. مشاريع المقاولات (`contracting_projects`)

موديل: `ContractingProject` · 16 عمود · 15 علاقة

**إيه الجدول؟** المشروع الإنشائي: عميل، مركز تكلفة، ميزانية.

**امتى بيتستخدم؟** أبو المستخلصات والمقاولين من الباطن.

**الشاشات:** مشروع مقاولات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع كود | `projectCode` | String | حقل «مشروع كود» على هذا الجدول. |
| مشروع اسم | `projectName` | String | حقل «مشروع اسم» على هذا الجدول. |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| عقد value | `contractValue` | Decimal | حقل «عقد value» على هذا الجدول. |
| سلفة دفع مبلغ | `advancePaymentAmount` | Decimal | حقل «سلفة دفع مبلغ» على هذا الجدول. |
| سلفة دفع رصيد | `advancePaymentBalance` | Decimal | حقل «سلفة دفع رصيد» على هذا الجدول. |
| سلفة deduction percent | `advanceDeductionPercent` | Decimal | حقل «سلفة deduction percent» على هذا الجدول. |
| retention percent | `retentionPercent` | Decimal | حقل «retention percent» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| تاريخ البداية | `startDate` | DateTime? | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime? | نهاية السنة/الفترة/العقد. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `1-N` subcontracts → تعاقدات الباطن على المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «تعاقدات الباطن على المشروع».
- `1-N` client extracts → مستخلصات العميل (مختصر): هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات العميل (مختصر)».
- `1-N` subcontractor extracts → مستخلصات مقاول الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات مقاول الباطن».
- `1-N` boq items → بنود جدول الكميات (نسخة مشروع): هذا الجدول أب: صف واحد هنا له أكثر من «بنود جدول الكميات (نسخة مشروع)».
- `1-N` عقد extracts → مستخلصات العقد: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات العقد».
- `1-N` enterprise subcontracts → عقود الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الباطن».
- `1-N` owner boq items → بنود جدول كميات المالك: هذا الجدول أب: صف واحد هنا له أكثر من «بنود جدول كميات المالك».
- `1-N` boq markup structures → هيكل هامش الـ BOQ: هذا الجدول أب: صف واحد هنا له أكثر من «هيكل هامش الـ BOQ».
- `1-N` executive measurement sheets → حصر تنفيذي: هذا الجدول أب: صف واحد هنا له أكثر من «حصر تنفيذي».
- `N-0..1` client عقد → عقود العميل (مقاولات): ربط اختياري بصف واحد من «عقود العميل (مقاولات)».
- `1-N` site stock materials → مخزون موقع المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «مخزون موقع المشروع».
- `1-N` مشروع letters of ضمان → خطابات ضمان المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات ضمان المشروع».

### 128. تعاقدات الباطن على المشروع (`project_subcontracts`)

موديل: `ProjectSubcontract` · 10 عمود · 4 علاقة

**إيه الجدول؟** ربط مقاول باطن بالمشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تعاقدات الباطن على المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| subcontractor | `subcontractorId` | String | مفتاح أجنبي يربط الصف بجدول «subcontractor». |
| subcontract value | `subcontractValue` | Decimal | حقل «subcontract value» على هذا الجدول. |
| سلفة دفع رصيد | `advancePaymentBalance` | Decimal | حقل «سلفة دفع رصيد» على هذا الجدول. |
| سلفة recovery percent | `advanceRecoveryPercent` | Decimal | حقل «سلفة recovery percent» على هذا الجدول. |
| retention percent | `retentionPercent` | Decimal | حقل «retention percent» على هذا الجدول. |
| scope of work | `scopeOfWork` | String? | حقل «scope of work» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-1` subcontractor → المقاولون: كل صف هنا مربوط بصف واحد من «المقاولون» عبر subcontractorId.
- `1-N` extracts → مستخلصات مقاول الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات مقاول الباطن».
- `1-N` عقد extracts → مستخلصات العقد: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات العقد».

### 129. مستخلصات العميل (مختصر) (`client_extracts`)

موديل: `ClientExtract` · 17 عمود · 1 علاقة

**إيه الجدول؟** مستخلص يُقدَّم للعميل.

**امتى بيتستخدم؟** دفعة مستحقة من مالك المشروع.

**الشاشات:** مستخلص عميل

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مستخلص رقم | `extractNumber` | String | حقل «مستخلص رقم» على هذا الجدول. |
| فترة start | `periodStart` | DateTime? | حقل «فترة start» على هذا الجدول. |
| فترة end | `periodEnd` | DateTime? | حقل «فترة end» على هذا الجدول. |
| gross مبلغ | `grossAmount` | Decimal | حقل «gross مبلغ» على هذا الجدول. |
| سلفة deduction مبلغ | `advanceDeductionAmount` | Decimal | حقل «سلفة deduction مبلغ» على هذا الجدول. |
| retention مبلغ | `retentionAmount` | Decimal | حقل «retention مبلغ» على هذا الجدول. |
| vat مبلغ | `vatAmount` | Decimal | حقل «vat مبلغ» على هذا الجدول. |
| wht مبلغ | `whtAmount` | Decimal | حقل «wht مبلغ» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.

### 130. مستخلصات مقاول الباطن (`subcontractor_extracts`)

موديل: `SubcontractorExtract` · 20 عمود · 3 علاقة

**إيه الجدول؟** مستحق الباطن عن أعمال منفذة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مستخلصات مقاول الباطن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مشروع subcontract | `projectSubcontractId` | String? | مفتاح أجنبي يربط الصف بجدول «مشروع subcontract». |
| subcontractor | `subcontractorId` | String | مفتاح أجنبي يربط الصف بجدول «subcontractor». |
| مستخلص رقم | `extractNumber` | String | حقل «مستخلص رقم» على هذا الجدول. |
| فترة start | `periodStart` | DateTime? | حقل «فترة start» على هذا الجدول. |
| فترة end | `periodEnd` | DateTime? | حقل «فترة end» على هذا الجدول. |
| gross مبلغ | `grossAmount` | Decimal | حقل «gross مبلغ» على هذا الجدول. |
| سلفة deduction مبلغ | `advanceDeductionAmount` | Decimal | حقل «سلفة deduction مبلغ» على هذا الجدول. |
| retention مبلغ | `retentionAmount` | Decimal | حقل «retention مبلغ» على هذا الجدول. |
| غرامة مبلغ | `penaltyAmount` | Decimal | حقل «غرامة مبلغ» على هذا الجدول. |
| خامة deduction مبلغ | `materialDeductionAmount` | Decimal | حقل «خامة deduction مبلغ» على هذا الجدول. |
| wht مبلغ | `whtAmount` | Decimal | حقل «wht مبلغ» على هذا الجدول. |
| الصافي | `netAmount` | Decimal | بعد الخصم والضريبة والإضافات. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-0..1` مشروع subcontract → تعاقدات الباطن على المشروع: ربط اختياري بصف واحد من «تعاقدات الباطن على المشروع» عبر projectSubcontractId.
- `N-1` subcontractor → المقاولون: كل صف هنا مربوط بصف واحد من «المقاولون» عبر subcontractorId.

### 131. بنود جدول الكميات (نسخة مشروع) (`project_boq_items`)

موديل: `ProjectBoqItem` · 11 عمود · 2 علاقة

**إيه الجدول؟** بند أعمال وكميته في المشروع.

**امتى بيتستخدم؟** المستخلص يخصم منها.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| صنف رقم | `itemNumber` | String | حقل «صنف رقم» على هذا الجدول. |
| البيان / الشرح | `description` | String | نص حر يظهر في القيد والطباعة. |
| وحدة | `unit` | String? | حقل «وحدة» على هذا الجدول. |
| عقد كمية | `contractQuantity` | Decimal | حقل «عقد كمية» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي سعر | `totalPrice` | Decimal | حقل «إجمالي سعر» على هذا الجدول. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `1-N` مستخلص lines → سطور المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «سطور المستخلص».

### 132. مستخلصات العقد (`contract_extracts`)

موديل: `ContractExtract` · 27 عمود · 4 علاقة

**إيه الجدول؟** رأس مستخلص تفصيلي على عقد.

**امتى بيتستخدم؟** بعد الاعتماد يتحول لمطالبة مالية.

**الشاشات:** مستخلص

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مشروع subcontract | `projectSubcontractId` | String? | مفتاح أجنبي يربط الصف بجدول «مشروع subcontract». |
| مستخلص رقم | `extractNumber` | String | حقل «مستخلص رقم» على هذا الجدول. |
| مستخلص نوع | `extractType` | String | حقل «مستخلص نوع» على هذا الجدول. |
| party | `partyId` | String | مفتاح أجنبي يربط الصف بجدول «party». |
| مستخلص تاريخ | `extractDate` | DateTime | حقل «مستخلص تاريخ» على هذا الجدول. |
| فترة start | `periodStart` | DateTime? | حقل «فترة start» على هذا الجدول. |
| فترة end | `periodEnd` | DateTime? | حقل «فترة end» على هذا الجدول. |
| إجمالي executed مبلغ | `totalExecutedAmount` | Decimal | حقل «إجمالي executed مبلغ» على هذا الجدول. |
| previous executed مبلغ | `previousExecutedAmount` | Decimal | حقل «previous executed مبلغ» على هذا الجدول. |
| current executed مبلغ | `currentExecutedAmount` | Decimal | حقل «current executed مبلغ» على هذا الجدول. |
| سلفة دفع deduction | `advancePaymentDeduction` | Decimal | حقل «سلفة دفع deduction» على هذا الجدول. |
| retention deduction | `retentionDeduction` | Decimal | حقل «retention deduction» على هذا الجدول. |
| wht deduction | `whtDeduction` | Decimal | حقل «wht deduction» على هذا الجدول. |
| other deductions | `otherDeductions` | Decimal | حقل «other deductions» على هذا الجدول. |
| penalties | `penalties` | Decimal | حقل «penalties» على هذا الجدول. |
| صافي before vat | `netBeforeVat` | Decimal | حقل «صافي before vat» على هذا الجدول. |
| vat مبلغ | `vatAmount` | Decimal | حقل «vat مبلغ» على هذا الجدول. |
| صافي payable مبلغ | `netPayableAmount` | Decimal | حقل «صافي payable مبلغ» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| ملاحظات داخلية | `internalNotes` | Json? | للفريق فقط، مش للعميل. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-0..1` مشروع subcontract → تعاقدات الباطن على المشروع: ربط اختياري بصف واحد من «تعاقدات الباطن على المشروع» عبر projectSubcontractId.
- `1-N` lines → سطور المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «سطور المستخلص».

### 133. سطور المستخلص (`contract_extract_lines`)

موديل: `ContractExtractLine` · 9 عمود · 2 علاقة

**إيه الجدول؟** كمية منفذة لكل بند.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور المستخلص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مستخلص | `extractId` | String | مفتاح أجنبي يربط الصف بجدول «مستخلص». |
| boq صنف | `boqItemId` | String | مفتاح أجنبي يربط الصف بجدول «boq صنف». |
| previous كمية | `previousQuantity` | Decimal | حقل «previous كمية» على هذا الجدول. |
| current كمية | `currentQuantity` | Decimal | حقل «current كمية» على هذا الجدول. |
| cumulative كمية | `cumulativeQuantity` | Decimal | حقل «cumulative كمية» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي السطر | `lineTotal` | Decimal | كمية × سعر بعد خصم السطر. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |

**العلاقات:**

- `N-1` مستخلص → مستخلصات العقد: كل صف هنا مربوط بصف واحد من «مستخلصات العقد» عبر extractId.
- `N-1` boq صنف → بنود جدول الكميات (نسخة مشروع): كل صف هنا مربوط بصف واحد من «بنود جدول الكميات (نسخة مشروع)» عبر boqItemId.

### 134. المقاولون من الباطن (`subcontractors`)

موديل: `Subcontractor` · 15 عمود · 2 علاقة

**إيه الجدول؟** كارت مقاول باطن.

**امتى بيتستخدم؟** اختيار المقاول على عقد الباطن والمستخلص.

**الشاشات:** مقاول باطن

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| اسم ar | `nameAr` | String | حقل «اسم ar» على هذا الجدول. |
| اسم en | `nameEn` | String? | حقل «اسم en» على هذا الجدول. |
| ضريبة registration رقم | `taxRegistrationNumber` | String? | حقل «ضريبة registration رقم» على هذا الجدول. |
| commercial register | `commercialRegister` | String? | حقل «commercial register» على هذا الجدول. |
| الهاتف | `phone` | String? | رقم التواصل. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| العنوان | `address` | String? | عنوان الطرف. |
| الحالة | `status` | SubcontractorStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| بنك حساب details | `bankAccountDetails` | Json? | حقل «بنك حساب details» على هذا الجدول. |
| risk score | `riskScore` | Float | حقل «risk score» على هذا الجدول. |
| legacy contractor | `legacyContractorId` | String? | مفتاح أجنبي يربط الصف بجدول «legacy contractor». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` subcontracts → عقود الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الباطن».

### 135. عقود الباطن (`subcontracts`)

موديل: `Subcontract` · 19 عمود · 10 علاقة

**إيه الجدول؟** عقد باطن بقيمة وجدول كميات.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عقود الباطن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| subcontract رقم | `subcontractNumber` | String | حقل «subcontract رقم» على هذا الجدول. |
| subcontractor | `subcontractorId` | String | مفتاح أجنبي يربط الصف بجدول «subcontractor». |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| عقد تاريخ | `contractDate` | DateTime | حقل «عقد تاريخ» على هذا الجدول. |
| إجمالي عقد value | `totalContractValue` | Decimal | حقل «إجمالي عقد value» على هذا الجدول. |
| الحالة | `status` | SubcontractStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| سلفة دفع إجمالي | `advancePaymentTotal` | Decimal | حقل «سلفة دفع إجمالي» على هذا الجدول. |
| سلفة دفع recovery سعر | `advancePaymentRecoveryRate` | Decimal | حقل «سلفة دفع recovery سعر» على هذا الجدول. |
| retention سعر | `retentionRate` | Decimal | حقل «retention سعر» على هذا الجدول. |
| ضريبة خصم منبع سعر | `taxWithholdingRate` | Decimal | حقل «ضريبة خصم منبع سعر» على هذا الجدول. |
| social insurance سعر | `socialInsuranceRate` | Decimal | حقل «social insurance سعر» على هذا الجدول. |
| max allowed variation أمر سعر | `maxAllowedVariationOrderRate` | Decimal | حقل «max allowed variation أمر سعر» على هذا الجدول. |
| standard scrap tolerance سعر | `standardScrapToleranceRate` | Decimal | حقل «standard scrap tolerance سعر» على هذا الجدول. |
| عقد admin overhead سعر | `contractAdminOverheadRate` | Decimal | حقل «عقد admin overhead سعر» على هذا الجدول. |
| early دفع خصم سعر | `earlyPaymentDiscountRate` | Decimal | حقل «early دفع خصم سعر» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` subcontractor → المقاولون من الباطن: كل صف هنا مربوط بصف واحد من «المقاولون من الباطن» عبر subcontractorId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `1-N` boq items → بنود عقد الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «بنود عقد الباطن».
- `1-N` invoices → مطالبات الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مطالبات الباطن».
- `1-N` خامة reconciliations → مطابقة خامات الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «مطابقة خامات الموقع».
- `1-N` site penalties → غرامات وعيوب الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «غرامات وعيوب الموقع».
- `1-N` direct execution charges → تحميل تنفيذ مباشر: هذا الجدول أب: صف واحد هنا له أكثر من «تحميل تنفيذ مباشر».
- `1-N` financial adjustment notes → إشعارات تسوية مالية للمشروع: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات تسوية مالية للمشروع».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 136. بنود عقد الباطن (`subcontract_boq_items`)

موديل: `SubcontractBOQItem` · 13 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: بنود عقد الباطن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| subcontract | `subcontractId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| صنف كود | `itemCode` | String | حقل «صنف كود» على هذا الجدول. |
| البيان عربي | `descriptionAr` | String | شرح السطر بالعربي. |
| البيان إنجليزي | `descriptionEn` | String? | شرح السطر بالإنجليزي. |
| وحدة | `unit` | String | حقل «وحدة» على هذا الجدول. |
| عقد كمية | `contractQuantity` | Decimal | حقل «عقد كمية» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي سعر | `totalPrice` | Decimal | حقل «إجمالي سعر» على هذا الجدول. |
| max allowed كمية | `maxAllowedQuantity` | Decimal | حقل «max allowed كمية» على هذا الجدول. |
| cumulative executed qty | `cumulativeExecutedQty` | Decimal | حقل «cumulative executed qty» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` subcontract → عقود الباطن: كل صف هنا مربوط بصف واحد من «عقود الباطن» عبر subcontractId.
- `1-N` فاتورة items → سطور مطالبة الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مطالبة الباطن».
- `1-N` adjustment lines → سطور إشعار التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إشعار التسوية».

### 137. مطالبات الباطن (`subcontract_invoices`)

موديل: `SubcontractInvoice` · 26 عمود · 8 علاقة

**إيه الجدول؟** فاتورة/مطالبة من مقاول الباطن.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مطالبات الباطن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| subcontract | `subcontractId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| رقم الفاتورة | `invoiceNumber` | String | الرقم الظاهر للمستخدم، من مسلسل المستندات. |
| مسلسل رقم | `sequenceNumber` | Int | حقل «مسلسل رقم» على هذا الجدول. |
| فترة start تاريخ | `periodStartDate` | DateTime | حقل «فترة start تاريخ» على هذا الجدول. |
| فترة end تاريخ | `periodEndDate` | DateTime | حقل «فترة end تاريخ» على هذا الجدول. |
| نوع | `type` | SubcontractInvoiceType | حقل «نوع» على هذا الجدول. |
| الحالة | `status` | SubcontractInvoiceStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| gross current مبلغ | `grossCurrentAmount` | Decimal | حقل «gross current مبلغ» على هذا الجدول. |
| gross cumulative مبلغ | `grossCumulativeAmount` | Decimal | حقل «gross cumulative مبلغ» على هذا الجدول. |
| previous gross مبلغ | `previousGrossAmount` | Decimal | حقل «previous gross مبلغ» على هذا الجدول. |
| سلفة دفع deduction | `advancePaymentDeduction` | Decimal | حقل «سلفة دفع deduction» على هذا الجدول. |
| retention deduction | `retentionDeduction` | Decimal | حقل «retention deduction» على هذا الجدول. |
| ضريبة خصم منبع deduction | `taxWithholdingDeduction` | Decimal | حقل «ضريبة خصم منبع deduction» على هذا الجدول. |
| social insurance deduction | `socialInsuranceDeduction` | Decimal | حقل «social insurance deduction» على هذا الجدول. |
| خامة overuse deduction | `materialOveruseDeduction` | Decimal | حقل «خامة overuse deduction» على هذا الجدول. |
| site penalties deduction | `sitePenaltiesDeduction` | Decimal | حقل «site penalties deduction» على هذا الجدول. |
| direct execution deduction | `directExecutionDeduction` | Decimal | حقل «direct execution deduction» على هذا الجدول. |
| early دفع خصم deduction | `earlyPaymentDiscountDeduction` | Decimal | حقل «early دفع خصم deduction» على هذا الجدول. |
| صافي payable مبلغ | `netPayableAmount` | Decimal | حقل «صافي payable مبلغ» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| attachments | `attachments` | Json? | حقل «attachments» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` subcontract → عقود الباطن: كل صف هنا مربوط بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` items → سطور مطالبة الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مطالبة الباطن».
- `1-N` خامة reconciliations → مطابقة خامات الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «مطابقة خامات الموقع».
- `1-N` site penalties → غرامات وعيوب الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «غرامات وعيوب الموقع».
- `1-N` direct execution charges → تحميل تنفيذ مباشر: هذا الجدول أب: صف واحد هنا له أكثر من «تحميل تنفيذ مباشر».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 138. سطور مطالبة الباطن (`subcontract_invoice_items`)

موديل: `SubcontractInvoiceItem` · 9 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور مطالبة الباطن.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| subcontract فاتورة | `subcontractInvoiceId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract فاتورة». |
| subcontract boqitem | `subcontractBOQItemId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract boqitem». |
| previous كمية | `previousQuantity` | Decimal | حقل «previous كمية» على هذا الجدول. |
| current كمية | `currentQuantity` | Decimal | حقل «current كمية» على هذا الجدول. |
| إجمالي cumulative كمية | `totalCumulativeQuantity` | Decimal | حقل «إجمالي cumulative كمية» على هذا الجدول. |
| completion percentage | `completionPercentage` | Decimal | حقل «completion percentage» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي current مبلغ | `totalCurrentAmount` | Decimal | حقل «إجمالي current مبلغ» على هذا الجدول. |

**العلاقات:**

- `N-1` فاتورة → مطالبات الباطن: كل صف هنا مربوط بصف واحد من «مطالبات الباطن» عبر subcontractInvoiceId.
- `N-1` boq صنف → بنود عقد الباطن: كل صف هنا مربوط بصف واحد من «بنود عقد الباطن» عبر subcontractBOQItemId.

### 139. مطابقة خامات الموقع (`material_reconciliation_logs`)

موديل: `MaterialReconciliationLog` · 14 عمود · 4 علاقة

**إيه الجدول؟** صرف نظري مقابل فعلي.

**امتى بيتستخدم؟** انحراف خامات المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| subcontract | `subcontractId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| subcontract فاتورة | `subcontractInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract فاتورة». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| مخزن صرف slip رقم | `warehouseIssueSlipNumber` | String? | حقل «مخزن صرف slip رقم» على هذا الجدول. |
| standard engineered qty | `standardEngineeredQty` | Decimal | حقل «standard engineered qty» على هذا الجدول. |
| actual issued qty | `actualIssuedQty` | Decimal | حقل «actual issued qty» على هذا الجدول. |
| scrap excess qty | `scrapExcessQty` | Decimal | حقل «scrap excess qty» على هذا الجدول. |
| market سعر per وحدة | `marketPricePerUnit` | Decimal | حقل «market سعر per وحدة» على هذا الجدول. |
| admin overhead percentage | `adminOverheadPercentage` | Decimal | حقل «admin overhead percentage» على هذا الجدول. |
| إجمالي غرامة مبلغ | `totalPenaltyAmount` | Decimal | حقل «إجمالي غرامة مبلغ» على هذا الجدول. |
| الحالة | `status` | MaterialReconciliationStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` subcontract → عقود الباطن: كل صف هنا مربوط بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` فاتورة → مطالبات الباطن: ربط اختياري بصف واحد من «مطالبات الباطن» عبر subcontractInvoiceId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 140. غرامات وعيوب الموقع (`site_penalties_and_snags`)

موديل: `SitePenaltyAndSnag` · 11 عمود · 3 علاقة

**إيه الجدول؟** خصم أو snag على مقاول/بند.

**امتى بيتستخدم؟** يُستخدم مع شاشات: غرامات وعيوب الموقع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| subcontract | `subcontractId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| subcontract فاتورة | `subcontractInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract فاتورة». |
| غرامة نوع | `penaltyType` | SitePenaltyType | حقل «غرامة نوع» على هذا الجدول. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| incident تاريخ | `incidentDate` | DateTime | حقل «incident تاريخ» على هذا الجدول. |
| البيان / الشرح | `description` | String | نص حر يظهر في القيد والطباعة. |
| consultant report ref | `consultantReportRef` | String? | حقل «consultant report ref» على هذا الجدول. |
| الحالة | `status` | SitePenaltyStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` subcontract → عقود الباطن: كل صف هنا مربوط بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` فاتورة → مطالبات الباطن: ربط اختياري بصف واحد من «مطالبات الباطن» عبر subcontractInvoiceId.
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 141. تحميل تنفيذ مباشر (`direct_execution_charges`)

موديل: `DirectExecutionCharge` · 11 عمود · 2 علاقة

**إيه الجدول؟** تكلفة نفّذتها الشركة بنفسها على المشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تحميل تنفيذ مباشر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| subcontract | `subcontractId` | String | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| subcontract فاتورة | `subcontractInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract فاتورة». |
| reason | `reason` | String | حقل «reason» على هذا الجدول. |
| third party vendor اسم | `thirdPartyVendorName` | String? | حقل «third party vendor اسم» على هذا الجدول. |
| direct تكلفة incurred | `directCostIncurred` | Decimal | حقل «direct تكلفة incurred» على هذا الجدول. |
| overhead surcharge سعر | `overheadSurchargeRate` | Decimal | حقل «overhead surcharge سعر» على هذا الجدول. |
| إجمالي deduction | `totalDeduction` | Decimal | حقل «إجمالي deduction» على هذا الجدول. |
| الحالة | `status` | DirectExecutionStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` subcontract → عقود الباطن: كل صف هنا مربوط بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` فاتورة → مطالبات الباطن: ربط اختياري بصف واحد من «مطالبات الباطن» عبر subcontractInvoiceId.

### 142. بنود جدول كميات المالك (`project_owner_boq_items`)

موديل: `ProjectBOQItem` · 16 عمود · 7 علاقة

**إيه الجدول؟** BOQ المعتمد مع العميل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: بنود جدول كميات المالك.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| صنف كود | `itemCode` | String | حقل «صنف كود» على هذا الجدول. |
| البيان عربي | `descriptionAr` | String | شرح السطر بالعربي. |
| البيان إنجليزي | `descriptionEn` | String? | شرح السطر بالإنجليزي. |
| وحدة | `unit` | BOQItemUnit | حقل «وحدة» على هذا الجدول. |
| عقد كمية | `contractQuantity` | Decimal | حقل «عقد كمية» على هذا الجدول. |
| direct تكلفة estimated | `directCostEstimated` | Decimal | حقل «direct تكلفة estimated» على هذا الجدول. |
| indirect markup سعر | `indirectMarkupRate` | Decimal | حقل «indirect markup سعر» على هذا الجدول. |
| وحدة selling سعر | `unitSellingPrice` | Decimal | حقل «وحدة selling سعر» على هذا الجدول. |
| إجمالي selling سعر | `totalSellingPrice` | Decimal | حقل «إجمالي selling سعر» على هذا الجدول. |
| cumulative executed qty | `cumulativeExecutedQty` | Decimal | حقل «cumulative executed qty» على هذا الجدول. |
| الحالة | `status` | ProjectBOQItemStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `1-N` سعر analysis items → تحليل تسعير البند: هذا الجدول أب: صف واحد هنا له أكثر من «تحليل تسعير البند».
- `1-N` markup structures → هيكل هامش الـ BOQ: هذا الجدول أب: صف واحد هنا له أكثر من «هيكل هامش الـ BOQ».
- `1-N` measurement sheets → حصر تنفيذي: هذا الجدول أب: صف واحد هنا له أكثر من «حصر تنفيذي».
- `1-N` client فاتورة items → سطور مطالبة العميل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مطالبة العميل».
- `1-N` adjustment lines → سطور إشعار التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إشعار التسوية».

### 143. تحليل تسعير البند (`boq_rate_analysis_items`)

موديل: `BOQRateAnalysisItem` · 15 عمود · 2 علاقة

**إيه الجدول؟** خامات+عمالة+معدات وراء سعر البند.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تحليل تسعير البند.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع boqitem | `projectBOQItemId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع boqitem». |
| تكلفة element نوع | `costElementType` | BOQCostElementType | حقل «تكلفة element نوع» على هذا الجدول. |
| resource كود | `resourceCode` | String? | حقل «resource كود» على هذا الجدول. |
| البيان عربي | `descriptionAr` | String | شرح السطر بالعربي. |
| البيان إنجليزي | `descriptionEn` | String? | شرح السطر بالإنجليزي. |
| وحدة | `unit` | String | حقل «وحدة» على هذا الجدول. |
| consumption quota per وحدة | `consumptionQuotaPerUnit` | Decimal | حقل «consumption quota per وحدة» على هذا الجدول. |
| وحدة تكلفة | `unitCost` | Decimal | حقل «وحدة تكلفة» على هذا الجدول. |
| waste factor سعر | `wasteFactorRate` | Decimal | حقل «waste factor سعر» على هذا الجدول. |
| إجمالي تكلفة per وحدة | `totalCostPerUnit` | Decimal | حقل «إجمالي تكلفة per وحدة» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع boqitem → بنود جدول كميات المالك: كل صف هنا مربوط بصف واحد من «بنود جدول كميات المالك» عبر projectBOQItemId.

### 144. هيكل هامش الـ BOQ (`boq_markup_structures`)

موديل: `BOQMarkupStructure` · 11 عمود · 3 علاقة

**إيه الجدول؟** نسب إشراف وربح على التحليل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: هيكل هامش الـ BOQ.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع boqitem | `projectBOQItemId` | String? | مفتاح أجنبي يربط الصف بجدول «مشروع boqitem». |
| مشروع | `projectId` | String? | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| general overhead سعر | `generalOverheadRate` | Decimal | حقل «general overhead سعر» على هذا الجدول. |
| site overhead سعر | `siteOverheadRate` | Decimal | حقل «site overhead سعر» على هذا الجدول. |
| contingency risk سعر | `contingencyRiskRate` | Decimal | حقل «contingency risk سعر» على هذا الجدول. |
| profit margin سعر | `profitMarginRate` | Decimal | حقل «profit margin سعر» على هذا الجدول. |
| عقد taxes سعر | `contractTaxesRate` | Decimal | حقل «عقد taxes سعر» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` مشروع boqitem → بنود جدول كميات المالك: ربط اختياري بصف واحد من «بنود جدول كميات المالك» عبر projectBOQItemId.
- `N-0..1` مشروع → مشاريع المقاولات: ربط اختياري بصف واحد من «مشاريع المقاولات» عبر projectId.

### 145. حصر تنفيذي (`executive_measurement_sheets`)

موديل: `ExecutiveMeasurementSheet` · 21 عمود · 5 علاقة

**إيه الجدول؟** قياس كميات منفذة في الموقع.

**امتى بيتستخدم؟** أساس المستخلص.

**الشاشات:** حصر تنفيذي

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مشروع boqitem | `projectBOQItemId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع boqitem». |
| sheet رقم | `sheetNumber` | String | حقل «sheet رقم» على هذا الجدول. |
| measurement تاريخ | `measurementDate` | DateTime | حقل «measurement تاريخ» على هذا الجدول. |
| موقع zone | `locationZone` | String? | حقل «موقع zone» على هذا الجدول. |
| axis grid ref | `axisGridRef` | String? | حقل «axis grid ref» على هذا الجدول. |
| statement | `statement` | String? | حقل «statement» على هذا الجدول. |
| multiplier count | `multiplierCount` | Decimal | حقل «multiplier count» على هذا الجدول. |
| dimension length | `dimensionLength` | Decimal? | حقل «dimension length» على هذا الجدول. |
| dimension width | `dimensionWidth` | Decimal? | حقل «dimension width» على هذا الجدول. |
| dimension height | `dimensionHeight` | Decimal? | حقل «dimension height» على هذا الجدول. |
| calculated gross qty | `calculatedGrossQty` | Decimal | حقل «calculated gross qty» على هذا الجدول. |
| deduction qty | `deductionQty` | Decimal | حقل «deduction qty» على هذا الجدول. |
| صافي executed qty | `netExecutedQty` | Decimal | حقل «صافي executed qty» على هذا الجدول. |
| attachments | `attachments` | Json? | حقل «attachments» على هذا الجدول. |
| الحالة | `status` | MeasurementSheetStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| client فاتورة | `clientInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «client فاتورة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-1` مشروع boqitem → بنود جدول كميات المالك: كل صف هنا مربوط بصف واحد من «بنود جدول كميات المالك» عبر projectBOQItemId.
- `N-0..1` client فاتورة → فواتير/مطالبات العميل: ربط اختياري بصف واحد من «فواتير/مطالبات العميل» عبر clientInvoiceId.
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 146. إشعارات تسوية مالية للمشروع (`financial_adjustment_notes`)

موديل: `FinancialAdjustmentNote` · 21 عمود · 6 علاقة

**إيه الجدول؟** خصم/إضافة على مستحقات المشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إشعارات تسوية مالية للمشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| ملاحظة رقم | `noteNumber` | String | حقل «ملاحظة رقم» على هذا الجدول. |
| ملاحظة نوع | `noteType` | FinancialAdjustmentNoteType | حقل «ملاحظة نوع» على هذا الجدول. |
| هدف موديول | `targetModule` | FinancialAdjustmentTargetModule | حقل «هدف موديول» على هذا الجدول. |
| مصدر فاتورة | `sourceInvoiceId` | String | مفتاح أجنبي يربط الصف بجدول «مصدر فاتورة». |
| subcontract | `subcontractId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract». |
| client عقد | `clientContractId` | String? | مفتاح أجنبي يربط الصف بجدول «client عقد». |
| reason تصنيف | `reasonCategory` | FinancialAdjustmentReasonCategory | حقل «reason تصنيف» على هذا الجدول. |
| reason description | `reasonDescription` | String | حقل «reason description» على هذا الجدول. |
| requested by مستخدم | `requestedByUserId` | String | مفتاح أجنبي يربط الصف بجدول «requested by مستخدم». |
| معتمد by مستخدم | `approvedByUserId` | String? | مفتاح أجنبي يربط الصف بجدول «معتمد by مستخدم». |
| الحالة | `status` | FinancialAdjustmentNoteStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| gross adjustment مبلغ | `grossAdjustmentAmount` | Decimal | حقل «gross adjustment مبلغ» على هذا الجدول. |
| ضريبة wht adjustment مبلغ | `taxWhtAdjustmentAmount` | Decimal | حقل «ضريبة wht adjustment مبلغ» على هذا الجدول. |
| صافي adjustment مبلغ | `netAdjustmentAmount` | Decimal | حقل «صافي adjustment مبلغ» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| عكس أي قيد | `reversalOfJournalEntryId` | String? | لو الصف قيد عكسي، هنا القيد الأصلي. |
| attachments | `attachments` | Json? | حقل «attachments» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` subcontract → عقود الباطن: ربط اختياري بصف واحد من «عقود الباطن» عبر subcontractId.
- `N-0..1` client عقد → عقود العميل (مقاولات): ربط اختياري بصف واحد من «عقود العميل (مقاولات)» عبر clientContractId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `N-0..1` reversal of قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر reversalOfJournalEntryId.
- `1-N` lines → سطور إشعار التسوية: هذا الجدول أب: صف واحد هنا له أكثر من «سطور إشعار التسوية».

### 147. سطور إشعار التسوية (`financial_adjustment_line_items`)

موديل: `FinancialAdjustmentLineItem` · 9 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور إشعار التسوية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| adjustment ملاحظة | `adjustmentNoteId` | String | مفتاح أجنبي يربط الصف بجدول «adjustment ملاحظة». |
| subcontract boqitem | `subcontractBOQItemId` | String? | مفتاح أجنبي يربط الصف بجدول «subcontract boqitem». |
| مشروع boqitem | `projectBOQItemId` | String? | مفتاح أجنبي يربط الصف بجدول «مشروع boqitem». |
| البيان / الشرح | `description` | String | نص حر يظهر في القيد والطباعة. |
| كمية adjustment | `quantityAdjustment` | Decimal | حقل «كمية adjustment» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| deduction نوع affected | `deductionTypeAffected` | FinancialAdjustmentDeductionType | حقل «deduction نوع affected» على هذا الجدول. |

**العلاقات:**

- `N-1` adjustment ملاحظة → إشعارات تسوية مالية للمشروع: كل صف هنا مربوط بصف واحد من «إشعارات تسوية مالية للمشروع» عبر adjustmentNoteId.
- `N-0..1` subcontract boqitem → بنود عقد الباطن: ربط اختياري بصف واحد من «بنود عقد الباطن» عبر subcontractBOQItemId.
- `N-0..1` مشروع boqitem → بنود جدول كميات المالك: ربط اختياري بصف واحد من «بنود جدول كميات المالك» عبر projectBOQItemId.

### 148. عقود العميل (مقاولات) (`client_contracts`)

موديل: `ClientContract` · 14 عمود · 6 علاقة

**إيه الجدول؟** عقد مالك المشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عقود العميل (مقاولات).

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| عقد رقم | `contractNumber` | String | حقل «عقد رقم» على هذا الجدول. |
| client عميل | `clientCustomerId` | String | مفتاح أجنبي يربط الصف بجدول «client عميل». |
| عقد تاريخ | `contractDate` | DateTime | حقل «عقد تاريخ» على هذا الجدول. |
| إجمالي عقد value | `totalContractValue` | Decimal | حقل «إجمالي عقد value» على هذا الجدول. |
| سلفة دفع مبلغ | `advancePaymentAmount` | Decimal | حقل «سلفة دفع مبلغ» على هذا الجدول. |
| سلفة recovery سعر | `advanceRecoveryRate` | Decimal | حقل «سلفة recovery سعر» على هذا الجدول. |
| retention سعر | `retentionRate` | Decimal | حقل «retention سعر» على هذا الجدول. |
| engineering stamps سعر | `engineeringStampsRate` | Decimal | حقل «engineering stamps سعر» على هذا الجدول. |
| الحالة | `status` | ClientContractStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-1` client → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر clientCustomerId.
- `1-N` invoices → فواتير/مطالبات العميل: هذا الجدول أب: صف واحد هنا له أكثر من «فواتير/مطالبات العميل».
- `1-N` financial adjustment notes → إشعارات تسوية مالية للمشروع: هذا الجدول أب: صف واحد هنا له أكثر من «إشعارات تسوية مالية للمشروع».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 149. فواتير/مطالبات العميل (`client_invoices`)

موديل: `ClientInvoice` · 22 عمود · 7 علاقة

**إيه الجدول؟** مطالبة مالية للمالك خلاف المستخلص التفصيلي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: فواتير/مطالبات العميل.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| client عقد | `clientContractId` | String | مفتاح أجنبي يربط الصف بجدول «client عقد». |
| رقم الفاتورة | `invoiceNumber` | String | الرقم الظاهر للمستخدم، من مسلسل المستندات. |
| مسلسل رقم | `sequenceNumber` | Int | حقل «مسلسل رقم» على هذا الجدول. |
| فترة start تاريخ | `periodStartDate` | DateTime | حقل «فترة start تاريخ» على هذا الجدول. |
| فترة end تاريخ | `periodEndDate` | DateTime | حقل «فترة end تاريخ» على هذا الجدول. |
| نوع | `type` | ClientInvoiceType | حقل «نوع» على هذا الجدول. |
| الحالة | `status` | ClientInvoiceStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| gross current works | `grossCurrentWorks` | Decimal | حقل «gross current works» على هذا الجدول. |
| previous gross works | `previousGrossWorks` | Decimal | حقل «previous gross works» على هذا الجدول. |
| cumulative gross works | `cumulativeGrossWorks` | Decimal | حقل «cumulative gross works» على هذا الجدول. |
| materials on site current | `materialsOnSiteCurrent` | Decimal | حقل «materials on site current» على هذا الجدول. |
| materials on site deduction | `materialsOnSiteDeduction` | Decimal | حقل «materials on site deduction» على هذا الجدول. |
| سلفة دفع recovery | `advancePaymentRecovery` | Decimal | حقل «سلفة دفع recovery» على هذا الجدول. |
| retention deduction | `retentionDeduction` | Decimal | حقل «retention deduction» على هذا الجدول. |
| engineering stamps deduction | `engineeringStampsDeduction` | Decimal | حقل «engineering stamps deduction» على هذا الجدول. |
| other client penalties | `otherClientPenalties` | Decimal | حقل «other client penalties» على هذا الجدول. |
| صافي payable by client | `netPayableByClient` | Decimal | حقل «صافي payable by client» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` client عقد → عقود العميل (مقاولات): كل صف هنا مربوط بصف واحد من «عقود العميل (مقاولات)» عبر clientContractId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` items → سطور مطالبة العميل: هذا الجدول أب: صف واحد هنا له أكثر من «سطور مطالبة العميل».
- `1-N` measurement sheets → حصر تنفيذي: هذا الجدول أب: صف واحد هنا له أكثر من «حصر تنفيذي».
- `1-N` site stock materials → مخزون موقع المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «مخزون موقع المشروع».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 150. سطور مطالبة العميل (`client_invoice_items`)

موديل: `ClientInvoiceItem` · 11 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور مطالبة العميل.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| client فاتورة | `clientInvoiceId` | String | مفتاح أجنبي يربط الصف بجدول «client فاتورة». |
| مشروع boqitem | `projectBOQItemId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع boqitem». |
| previous كمية | `previousQuantity` | Decimal | حقل «previous كمية» على هذا الجدول. |
| current كمية | `currentQuantity` | Decimal | حقل «current كمية» على هذا الجدول. |
| cumulative كمية | `cumulativeQuantity` | Decimal | حقل «cumulative كمية» على هذا الجدول. |
| وحدة selling سعر | `unitSellingPrice` | Decimal | حقل «وحدة selling سعر» على هذا الجدول. |
| current مبلغ | `currentAmount` | Decimal | حقل «current مبلغ» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` client فاتورة → فواتير/مطالبات العميل: كل صف هنا مربوط بصف واحد من «فواتير/مطالبات العميل» عبر clientInvoiceId.
- `N-1` مشروع boqitem → بنود جدول كميات المالك: كل صف هنا مربوط بصف واحد من «بنود جدول كميات المالك» عبر projectBOQItemId.

### 151. مخزون موقع المشروع (`site_stock_materials`)

موديل: `SiteStockMaterial` · 14 عمود · 3 علاقة

**إيه الجدول؟** خامات موجودة في الموقع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مخزون موقع المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| client فاتورة | `clientInvoiceId` | String? | مفتاح أجنبي يربط الصف بجدول «client فاتورة». |
| خامة description | `materialDescription` | String | حقل «خامة description» على هذا الجدول. |
| delivery تاريخ | `deliveryDate` | DateTime | حقل «delivery تاريخ» على هذا الجدول. |
| مخزن قبض/إذن ref | `warehouseReceiptRef` | String? | حقل «مخزن قبض/إذن ref» على هذا الجدول. |
| delivered كمية | `deliveredQuantity` | Decimal | حقل «delivered كمية» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| معتمد percentage | `approvedPercentage` | Decimal | حقل «معتمد percentage» على هذا الجدول. |
| صافي claimed مبلغ | `netClaimedAmount` | Decimal | حقل «صافي claimed مبلغ» على هذا الجدول. |
| الحالة | `status` | SiteStockMaterialStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-0..1` client فاتورة → فواتير/مطالبات العميل: ربط اختياري بصف واحد من «فواتير/مطالبات العميل» عبر clientInvoiceId.

### 152. خطابات ضمان المشروع (`project_letters_of_guarantee`)

موديل: `ProjectLetterOfGuarantee` · 20 عمود · 6 علاقة

**إيه الجدول؟** ابتدائي/دفعة مقدمة/ختامي على مشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: خطابات ضمان المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| lg رقم | `lgNumber` | String | حقل «lg رقم» على هذا الجدول. |
| الحساب البنكي | `bankAccountId` | String | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| البنك المسحوب عليه | `bankName` | String | اسم البنك المكتوب على الشيك. |
| beneficiary اسم | `beneficiaryName` | String | حقل «beneficiary اسم» على هذا الجدول. |
| نوع | `type` | ProjectLgType | حقل «نوع» على هذا الجدول. |
| issuance تاريخ | `issuanceDate` | DateTime | علامة نعم/لا: issuance تاريخ. |
| expiry تاريخ | `expiryDate` | DateTime | حقل «expiry تاريخ» على هذا الجدول. |
| original مبلغ | `originalAmount` | Decimal | حقل «original مبلغ» على هذا الجدول. |
| current مبلغ | `currentAmount` | Decimal | حقل «current مبلغ» على هذا الجدول. |
| cash margin سعر | `cashMarginRate` | Decimal | حقل «cash margin سعر» على هذا الجدول. |
| cash margin مبلغ | `cashMarginAmount` | Decimal | حقل «cash margin مبلغ» على هذا الجدول. |
| issuance عمولة مبلغ | `issuanceCommissionAmount` | Decimal | علامة نعم/لا: issuance عمولة مبلغ. |
| الحالة | `status` | ProjectLgStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| renewal count | `renewalCount` | Int | حقل «renewal count» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` مشروع → مشاريع المقاولات: كل صف هنا مربوط بصف واحد من «مشاريع المقاولات» عبر projectId.
- `N-1` بنك حساب → الحسابات البنكية: كل صف هنا مربوط بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر journalEntryId.
- `1-N` إجراء تاريخ → تاريخ حركة خطاب الضمان: هذا الجدول أب: صف واحد هنا له أكثر من «تاريخ حركة خطاب الضمان».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 153. تاريخ حركة خطاب الضمان (`lg_action_histories`)

موديل: `LgActionHistory` · 13 عمود · 2 علاقة

**إيه الجدول؟** إصدار، تمديد، تسييل، رد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تاريخ حركة خطاب الضمان.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| خطاب of ضمان | `letterOfGuaranteeId` | String | مفتاح أجنبي يربط الصف بجدول «خطاب of ضمان». |
| إجراء نوع | `actionType` | LgActionType | حقل «إجراء نوع» على هذا الجدول. |
| إجراء تاريخ | `actionDate` | DateTime | حقل «إجراء تاريخ» على هذا الجدول. |
| previous expiry تاريخ | `previousExpiryDate` | DateTime? | حقل «previous expiry تاريخ» على هذا الجدول. |
| new expiry تاريخ | `newExpiryDate` | DateTime? | حقل «new expiry تاريخ» على هذا الجدول. |
| previous مبلغ | `previousAmount` | Decimal? | حقل «previous مبلغ» على هذا الجدول. |
| new مبلغ | `newAmount` | Decimal? | حقل «new مبلغ» على هذا الجدول. |
| بنك reference no | `bankReferenceNo` | String? | حقل «بنك reference no» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` خطاب of ضمان → خطابات ضمان المشروع: كل صف هنا مربوط بصف واحد من «خطابات ضمان المشروع» عبر letterOfGuaranteeId.

### 197. المشاريع (مستخلصات عامة) (`projects`)

موديل: `Project` · 19 عمود · 8 علاقة

**إيه الجدول؟** مشروع في موديول المستخلصات/المقاول العام.

**امتى بيتستخدم؟** أبو المباني وبنود الأعمال والمستخلصات.

**الشاشات:** المشاريع

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| إجمالي value | `totalValue` | Decimal? | حقل «إجمالي value» على هذا الجدول. |
| سلفة دفع percentage | `advancePaymentPercentage` | Decimal? | حقل «سلفة دفع percentage» على هذا الجدول. |
| سلفة دفع value | `advancePaymentValue` | Decimal? | حقل «سلفة دفع value» على هذا الجدول. |
| late غرامة percentage | `latePenaltyPercentage` | Decimal? | حقل «late غرامة percentage» على هذا الجدول. |
| late غرامة per days | `latePenaltyPerDays` | String? | حقل «late غرامة per days» على هذا الجدول. |
| business affairs percentage | `businessAffairsPercentage` | Decimal? | حقل «business affairs percentage» على هذا الجدول. |
| facilities deduction percentage | `facilitiesDeductionPercentage` | Decimal? | حقل «facilities deduction percentage» على هذا الجدول. |
| facilities deduction max | `facilitiesDeductionMax` | Decimal? | حقل «facilities deduction max» على هذا الجدول. |
| other additions | `otherAdditions` | Json? | Array of { name: string, value: Decimal } |
| other deductions | `otherDeductions` | Json? | Array of { name: string, value: Decimal } |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` buildings → مباني المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «مباني المشروع».
- `1-N` work items → بنود أعمال المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «بنود أعمال المشروع».
- `1-N` extracts → المستخلصات: هذا الجدول أب: صف واحد هنا له أكثر من «المستخلصات».
- `1-N` مستخلص payments → صرفيات المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «صرفيات المستخلص».
- `1-N` contractor assignments → تعيين مقاول على مشروع: هذا الجدول أب: صف واحد هنا له أكثر من «تعيين مقاول على مشروع».
- `1-N` measurement definitions → تعريفات الحصر: هذا الجدول أب: صف واحد هنا له أكثر من «تعريفات الحصر».
- `1-N` manpower logs → سجل العمالة في الموقع: هذا الجدول أب: صف واحد هنا له أكثر من «سجل العمالة في الموقع».

### 198. مباني المشروع (`project_buildings`)

موديل: `ProjectBuilding` · 9 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: مباني المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مجموعة رقم | `groupNumber` | String? | حقل «مجموعة رقم» على هذا الجدول. |
| model رقم | `modelNumber` | String? | حقل «model رقم» على هذا الجدول. |
| وحدة رقم | `unitNumber` | String? | حقل «وحدة رقم» على هذا الجدول. |
| الاسم العربي | `arabicName` | String? | الاسم اللي يظهر في الشاشات العربية. |
| image url | `imageUrl` | String? | حقل «image url» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.
- `1-N` work items → بنود أعمال المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «بنود أعمال المشروع».
- `1-N` مستخلص items → بنود المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «بنود المستخلص».

### 199. بنود أعمال المشروع (`project_work_items`)

موديل: `ProjectWorkItem` · 15 عمود · 4 علاقة

**إيه الجدول؟** بند يُقاس ويُستخلص.

**امتى بيتستخدم؟** يُستخدم مع شاشات: بنود أعمال المشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مبنى | `buildingId` | String? | مفتاح أجنبي يربط الصف بجدول «مبنى». |
| صنف رقم | `itemNumber` | String | حقل «صنف رقم» على هذا الجدول. |
| صنف مجموعة كود | `itemGroupCode` | String? | حقل «صنف مجموعة كود» على هذا الجدول. |
| صنف مجموعة اسم | `itemGroupName` | String? | حقل «صنف مجموعة اسم» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| وحدة | `unit` | String? | حقل «وحدة» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي سعر | `totalPrice` | Decimal? | حقل «إجمالي سعر» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.
- `N-0..1` مبنى → مباني المشروع: ربط اختياري بصف واحد من «مباني المشروع» عبر buildingId.
- `1-N` contractor assignments → تعيين مقاول على مشروع: هذا الجدول أب: صف واحد هنا له أكثر من «تعيين مقاول على مشروع».
- `1-N` مستخلص items → بنود المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «بنود المستخلص».

### 200. المقاولون (`contractors`)

موديل: `Contractor` · 12 عمود · 7 علاقة

**إيه الجدول؟** كارت مقاول لموديول المستخلصات.

**امتى بيتستخدم؟** يُعيَّن على مشروع ويُصرف له مستخلص.

**الشاشات:** مقاول

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الرقم الضريبي | `taxNumber` | String? | الرقم الضريبي للشركة أو العميل. |
| الهاتف | `phone` | String? | رقم التواصل. |
| العنوان | `address` | String? | عنوان الطرف. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` assignments → تعيين مقاول على مشروع: هذا الجدول أب: صف واحد هنا له أكثر من «تعيين مقاول على مشروع».
- `1-N` extracts → المستخلصات: هذا الجدول أب: صف واحد هنا له أكثر من «المستخلصات».
- `1-N` مستخلص payments → صرفيات المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «صرفيات المستخلص».
- `N-0..1` contractor إعدادات → إعدادات المقاولين: ربط اختياري بصف واحد من «إعدادات المقاولين».
- `1-N` مشروع subcontracts → تعاقدات الباطن على المشروع: هذا الجدول أب: صف واحد هنا له أكثر من «تعاقدات الباطن على المشروع».
- `1-N` subcontractor extracts → مستخلصات مقاول الباطن: هذا الجدول أب: صف واحد هنا له أكثر من «مستخلصات مقاول الباطن».

### 201. إعدادات المقاولين (`contractor_settings`)

موديل: `ContractorSettings` · 8 عمود · 1 علاقة

**إيه الجدول؟** حسابات افتراضية للمستخلص.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعدادات المقاولين.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| contractor | `contractorId` | String | مفتاح أجنبي يربط الصف بجدول «contractor». |
| سلفة دفع percentage | `advancePaymentPercentage` | Decimal? | حقل «سلفة دفع percentage» على هذا الجدول. |
| work insurance percentage | `workInsurancePercentage` | Decimal? | حقل «work insurance percentage» على هذا الجدول. |
| ضريبة deduction percentage | `taxDeductionPercentage` | Decimal? | حقل «ضريبة deduction percentage» على هذا الجدول. |
| other إعدادات | `otherSettings` | Json? | حقل «other إعدادات» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` contractor → المقاولون: كل صف هنا مربوط بصف واحد من «المقاولون» عبر contractorId.

### 202. تعيين مقاول على مشروع (`contractor_assignments`)

موديل: `ContractorAssignment` · 8 عمود · 3 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: تعيين مقاول على مشروع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| contractor | `contractorId` | String | مفتاح أجنبي يربط الصف بجدول «contractor». |
| work صنف | `workItemId` | String | مفتاح أجنبي يربط الصف بجدول «work صنف». |
| assignment تاريخ | `assignmentDate` | DateTime | حقل «assignment تاريخ» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.
- `N-1` contractor → المقاولون: كل صف هنا مربوط بصف واحد من «المقاولون» عبر contractorId.
- `N-1` work صنف → بنود أعمال المشروع: كل صف هنا مربوط بصف واحد من «بنود أعمال المشروع» عبر workItemId.

### 203. المستخلصات (`extracts`)

موديل: `Extract` · 18 عمود · 4 علاقة

**إيه الجدول؟** رأس مستخلص كميات منفذة.

**امتى بيتستخدم؟** بعد الاعتماد يتحول لمطالبة مالية.

**الشاشات:** مستخلص

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| contractor | `contractorId` | String? | مفتاح أجنبي يربط الصف بجدول «contractor». |
| مستخلص رقم | `extractNumber` | String? | حقل «مستخلص رقم» على هذا الجدول. |
| مستخلص تاريخ | `extractDate` | DateTime | حقل «مستخلص تاريخ» على هذا الجدول. |
| أي قائمة | `statementType` | String | BALANCE_SHEET ميزانية أو INCOME_STATEMENT قائمة دخل. 'partial' | 'final' |
| statement | `statement` | String? | حقل «statement» على هذا الجدول. |
| مستخلص نوع | `extractType` | String | 'contractor' | 'owner' | 'self-execution' |
| إجمالي value | `totalValue` | Decimal? | حقل «إجمالي value» على هذا الجدول. |
| سلفة دفع | `advancePayment` | Decimal? | حقل «سلفة دفع» على هذا الجدول. |
| صافي work value | `netWorkValue` | Decimal? | حقل «صافي work value» على هذا الجدول. |
| previous work إجمالي | `previousWorkTotal` | Decimal? | حقل «previous work إجمالي» على هذا الجدول. |
| previous مستخلص count | `previousExtractCount` | Int? | حقل «previous مستخلص count» على هذا الجدول. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| ملغي | `isCancelled` | Boolean | المستند اتلغى. يفضل الصف للمراجعة، ومش بيأثر على الأرصدة كحركة نشطة. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.
- `N-0..1` contractor → المقاولون: ربط اختياري بصف واحد من «المقاولون» عبر contractorId.
- `1-N` items → بنود المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «بنود المستخلص».
- `1-N` payments → صرفيات المستخلص: هذا الجدول أب: صف واحد هنا له أكثر من «صرفيات المستخلص».

### 204. بنود المستخلص (`extract_items`)

موديل: `ExtractItem` · 17 عمود · 3 علاقة

**إيه الجدول؟** كمية وسعر كل بند في المستخلص.

**امتى بيتستخدم؟** يُستخدم مع شاشات: بنود المستخلص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مستخلص | `extractId` | String | مفتاح أجنبي يربط الصف بجدول «مستخلص». |
| work صنف | `workItemId` | String? | مفتاح أجنبي يربط الصف بجدول «work صنف». |
| مبنى | `buildingId` | String? | مفتاح أجنبي يربط الصف بجدول «مبنى». |
| وحدة رقم | `unitNumber` | String? | حقل «وحدة رقم» على هذا الجدول. |
| model رقم | `modelNumber` | String? | حقل «model رقم» على هذا الجدول. |
| مجموعة كود | `groupCode` | String? | حقل «مجموعة كود» على هذا الجدول. |
| مجموعة اسم | `groupName` | String? | حقل «مجموعة اسم» على هذا الجدول. |
| صنف رقم | `itemNumber` | String? | حقل «صنف رقم» على هذا الجدول. |
| صنف اسم | `itemName` | String | حقل «صنف اسم» على هذا الجدول. |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| وحدة | `unit` | String? | حقل «وحدة» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal? | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي سعر | `totalPrice` | Decimal? | حقل «إجمالي سعر» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخلص → المستخلصات: كل صف هنا مربوط بصف واحد من «المستخلصات» عبر extractId.
- `N-0..1` work صنف → بنود أعمال المشروع: ربط اختياري بصف واحد من «بنود أعمال المشروع» عبر workItemId.
- `N-0..1` مبنى → مباني المشروع: ربط اختياري بصف واحد من «مباني المشروع» عبر buildingId.

### 205. صرفيات المستخلص (`extract_payments`)

موديل: `ExtractPayment` · 21 عمود · 3 علاقة

**إيه الجدول؟** دفعة مالية على المستخلص.

**امتى بيتستخدم؟** يُستخدم مع شاشات: صرفيات المستخلص.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مستخلص | `extractId` | String | مفتاح أجنبي يربط الصف بجدول «مستخلص». |
| contractor | `contractorId` | String? | مفتاح أجنبي يربط الصف بجدول «contractor». |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| دفع رقم | `paymentNumber` | String? | حقل «دفع رقم» على هذا الجدول. |
| دفع تاريخ | `paymentDate` | DateTime | حقل «دفع تاريخ» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime? | متى يستحق الشيك أو القسط أو الفاتورة. |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| check رقم | `checkNumber` | String? | حقل «check رقم» على هذا الجدول. |
| check تاريخ | `checkDate` | DateTime? | حقل «check تاريخ» على هذا الجدول. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| إجمالي extracts | `totalExtracts` | Decimal? | حقل «إجمالي extracts» على هذا الجدول. |
| إجمالي paid | `totalPaid` | Decimal? | حقل «إجمالي paid» على هذا الجدول. |
| دفع مبلغ | `paymentAmount` | Decimal | حقل «دفع مبلغ» على هذا الجدول. |
| صنف مجموعة | `itemGroup` | String? | حقل «صنف مجموعة» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| مرحّل | `isPosted` | Boolean | true = دخل الدفتر المحاسبي/المخزني. المرحّل ما يتعدّلش فوقه؛ يتفك أو يتعكس. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخلص → المستخلصات: كل صف هنا مربوط بصف واحد من «المستخلصات» عبر extractId.
- `N-0..1` contractor → المقاولون: ربط اختياري بصف واحد من «المقاولون» عبر contractorId.
- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.

### 206. تعريفات الحصر (`project_measurement_definitions`)

موديل: `ProjectMeasurementDefinition` · 8 عمود · 1 علاقة

**إيه الجدول؟** وحدة وطريقة قياس قيد البند.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تعريفات الحصر.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| وحدة | `unit` | String? | حقل «وحدة» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.

### 207. سجل العمالة في الموقع (`manpower_logs`)

موديل: `ManpowerLog` · 11 عمود · 1 علاقة

**إيه الجدول؟** حضور/عدد عمال يومي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سجل العمالة في الموقع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| worker اسم | `workerName` | String | حقل «worker اسم» على هذا الجدول. |
| worker نوع | `workerType` | String? | 'skilled' | 'unskilled' | 'supervisor' | etc. |
| hours | `hours` | Decimal? | حقل «hours» على هذا الجدول. |
| wage | `wage` | Decimal? | حقل «wage» على هذا الجدول. |
| إجمالي | `total` | Decimal? | حقل «إجمالي» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → المشاريع (مستخلصات عامة): كل صف هنا مربوط بصف واحد من «المشاريع (مستخلصات عامة)» عبر projectId.

## عقارات

وحدات، حجز، عقد، أقساط، شيكات آجلة، فسخ.

### 154. إعدادات الاستثمار العقاري (`real_estate_settings`)

موديل: `RealEstateSettings` · 9 عمود · 1 علاقة

**إيه الجدول؟** حسابات العربون والأقساط والإيراد.

**امتى بيتستخدم؟** تُقرأ عند ترحيل عقد الوحدة والأقساط.

**الشاشات:** إعدادات العقارات

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| عقاري عقار ar حساب كود | `realEstateArAccountCode` | String? | حقل «عقاري عقار ar حساب كود» على هذا الجدول. |
| unearned عقاري عقار revenue حساب كود | `unearnedRealEstateRevenueAccountCode` | String? | حقل «unearned عقاري عقار revenue حساب كود» على هذا الجدول. |
| عقاري عقار revenue حساب كود | `realEstateRevenueAccountCode` | String? | حقل «عقاري عقار revenue حساب كود» على هذا الجدول. |
| maintenance deposits حساب كود | `maintenanceDepositsAccountCode` | String? | حقل «maintenance deposits حساب كود» على هذا الجدول. |
| غرامة revenue حساب كود | `penaltyRevenueAccountCode` | String? | حقل «غرامة revenue حساب كود» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 155. مشاريع عقارية (`real_estate_projects`)

موديل: `RealEstateProject` · 7 عمود · 3 علاقة

**إيه الجدول؟** كمبوند/مشروع وحدات.

**امتى بيتستخدم؟** أبو المباني والوحدات والحجوزات.

**الشاشات:** مشروع عقاري

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع كود | `projectCode` | String | حقل «مشروع كود» على هذا الجدول. |
| مشروع اسم | `projectName` | String | حقل «مشروع اسم» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `1-N` buildings → مباني المشروع العقاري: هذا الجدول أب: صف واحد هنا له أكثر من «مباني المشروع العقاري».

### 156. مباني المشروع العقاري (`real_estate_buildings`)

موديل: `RealEstateBuilding` · 7 عمود · 2 علاقة

**إيه الجدول؟** عمارة داخل المشروع.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مباني المشروع العقاري.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مبنى كود | `buildingCode` | String | حقل «مبنى كود» على هذا الجدول. |
| الاسم | `name` | String | اسم الصف. |
| إجمالي floors | `totalFloors` | Int | حقل «إجمالي floors» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع عقارية: كل صف هنا مربوط بصف واحد من «مشاريع عقارية» عبر projectId.
- `1-N` units → وحدات عقارية: هذا الجدول أب: صف واحد هنا له أكثر من «وحدات عقارية».

### 157. وحدات عقارية (`real_estate_units`)

موديل: `RealEstateUnit` · 13 عمود · 4 علاقة

**إيه الجدول؟** شقة/محل للبيع.

**امتى بيتستخدم؟** تُحجز ثم تُباع بعقد وأقساط.

**الشاشات:** وحدة عقارية

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مبنى | `buildingId` | String | مفتاح أجنبي يربط الصف بجدول «مبنى». |
| وحدة كود | `unitCode` | String | حقل «وحدة كود» على هذا الجدول. |
| وحدة نوع | `unitType` | String | حقل «وحدة نوع» على هذا الجدول. |
| floor | `floor` | Int | حقل «floor» على هذا الجدول. |
| gross area | `grossArea` | Decimal | حقل «gross area» على هذا الجدول. |
| صافي area | `netArea` | Decimal | حقل «صافي area» على هذا الجدول. |
| meter سعر | `meterPrice` | Decimal | حقل «meter سعر» على هذا الجدول. |
| إجمالي سعر | `totalPrice` | Decimal | حقل «إجمالي سعر» على هذا الجدول. |
| maintenance deposit | `maintenanceDeposit` | Decimal | حقل «maintenance deposit» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مبنى → مباني المشروع العقاري: كل صف هنا مربوط بصف واحد من «مباني المشروع العقاري» عبر buildingId.
- `1-N` contracts → عقود الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الوحدات».
- `1-N` reservations → حجوزات الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «حجوزات الوحدات».
- `N-0..1` عقار وحدة → وحدات الأملاك: ربط اختياري بصف واحد من «وحدات الأملاك».

### 158. حجوزات الوحدات (`real_estate_reservations`)

موديل: `RealEstateReservation` · 14 عمود · 3 علاقة

**إيه الجدول؟** عربون وحجز قبل العقد.

**امتى بيتستخدم؟** يتحول لعقد وحدة أو يُلغى.

**الشاشات:** حجز وحدة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الوحدة | `unitId` | String | وحدة القياس على السطر (قطعة، كرتونة…). |
| العميل | `customerId` | String | طرف القبض/البيع. |
| حجز تاريخ | `reservationDate` | DateTime | حقل «حجز تاريخ» على هذا الجدول. |
| حجز مبلغ | `reservationAmount` | Decimal? | حقل «حجز مبلغ» على هذا الجدول. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| confirmed at | `confirmedAt` | DateTime? | ختم زمني لهذا الحدث. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| فسخ reason | `cancellationReason` | String? | علامة نعم/لا: فسخ reason. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` وحدة → وحدات عقارية: كل صف هنا مربوط بصف واحد من «وحدات عقارية» عبر unitId.
- `N-1` عميل → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر customerId.

### 159. مشاريع أملاك (`property_projects`)

موديل: `PropertyProject` · 11 عمود · 3 علاقة

**إيه الجدول؟** مسار عقاري موازي (property_*).

**امتى بيتستخدم؟** يُستخدم مع شاشات: مشاريع أملاك.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مشروع كود | `projectCode` | String | حقل «مشروع كود» على هذا الجدول. |
| اسم ar | `nameAr` | String | حقل «اسم ar» على هذا الجدول. |
| اسم en | `nameEn` | String? | حقل «اسم en» على هذا الجدول. |
| موقع | `location` | String? | حقل «موقع» على هذا الجدول. |
| construction completion pct | `constructionCompletionPct` | Decimal | حقل «construction completion pct» على هذا الجدول. |
| نشط سعر multiplier | `activePriceMultiplier` | Decimal | حقل «نشط سعر multiplier» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `1-N` phases → مراحل المشروع العقاري: هذا الجدول أب: صف واحد هنا له أكثر من «مراحل المشروع العقاري».

### 160. مراحل المشروع العقاري (`property_phases`)

موديل: `PropertyPhase` · 10 عمود · 2 علاقة

**إيه الجدول؟** مرحلة تسليم.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مراحل المشروع العقاري.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مشروع | `projectId` | String | مفتاح أجنبي يربط الصف بجدول «مشروع». |
| مرحلة كود | `phaseCode` | String | حقل «مرحلة كود» على هذا الجدول. |
| اسم ar | `nameAr` | String | حقل «اسم ar» على هذا الجدول. |
| اسم en | `nameEn` | String? | حقل «اسم en» على هذا الجدول. |
| موقع | `location` | String? | حقل «موقع» على هذا الجدول. |
| construction completion pct | `constructionCompletionPct` | Decimal | حقل «construction completion pct» على هذا الجدول. |
| نشط سعر multiplier | `activePriceMultiplier` | Decimal | حقل «نشط سعر multiplier» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مشروع → مشاريع أملاك: كل صف هنا مربوط بصف واحد من «مشاريع أملاك» عبر projectId.
- `1-N` units → وحدات الأملاك: هذا الجدول أب: صف واحد هنا له أكثر من «وحدات الأملاك».

### 161. وحدات الأملاك (`property_units`)

موديل: `PropertyUnit` · 15 عمود · 5 علاقة

**إيه الجدول؟** وحدة في مسار property.

**امتى بيتستخدم؟** يُستخدم مع شاشات: وحدات الأملاك.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مرحلة | `phaseId` | String | مفتاح أجنبي يربط الصف بجدول «مرحلة». |
| وحدة كود | `unitCode` | String | حقل «وحدة كود» على هذا الجدول. |
| وحدة نوع | `unitType` | PropertyUnitType | حقل «وحدة نوع» على هذا الجدول. |
| gross area | `grossArea` | Decimal | حقل «gross area» على هذا الجدول. |
| صافي area | `netArea` | Decimal | حقل «صافي area» على هذا الجدول. |
| floor رقم | `floorNumber` | Int | حقل «floor رقم» على هذا الجدول. |
| base سعر per meter | `basePricePerMeter` | Decimal | حقل «base سعر per meter» على هذا الجدول. |
| premium modifiers إجمالي | `premiumModifiersTotal` | Decimal | حقل «premium modifiers إجمالي» على هذا الجدول. |
| إجمالي سعر | `totalPrice` | Decimal | حقل «إجمالي سعر» على هذا الجدول. |
| maintenance deposit مبلغ | `maintenanceDepositAmount` | Decimal | حقل «maintenance deposit مبلغ» على هذا الجدول. |
| الحالة | `status` | PropertyUnitStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| legacy عقاري عقار وحدة | `legacyRealEstateUnitId` | String? | مفتاح أجنبي يربط الصف بجدول «legacy عقاري عقار وحدة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مرحلة → مراحل المشروع العقاري: كل صف هنا مربوط بصف واحد من «مراحل المشروع العقاري» عبر phaseId.
- `N-0..1` legacy عقاري عقار وحدة → وحدات عقارية: ربط اختياري بصف واحد من «وحدات عقارية» عبر legacyRealEstateUnitId.
- `1-N` contracts → عقود الوحدات: هذا الجدول أب: صف واحد هنا له أكثر من «عقود الوحدات».
- `1-N` تأجير agreements → اتفاقيات صندوق التأجير: هذا الجدول أب: صف واحد هنا له أكثر من «اتفاقيات صندوق التأجير».
- `1-N` مستند attachments → مرفقات المستندات: هذا الجدول أب: صف واحد هنا له أكثر من «مرفقات المستندات».

### 167. اتفاقيات صندوق التأجير (`rental_pool_agreements`)

موديل: `RentalPoolAgreement` · 11 عمود · 5 علاقة

**إيه الجدول؟** وحدة تدخل pool تأجير.

**امتى بيتستخدم؟** يُستخدم مع شاشات: اتفاقيات صندوق التأجير.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| عقار وحدة | `propertyUnitId` | String | مفتاح أجنبي يربط الصف بجدول «عقار وحدة». |
| وحدة عقد | `unitContractId` | String? | مفتاح أجنبي يربط الصف بجدول «وحدة عقد». |
| owner عميل | `ownerCustomerId` | String | مفتاح أجنبي يربط الصف بجدول «owner عميل». |
| management مصروف دراسي سعر | `managementFeeRate` | Decimal | حقل «management مصروف دراسي سعر» على هذا الجدول. |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime? | نهاية السنة/الفترة/العقد. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` عقار وحدة → وحدات الأملاك: كل صف هنا مربوط بصف واحد من «وحدات الأملاك» عبر propertyUnitId.
- `N-0..1` عقد → عقود الوحدات: ربط اختياري بصف واحد من «عقود الوحدات» عبر unitContractId.
- `N-1` owner → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر ownerCustomerId.
- `1-N` distributions → توزيع عائد الإيجار: هذا الجدول أب: صف واحد هنا له أكثر من «توزيع عائد الإيجار».

### 168. توزيع عائد الإيجار (`rental_distributions`)

موديل: `RentalDistribution` · 11 عمود · 1 علاقة

**إيه الجدول؟** نصيب المالك من الإيجار.

**امتى بيتستخدم؟** يُستخدم مع شاشات: توزيع عائد الإيجار.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| تأجير صندوق إيجار agreement | `rentalPoolAgreementId` | String | مفتاح أجنبي يربط الصف بجدول «تأجير صندوق إيجار agreement». |
| فترة start | `periodStart` | DateTime | حقل «فترة start» على هذا الجدول. |
| فترة end | `periodEnd` | DateTime | حقل «فترة end» على هذا الجدول. |
| gross rent received | `grossRentReceived` | Decimal | حقل «gross rent received» على هذا الجدول. |
| maintenance operating expense | `maintenanceOperatingExpense` | Decimal | حقل «maintenance operating expense» على هذا الجدول. |
| developer management مصروف دراسي | `developerManagementFee` | Decimal | حقل «developer management مصروف دراسي» على هذا الجدول. |
| صافي distributed مبلغ | `netDistributedAmount` | Decimal | حقل «صافي distributed مبلغ» على هذا الجدول. |
| distributed at | `distributedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` agreement → اتفاقيات صندوق التأجير: كل صف هنا مربوط بصف واحد من «اتفاقيات صندوق التأجير» عبر rentalPoolAgreementId.

## مدارس

طالب، سنة دراسية، مصروفات، أقساط.

### 169. إعدادات المدارس (`school_settings`)

موديل: `SchoolSettings` · 10 عمود · 1 علاقة

**إيه الجدول؟** حسابات المصروفات والأقساط.

**امتى بيتستخدم؟** تُقرأ عند ترحيل عقد المصروفات.

**الشاشات:** إعدادات المدارس

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| طالب ar حساب كود | `studentArAccountCode` | String? | حقل «طالب ar حساب كود» على هذا الجدول. |
| unearned tuition revenue حساب كود | `unearnedTuitionRevenueAccountCode` | String? | حقل «unearned tuition revenue حساب كود» على هذا الجدول. |
| earned tuition revenue حساب كود | `earnedTuitionRevenueAccountCode` | String? | حقل «earned tuition revenue حساب كود» على هذا الجدول. |
| tuition خصم حساب كود | `tuitionDiscountAccountCode` | String? | حقل «tuition خصم حساب كود» على هذا الجدول. |
| أتوبيس revenue حساب كود | `busRevenueAccountCode` | String? | حقل «أتوبيس revenue حساب كود» على هذا الجدول. |
| books revenue حساب كود | `booksRevenueAccountCode` | String? | حقل «books revenue حساب كود» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 170. سنوات دراسية (`school_academic_years`)

موديل: `SchoolAcademicYear` · 9 عمود · 4 علاقة

**إيه الجدول؟** عام دراسي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سنوات دراسية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| سنة كود | `yearCode` | String | حقل «سنة كود» على هذا الجدول. |
| الاسم | `name` | String | اسم الصف. |
| تاريخ البداية | `startDate` | DateTime? | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime? | نهاية السنة/الفترة/العقد. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` terms → فصول دراسية: هذا الجدول أب: صف واحد هنا له أكثر من «فصول دراسية».
- `1-N` students → طلبة المدرسة (كارت مدرسي): هذا الجدول أب: صف واحد هنا له أكثر من «طلبة المدرسة (كارت مدرسي)».
- `1-N` contracts → عقود مصروفات الطالب: هذا الجدول أب: صف واحد هنا له أكثر من «عقود مصروفات الطالب».

### 171. فصول دراسية (`school_academic_terms`)

موديل: `SchoolAcademicTerm` · 9 عمود · 1 علاقة

**إيه الجدول؟** ترم داخل السنة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: فصول دراسية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| دراسي سنة | `academicYearId` | String | مفتاح أجنبي يربط الصف بجدول «دراسي سنة». |
| فصل دراسي كود | `termCode` | String | حقل «فصل دراسي كود» على هذا الجدول. |
| فصل دراسي اسم | `termName` | String | حقل «فصل دراسي اسم» على هذا الجدول. |
| تاريخ البداية | `startDate` | DateTime? | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime? | نهاية السنة/الفترة/العقد. |
| sort أمر | `sortOrder` | Int | حقل «sort أمر» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` دراسي سنة → سنوات دراسية: كل صف هنا مربوط بصف واحد من «سنوات دراسية» عبر academicYearId.

### 172. الصفوف الدراسية (`academic_grades`)

موديل: `AcademicGrade` · 9 عمود · 3 علاقة

**إيه الجدول؟** أولى، تانية… مع مركز تكلفة اختياري.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الصفوف الدراسية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مرحلة اسم | `stageName` | String | حقل «مرحلة اسم» على هذا الجدول. |
| صف اسم | `gradeName` | String | حقل «صف اسم» على هذا الجدول. |
| صف كود | `gradeCode` | String | حقل «صف كود» على هذا الجدول. |
| افتراضي tuition مصروف دراسي | `defaultTuitionFee` | Decimal | حقل «افتراضي tuition مصروف دراسي» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` تكلفة مركز → مراكز التكلفة: ربط اختياري بصف واحد من «مراكز التكلفة» عبر costCenterId.
- `1-N` students → طلبة المدرسة (كارت مدرسي): هذا الجدول أب: صف واحد هنا له أكثر من «طلبة المدرسة (كارت مدرسي)».

### 173. خطوط الأتوبيس (`school_bus_routes`)

موديل: `SchoolBusRoute` · 7 عمود · 2 علاقة

**إيه الجدول؟** خط توصيل الطلبة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: خطوط الأتوبيس.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| خط كود | `routeCode` | String | حقل «خط كود» على هذا الجدول. |
| الاسم | `name` | String | اسم الصف. |
| annual مصروف دراسي | `annualFee` | Decimal | حقل «annual مصروف دراسي» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` students → طلبة المدرسة (كارت مدرسي): هذا الجدول أب: صف واحد هنا له أكثر من «طلبة المدرسة (كارت مدرسي)».

### 174. طلبة المدرسة (كارت مدرسي) (`school_students`)

موديل: `SchoolStudent` · 11 عمود · 6 علاقة

**إيه الجدول؟** بيانات الطالب في موديول المدارس.

**امتى بيتستخدم؟** أساس عقد المصروفات والأقساط.

**الشاشات:** كارت طالب

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| طالب كود | `studentCode` | String | حقل «طالب كود» على هذا الجدول. |
| full اسم | `fullName` | String | حقل «full اسم» على هذا الجدول. |
| guardian عميل | `guardianCustomerId` | String | مفتاح أجنبي يربط الصف بجدول «guardian عميل». |
| صف | `gradeId` | String | مفتاح أجنبي يربط الصف بجدول «صف». |
| دراسي سنة | `academicYearId` | String | مفتاح أجنبي يربط الصف بجدول «دراسي سنة». |
| أتوبيس خط | `busRouteId` | String? | مفتاح أجنبي يربط الصف بجدول «أتوبيس خط». |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` guardian → العملاء: كل صف هنا مربوط بصف واحد من «العملاء» عبر guardianCustomerId.
- `N-1` صف → الصفوف الدراسية: كل صف هنا مربوط بصف واحد من «الصفوف الدراسية» عبر gradeId.
- `N-1` دراسي سنة → سنوات دراسية: كل صف هنا مربوط بصف واحد من «سنوات دراسية» عبر academicYearId.
- `N-0..1` أتوبيس خط → خطوط الأتوبيس: ربط اختياري بصف واحد من «خطوط الأتوبيس» عبر busRouteId.
- `1-N` مصروف دراسي contracts → عقود مصروفات الطالب: هذا الجدول أب: صف واحد هنا له أكثر من «عقود مصروفات الطالب».

### 175. عقود مصروفات الطالب (`student_fee_contracts`)

موديل: `StudentFeeContract` · 19 عمود · 4 علاقة

**إيه الجدول؟** المصروفات السنوية وطريقة السداد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عقود مصروفات الطالب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| طالب | `studentId` | String | مفتاح أجنبي يربط الصف بجدول «طالب». |
| دراسي سنة | `academicYearId` | String | مفتاح أجنبي يربط الصف بجدول «دراسي سنة». |
| عقد رقم | `contractNumber` | String | حقل «عقد رقم» على هذا الجدول. |
| إجمالي gross مصروف دراسي | `totalGrossFee` | Decimal | حقل «إجمالي gross مصروف دراسي» على هذا الجدول. |
| إجمالي خصم | `totalDiscount` | Decimal | حقل «إجمالي خصم» على هذا الجدول. |
| إجمالي صافي مصروف دراسي | `totalNetFee` | Decimal | حقل «إجمالي صافي مصروف دراسي» على هذا الجدول. |
| tuition مصروف دراسي | `tuitionFee` | Decimal | حقل «tuition مصروف دراسي» على هذا الجدول. |
| أتوبيس مصروف دراسي | `busFee` | Decimal | حقل «أتوبيس مصروف دراسي» على هذا الجدول. |
| books مصروف دراسي | `booksFee` | Decimal | حقل «books مصروف دراسي» على هذا الجدول. |
| outstanding ar رصيد | `outstandingArBalance` | Decimal | حقل «outstanding ar رصيد» على هذا الجدول. |
| unearned tuition رصيد | `unearnedTuitionBalance` | Decimal | حقل «unearned tuition رصيد» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| accrual قيد حركة | `accrualJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «accrual قيد حركة». |
| recognition قيد حركة | `recognitionJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «recognition قيد حركة». |
| وقت الترحيل | `postedAt` | DateTime? | الختم الزمني لأول ترحيل ناجح. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` طالب → طلبة المدرسة (كارت مدرسي): كل صف هنا مربوط بصف واحد من «طلبة المدرسة (كارت مدرسي)» عبر studentId.
- `N-1` دراسي سنة → سنوات دراسية: كل صف هنا مربوط بصف واحد من «سنوات دراسية» عبر academicYearId.
- `1-N` installments → أقساط المصروفات: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط المصروفات».

### 176. أقساط المصروفات (`student_fee_installments`)

موديل: `StudentFeeInstallment` · 11 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: أقساط المصروفات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| عقد | `contractId` | String | مفتاح أجنبي يربط الصف بجدول «عقد». |
| قسط رقم | `installmentNumber` | Int | حقل «قسط رقم» على هذا الجدول. |
| فصل دراسي اسم | `termName` | String? | حقل «فصل دراسي اسم» على هذا الجدول. |
| تاريخ الاستحقاق | `dueDate` | DateTime | متى يستحق الشيك أو القسط أو الفاتورة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| دفع معاملة | `paymentTransactionId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع معاملة». |
| paid at | `paidAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` عقد → عقود مصروفات الطالب: كل صف هنا مربوط بصف واحد من «عقود مصروفات الطالب» عبر contractId.
- `N-0..1` دفع معاملة → سندات وأوامر الخزينة: ربط اختياري بصف واحد من «سندات وأوامر الخزينة» عبر paymentTransactionId.

### 192. الطلبة (كارت عام) (`students`)

موديل: `Student` · 19 عمود · 4 علاقة

**إيه الجدول؟** كارت طالب في مسار المدارس/الأقساط العام.

**امتى بيتستخدم؟** أساس الأقساط في المسار العام.

**الشاشات:** طالب

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| طالب اسم | `studentName` | String | حقل «طالب اسم» على هذا الجدول. |
| السنة | `year` | String? | السنة الرقمية للملخص أو الفترة. |
| father اسم | `fatherName` | String? | حقل «father اسم» على هذا الجدول. |
| father grandfather | `fatherGrandfather` | String? | حقل «father grandfather» على هذا الجدول. |
| father great grandfather | `fatherGreatGrandfather` | String? | حقل «father great grandfather» على هذا الجدول. |
| mother اسم | `motherName` | String? | حقل «mother اسم» على هذا الجدول. |
| mother grandfather | `motherGrandfather` | String? | حقل «mother grandfather» على هذا الجدول. |
| mother great grandfather | `motherGreatGrandfather` | String? | حقل «mother great grandfather» على هذا الجدول. |
| كود العملة | `currencyCode` | String? | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| مرحلة | `stageId` | String? | مفتاح أجنبي يربط الصف بجدول «مرحلة». |
| ترم | `semesterId` | String? | مفتاح أجنبي يربط الصف بجدول «ترم». |
| دفع نوع | `paymentType` | String? | حقل «دفع نوع» على هذا الجدول. |
| enrollment | `enrollment` | String? | حقل «enrollment» على هذا الجدول. |
| is finished | `isFinished` | Boolean | علامة نعم/لا: is finished. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` مرحلة → المراحل الدراسية: ربط اختياري بصف واحد من «المراحل الدراسية» عبر stageId.
- `N-0..1` ترم → التيرمات: ربط اختياري بصف واحد من «التيرمات» عبر semesterId.
- `1-N` installments → أقساط الطالب: هذا الجدول أب: صف واحد هنا له أكثر من «أقساط الطالب».

### 193. أقساط الطالب (`student_installments`)

موديل: `StudentInstallment` · 12 عمود · 1 علاقة

**إيه الجدول؟** قسط مصروفات على كارت student.

**امتى بيتستخدم؟** يُستخدم مع شاشات: أقساط الطالب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| طالب | `studentId` | String | مفتاح أجنبي يربط الصف بجدول «طالب». |
| قسط | `installment` | Int | حقل «قسط» على هذا الجدول. |
| التاريخ | `date` | DateTime | تاريخ المستند المحاسبي/التشغيلي (مش تاريخ الإنشاء). |
| value | `value` | Decimal | حقل «value» على هذا الجدول. |
| car value | `carValue` | Decimal? | حقل «car value» على هذا الجدول. |
| education خصم | `educationDiscount` | Decimal? | حقل «education خصم» على هذا الجدول. |
| car خصم | `carDiscount` | Decimal? | حقل «car خصم» على هذا الجدول. |
| إجمالي | `total` | Decimal | حقل «إجمالي» على هذا الجدول. |
| is paid | `isPaid` | Boolean | علامة نعم/لا: is paid. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` طالب → الطلبة (كارت عام): كل صف هنا مربوط بصف واحد من «الطلبة (كارت عام)» عبر studentId.

### 194. المراحل الدراسية (`stages`)

موديل: `Stage` · 8 عمود · 2 علاقة

**إيه الجدول؟** مرحلة (ابتدائي/إعدادي) في المسار العام.

**امتى بيتستخدم؟** يُستخدم مع شاشات: المراحل الدراسية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` students → الطلبة (كارت عام): هذا الجدول أب: صف واحد هنا له أكثر من «الطلبة (كارت عام)».

### 195. التيرمات (`semesters`)

موديل: `Semester` · 8 عمود · 2 علاقة

**إيه الجدول؟** ترم في المسار العام.

**امتى بيتستخدم؟** يُستخدم مع شاشات: التيرمات.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الكود | `code` | String? | الرمز الظاهر للمستخدم، فريد داخل الشركة (حساب، صنف، عميل…). |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` students → الطلبة (كارت عام): هذا الجدول أب: صف واحد هنا له أكثر من «الطلبة (كارت عام)».

## استيراد واعتمادات

اعتماد مستندي، خطاب ضمان، خصم منبع.

### 216. قوالب الاعتماد المستندي (`documentary_credit_definitions`)

موديل: `DocumentaryCreditDefinition` · 23 عمود · 2 علاقة

**إيه الجدول؟** تعريف رسوم ومراحل الاعتماد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: قوالب الاعتماد المستندي.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. Reference to Supplier |
| مورد اسم | `supplierName` | String? | حقل «مورد اسم» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| shipping port | `shippingPort` | String? | حقل «shipping port» على هذا الجدول. |
| ائتمان/دائن value | `creditValue` | Decimal? | حقل «ائتمان/دائن value» على هذا الجدول. |
| ائتمان/دائن رقم | `creditNumber` | String? | حقل «ائتمان/دائن رقم» على هذا الجدول. |
| العملة | `currencyId` | String? | ربط بجدول العملات. Reference to Currency |
| عملة اسم | `currencyName` | String? | حقل «عملة اسم» على هذا الجدول. |
| shipping method | `shippingMethod` | String? | 'بحري' | 'جوي' | 'برى' |
| دفع method | `paymentMethod` | String? | 'فيزا' | 'شيك' | 'نقد' |
| افتتاحي تاريخ | `openingDate` | DateTime? | حقل «افتتاحي تاريخ» على هذا الجدول. |
| افتتاحي تاريخ hijri | `openingDateHijri` | String? | حقل «افتتاحي تاريخ hijri» على هذا الجدول. |
| ختامي تاريخ | `closingDate` | DateTime? | حقل «ختامي تاريخ» على هذا الجدول. |
| ختامي تاريخ hijri | `closingDateHijri` | String? | حقل «ختامي تاريخ hijri» على هذا الجدول. |
| shipping تاريخ | `shippingDate` | DateTime? | حقل «shipping تاريخ» على هذا الجدول. |
| shipping تاريخ hijri | `shippingDateHijri` | String? | حقل «shipping تاريخ hijri» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` credits → الاعتمادات المستندية: هذا الجدول أب: صف واحد هنا له أكثر من «الاعتمادات المستندية».

### 217. الاعتمادات المستندية (`documentary_credits`)

موديل: `DocumentaryCredit` · 56 عمود · 2 علاقة

**إيه الجدول؟** ملف اعتماد استيراد كامل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الاعتمادات المستندية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| definition | `definitionId` | String? | Reference to DocumentaryCreditDefinition |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. Reference to Supplier |
| مورد اسم | `supplierName` | String? | حقل «مورد اسم» على هذا الجدول. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). Reference to Account |
| حساب اسم | `accountName` | String? | حقل «حساب اسم» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. Reference to CostCenter |
| تكلفة مركز اسم | `costCenterName` | String? | حقل «تكلفة مركز اسم» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| approval حالة | `approvalStatus` | String | 'open' | 'closed' |
| approval رقم | `approvalNumber` | String? | حقل «approval رقم» على هذا الجدول. |
| approval value | `approvalValue` | Decimal? | حقل «approval value» على هذا الجدول. |
| العملة | `currencyId` | String? | ربط بجدول العملات. Reference to Currency |
| عملة اسم | `currencyName` | String? | حقل «عملة اسم» على هذا الجدول. |
| shipping method | `shippingMethod` | String? | 'بحري' | 'جوي' | 'برى' |
| دفع method | `paymentMethod` | String? | 'فيزا' | 'شيك' | 'نقد' |
| application تاريخ | `applicationDate` | DateTime? | تاريخ الطلب |
| application تاريخ hijri | `applicationDateHijri` | String? | حقل «application تاريخ hijri» على هذا الجدول. |
| افتتاحي تاريخ | `openingDate` | DateTime? | تاريخ الفتح |
| افتتاحي تاريخ hijri | `openingDateHijri` | String? | حقل «افتتاحي تاريخ hijri» على هذا الجدول. |
| ختامي تاريخ | `closingDate` | DateTime? | تاريخ الإغلاق |
| ختامي تاريخ hijri | `closingDateHijri` | String? | حقل «ختامي تاريخ hijri» على هذا الجدول. |
| shipping تاريخ | `shippingDate` | DateTime? | تاريخ الشحن |
| shipping تاريخ hijri | `shippingDateHijri` | String? | حقل «shipping تاريخ hijri» على هذا الجدول. |
| arrival تاريخ | `arrivalDate` | DateTime? | تاريخ الوصول |
| arrival تاريخ hijri | `arrivalDateHijri` | String? | حقل «arrival تاريخ hijri» على هذا الجدول. |
| date1 | `date1` | DateTime? | حقل «date1» على هذا الجدول. |
| date1hijri | `date1Hijri` | String? | حقل «date1hijri» على هذا الجدول. |
| date2 | `date2` | DateTime? | حقل «date2» على هذا الجدول. |
| date2hijri | `date2Hijri` | String? | حقل «date2hijri» على هذا الجدول. |
| date3 | `date3` | DateTime? | حقل «date3» على هذا الجدول. |
| date3hijri | `date3Hijri` | String? | حقل «date3hijri» على هذا الجدول. |
| date4 | `date4` | DateTime? | حقل «date4» على هذا الجدول. |
| date4hijri | `date4Hijri` | String? | حقل «date4hijri» على هذا الجدول. |
| date5 | `date5` | DateTime? | حقل «date5» على هذا الجدول. |
| date5hijri | `date5Hijri` | String? | حقل «date5hijri» على هذا الجدول. |
| date6 | `date6` | DateTime? | حقل «date6» على هذا الجدول. |
| date6hijri | `date6Hijri` | String? | حقل «date6hijri» على هذا الجدول. |
| date7 | `date7` | DateTime? | حقل «date7» على هذا الجدول. |
| date7hijri | `date7Hijri` | String? | حقل «date7hijri» على هذا الجدول. |
| date8 | `date8` | DateTime? | حقل «date8» على هذا الجدول. |
| date8hijri | `date8Hijri` | String? | حقل «date8hijri» على هذا الجدول. |
| date9 | `date9` | DateTime? | حقل «date9» على هذا الجدول. |
| date9hijri | `date9Hijri` | String? | حقل «date9hijri» على هذا الجدول. |
| date10 | `date10` | DateTime? | حقل «date10» على هذا الجدول. |
| date10hijri | `date10Hijri` | String? | حقل «date10hijri» على هذا الجدول. |
| shipping port | `shippingPort` | String? | حقل «shipping port» على هذا الجدول. |
| bill of lading | `billOfLading` | String? | البوليصة |
| ضريبة حركة | `taxEntryId` | String? | Reference to JournalEntry |
| حركة | `entryId` | String? | Reference to JournalEntry |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` definition → قوالب الاعتماد المستندي: ربط اختياري بصف واحد من «قوالب الاعتماد المستندي» عبر definitionId.

### 218. إعدادات خطابات الضمان (`letter_of_guarantee_settings`)

موديل: `LetterOfGuaranteeSettings` · 11 عمود · 1 علاقة

**إيه الجدول؟** حسابات الغطاء والعمولة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعدادات خطابات الضمان.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| ضمان حساب | `guaranteeAccountId` | String? | Default account for guarantees |
| expense حساب | `expenseAccountId` | String? | Default expense account |
| افتراضي عملة | `defaultCurrencyId` | String? | Default currency |
| افتراضي bid percentage | `defaultBidPercentage` | Decimal? | Default bid percentage |
| auto renewal enabled | `autoRenewalEnabled` | Boolean | حقل «auto renewal enabled» على هذا الجدول. |
| renewal warning days | `renewalWarningDays` | Int? | Days before expiry to warn |
| include بنك expenses | `includeBankExpenses` | Boolean | حقل «include بنك expenses» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 219. خطابات الضمان (`letters_of_guarantee`)

موديل: `LetterOfGuarantee` · 63 عمود · 3 علاقة

**إيه الجدول؟** إصدار/غطاء/عمولة خطاب ضمان بنكي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: خطابات الضمان.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| ضمان حساب | `guaranteeAccountId` | String? | Reference to Account |
| ضمان حساب اسم | `guaranteeAccountName` | String? | حقل «ضمان حساب اسم» على هذا الجدول. |
| خطاب نوع | `letterType` | String | 'incoming' | 'outgoing' |
| خطاب رقم | `letterNumber` | String? | حقل «خطاب رقم» على هذا الجدول. |
| صرف تاريخ | `issueDate` | DateTime? | علامة نعم/لا: صرف تاريخ. |
| صرف تاريخ hijri | `issueDateHijri` | String? | علامة نعم/لا: صرف تاريخ hijri. |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| expiry تاريخ hijri | `expiryDateHijri` | String? | حقل «expiry تاريخ hijri» على هذا الجدول. |
| خطاب value | `letterValue` | Decimal? | حقل «خطاب value» على هذا الجدول. |
| bid percentage | `bidPercentage` | Decimal? | حقل «bid percentage» على هذا الجدول. |
| bid value | `bidValue` | Decimal? | حقل «bid value» على هذا الجدول. |
| beneficiary | `beneficiary` | String? | الجهة المستفيدة |
| issuing بنك | `issuingBank` | String? | بنك الإصدار |
| incoming party | `incomingParty` | String? | طرف الوارد |
| includes بنك expenses | `includesBankExpenses` | Boolean | حقل «includes بنك expenses» على هذا الجدول. |
| expense حساب | `expenseAccountId` | String? | Reference to Account |
| expense حساب اسم | `expenseAccountName` | String? | حقل «expense حساب اسم» على هذا الجدول. |
| expense value | `expenseValue` | Decimal? | حقل «expense value» على هذا الجدول. |
| مركز التكلفة | `costCenterId` | String? | للتحليل: المشروع/الإدارة اللي الحركة تخصها. Reference to CostCenter |
| تكلفة مركز اسم | `costCenterName` | String? | حقل «تكلفة مركز اسم» على هذا الجدول. |
| نوع | `type` | String? | نوع الخطاب |
| العملة | `currencyId` | String? | ربط بجدول العملات. Reference to Currency |
| عملة اسم | `currencyName` | String? | حقل «عملة اسم» على هذا الجدول. |
| accrued revenue | `accruedRevenue` | Decimal? | حقل «accrued revenue» على هذا الجدول. |
| operations مركز | `operationsCenter` | String? | حقل «operations مركز» على هذا الجدول. |
| cash collection papers1 | `cashCollectionPapers1` | String? | أوراق القبض النقدية 1 |
| cash collection papers2 | `cashCollectionPapers2` | String? | أوراق القبض النقدية 2 |
| cash collection papers3 | `cashCollectionPapers3` | String? | أوراق القبض النقدية 3 |
| approval حالة | `approvalStatus` | String | 'open' | 'closed' |
| حركة | `entryId` | String? | Reference to JournalEntry |
| ختامي حركة | `closingEntryId` | String? | Reference to JournalEntry |
| creation حركة | `creationEntryId` | String? | Reference to JournalEntry |
| date1 | `date1` | DateTime? | حقل «date1» على هذا الجدول. |
| date1hijri | `date1Hijri` | String? | حقل «date1hijri» على هذا الجدول. |
| date2 | `date2` | DateTime? | حقل «date2» على هذا الجدول. |
| date2hijri | `date2Hijri` | String? | حقل «date2hijri» على هذا الجدول. |
| date3 | `date3` | DateTime? | حقل «date3» على هذا الجدول. |
| date3hijri | `date3Hijri` | String? | حقل «date3hijri» على هذا الجدول. |
| date4 | `date4` | DateTime? | حقل «date4» على هذا الجدول. |
| date4hijri | `date4Hijri` | String? | حقل «date4hijri» على هذا الجدول. |
| date5 | `date5` | DateTime? | حقل «date5» على هذا الجدول. |
| date5hijri | `date5Hijri` | String? | حقل «date5hijri» على هذا الجدول. |
| date6 | `date6` | DateTime? | حقل «date6» على هذا الجدول. |
| date6hijri | `date6Hijri` | String? | حقل «date6hijri» على هذا الجدول. |
| date7 | `date7` | DateTime? | حقل «date7» على هذا الجدول. |
| date7hijri | `date7Hijri` | String? | حقل «date7hijri» على هذا الجدول. |
| date8 | `date8` | DateTime? | حقل «date8» على هذا الجدول. |
| date8hijri | `date8Hijri` | String? | حقل «date8hijri» على هذا الجدول. |
| date9 | `date9` | DateTime? | حقل «date9» على هذا الجدول. |
| date9hijri | `date9Hijri` | String? | حقل «date9hijri» على هذا الجدول. |
| date10 | `date10` | DateTime? | حقل «date10» على هذا الجدول. |
| date10hijri | `date10Hijri` | String? | حقل «date10hijri» على هذا الجدول. |
| is renewed | `isRenewed` | Boolean | علامة نعم/لا: is renewed. |
| renewed من | `renewedFromId` | String? | Reference to previous letter |
| renewed at | `renewedAt` | DateTime? | ختم زمني لهذا الحدث. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| حذف ناعم | `deletedAt` | DateTime? | لو فيه تاريخ يبقى الصف مخفي من الشاشات ومش ممسوح من الداتابيز. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` renewed من → خطابات الضمان: ربط اختياري بصف واحد من «خطابات الضمان» عبر renewedFromId.
- `1-N` renewed إلى → خطابات الضمان: هذا الجدول أب: صف واحد هنا له أكثر من «خطابات الضمان».

### 229. إعدادات التجارة الخارجية (`trade_settings`)

موديل: `TradeSettings` · 10 عمود · 1 علاقة

**إيه الجدول؟** حسابات الاعتمادات والمصاريف.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعدادات التجارة الخارجية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| open lc wip حساب كود | `openLcWipAccountCode` | String? | حقل «open lc wip حساب كود» على هذا الجدول. |
| inventory حساب كود | `inventoryAccountCode` | String? | حقل «inventory حساب كود» على هذا الجدول. |
| lc payable حساب كود | `lcPayableAccountCode` | String? | حقل «lc payable حساب كود» على هذا الجدول. |
| lg cash cover حساب كود | `lgCashCoverAccountCode` | String? | حقل «lg cash cover حساب كود» على هذا الجدول. |
| بنك عمولة حساب كود | `bankCommissionAccountCode` | String? | حقل «بنك عمولة حساب كود» على هذا الجدول. |
| lg confiscation loss حساب كود | `lgConfiscationLossAccountCode` | String? | حقل «lg confiscation loss حساب كود» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 230. خطابات الاعتماد (مسار تجارة) (`letter_of_credits`)

موديل: `LetterOfCredit` · 22 عمود · 8 علاقة

**إيه الجدول؟** اعتماد في موديول الاستيراد/التصدير.

**امتى بيتستخدم؟** يُستخدم مع شاشات: خطابات الاعتماد (مسار تجارة).

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| lc رقم | `lcNumber` | String | حقل «lc رقم» على هذا الجدول. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| المخزن | `warehouseId` | String? | المخزن اللي الكمية بتتحرك منه أو إليه. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| إجمالي مبلغ fx | `totalAmountFx` | Decimal | حقل «إجمالي مبلغ fx» على هذا الجدول. |
| merchandise base | `merchandiseBase` | Decimal | حقل «merchandise base» على هذا الجدول. |
| إجمالي تكلفة إضافية تكلفة | `totalLandedCost` | Decimal | حقل «إجمالي تكلفة إضافية تكلفة» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| افتتاحي قيد حركة | `openingJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «افتتاحي قيد حركة». |
| clearing قيد حركة | `clearingJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «clearing قيد حركة». |
| صرف تاريخ | `issueDate` | DateTime | علامة نعم/لا: صرف تاريخ. |
| cleared at | `clearedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.
- `N-0..1` مخزن → المخازن: ربط اختياري بصف واحد من «المخازن» عبر warehouseId.
- `1-N` expenses → مصاريف الاعتماد: هذا الجدول أب: صف واحد هنا له أكثر من «مصاريف الاعتماد».
- `1-N` قبض/إذن lines → سطور استلام بضاعة الاعتماد: هذا الجدول أب: صف واحد هنا له أكثر من «سطور استلام بضاعة الاعتماد».

### 231. مصاريف الاعتماد (`lc_expenses`)

موديل: `LcExpense` · 13 عمود · 1 علاقة

**إيه الجدول؟** عمولة بنك، بوليصة… تتحمل على الاعتماد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مصاريف الاعتماد.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| lc | `lcId` | String | مفتاح أجنبي يربط الصف بجدول «lc». |
| expense نوع | `expenseType` | String | حقل «expense نوع» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| سعر التحويل | `exchangeRate` | Decimal | كم وحدة أساس لكل وحدة من عملة المستند. |
| مبلغ base | `amountBase` | Decimal | حقل «مبلغ base» على هذا الجدول. |
| expense تاريخ | `expenseDate` | DateTime | حقل «expense تاريخ» على هذا الجدول. |
| قيد اليومية | `journalEntryId` | String? | القيد المتولّد بعد الترحيل. المستند ≠ القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` lc → خطابات الاعتماد (مسار تجارة): كل صف هنا مربوط بصف واحد من «خطابات الاعتماد (مسار تجارة)» عبر lcId.

### 232. سطور استلام بضاعة الاعتماد (`lc_receipt_lines`)

موديل: `LcReceiptLine` · 11 عمود · 2 علاقة

**إيه الجدول؟** كميات وصلت مقابل الاعتماد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور استلام بضاعة الاعتماد.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| lc | `lcId` | String | مفتاح أجنبي يربط الصف بجدول «lc». |
| الصنف | `itemId` | String | الصنف المخزني أو الخدمي على السطر. |
| الوحدة | `unitId` | String? | وحدة القياس على السطر (قطعة، كرتونة…). |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| merchandise base | `merchandiseBase` | Decimal | حقل «merchandise base» على هذا الجدول. |
| allocated expense base | `allocatedExpenseBase` | Decimal | حقل «allocated expense base» على هذا الجدول. |
| تكلفة إضافية وحدة تكلفة base | `landedUnitCostBase` | Decimal | حقل «تكلفة إضافية وحدة تكلفة base» على هذا الجدول. |
| ترتيب السطر | `lineOrder` | Int | ترتيب العرض والترحيل داخل القيد. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` lc → خطابات الاعتماد (مسار تجارة): كل صف هنا مربوط بصف واحد من «خطابات الاعتماد (مسار تجارة)» عبر lcId.
- `N-1` صنف → الأصناف: كل صف هنا مربوط بصف واحد من «الأصناف» عبر itemId.

### 233. خطابات الضمان (مسار تجارة) (`guarantee_letters`)

موديل: `GuaranteeLetter` · 23 عمود · 4 علاقة

**إيه الجدول؟** خطاب ضمان في موديول الاستيراد.

**امتى بيتستخدم؟** يُستخدم مع شاشات: خطابات الضمان (مسار تجارة).

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| lg رقم | `lgNumber` | String | حقل «lg رقم» على هذا الجدول. |
| lg نوع | `lgType` | String | حقل «lg نوع» على هذا الجدول. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| beneficiary اسم | `beneficiaryName` | String? | حقل «beneficiary اسم» على هذا الجدول. |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| cash cover مبلغ | `cashCoverAmount` | Decimal | حقل «cash cover مبلغ» على هذا الجدول. |
| عمولة مبلغ | `commissionAmount` | Decimal | حقل «عمولة مبلغ» على هذا الجدول. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| صرف تاريخ | `issueDate` | DateTime | علامة نعم/لا: صرف تاريخ. |
| expiry تاريخ | `expiryDate` | DateTime? | حقل «expiry تاريخ» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| صرف قيد حركة | `issueJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «صرف قيد حركة». |
| release قيد حركة | `releaseJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «release قيد حركة». |
| confiscate قيد حركة | `confiscateJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «confiscate قيد حركة». |
| extended at | `extendedAt` | DateTime? | ختم زمني لهذا الحدث. |
| released at | `releasedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` بنك حساب → الحسابات البنكية: ربط اختياري بصف واحد من «الحسابات البنكية» عبر bankAccountId.

### 234. سداد ضريبة الخصم من المنبع (`withholding_tax_payments`)

موديل: `WithholdingTaxPayment` · 19 عمود · 1 علاقة

**إيه الجدول؟** توريد خصم المورد لمصلحة الضرائب.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سداد ضريبة الخصم من المنبع.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المسلسل | `serial` | String? | رقم تسلسلي إضافي أو بديل. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| gregorian تاريخ | `gregorianDate` | DateTime | حقل «gregorian تاريخ» على هذا الجدول. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| selected فترة | `selectedPeriod` | String? | e.g., "الفترة الأولى", "الفترة الثانية" |
| due | `due` | Decimal? | حقل «due» على هذا الجدول. |
| paid | `paid` | Decimal? | حقل «paid» على هذا الجدول. |
| due رصيد | `dueBalance` | Decimal? | حقل «due رصيد» على هذا الجدول. |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| دفع تاريخ | `paymentDate` | DateTime? | حقل «دفع تاريخ» على هذا الجدول. |
| الضريبة | `taxAmount` | Decimal? | قيمة الضريبة المحسوبة. |
| الحساب | `accountId` | String? | حساب الأستاذ في دليل الحسابات (POSTING مش رئيسي). |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

## ضرائب وإي-فاتورة

فترة ضريبية، إقرار، فاتورة إلكترونية.

### 209. أصناف الإي-فاتورة (كتالوج) (`electronic_invoice_items`)

موديل: `ElectronicInvoiceItem` · 15 عمود · 3 علاقة

**إيه الجدول؟** وصف صنف كما تطلب مصلحة الضرائب.

**امتى بيتستخدم؟** يُستخدم مع شاشات: أصناف الإي-فاتورة (كتالوج).

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الصنف | `itemId` | String? | الصنف المخزني أو الخدمي على السطر. Reference to inventory item |
| صنف كود | `itemCode` | String | حقل «صنف كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| وحدة كود | `unitCode` | String? | حقل «وحدة كود» على هذا الجدول. |
| وحدة اسم | `unitName` | String? | حقل «وحدة اسم» على هذا الجدول. |
| ضريبة نوع | `taxType` | String? | 'T1' | 'T2' | 'T3' | etc. |
| ضريبة سعر | `taxRate` | Decimal? | حقل «ضريبة سعر» على هذا الجدول. |
| سعر | `price` | Decimal? | حقل «سعر» على هذا الجدول. |
| البيان / الشرح | `description` | String? | نص حر يظهر في القيد والطباعة. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` صنف → الأصناف: ربط اختياري بصف واحد من «الأصناف» عبر itemId.
- `1-N` فاتورة lines → سطور الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الإي-فاتورة».

### 210. عملاء الإي-فاتورة (`electronic_invoice_customers`)

موديل: `ElectronicInvoiceCustomer` · 17 عمود · 4 علاقة

**إيه الجدول؟** بيانات المشتري للبوابة الضريبية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: عملاء الإي-فاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| العميل | `customerId` | String? | طرف القبض/البيع. Reference to accounting customer |
| المورد | `supplierId` | String? | طرف الدفع/الشراء. Reference to supplier |
| الرقم الضريبي | `taxNumber` | String | الرقم الضريبي للشركة أو العميل. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| العنوان | `address` | String? | عنوان الطرف. |
| مدينة | `city` | String? | حقل «مدينة» على هذا الجدول. |
| country | `country` | String? | حقل «country» على هذا الجدول. |
| الهاتف | `phone` | String? | رقم التواصل. |
| البريد | `email` | String? | بريد الدخول أو التواصل. |
| registration رقم | `registrationNumber` | String? | حقل «registration رقم» على هذا الجدول. |
| commercial registration | `commercialRegistration` | String? | حقل «commercial registration» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` عميل → العملاء: ربط اختياري بصف واحد من «العملاء» عبر customerId.
- `N-0..1` مورد → الموردون: ربط اختياري بصف واحد من «الموردون» عبر supplierId.
- `1-N` invoices → الإي-فواتير: هذا الجدول أب: صف واحد هنا له أكثر من «الإي-فواتير».

### 211. الإي-فواتير (`electronic_invoices`)

موديل: `ElectronicInvoice` · 22 عمود · 4 علاقة

**إيه الجدول؟** مستند مرسل/مستلم من منظومة الفاتورة الإلكترونية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إرسال فاتورة.

**الشاشات:** إرسال فاتورة

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| العميل | `customerId` | String | طرف القبض/البيع. |
| نوع قديم | `invoiceType` | String | حقل تراثي موازي لـ invoiceKind. التقارير بتقرأ الاتنين. 'sales' | 'return' | 'amendment' |
| رقم الفاتورة | `invoiceNumber` | String? | الرقم الظاهر للمستخدم، من مسلسل المستندات. |
| فاتورة تاريخ | `invoiceDate` | DateTime | حقل «فاتورة تاريخ» على هذا الجدول. |
| التاريخ الهجري | `hijriDate` | String? | مرادف هجري للتاريخ الميلادي عشان الطباعة. |
| uuid | `uuid` | String? | ETA UUID |
| long | `longId` | String? | ETA Long ID |
| qr كود | `qrCode` | String? | حقل «qr كود» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled' |
| submission تاريخ | `submissionDate` | DateTime? | حقل «submission تاريخ» على هذا الجدول. |
| approval تاريخ | `approvalDate` | DateTime? | حقل «approval تاريخ» على هذا الجدول. |
| rejection reason | `rejectionReason` | String? | حقل «rejection reason» على هذا الجدول. |
| الإجمالي | `totalAmount` | Decimal | مجموع السطور قبل/مع الخصم حسب الشاشة. |
| إجمالي ضريبة | `totalTax` | Decimal | حقل «إجمالي ضريبة» على هذا الجدول. |
| إجمالي مبلغ after ضريبة | `totalAmountAfterTax` | Decimal | حقل «إجمالي مبلغ after ضريبة» على هذا الجدول. |
| الخصم | `discountAmount` | Decimal? | قيمة الخصم على الرأس أو السطر. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-1` عميل → عملاء الإي-فاتورة: كل صف هنا مربوط بصف واحد من «عملاء الإي-فاتورة» عبر customerId.
- `1-N` lines → سطور الإي-فاتورة: هذا الجدول أب: صف واحد هنا له أكثر من «سطور الإي-فاتورة».

### 212. سطور الإي-فاتورة (`electronic_invoice_lines`)

موديل: `ElectronicInvoiceLine` · 19 عمود · 2 علاقة

**إيه الجدول؟** 

**امتى بيتستخدم؟** يُستخدم مع شاشات: سطور الإي-فاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الفاتورة | `invoiceId` | String | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| الصنف | `itemId` | String? | الصنف المخزني أو الخدمي على السطر. |
| صنف كود | `itemCode` | String | حقل «صنف كود» على هذا الجدول. |
| الاسم العربي | `arabicName` | String | الاسم اللي يظهر في الشاشات العربية. |
| الاسم الإنجليزي | `englishName` | String? | الاسم البديل للطباعة أو التقارير الإنجليزية. |
| الكمية | `quantity` | Decimal | الكمية بوحدة السطر. |
| وحدة كود | `unitCode` | String? | حقل «وحدة كود» على هذا الجدول. |
| وحدة اسم | `unitName` | String? | حقل «وحدة اسم» على هذا الجدول. |
| سعر الوحدة | `unitPrice` | Decimal | سعر الوحدة قبل الضريبة غالبًا. |
| إجمالي سعر | `totalPrice` | Decimal | حقل «إجمالي سعر» على هذا الجدول. |
| ضريبة نوع | `taxType` | String? | حقل «ضريبة نوع» على هذا الجدول. |
| ضريبة سعر | `taxRate` | Decimal? | حقل «ضريبة سعر» على هذا الجدول. |
| الضريبة | `taxAmount` | Decimal | قيمة الضريبة المحسوبة. |
| الخصم | `discountAmount` | Decimal? | قيمة الخصم على الرأس أو السطر. |
| إجمالي after ضريبة | `totalAfterTax` | Decimal | حقل «إجمالي after ضريبة» على هذا الجدول. |
| رقم السطر | `lineNumber` | Int | ترتيب السطر داخل المستند، فريد مع رأس المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` فاتورة → الإي-فواتير: كل صف هنا مربوط بصف واحد من «الإي-فواتير» عبر invoiceId.
- `N-0..1` صنف → أصناف الإي-فاتورة (كتالوج): ربط اختياري بصف واحد من «أصناف الإي-فاتورة (كتالوج)» عبر itemId.

### 213. قراءات أجهزة (`sensor_readings`)

موديل: `SensorReading` · 9 عمود · 0 علاقة

**إيه الجدول؟** بيانات حساسات (وزن/حرارة) اختيارية.

**امتى بيتستخدم؟** يُستخدم مع شاشات: قراءات أجهزة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String? | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| machine | `machineId` | String | مفتاح أجنبي يربط الصف بجدول «machine». |
| sensor نوع | `sensorType` | String | حقل «sensor نوع» على هذا الجدول. |
| value | `value` | Decimal | حقل «value» على هذا الجدول. |
| وحدة | `unit` | String? | حقل «وحدة» على هذا الجدول. |
| timestamp | `timestamp` | DateTime | حقل «timestamp» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

### 220. الفترات الضريبية (`tax_periods`)

موديل: `TaxPeriod` · 14 عمود · 4 علاقة

**إيه الجدول؟** شهر/ربع إقرار.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الفترات الضريبية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| السنة المالية | `fiscalYearId` | String | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| فترة رقم | `periodNumber` | Int | حقل «فترة رقم» على هذا الجدول. |
| فترة اسم | `periodName` | String? | حقل «فترة اسم» على هذا الجدول. |
| فترة نوع | `periodType` | String | حقل «فترة نوع» على هذا الجدول. |
| سنة المصدر | `sourceYearId` | String? | السنة الظاهرة في ترقيم المستند (غالبًا legacyYearId). |
| تاريخ البداية | `startDate` | DateTime | بداية السنة/الفترة/العقد. |
| تاريخ النهاية | `endDate` | DateTime | نهاية السنة/الفترة/العقد. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| closed at | `closedAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فرع → الفروع: ربط اختياري بصف واحد من «الفروع» عبر branchId.
- `N-1` مالي سنة → السنوات المالية: كل صف هنا مربوط بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `1-N` declarations → الإقرارات الضريبية: هذا الجدول أب: صف واحد هنا له أكثر من «الإقرارات الضريبية».

### 221. الإقرارات الضريبية (`tax_declarations`)

موديل: `TaxDeclaration` · 12 عمود · 5 علاقة

**إيه الجدول؟** إقرار ضريبة القيمة المضافة أو الدخل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: الإقرارات الضريبية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| ضريبة فترة | `taxPeriodId` | String | مفتاح أجنبي يربط الصف بجدول «ضريبة فترة». |
| السنة المالية | `fiscalYearId` | String? | السنة المفتوحة اللي القيد/المستند اترحّل تحتها. لو السنة مقفولة الترحيل يتمنع. |
| إجمالي output vat | `totalOutputVat` | Decimal | حقل «إجمالي output vat» على هذا الجدول. |
| إجمالي input vat | `totalInputVat` | Decimal | حقل «إجمالي input vat» على هذا الجدول. |
| صافي vat مبلغ | `netVatAmount` | Decimal | حقل «صافي vat مبلغ» على هذا الجدول. |
| إجمالي خصم منبع ضريبة | `totalWithholdingTax` | Decimal | حقل «إجمالي خصم منبع ضريبة» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| تسوية قيد حركة | `settlementJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «تسوية قيد حركة». |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` ضريبة فترة → الفترات الضريبية: كل صف هنا مربوط بصف واحد من «الفترات الضريبية» عبر taxPeriodId.
- `N-0..1` مالي سنة → السنوات المالية: ربط اختياري بصف واحد من «السنوات المالية» عبر fiscalYearId.
- `N-0..1` تسوية قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر settlementJournalEntryId.
- `1-N` settlements → تسويات الضريبة: هذا الجدول أب: صف واحد هنا له أكثر من «تسويات الضريبة».

### 222. تسويات الضريبة (`tax_settlements`)

موديل: `TaxSettlement` · 11 عمود · 3 علاقة

**إيه الجدول؟** سداد أو تسوية فرق الإقرار.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تسويات الضريبة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| ضريبة إقرار | `taxDeclarationId` | String | مفتاح أجنبي يربط الصف بجدول «ضريبة إقرار». |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| دفع قيد حركة | `paymentJournalEntryId` | String? | مفتاح أجنبي يربط الصف بجدول «دفع قيد حركة». |
| الخزينة | `safeId` | String? | الصندوق النقدي. الخزينة نفسها مش حساب؛ ليها حساب GL مربوط. |
| الحساب البنكي | `bankAccountId` | String? | حساب البنك التشغيلي، مربوط بحساب أستاذ. |
| settled at | `settledAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` ضريبة إقرار → الإقرارات الضريبية: كل صف هنا مربوط بصف واحد من «الإقرارات الضريبية» عبر taxDeclarationId.
- `N-0..1` دفع قيد حركة → قيود اليومية: ربط اختياري بصف واحد من «قيود اليومية» عبر paymentJournalEntryId.

### 227. إعدادات بوابة الإي-فاتورة (`e_invoice_settings`)

موديل: `EInvoiceSetting` · 12 عمود · 1 علاقة

**إيه الجدول؟** معرف الشركة لدى المصلحة، شهادة، بيئة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إعدادات بوابة الإي-فاتورة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| client | `clientId` | String? | مفتاح أجنبي يربط الصف بجدول «client». |
| client secret | `clientSecret` | String? | حقل «client secret» على هذا الجدول. |
| token pin | `tokenPin` | String? | حقل «token pin» على هذا الجدول. |
| environment | `environment` | String | حقل «environment» على هذا الجدول. |
| issuer ضريبة | `issuerTaxId` | String? | مفتاح أجنبي يربط الصف بجدول «issuer ضريبة». |
| issuer اسم | `issuerName` | String? | علامة نعم/لا: issuer اسم. |
| نشاط كود | `activityCode` | String? | حقل «نشاط كود» على هذا الجدول. |
| api base url | `apiBaseUrl` | String? | حقل «api base url» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 228. مستندات البوابة الضريبية (`e_invoice_documents`)

موديل: `EInvoiceDocument` · 22 عمود · 3 علاقة

**إيه الجدول؟** حالة الإرسال والتوقيع والرفض.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مستندات البوابة الضريبية.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفاتورة | `invoiceId` | String? | الفاتورة المربوطة بالسند أو القسط أو السطر. |
| نقطة بيع أمر | `posOrderId` | String? | مفتاح أجنبي يربط الصف بجدول «نقطة بيع أمر». |
| مستند نوع | `documentType` | String | حقل «مستند نوع» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| مستند uuid | `documentUuid` | String? | حقل «مستند uuid» على هذا الجدول. |
| submission uuid | `submissionUuid` | String? | حقل «submission uuid» على هذا الجدول. |
| long | `longId` | String? | مفتاح أجنبي يربط الصف بجدول «long». |
| public url | `publicUrl` | String? | حقل «public url» على هذا الجدول. |
| original مستند uuid | `originalDocumentUuid` | String? | حقل «original مستند uuid» على هذا الجدول. |
| content hash | `contentHash` | String | حقل «content hash» على هذا الجدول. |
| raw payload | `rawPayload` | Json | حقل «raw payload» على هذا الجدول. |
| submission response | `submissionResponse` | Json? | حقل «submission response» على هذا الجدول. |
| error details | `errorDetails` | Json? | حقل «error details» على هذا الجدول. |
| validation errors | `validationErrors` | Json? | حقل «validation errors» على هذا الجدول. |
| تاريخ time issued | `dateTimeIssued` | DateTime? | حقل «تاريخ time issued» على هذا الجدول. |
| تاريخ time received | `dateTimeReceived` | DateTime? | حقل «تاريخ time received» على هذا الجدول. |
| submitted at | `submittedAt` | DateTime? | ختم زمني لهذا الحدث. |
| وقت الإلغاء | `cancelledAt` | DateTime? | متى اتلغى المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-0..1` فاتورة → الفواتير: ربط اختياري بصف واحد من «الفواتير» عبر invoiceId.
- `N-0..1` نقطة بيع أمر → طلبات نقطة البيع: ربط اختياري بصف واحد من «طلبات نقطة البيع» عبر posOrderId.

## ذكاء اصطناعي ونمو

مساعد GATES، معرفة، فرص نمو، واتساب.

### 17. إشعارات الذكاء الاصطناعي (`ai_notifications`)

موديل: `AiNotification` · 15 عمود · 0 علاقة

**إيه الجدول؟** تنبيهات المساعد الآلي.

**امتى بيتستخدم؟** لوحة الذكاء الاصطناعي.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| هدف roles | `targetRoles` | Json | حقل «هدف roles» على هذا الجدول. |
| تصنيف | `category` | NotificationCategory | حقل «تصنيف» على هذا الجدول. |
| severity | `severity` | NotificationSeverity | حقل «severity» على هذا الجدول. |
| مسمى ar | `titleAr` | String | حقل «مسمى ar» على هذا الجدول. |
| رسالة ar | `messageAr` | String | حقل «رسالة ar» على هذا الجدول. |
| إجراء url | `actionUrl` | String? | حقل «إجراء url» على هذا الجدول. |
| إجراء label ar | `actionLabelAr` | String? | حقل «إجراء label ar» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| fingerprint | `fingerprint` | String? | حقل «fingerprint» على هذا الجدول. |
| is read | `isRead` | Boolean | علامة نعم/لا: is read. |
| read at | `readAt` | DateTime? | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

### 256. محادثات المساعد (`ai_conversations`)

موديل: `AiConversation` · 6 عمود · 5 علاقة

**إيه الجدول؟** جلسة دردشة مع GATES AI.

**امتى بيتستخدم؟** يُستخدم مع شاشات: محادثات المساعد.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مسمى | `title` | String | حقل «مسمى» على هذا الجدول. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` messages → رسائل المحادثة: هذا الجدول أب: صف واحد هنا له أكثر من «رسائل المحادثة».
- `1-N` أداة executions → تنفيذ أدوات الذكاء: هذا الجدول أب: صف واحد هنا له أكثر من «تنفيذ أدوات الذكاء».
- `1-N` معلّق actions → إجراءات ذكاء معلّقة: هذا الجدول أب: صف واحد هنا له أكثر من «إجراءات ذكاء معلّقة».

### 257. رسائل المحادثة (`ai_messages`)

موديل: `AiMessage` · 6 عمود · 1 علاقة

**إيه الجدول؟** سؤال/جواب داخل الجلسة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: رسائل المحادثة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| محادثة | `conversationId` | String | مفتاح أجنبي يربط الصف بجدول «محادثة». |
| role | `role` | String | حقل «role» على هذا الجدول. |
| content | `content` | String | حقل «content» على هذا الجدول. |
| أداة calls | `toolCalls` | Json? | حقل «أداة calls» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` محادثة → محادثات المساعد: كل صف هنا مربوط بصف واحد من «محادثات المساعد» عبر conversationId.

### 258. تنفيذ أدوات الذكاء (`ai_tool_executions`)

موديل: `AiToolExecution` · 8 عمود · 1 علاقة

**إيه الجدول؟** لما المساعد يستدعي تقرير أو استعلام.

**امتى بيتستخدم؟** يُستخدم مع شاشات: تنفيذ أدوات الذكاء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| محادثة | `conversationId` | String | مفتاح أجنبي يربط الصف بجدول «محادثة». |
| أداة اسم | `toolName` | String | حقل «أداة اسم» على هذا الجدول. |
| input args | `inputArgs` | Json | حقل «input args» على هذا الجدول. |
| output result | `outputResult` | Json? | حقل «output result» على هذا الجدول. |
| الحالة | `status` | String | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| execution time ms | `executionTimeMs` | Int? | حقل «execution time ms» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` محادثة → محادثات المساعد: كل صف هنا مربوط بصف واحد من «محادثات المساعد» عبر conversationId.

### 259. سجل تدقيق الذكاء الاصطناعي (`ai_audit_logs`)

موديل: `AiAuditLog` · 16 عمود · 2 علاقة

**إيه الجدول؟** من سأل إيه ومتاح له إيه.

**امتى بيتستخدم؟** يُستخدم مع شاشات: سجل تدقيق الذكاء الاصطناعي.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| مستخدم role | `userRole` | String? | حقل «مستخدم role» على هذا الجدول. |
| current screen | `currentScreen` | String? | حقل «current screen» على هذا الجدول. |
| مستخدم prompt | `userPrompt` | String? | حقل «مستخدم prompt» على هذا الجدول. |
| أداة calls | `toolCalls` | Json? | حقل «أداة calls» على هذا الجدول. |
| أداة results | `toolResults` | Json? | حقل «أداة results» على هذا الجدول. |
| ai response | `aiResponse` | String? | حقل «ai response» على هذا الجدول. |
| الحالة | `status` | AiAuditStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| latency ms | `latencyMs` | Int? | حقل «latency ms» على هذا الجدول. |
| tokens used | `tokensUsed` | Int? | حقل «tokens used» على هذا الجدول. |
| إجراء | `action` | String | حقل «إجراء» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| ip address | `ipAddress` | String? | حقل «ip address» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` مستخدم → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر userId.
- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 260. إجراءات ذكاء معلّقة (`ai_pending_actions`)

موديل: `AiPendingAction` · 14 عمود · 1 علاقة

**إيه الجدول؟** اقتراح يحتاج موافقة بشرية قبل التنفيذ.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إجراءات ذكاء معلّقة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| محادثة | `conversationId` | String | مفتاح أجنبي يربط الصف بجدول «محادثة». |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| المستخدم | `userId` | String | صاحب الصلاحية أو الإجراء. |
| إجراء نوع | `actionType` | String | حقل «إجراء نوع» على هذا الجدول. |
| required صلاحية | `requiredPermission` | String | حقل «required صلاحية» على هذا الجدول. |
| payload | `payload` | Json | حقل «payload» على هذا الجدول. |
| summary display | `summaryDisplay` | Json | حقل «summary display» على هذا الجدول. |
| الحالة | `status` | AiActionStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| execution error | `executionError` | String? | حقل «execution error» على هذا الجدول. |
| resulting entity | `resultingEntityId` | String? | مفتاح أجنبي يربط الصف بجدول «resulting entity». |
| expires at | `expiresAt` | DateTime | ختم زمني لهذا الحدث. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` محادثة → محادثات المساعد: كل صف هنا مربوط بصف واحد من «محادثات المساعد» عبر conversationId.

### 261. مستندات معرفة الذكاء (`ai_documents`)

موديل: `AiDocument` · 13 عمود · 3 علاقة

**إيه الجدول؟** ملف اترفع عشان المساعد يجاوب منه.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مستندات معرفة الذكاء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| uploaded by | `uploadedById` | String | مفتاح أجنبي يربط الصف بجدول «uploaded by». |
| مسمى | `title` | String | حقل «مسمى» على هذا الجدول. |
| file اسم | `fileName` | String | حقل «file اسم» على هذا الجدول. |
| file url | `fileUrl` | String | حقل «file url» على هذا الجدول. |
| file مقاس | `fileSize` | Int | حقل «file مقاس» على هذا الجدول. |
| mime نوع | `mimeType` | String | حقل «mime نوع» على هذا الجدول. |
| تصنيف | `category` | AiDocumentCategory | حقل «تصنيف» على هذا الجدول. |
| reference | `referenceId` | String? | مفتاح أجنبي يربط الصف بجدول «reference». |
| إجمالي chunks | `totalChunks` | Int | حقل «إجمالي chunks» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` uploaded by → المستخدمون: كل صف هنا مربوط بصف واحد من «المستخدمون» عبر uploadedById.
- `1-N` chunks → قطع المستند: هذا الجدول أب: صف واحد هنا له أكثر من «قطع المستند».

### 262. قطع المستند (`ai_document_chunks`)

موديل: `AiDocumentChunk` · 8 عمود · 1 علاقة

**إيه الجدول؟** تجزئة النص للبحث الدلالي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: قطع المستند.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| مستند | `documentId` | String | مفتاح أجنبي يربط الصف بجدول «مستند». |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| قطعة index | `chunkIndex` | Int | حقل «قطعة index» على هذا الجدول. |
| content | `content` | String | حقل «content» على هذا الجدول. |
| token count | `tokenCount` | Int | حقل «token count» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| embedding | `embedding` | Json? | حقل «embedding» على هذا الجدول. |

**العلاقات:**

- `N-1` مستند → مستندات معرفة الذكاء: كل صف هنا مربوط بصف واحد من «مستندات معرفة الذكاء» عبر documentId.

### 263. استنتاجات الذكاء (`ai_insights`)

موديل: `AiInsight` · 12 عمود · 1 علاقة

**إيه الجدول؟** تنبيه تحليلي محفوظ (هامش نزل، عميل تأخّر…).

**امتى بيتستخدم؟** يُستخدم مع شاشات: استنتاجات الذكاء.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| الفرع | `branchId` | String? | الفرع اللي المستند اتعمل فيه. اختياري على الكروت، شائع على المستندات. |
| تصنيف | `category` | InsightCategory | حقل «تصنيف» على هذا الجدول. |
| severity | `severity` | InsightSeverity | حقل «severity» على هذا الجدول. |
| مسمى | `title` | String | حقل «مسمى» على هذا الجدول. |
| summary | `summary` | String | حقل «summary» على هذا الجدول. |
| deterministic data | `deterministicData` | Json | حقل «deterministic data» على هذا الجدول. |
| إجراء link | `actionLink` | String? | حقل «إجراء link» على هذا الجدول. |
| is dismissed | `isDismissed` | Boolean | علامة نعم/لا: is dismissed. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| expires at | `expiresAt` | DateTime? | ختم زمني لهذا الحدث. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 265. لقطات المراقب (`ai_sentinel_snapshots`)

موديل: `AiSentinelSnapshot` · 7 عمود · 1 علاقة

**إيه الجدول؟** صورة مؤشرات يومية للمساعد الرقابي.

**امتى بيتستخدم؟** يُستخدم مع شاشات: لقطات المراقب.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| payload | `payload` | Json | حقل «payload» على هذا الجدول. |
| generated at | `generatedAt` | DateTime | ختم زمني لهذا الحدث. |
| مصدر | `source` | String | حقل «مصدر» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 267. مستخدمو واتساب المصرّحون (`whatsapp_authorized_users`)

موديل: `WhatsappAuthorizedUser` · 8 عمود · 1 علاقة

**إيه الجدول؟** مين يبعت من رقم الشركة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: مستخدمو واتساب المصرّحون.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| phone رقم | `phoneNumber` | String | حقل «phone رقم» على هذا الجدول. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| العميل | `customerId` | String? | طرف القبض/البيع. |
| role نوع | `roleType` | String | حقل «role نوع» على هذا الجدول. |
| نشط | `isActive` | Boolean | لو false الكارت يتقفل من القوائم الجديدة ويفضل ظاهر في التاريخ القديم. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.

### 268. فرص النمو (`growth_opportunities`)

موديل: `GrowthOpportunity` · 32 عمود · 3 علاقة

**إيه الجدول؟** فرصة بيع/تحصيل مقترحة من التحليل.

**امتى بيتستخدم؟** يُستخدم مع شاشات: فرص النمو.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| fingerprint | `fingerprint` | String | حقل «fingerprint» على هذا الجدول. |
| نوع | `type` | String | حقل «نوع» على هذا الجدول. |
| تصنيف | `category` | GrowthOpportunityCategory | حقل «تصنيف» على هذا الجدول. |
| مسمى | `title` | String | حقل «مسمى» على هذا الجدول. |
| البيان / الشرح | `description` | String | نص حر يظهر في القيد والطباعة. |
| why detected | `whyDetected` | String | حقل «why detected» على هذا الجدول. |
| الحالة | `status` | GrowthOpportunityStatus | حالة دورة حياة الصف (مسودة، مرحّل، ملغي، في الخزينة…). |
| priority | `priority` | GrowthOpportunityPriority | حقل «priority» على هذا الجدول. |
| estimated value | `estimatedValue` | Decimal | حقل «estimated value» على هذا الجدول. |
| actioned value | `actionedValue` | Decimal | حقل «actioned value» على هذا الجدول. |
| realized value | `realizedValue` | Decimal | حقل «realized value» على هذا الجدول. |
| كود العملة | `currencyCode` | String | مثل EGP. التقارير تتجمع بالعملة الأساسية عبر *Base. |
| موديول | `module` | String? | حقل «موديول» على هذا الجدول. |
| entity نوع | `entityType` | String? | حقل «entity نوع» على هذا الجدول. |
| entity | `entityId` | String? | مفتاح أجنبي يربط الصف بجدول «entity». |
| confidence | `confidence` | Decimal | حقل «confidence» على هذا الجدول. |
| evidence | `evidence` | Json? | حقل «evidence» على هذا الجدول. |
| recommended actions | `recommendedActions` | Json? | حقل «recommended actions» على هذا الجدول. |
| metadata | `metadata` | Json? | حقل «metadata» على هذا الجدول. |
| generated by | `generatedBy` | String | حقل «generated by» على هذا الجدول. |
| ai explanation | `aiExplanation` | String? | حقل «ai explanation» على هذا الجدول. |
| reviewed at | `reviewedAt` | DateTime? | ختم زمني لهذا الحدث. |
| reviewed by | `reviewedBy` | String? | حقل «reviewed by» على هذا الجدول. |
| actioned at | `actionedAt` | DateTime? | ختم زمني لهذا الحدث. |
| actioned by | `actionedBy` | String? | حقل «actioned by» على هذا الجدول. |
| resolved at | `resolvedAt` | DateTime? | ختم زمني لهذا الحدث. |
| dismissed at | `dismissedAt` | DateTime? | ختم زمني لهذا الحدث. |
| dismissed by | `dismissedBy` | String? | حقل «dismissed by» على هذا الجدول. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |
| آخر تعديل | `updatedAt` | DateTime | يتحدث تلقائيًا مع أي حفظ. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `1-N` actions → إجراءات الفرصة: هذا الجدول أب: صف واحد هنا له أكثر من «إجراءات الفرصة».
- `1-N` attributions → إسناد نتيجة النمو: هذا الجدول أب: صف واحد هنا له أكثر من «إسناد نتيجة النمو».

### 269. إجراءات الفرصة (`growth_opportunity_actions`)

موديل: `GrowthOpportunityAction` · 8 عمود · 2 علاقة

**إيه الجدول؟** مهمة متابعة على الفرصة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إجراءات الفرصة.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| فرصة | `opportunityId` | String | مفتاح أجنبي يربط الصف بجدول «فرصة». |
| إجراء مفتاح | `actionKey` | String | حقل «إجراء مفتاح» على هذا الجدول. |
| label | `label` | String | حقل «label» على هذا الجدول. |
| المستخدم | `userId` | String? | صاحب الصلاحية أو الإجراء. |
| ملاحظات | `notes` | String? | ملاحظات داخلية، غالبًا مش بتطبع على المستند. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فرصة → فرص النمو: كل صف هنا مربوط بصف واحد من «فرص النمو» عبر opportunityId.

### 270. إسناد نتيجة النمو (`growth_attributions`)

موديل: `GrowthAttribution` · 10 عمود · 2 علاقة

**إيه الجدول؟** البيع اتنسب لأنهي فرصة/حملة.

**امتى بيتستخدم؟** يُستخدم مع شاشات: إسناد نتيجة النمو.

| بالعربي | العمود | النوع | الشرح |
|---|---|---|---|
| المفتاح | `id` | String | معرّف الصف الداخلي (UUID). مش الرقم اللي المستخدم بيشوفه على الشاشة. |
| الشركة | `companyId` | String | عزل البيانات: الصف ده يخص الشركة دي فقط. أي قراءة/كتابة تتفلتر عليه. |
| فرصة | `opportunityId` | String | مفتاح أجنبي يربط الصف بجدول «فرصة». |
| تصنيف | `kind` | String | حقل «تصنيف» على هذا الجدول. |
| entity نوع | `entityType` | String | حقل «entity نوع» على هذا الجدول. |
| entity | `entityId` | String | مفتاح أجنبي يربط الصف بجدول «entity». |
| المبلغ | `amount` | Decimal | قيمة الصف بعملة المستند. |
| label | `label` | String | حقل «label» على هذا الجدول. |
| is realized | `isRealized` | Boolean | علامة نعم/لا: is realized. |
| تاريخ الإنشاء | `createdAt` | DateTime | وقت إنشاء الصف في السيرفر. |

**العلاقات:**

- `N-1` شركة → الشركات: كل صف هنا مربوط بصف واحد من «الشركات» عبر companyId.
- `N-1` فرصة → فرص النمو: كل صف هنا مربوط بصف واحد من «فرص النمو» عبر opportunityId.
