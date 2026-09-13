export type ThermalRollWidth = 58 | 80;

export type ThermalInvoiceItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ThermalInvoiceData = {
  companyName: string;
  branch?: string | null;
  phone?: string | null;
  taxRegistrationNumber?: string | null;
  title: string;
  invoiceNumber: string;
  dateTime: string;
  customerName?: string | null;
  customerBalance?: number | null;
  items: ThermalInvoiceItem[];
  subtotal: number;
  vatAmount: number;
  vatRateLabel?: string;
  discount: number;
  developmentFee?: number;
  withholding?: number;
  net: number;
  notes?: string | null;
  footer?: string | null;
  /** ETA TLV (base64) or a plain invoice-summary string drawn as QR. */
  qrPayload?: string | null;
};

export type ReceiptCanvasOptions = {
  widthMm: ThermalRollWidth;
};
