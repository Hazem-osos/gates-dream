export type AiDocumentStatus = 'POSTED' | 'DRAFT' | 'CANCELLED';

export type AiScreenSession = {
  documentId?: string;
  documentStatus?: AiDocumentStatus | string;
  pageTitle?: string;
  formErrors?: string[];
  formValues?: Record<string, unknown>;
};

let session: AiScreenSession = {};
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function publishAiScreenSession(patch: Partial<AiScreenSession>): void {
  session = { ...session, ...patch };
  emit();
}

export function getAiScreenSession(): AiScreenSession {
  return session;
}

export function subscribeAiScreenSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function inferDocumentStatus(statusTone: string, statusLabel: string): AiDocumentStatus {
  const label = statusLabel.trim();
  if (/ملغ|cancelled/i.test(label)) return 'CANCELLED';
  if (statusTone === 'success' || /مرحّل|مرحل|posted/i.test(label)) return 'POSTED';
  return 'DRAFT';
}
