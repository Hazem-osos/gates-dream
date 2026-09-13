export const AI_ACTION_TYPES = {
  CREATE_QUOTATION: 'CREATE_QUOTATION',
  CREATE_INVOICE: 'CREATE_INVOICE',
  CREATE_CUSTOMER: 'CREATE_CUSTOMER',
  DRAFT_SALES_INVOICE: 'DRAFT_SALES_INVOICE',
  DRAFT_PURCHASE_INVOICE: 'DRAFT_PURCHASE_INVOICE',
  DRAFT_PAYMENT_VOUCHER: 'DRAFT_PAYMENT_VOUCHER',
  DRAFT_STOCK_ISSUE: 'DRAFT_STOCK_ISSUE',
} as const;

export type AiActionType = (typeof AI_ACTION_TYPES)[keyof typeof AI_ACTION_TYPES];

export const AI_ACTION_PERMISSIONS = {
  CREATE_QUOTATION: 'invoice:edit',
  CREATE_INVOICE: 'invoice:edit',
  CREATE_CUSTOMER: 'customer:edit',
  DRAFT_SALES_INVOICE: 'invoice:edit',
  DRAFT_PURCHASE_INVOICE: 'invoice:edit',
  DRAFT_PAYMENT_VOUCHER: 'invoice:edit',
  DRAFT_STOCK_ISSUE: 'invoice:edit',
} as const;

export const ACTION_TTL_MS = 30 * 60 * 1000;

export type AiActionLineSummary = {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableQty?: number;
  rawItemName?: string;
  needsCreation?: boolean;
  matchConfidence?: number;
};

export type AiActionSummaryDisplay = {
  title: string;
  actionType: AiActionType;
  customerName?: string;
  partyName?: string;
  itemsCount?: number;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  netAmount?: number;
  currency?: string;
  lines?: AiActionLineSummary[];
  notes?: string;
  paymentTerms?: string;
  warehouseName?: string;
  isCash?: boolean;
  phone?: string;
  taxNumber?: string;
  creditLimit?: number;
  stockWarnings?: string[];
  ocr?: {
    source?: string;
    invoiceNumber?: string;
    supplierConfidence?: number;
    supplierMatched?: boolean;
    unmatchedCount?: number;
  };
};

export type PreparedActionResult = {
  actionId: string;
  actionType: AiActionType;
  status: 'PENDING';
  confirmationRequired: true;
  isActionCard?: true;
  instruction: string;
  expiresAt: string;
  summaryDisplay: AiActionSummaryDisplay;
  resolvedItems?: AiActionLineSummary[];
  totals?: { subtotal: number; tax: number; total: number; currency: string };
  actionCard?: {
    actionType: AiActionType;
    titleAr: string;
    summary: {
      partyName?: string;
      warehouseName?: string;
      totalAmount: number;
      itemsCount?: number;
      subtotal?: number;
      taxAmount?: number;
      netAmount?: number;
    };
    draftPayload: Record<string, unknown>;
    previewLines?: Array<{
      name: string;
      quantity?: number;
      unitPrice?: number;
      total: number;
      rawItemName?: string;
      needsCreation?: boolean;
      matchConfidence?: number;
    }>;
  };
};
