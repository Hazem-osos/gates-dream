import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import type { DraftMode } from '@/lib/drafts/draft-key';

export const FLUSH_DRAFTS_EVENT = 'gates:flush-drafts';
export const QC_RETURN_KEY = 'gates:qc-return-path';
export const DRAFT_SESSION_KEY = 'gates:draft-session-id';
export const DRAFT_ENVELOPE_VERSION = 2;

export type DraftEnvelope<T> = {
  version: number;
  companyId: string;
  documentType: string;
  mode: DraftMode;
  variantId?: string;
  savedAt: string;
  sessionId: string;
  writeSeq: number;
  payload: T;
};

export type DraftWriteMeta = {
  companyId: string;
  documentType: string;
  mode?: DraftMode;
  variantId?: string;
  writeSeq: number;
};

export function flushPageDrafts() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(FLUSH_DRAFTS_EVENT));
}

export function getDraftSessionId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem(DRAFT_SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(DRAFT_SESSION_KEY, id);
  }
  return id;
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

function asEnvelope<T>(parsed: unknown): DraftEnvelope<T> | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Partial<DraftEnvelope<T>> & { payload?: T };
  if (row.payload == null) return null;
  return {
    version: typeof row.version === 'number' ? row.version : 1,
    companyId: typeof row.companyId === 'string' ? row.companyId : '',
    documentType: typeof row.documentType === 'string' ? row.documentType : '',
    mode: row.mode === 'edit' ? 'edit' : 'new',
    variantId: typeof row.variantId === 'string' ? row.variantId : undefined,
    savedAt: typeof row.savedAt === 'string' ? row.savedAt : '',
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : '',
    writeSeq: typeof row.writeSeq === 'number' ? row.writeSeq : 0,
    payload: row.payload,
  };
}

export function readDraft<T>(storageKey: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return asEnvelope<T>(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDraft<T>(storageKey: string, payload: T, meta: DraftWriteMeta): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = readDraft<T>(storageKey);
    if (existing && existing.writeSeq > meta.writeSeq) {
      return existing.savedAt;
    }
    const savedAt = new Date().toISOString();
    const envelope: DraftEnvelope<T> = {
      version: DRAFT_ENVELOPE_VERSION,
      companyId: meta.companyId,
      documentType: meta.documentType,
      mode: meta.mode ?? 'new',
      variantId: meta.variantId,
      savedAt,
      sessionId: getDraftSessionId(),
      writeSeq: meta.writeSeq,
      payload,
    };
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

export function shouldAutoRestoreDraft(envelope: DraftEnvelope<unknown>, companyId: string): boolean {
  if (!envelope.sessionId || envelope.sessionId !== getDraftSessionId()) return false;
  if (envelope.companyId && companyId && envelope.companyId !== companyId) return false;
  return true;
}
