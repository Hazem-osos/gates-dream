export type ActionType =
  | 'DRAFT_SALES_INVOICE'
  | 'DRAFT_PURCHASE_INVOICE'
  | 'DRAFT_PAYMENT_VOUCHER'
  | 'DRAFT_STOCK_ISSUE';

export interface ActionCardSummary {
  partyName?: string;
  warehouseName?: string;
  totalAmount: number;
  itemsCount?: number;
  subtotal?: number;
  taxAmount?: number;
  netAmount?: number;
}

export interface ActionCardPreviewLine {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
}

export interface ActionCardPayload {
  actionType: ActionType;
  titleAr: string;
  summary: ActionCardSummary;
  /** Payload matching the real module's create DTO. Never written until the user confirms. */
  draftPayload: Record<string, unknown>;
  previewLines?: ActionCardPreviewLine[];
}

export const DRAFT_ACTION_TYPES = [
  'DRAFT_SALES_INVOICE',
  'DRAFT_PURCHASE_INVOICE',
  'DRAFT_PAYMENT_VOUCHER',
  'DRAFT_STOCK_ISSUE',
] as const;

export function isDraftActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && (DRAFT_ACTION_TYPES as readonly string[]).includes(value);
}
