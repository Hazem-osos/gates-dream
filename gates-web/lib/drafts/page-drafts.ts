import { normalizeAppPath } from '@/lib/navigation/app-module-root';

export const FLUSH_DRAFTS_EVENT = 'gates:flush-drafts';
export const QC_RETURN_KEY = 'gates:qc-return-path';

export type DraftEnvelope<T> = {
  savedAt: string;
  payload: T;
};

export function flushPageDrafts() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FLUSH_DRAFTS_EVENT));
}

export function markQcReturn(path: string) {
  if (typeof window === 'undefined') return;
  const next = normalizeAppPath(path);
  const stored = sessionStorage.getItem(QC_RETURN_KEY);
  const paths = stored ? stored.split('|').filter(Boolean) : [];
  if (!paths.includes(next)) paths.push(next);
  sessionStorage.setItem(QC_RETURN_KEY, paths.join('|'));
}

export function consumeQcReturn(currentPath: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = sessionStorage.getItem(QC_RETURN_KEY);
  if (!stored) return false;
  const paths = stored.split('|').filter(Boolean);
  const next = normalizeAppPath(currentPath);
  const index = paths.indexOf(next);
  if (index === -1) return false;
  paths.splice(index, 1);
  if (paths.length) sessionStorage.setItem(QC_RETURN_KEY, paths.join('|'));
  else sessionStorage.removeItem(QC_RETURN_KEY);
  return true;
}

export function readDraft<T>(storageKey: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (!parsed || parsed.payload == null) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(storageKey: string, payload: T): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const savedAt = new Date().toISOString();
    const envelope: DraftEnvelope<T> = { savedAt, payload };
    localStorage.setItem(storageKey, JSON.stringify(envelope));
    return savedAt;
  } catch {
    return null;
  }
}

export function removeDraft(storageKey: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey);
}
