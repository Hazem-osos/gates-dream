import { z } from 'zod';
import { toBaseAmount } from '@/lib/accounting/fx-base';

function preprocessMoney(val: unknown): number {
  if (val === '' || val === null || val === undefined) return 0;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

const money = z.preprocess(preprocessMoney, z.number().min(0, 'لا يمكن أن تكون القيمة سالبة'));

function preprocessExchangeRate(val: unknown): number {
  if (val === '' || val === null || val === undefined) return 1;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

const exchangeRateField = z.preprocess(
  preprocessExchangeRate,
  z.number().min(0, 'سعر الصرف غير صالح')
);

export const journalLineSchema = z
  .object({
    accountId: z.string().min(1, 'يجب اختيار الحساب'),
    description: z.string().optional(),
    debit: money,
    credit: money,
    currencyId: z.string().optional(),
    exchangeRate: exchangeRateField,
    costCenterId: z.string().optional(),
    partnerId: z.string().optional(),
    partnerType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    isTiedToInvoice: z.boolean().optional(),
    invoiceId: z.string().optional().nullable(),
    invoiceNumber: z.string().optional().nullable(),
  })
  .superRefine((line, ctx) => {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit <= 0 && credit <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'أدخل مبلغ مدين أو دائن',
        path: ['debit'],
      });
    }
    if (debit > 0 && credit > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'لا يمكن إدخال مدين ودائن في نفس السطر',
        path: ['credit'],
      });
    }
  });

export const journalEntrySchema = z
  .object({
    date: z.string().min(1, 'هذا الحقل مطلوب'),
    referenceNumber: z.string().optional(),
    hijriDate: z.string().optional(),
    description: z.string().optional(),
    currencyId: z.string().min(1, 'يجب اختيار العملة'),
    lines: z.array(journalLineSchema).min(1, 'يرجى إضافة سطر واحد على الأقل'),
  })
  .superRefine((data, ctx) => {
    const debitTotal = data.lines.reduce(
      (sum, line) => sum + toBaseAmount(line.debit, line.exchangeRate),
      0
    );
    const creditTotal = data.lines.reduce(
      (sum, line) => sum + toBaseAmount(line.credit, line.exchangeRate),
      0
    );
    if (Math.abs(debitTotal - creditTotal) > 0.01) {
      ctx.addIssue({
        code: 'custom',
        message: 'يجب أن يكون إجمالي الدائن مساوياً لإجمالي المدين',
        path: ['lines'],
      });
    }
  });

export type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;
export type JournalLineFormValues = z.infer<typeof journalLineSchema>;

/** رصيد افتتاحي — رأس المستند قبل ربط جدول البنود بالـ API. */
export const openingBalanceHeaderSchema = z.object({
  isPosted: z.boolean(),
  entryNumber: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().min(1, 'اختر العملة'),
  date: z.string().optional(),
  hijriDate: z.string().optional(),
});

export type OpeningBalanceHeaderInput = z.input<typeof openingBalanceHeaderSchema>;

/** نقل حركة بين حسابين */
export const accountMovementTransferFormSchema = z
  .object({
    fromAccountId: z.string(),
    toAccountId: z.string(),
    fromDate: z.string().min(1, 'من تاريخ مطلوب'),
    toDate: z.string().min(1, 'إلى تاريخ مطلوب'),
    hijriDate: z.string().optional(),
    description: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.fromAccountId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الحساب المصدر', path: ['fromAccountId'] });
    }
    if (!d.toAccountId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الحساب الهدف', path: ['toAccountId'] });
    }
    if (
      d.fromAccountId.trim() &&
      d.toAccountId.trim() &&
      d.fromAccountId === d.toAccountId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'الحساب المصدر والحساب الهدف يجب أن يكونا مختلفين',
        path: ['toAccountId'],
      });
    }
    if (d.fromDate && d.toDate && new Date(d.fromDate) > new Date(d.toDate)) {
      ctx.addIssue({
        code: 'custom',
        message: 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية',
        path: ['toDate'],
      });
    }
  });

export type AccountMovementTransferFormInput = z.infer<typeof accountMovementTransferFormSchema>;

/** نقل حركة بين مراكز تكلفة */
export const costCenterMovementTransferFormSchema = z
  .object({
    fromCostCenterId: z.string(),
    toCostCenterId: z.string(),
    fromDate: z.string().min(1, 'من تاريخ مطلوب'),
    toDate: z.string().min(1, 'إلى تاريخ مطلوب'),
    hijriDate: z.string().optional(),
    accountId: z.string().optional(),
    description: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.fromCostCenterId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار مركز التكلفة المصدر', path: ['fromCostCenterId'] });
    }
    if (!d.toCostCenterId.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار مركز التكلفة الهدف', path: ['toCostCenterId'] });
    }
    if (
      d.fromCostCenterId.trim() &&
      d.toCostCenterId.trim() &&
      d.fromCostCenterId === d.toCostCenterId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'مركز التكلفة المصدر والهدف يجب أن يكونا مختلفين',
        path: ['toCostCenterId'],
      });
    }
    if (d.fromDate && d.toDate && new Date(d.fromDate) > new Date(d.toDate)) {
      ctx.addIssue({
        code: 'custom',
        message: 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية',
        path: ['toDate'],
      });
    }
  });

export type CostCenterMovementTransferFormInput = z.infer<typeof costCenterMovementTransferFormSchema>;

/** مسودة شاشات خصم/إضافة بنك (واجهة حتى ربط الـ API) */
export const bankVoucherUiFormSchema = z.object({
  isAdvanced: z.boolean(),
  isCyclic: z.boolean(),
  isApproved: z.boolean(),
  isPosted: z.boolean(),
  isRestored: z.boolean(),
  voucherStatus: z.string(),
  voucherNumber: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  hijriDate: z.string().optional(),
  currency: z.string().optional(),
  invoice: z.string().optional(),
  style: z.string().optional(),
  treasury: z.string().optional(),
  treasuryId: z.string().optional(),
  balance: z.string().optional(),
  otherParty: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  counterpartyBank: z.string().optional(),
});

export type BankVoucherUiFormInput = z.infer<typeof bankVoucherUiFormSchema>;

export const treasuryHubFilterSchema = z.object({
  query: z.string().optional(),
});

export type TreasuryHubFilterInput = z.infer<typeof treasuryHubFilterSchema>;

export const treasuryReceiptTypeSchema = z.enum(['cash', 'bank', 'safe', 'party']);

export const treasuryCashReceiptFormSchema = z
  .object({
    receiptType: treasuryReceiptTypeSchema,
    amount: z.string(),
    date: z.string().min(1, 'يرجى إدخال التاريخ'),
    currencyId: z.string().min(1, 'اختر العملة'),
    documentNumber: z.string().optional(),
    description: z.string().optional(),
    hijriDate: z.string().optional(),
    safeId: z.string().optional(),
    bankAccountId: z.string().optional(),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    accountId: z.string().optional(),
    exchangeRate: z.string().optional(),
    branchId: z.string().optional(),
    serial: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const amt = parseFloat(String(data.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
    }
    if (data.receiptType === 'safe' && !data.safeId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الصندوق', path: ['safeId'] });
    }
    if (data.receiptType === 'bank' && !data.bankAccountId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الحساب البنكي', path: ['bankAccountId'] });
    }
    if (
      data.receiptType === 'party' &&
      !data.customerId?.trim() &&
      !data.supplierId?.trim() &&
      !data.accountId?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'يرجى اختيار العميل أو المورد أو الحساب',
        path: ['accountId'],
      });
    }
  });

export type TreasuryCashReceiptFormInput = z.infer<typeof treasuryCashReceiptFormSchema>;

export const treasuryPaymentTypeSchema = z.enum(['cash', 'bank', 'safe', 'party']);

export const treasuryCashPaymentFormSchema = z
  .object({
    paymentType: treasuryPaymentTypeSchema,
    amount: z.string(),
    date: z.string().min(1, 'يرجى إدخال التاريخ'),
    currencyId: z.string().min(1, 'اختر العملة'),
    documentNumber: z.string().optional(),
    description: z.string().optional(),
    hijriDate: z.string().optional(),
    safeId: z.string().optional(),
    bankAccountId: z.string().optional(),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    accountId: z.string().optional(),
    exchangeRate: z.string().optional(),
    branchId: z.string().optional(),
    serial: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const amt = parseFloat(String(data.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
    }
    if (data.paymentType === 'safe' && !data.safeId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الصندوق', path: ['safeId'] });
    }
    if (data.paymentType === 'bank' && !data.bankAccountId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الحساب البنكي', path: ['bankAccountId'] });
    }
    if (
      data.paymentType === 'party' &&
      !data.customerId?.trim() &&
      !data.supplierId?.trim() &&
      !data.accountId?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'يرجى اختيار العميل أو المورد أو الحساب',
        path: ['accountId'],
      });
    }
  });

export type TreasuryCashPaymentFormInput = z.infer<typeof treasuryCashPaymentFormSchema>;

export const treasuryTempReceiptFormSchema = z.object({
  date: z.string().min(1, 'يرجى إدخال التاريخ'),
  serial: z.string().optional(),
  description: z.string().optional(),
  amount: z.string(),
  recipient: z.string().trim().min(1, 'يرجى إدخال اسم المستلم'),
  isSettled: z.boolean(),
  safeId: z.string().min(1, 'يرجى اختيار الصندوق'),
  currencyId: z.string().min(1, 'اختر العملة'),
  exchangeRate: z.coerce.number().positive().optional(),
}).superRefine((data, ctx) => {
  const amt = parseFloat(String(data.amount).replace(/,/g, ''));
  if (!Number.isFinite(amt) || amt <= 0) {
    ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
  }
});

export type TreasuryTempReceiptFormInput = z.infer<typeof treasuryTempReceiptFormSchema>;

export const receiptVoucherHeaderFormSchema = z.object({
  date: z.string().min(1, 'يرجى إدخال التاريخ'),
  description: z.string().optional(),
  safeId: z.string().min(1, 'يرجى اختيار الصندوق'),
  currencyId: z.string().min(1, 'اختر العملة'),
  voucherNumber: z.string().optional(),
  hijriDate: z.string().optional(),
  isCyclic: z.boolean(),
  isApproved: z.boolean(),
});

export type ReceiptVoucherHeaderFormInput = z.infer<typeof receiptVoucherHeaderFormSchema>;

export const paymentVoucherLineFormSchema = z.object({
  accountId: z.string().min(1, 'يرجى اختيار الحساب'),
  description: z.string().optional(),
  amount: z.coerce.number().positive('قيمة البند يجب أن تكون أكبر من صفر'),
  currencyCode: z.string().min(3).max(10).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
  costCenterId: z.string().uuid().optional().nullable(),
});

export const paymentVoucherAllocationFormSchema = z.object({
  invoiceId: z.string().uuid(),
  allocatedAmount: z.coerce.number().positive(),
});

export const paymentVoucherHeaderFormSchema = z.object({
  date: z.string().min(1, 'يرجى إدخال التاريخ'),
  description: z.string().optional(),
  safeId: z.string().min(1, 'يرجى اختيار الصندوق'),
  currencyId: z.string().min(1, 'اختر العملة'),
  voucherNumber: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{1,16}$/.test(v), 'رقم السند حتى 16 رقماً فقط'),
  hijriDate: z.string().optional(),
  isCyclic: z.boolean(),
  isApproved: z.boolean(),
  departmentId: z.string().optional(),
  sourceOrderId: z.string().optional(),
});

export type PaymentVoucherHeaderFormInput = z.infer<typeof paymentVoucherHeaderFormSchema>;

export const financialVoucherHeaderFormSchema = z.object({
  date: z.string().min(1, 'يرجى إدخال التاريخ'),
  description: z.string().optional(),
  fundId: z.string().min(1, 'يرجى اختيار الوعاء المالي'),
  currencyId: z.string().min(1, 'اختر العملة'),
  voucherNumber: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{1,16}$/.test(v), 'رقم السند حتى 16 رقماً فقط'),
  hijriDate: z.string().optional(),
  isCyclic: z.boolean(),
  isApproved: z.boolean(),
  departmentId: z.string().optional(),
  sourceOrderId: z.string().optional(),
  bankReference: z.string().max(80).optional(),
  valueDate: z.string().optional(),
});

export type FinancialVoucherHeaderFormInput = z.infer<typeof financialVoucherHeaderFormSchema>;

export const treasuryOrderHeaderFormSchema = z.object({
  date: z.string().min(1, 'يرجى إدخال التاريخ'),
  description: z.string().optional(),
  fundId: z.string().min(1, 'يرجى اختيار الخزينة'),
  currencyId: z.string().min(1, 'اختر العملة'),
  voucherNumber: z
    .string()
    .optional()
    .refine((v) => !v || /^\d{1,16}$/.test(v), 'رقم الأمر حتى 16 رقماً فقط'),
  hijriDate: z.string().optional(),
  fundKind: z.enum(['CASHBOX', 'BANK_ACCOUNT']),
});

export type TreasuryOrderHeaderFormInput = z.infer<typeof treasuryOrderHeaderFormSchema>;

export const securitiesBulkCreateHeaderFormSchema = z.object({
  currencyId: z.string().min(1, 'اختر العملة'),
  exchangeRate: z.coerce.number().positive().optional(),
  partyName: z.string().optional(),
  partyId: z.string().min(1, 'اختر الساحب / العميل'),
  partyType: z.enum(['customer', 'supplier']),
  issueDate: z.string().min(1, 'تاريخ التحرير مطلوب'),
  hijriIssueDate: z.string().optional(),
  entityName: z.string().optional(),
  entityId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
});

export type SecuritiesBulkCreateHeaderFormInput = z.infer<typeof securitiesBulkCreateHeaderFormSchema>;

export const securitiesReceiptLineSchema = z.object({
  serial: z.string().optional(),
  securityNumber: z.string().optional(),
  description: z.string().optional(),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  dueDate: z.string().optional(),
});

export const securitiesReceiptFormSchema = z.object({
  currencyId: z.string().min(1, 'اختر العملة'),
  partyType: z.enum(['customer', 'supplier']),
  partyId: z.string().min(1, 'اختر الطرف'),
  accountId: z.string().min(1, 'اختر الحساب'),
  costCenterId: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  lines: z.array(securitiesReceiptLineSchema).min(1, 'أضف سطراً واحداً على الأقل'),
});

export type SecuritiesReceiptFormInput = z.infer<typeof securitiesReceiptFormSchema>;

const securitiesSecurityTypeSchema = z.enum(['check', 'promissory-note', 'bond', 'other']);

/** ورقة مقبوضات (شاشة واحدة — ليس جدول الأسطر في `securitiesReceiptFormSchema`) */
export const securitiesSingleReceiptFormSchema = z
  .object({
    date: z.string().min(1, 'يرجى إدخال التاريخ'),
    hijriDate: z.string().optional(),
    currencyId: z.string().min(1, 'اختر العملة'),
    partyType: z.enum(['customer', 'supplier']),
    partyId: z.string().min(1, 'يرجى اختيار الجهة'),
    accountId: z.string().min(1, 'يرجى اختيار الحساب'),
    costCenterId: z.string().optional(),
    securityType: securitiesSecurityTypeSchema,
    serial: z.string().optional(),
    receiptNumber: z.string().optional(),
    securityNumber: z.string().optional(),
    description: z.string().optional(),
    issuerName: z.string().optional(),
    issuerBank: z.string().optional(),
    amount: z.string(),
    dueDate: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const amt = parseFloat(String(d.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
    }
  });

export type SecuritiesSingleReceiptFormInput = z.infer<typeof securitiesSingleReceiptFormSchema>;

/** ورقة مدفوعات */
export const securitiesSinglePaymentFormSchema = z
  .object({
    date: z.string().min(1, 'يرجى إدخال التاريخ'),
    hijriDate: z.string().optional(),
    currencyId: z.string().min(1, 'اختر العملة'),
    partyType: z.enum(['customer', 'supplier']),
    partyId: z.string().min(1, 'يرجى اختيار الجهة'),
    securityType: securitiesSecurityTypeSchema,
    serial: z.string().optional(),
    paymentNumber: z.string().optional(),
    securityNumber: z.string().optional(),
    description: z.string().optional(),
    payeeName: z.string().optional(),
    payeeBank: z.string().optional(),
    amount: z.string(),
    dueDate: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    const amt = parseFloat(String(d.amount).replace(/,/g, ''));
    if (!Number.isFinite(amt) || amt <= 0) {
      ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
    }
  });

export type SecuritiesSinglePaymentFormInput = z.infer<typeof securitiesSinglePaymentFormSchema>;

export const securitiesMultiCollectionFormSchema = z.object({
  receiptIds: z.array(z.string()).min(1, 'يرجى اختيار أوراق للتحصيل'),
  accountId: z.string().min(1, 'اختر حساب البنك'),
  date: z.string().min(1, 'أدخل تاريخ التحصيل'),
});

export type SecuritiesMultiCollectionFormInput = z.infer<typeof securitiesMultiCollectionFormSchema>;

/** بطاقة الحساب — طبيعة الحساب + التقرير الختامي + إلزام مركز التكلفة. */
export const accountCardFormSchema = z
  .object({
    code: z.string().trim().optional(),
    arabicName: z.string().trim().min(1, 'يرجى إدخال الإسم العربي'),
    englishName: z.string().optional(),
    accountType: z.string().optional(),
    parentId: z.string().optional(),
    accountSide: z.enum(['مدين', 'دائن', '']).optional(),
    accountNature: z.enum(['DEBIT', 'CREDIT']),
    statementType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT']),
    costCenterRequired: z.enum(['إجباري', 'اختياري', 'بدون', '']).optional(),
    defaultCostCenterId: z.string().optional(),
    requiresCostCenter: z.boolean(),
    warning: z.enum(['مدين', 'دائن', 'بدون', '']).optional(),
    budget: z.string().optional(),
    currencyCode: z.string().optional(),
    accountKind: z.enum(['HEADER', 'POSTING']).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.parentId?.trim() && !value.accountSide) {
      ctx.addIssue({
        code: 'custom',
        path: ['accountSide'],
        message: 'جهة الحساب مطلوبة للحساب الرئيسي (مدين أو دائن).',
      });
    }
  });

export type AccountCardFormInput = z.infer<typeof accountCardFormSchema>;

/** بطاقة مركز التكلفة — التسلسل الهرمي + حالة التفعيل. */
export const costCenterCardFormSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().trim().min(1, 'يرجى إدخال الإسم العربي'),
  englishName: z.string().optional(),
  parentId: z.string().optional(),
  costCenterKind: z.enum(['HEADER', 'POSTING']).optional(),
  quantityBudget: z.string().optional(),
  warning: z.enum(['مدين', 'دائن', 'بدون', '']).optional(),
  budget: z.string().optional(),
  creditLimit: z.string().optional(),
  currencyCode: z.string().optional(),
  isActive: z.boolean(),
});

export type CostCenterCardFormInput = z.infer<typeof costCenterCardFormSchema>;

/** بطاقة عميل — الاسم مطلوب. الكود والهاتف اختياريان. */
export const customerCardFormSchema = z
  .object({
    arabicName: z.string().trim().min(1, 'يرجى إدخال الإسم العربي'),
    phone1: z.string().optional(),
    mobile: z.string().optional(),
    taxData: z.boolean().optional(),
    taxAuthority: z.string().optional(),
    taxAuthorityName: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.taxData && !value.taxAuthority?.trim() && !value.taxAuthorityName?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['taxAuthority'],
        message: 'بيانات الضرائب مطلوبة بعد تفعيل الرقم الضريبي.',
      });
    }
  });

export type CustomerCardFormInput = z.infer<typeof customerCardFormSchema>;
