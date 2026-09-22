import { apiClient } from '@/lib/api/client';

function usesCancelPost(apiPath: string): boolean {
  return /cash-transaction|securities|invoice|treasury-receipt|receipt|issue|assembl|disassembl|opening-stock|price-quote|purchase-order|adjustment|stocktaking/i.test(
    apiPath
  );
}

export async function deleteDraftDocument(apiPath: string, id: string): Promise<void> {
  const base = apiPath.replace(/\/$/, '');
  if (usesCancelPost(base)) {
    await apiClient.post(`${base}/${id}/cancel`, {});
    return;
  }
  try {
    await apiClient.delete(`${base}/${id}`);
  } catch {
    await apiClient.post(`${base}/${id}/cancel`, {});
  }
}

export function isDraftDocumentRow(row: {
  isPosted?: unknown;
  isCancelled?: unknown;
  executionStatus?: unknown;
}): boolean {
  if (row.isCancelled === true) return false;
  const execution = String(row.executionStatus ?? '');
  if (execution === 'COMPLETED' || execution === 'CANCELLED') return false;
  return row.isPosted !== true;
}
