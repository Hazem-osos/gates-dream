export interface ReceiptOrderLineDto {
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
}

export interface CreateReceiptOrderDto {
  safeId: string;
  orderNumber?: string;
  date: Date | string;
  hijriDate?: string;
  notes?: string;
  lines: ReceiptOrderLineDto[];
}

export type UpdateReceiptOrderDto = CreateReceiptOrderDto;
