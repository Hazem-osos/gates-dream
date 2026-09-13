import type { PaymentVoucherEntrySide, ReceiptVoucherEntrySide } from './vouchers.dto';

export interface BankDebitNoteLineDto {
  accountId: string;
  amount: number;
  currencyId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  baseAmount?: number;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  costCenterId?: string | null;
  description?: string | null;
  entrySide?: PaymentVoucherEntrySide;
}

export interface CreateBankDebitNoteDto {
  bankAccountId: string;
  paymentOrderCode?: string;
  paymentOrderNumber?: string;
  sourceOrderId?: string;
  referenceNumber?: string;
  date: Date | string;
  hijriDate?: string;
  lines: BankDebitNoteLineDto[];
  notes?: string;
  additionalSettings?: Record<string, unknown>;
}

export interface BankCreditNoteLineDto {
  accountId: string;
  amount: number;
  currencyId?: string;
  currencyCode?: string;
  exchangeRate?: number;
  baseAmount?: number;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  costCenterId?: string | null;
  description?: string | null;
  entrySide?: ReceiptVoucherEntrySide;
}

export interface CreateBankCreditNoteDto {
  bankAccountId: string;
  receiptOrderCode?: string;
  receiptOrderNumber?: string;
  sourceOrderId?: string;
  referenceNumber?: string;
  date: Date | string;
  hijriDate?: string;
  lines: BankCreditNoteLineDto[];
  notes?: string;
  additionalSettings?: Record<string, unknown>;
}
