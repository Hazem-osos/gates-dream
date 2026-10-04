export type OfflineSyncState = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

const BUSINESS_STATUS = /^[4]\d\d$/;

export function isConnectivityFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  if (BUSINESS_STATUS.test(code)) return false;
  if (/^5\d\d$/.test(code)) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('request timeout') ||
    message.includes('timed out')
  );
}

export function canQueueOfflineSale(input: {
  companyOffline: boolean;
  terminalOffline: boolean;
  error: unknown;
  captureModes: string[];
}): boolean {
  if (!input.companyOffline || !input.terminalOffline) return false;
  if (input.captureModes.some((mode) => mode === 'TERMINAL')) return false;
  return isConnectivityFailure(input.error);
}

export function nextOfflineState(error: unknown): Extract<OfflineSyncState, 'failed' | 'conflict' | 'pending'> {
  if (!error || typeof error !== 'object') return 'pending';
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  if (BUSINESS_STATUS.test(code)) return 'conflict';
  if (isConnectivityFailure(error)) return 'pending';
  return 'failed';
}
