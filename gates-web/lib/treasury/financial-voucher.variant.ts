export type FinancialVoucherVariantId =
  | 'CASH_DISBURSEMENT'
  | 'CASH_RECEIPT'
  | 'BANK_DEBIT_ADVICE'
  | 'BANK_CREDIT_ADVICE';

export type CashVoucherFamily = 'BP01' | 'BR01' | 'KP01' | 'KR01';

export type FinancialVoucherVariant = {
  id: FinancialVoucherVariantId;
  family: CashVoucherFamily;
  transactionKind: 'PAYMENT' | 'RECEIPT';
  fundType: 'CASHBOX' | 'BANK_ACCOUNT';
  allocationSide: 'payable' | 'receivable';
  title: string;
  breadcrumbs: { label: string; href?: string }[];
  fundLabel: string;
  orderLabel: string;
  extraHeader: 'none' | 'bankTransfer' | 'bankAdvice';
  bankReferenceLabel: string;
  partyAddLabel: string;
  partyAddHref: string;
  tourSafe: string;
  tourLines: string;
  tourSave: string;
  printKind: 'PAYMENT' | 'RECEIPT';
  academyTrigger: string;
};

export const FINANCIAL_VOUCHER_VARIANTS: Record<
  FinancialVoucherVariantId,
  FinancialVoucherVariant
> = {
  CASH_DISBURSEMENT: {
    id: 'CASH_DISBURSEMENT',
    family: 'BP01',
    transactionKind: 'PAYMENT',
    fundType: 'CASHBOX',
    allocationSide: 'payable',
    title: 'سند صرف نقدية',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'الخزنة' },
      { label: 'سند صرف نقدية' },
    ],
    fundLabel: 'الخزنة',
    orderLabel: 'رقم أمر الصرف',
    extraHeader: 'none',
    bankReferenceLabel: '',
    partyAddLabel: 'أضف مورد',
    partyAddHref: '/accounting/cards/supplier',
    tourSafe: 'payment-voucher-safe',
    tourLines: 'payment-voucher-lines',
    tourSave: 'payment-voucher-save',
    printKind: 'PAYMENT',
    academyTrigger: 'treasury-payment.save-success',
  },
  CASH_RECEIPT: {
    id: 'CASH_RECEIPT',
    family: 'BR01',
    transactionKind: 'RECEIPT',
    fundType: 'CASHBOX',
    allocationSide: 'receivable',
    title: 'سند قبض نقدية',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'الخزنة' },
      { label: 'سند قبض نقدية' },
    ],
    fundLabel: 'الخزنة',
    orderLabel: 'رقم أمر التوريد',
    extraHeader: 'none',
    bankReferenceLabel: '',
    partyAddLabel: 'أضف عميل',
    partyAddHref: '/accounting/cards/customer',
    tourSafe: 'receipt-voucher-safe',
    tourLines: 'receipt-voucher-lines',
    tourSave: 'receipt-voucher-save',
    printKind: 'RECEIPT',
    academyTrigger: 'treasury-receipt.save-success',
  },
  BANK_DEBIT_ADVICE: {
    id: 'BANK_DEBIT_ADVICE',
    family: 'KP01',
    transactionKind: 'PAYMENT',
    fundType: 'BANK_ACCOUNT',
    allocationSide: 'payable',
    title: 'إشعار خصم بنكي',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'البنوك' },
      { label: 'إشعار خصم بنكي' },
    ],
    fundLabel: 'البنك',
    orderLabel: 'رقم أمر الصرف',
    extraHeader: 'bankTransfer',
    bankReferenceLabel: 'رقم مرجع البنك / السويفت',
    partyAddLabel: 'أضف مورد',
    partyAddHref: '/accounting/cards/supplier',
    tourSafe: 'bank-debit-fund',
    tourLines: 'bank-debit-lines',
    tourSave: 'bank-debit-save',
    printKind: 'PAYMENT',
    academyTrigger: 'treasury-bank-debit.save-success',
  },
  BANK_CREDIT_ADVICE: {
    id: 'BANK_CREDIT_ADVICE',
    family: 'KR01',
    transactionKind: 'RECEIPT',
    fundType: 'BANK_ACCOUNT',
    allocationSide: 'receivable',
    title: 'إشعار إضافة بنكي',
    breadcrumbs: [
      { label: 'المحاسبة', href: '/accounting' },
      { label: 'البنوك' },
      { label: 'إشعار إضافة بنكي' },
    ],
    fundLabel: 'البنك',
    orderLabel: 'رقم أمر التوريد',
    extraHeader: 'bankAdvice',
    bankReferenceLabel: 'رقم التحويل / العملية البنكية',
    partyAddLabel: 'أضف عميل',
    partyAddHref: '/accounting/cards/customer',
    tourSafe: 'bank-credit-fund',
    tourLines: 'bank-credit-lines',
    tourSave: 'bank-credit-save',
    printKind: 'RECEIPT',
    academyTrigger: 'treasury-bank-credit.save-success',
  },
};
