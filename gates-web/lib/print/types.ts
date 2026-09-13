export type CompanyPrintProfile = {
  nameAr: string;
  nameEn?: string | null;
  taxRegistrationNumber?: string | null;
  commercialRegister?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  branchName?: string | null;
};

export type InvoicePrintLine = {
  code?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discount: number;
  net: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
};

export type InvoicePrintModel = {
  kind: 'SALE' | 'PURCHASE';
  invoiceNumber: string;
  date: string;
  paymentMethod?: string;
  cashierOrUser?: string;
  customerName?: string;
  customerTaxId?: string;
  customerAddress?: string;
  supplierName?: string;
  lines: InvoicePrintLine[];
  subtotal: number;
  totalVat: number;
  developmentFee?: number;
  withholding: number;
  totalPayable: number;
  currencyCode?: string;
  qrPayloadBase64?: string;
  amountInWords?: string;
  printTermsOnInvoice?: boolean;
  allowReturn?: boolean;
  returnDays?: number;
  termsAndConditions?: string[];
};

export type VoucherPrintKind = 'RECEIPT' | 'PAYMENT';

export type VoucherPrintLine = {
  accountLabel: string;
  description?: string;
  amount: number;
};

export type VoucherPrintModel = {
  kind: VoucherPrintKind;
  voucherNumber: string;
  date: string;
  description?: string;
  safeName?: string;
  currencyCode?: string;
  lines: VoucherPrintLine[];
  totalAmount: number;
  amountInWords?: string;
};

export type JournalPrintLine = {
  accountLabel: string;
  description?: string;
  debit: number;
  credit: number;
};

export type JournalPrintModel = {
  voucherNumber?: string;
  date: string;
  description?: string;
  currencyCode?: string;
  lines: JournalPrintLine[];
  debitTotal: number;
  creditTotal: number;
};
