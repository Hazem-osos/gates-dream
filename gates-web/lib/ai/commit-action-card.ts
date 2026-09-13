import { apiClient } from '@/lib/api/client';

export type ActionCardCommitResult = {
  id: string;
  number: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function documentNumber(data: Record<string, unknown>, fallbackKeys: string[]): string {
  for (const key of fallbackKeys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const id = typeof data.id === 'string' ? data.id : '';
  return id ? id.slice(0, 8) : 'مسودة';
}

function unwrapDraft(payload: Record<string, unknown>): Record<string, unknown> {
  const card = asRecord(payload.actionCard);
  const nested = asRecord(card.draftPayload);
  if (Object.keys(nested).length) return nested;
  const rest = { ...payload };
  delete rest.actionCard;
  return rest;
}

export function extractDraftPayload(action: {
  payload?: Record<string, unknown> | null;
  actionType?: string;
}): Record<string, unknown> {
  return unwrapDraft(asRecord(action.payload));
}

export async function commitActionCard(
  actionType: string,
  payload: Record<string, unknown>
): Promise<ActionCardCommitResult> {
  const draft = unwrapDraft(payload);
  const body: Record<string, unknown> = { ...draft, status: 'DRAFT' };

  if (actionType === 'DRAFT_STOCK_ISSUE') {
    const res = await apiClient.post<Record<string, unknown>>('/inventory/issues', {
      date: body.date ?? new Date().toISOString(),
      warehouseId: body.warehouseId,
      description: body.description,
      lines: body.lines,
    });
    const data = asRecord(res.data);
    return { id: String(data.id ?? ''), number: documentNumber(data, ['serial', 'serialNumber']) };
  }

  if (actionType === 'DRAFT_PAYMENT_VOUCHER') {
    const res = await apiClient.post<Record<string, unknown>>('/treasury/cash-transactions', {
      transactionKind: 'PAYMENT',
      date: body.date ?? new Date().toISOString(),
      amount: body.amount,
      currencyCode: body.currencyCode ?? 'EGP',
      supplierId: body.supplierId,
      customerId: body.customerId,
      description: body.description,
      safeId: body.safeId,
      bankAccountId: body.bankAccountId,
    });
    const data = asRecord(res.data);
    return { id: String(data.id ?? ''), number: documentNumber(data, ['voucherNumber']) };
  }

  const invoiceType =
    actionType === 'DRAFT_PURCHASE_INVOICE' || body.invoiceType === 'purchase' ? 'purchase' : 'sales';
  const res = await apiClient.post<Record<string, unknown>>('/invoices', {
    ...body,
    invoiceType,
    date: typeof body.date === 'string' ? body.date : new Date().toISOString(),
    currencyCode: body.currencyCode ?? 'EGP',
  });
  const data = asRecord(res.data);
  return { id: String(data.id ?? ''), number: documentNumber(data, ['invoiceNumber']) };
}

export async function acknowledgePendingAction(
  actionId: string,
  result: ActionCardCommitResult
): Promise<void> {
  await apiClient.post(`/ai/actions/${actionId}/acknowledge`, {
    resultingEntityId: result.id,
    documentNumber: result.number,
  });
}
