import { apiClient } from '@/lib/api/client';

function httpStatusFromApiError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: string }).code;
  if (!code) return null;
  const n = Number.parseInt(code, 10);
  return Number.isFinite(n) ? n : null;
}

/** Some legacy routes only expose POST cancel; draft delete should prefer hard DELETE. */
function isMissingDeleteRoute(error: unknown): boolean {
  const status = httpStatusFromApiError(error);
  return status === 404 || status === 405 || status === 501;
}

export async function deleteDraftDocument(apiPath: string, id: string): Promise<void> {
  const base = apiPath.replace(/\/$/, '');
  try {
    await apiClient.delete(`${base}/${id}`);
    return;
  } catch (error) {
    if (isMissingDeleteRoute(error)) {
      await apiClient.post(`${base}/${id}/cancel`, {});
      return;
    }
    throw error;
  }
}

export function isDraftDocumentRow(row: {
  isPosted?: unknown;
  isCancelled?: unknown;
  executionStatus?: unknown;
  isOpening?: unknown;
}): boolean {
  if (row.isCancelled === true) return false;
  if (row.isOpening === true) return false;
  const execution = String(row.executionStatus ?? '');
  if (execution === 'COMPLETED' || execution === 'CANCELLED') return false;
  return row.isPosted !== true;
}
