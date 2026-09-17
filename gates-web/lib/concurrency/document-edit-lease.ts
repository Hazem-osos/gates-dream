const SESSION_KEY = 'gates-doc-lease-session';

export function documentLeaseSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

export function isDocumentOccupiedError(error: unknown): { holderName: string } | null {
  if (!error || typeof error !== 'object') return null;
  const code = 'code' in error ? String((error as { code?: string }).code ?? '') : '';
  const message = error instanceof Error ? error.message : '';
  if (code !== 'DOCUMENT_OCCUPIED' && !message.includes('السند مفتوح حالياً عند')) {
    return null;
  }
  const match = message.match(/عند\s+(.+)$/);
  return { holderName: match?.[1]?.trim() || 'موظف بالشركة' };
}
