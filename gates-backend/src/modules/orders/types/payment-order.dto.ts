export interface PaymentOrderLineDto {
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

export interface CreatePaymentOrderDto {
  safeId: string;
  orderNumber?: string;
  date: Date | string;
  hijriDate?: string;
  notes?: string;
  lines: PaymentOrderLineDto[];
}

export type UpdatePaymentOrderDto = CreatePaymentOrderDto;
