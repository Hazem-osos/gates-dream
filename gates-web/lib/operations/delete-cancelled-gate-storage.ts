const STORAGE_KEY = 'gates.delete-cancelled.gate';

type StoredGate = {
  gateToken: string;
  expiresAt: string;
};

export function readDeleteCancelledGate(): StoredGate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGate;
    if (!parsed?.gateToken || !parsed?.expiresAt) return null;
    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeDeleteCancelledGate(gateToken: string, expiresAt: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ gateToken, expiresAt }));
}

export function clearDeleteCancelledGate(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
