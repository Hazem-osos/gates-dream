export interface JournalEntryLineDto {
  accountId: string;
  debit: number;
  credit: number;
  currencyId?: string;
  currencyCode?: string | null;
  exchangeRate?: number;
  debitBase?: number;
  creditBase?: number;
  costCenterId?: string | null;
  description?: string | null;
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  partnerId?: string | null;
  partnerType?: 'CUSTOMER' | 'SUPPLIER';
  lineOrder?: number;
}

export type CreateJournalEntryLineDto = JournalEntryLineDto;
export type UpdateJournalEntryLineDto = JournalEntryLineDto;
