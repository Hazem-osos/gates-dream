export type AiTransactionDraft = {
  actionType: string;
  titleAr?: string;
  draftPayload: Record<string, unknown>;
};

const KEY = 'gates-ai-transaction-draft';

export function storeAiTransactionDraft(draft: AiTransactionDraft): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}

export function peekAiTransactionDraft(): AiTransactionDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AiTransactionDraft;
    if (!parsed || typeof parsed !== 'object' || !parsed.draftPayload) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function consumeAiTransactionDraft(expectedTypes?: string | string[]): AiTransactionDraft | null {
  const draft = peekAiTransactionDraft();
  if (!draft) return null;
  if (expectedTypes) {
    const allowed = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    if (!allowed.includes(draft.actionType)) return null;
  }
  sessionStorage.removeItem(KEY);
  return draft;
}

export function editHrefForActionType(actionType: string): string {
  switch (actionType) {
    case 'DRAFT_SALES_INVOICE':
    case 'CREATE_INVOICE':
      return '/inventory/operations/sales-invoice?fromAiDraft=1';
    case 'DRAFT_PURCHASE_INVOICE':
      return '/inventory/operations/final-purchase-invoice?fromAiDraft=1';
    case 'DRAFT_STOCK_ISSUE':
      return '/inventory/operations/issue?fromAiDraft=1';
    case 'DRAFT_PAYMENT_VOUCHER':
      return '/accounting/operations/treasury/payment?fromAiDraft=1';
    default:
      return '/inventory/operations/sales-invoice?fromAiDraft=1';
  }
}
