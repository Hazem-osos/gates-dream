import type { QuickCreateKind, QuickCreateRequest, QuickCreateResult } from './catalog';

const REQUEST_KEY = 'gates-qc-request';
const RESULT_KEY = 'gates-qc-result';
const pendingKey = (kind: string) => `gates-qc-pending-${kind}`;
export const QUICK_CREATE_EVENT = 'gates:quick-create';

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

const memory = {
  request: null as QuickCreateRequest | null,
  result: null as QuickCreateResult | null,
};

export function storeQuickCreateRequest(request: QuickCreateRequest) {
  memory.request = request;
  writeJson(REQUEST_KEY, request);
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(pendingKey(request.kind), request.id);
  }
}

export function peekPendingRequestId(kind: QuickCreateKind): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(pendingKey(kind));
}

export function clearPendingRequestId(kind: QuickCreateKind) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(pendingKey(kind));
}

export function getQuickCreateRequest(id?: string | null): QuickCreateRequest | null {
  const current = memory.request ?? readJson<QuickCreateRequest>(REQUEST_KEY);
  if (!current) return null;
  if (id && current.id !== id) return null;
  return current;
}

export function publishQuickCreateResult(result: QuickCreateResult) {
  memory.result = result;
  writeJson(RESULT_KEY, result);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUICK_CREATE_EVENT, { detail: result }));
  }
}

export function consumeQuickCreateResult(requestId: string): QuickCreateResult | null {
  const current = memory.result ?? readJson<QuickCreateResult>(RESULT_KEY);
  if (!current || current.requestId !== requestId) return null;
  memory.result = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(RESULT_KEY);
    sessionStorage.removeItem(pendingKey(current.kind));
  }
  return current;
}

export function completeQuickCreate(kind: QuickCreateKind, entity: { id: string; label: string } & Record<string, unknown>) {
  if (typeof window === 'undefined') return null;
  const qc = new URLSearchParams(window.location.search).get('qc');
  const request = getQuickCreateRequest(qc);
  if (!request || request.kind !== kind || !entity.id) return null;
  publishQuickCreateResult({
    requestId: request.id,
    kind,
    entity: { ...entity, id: entity.id, label: entity.label },
  });
  return request.returnPath;
}

export function subscribeQuickCreate(listener: (result: QuickCreateResult) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<QuickCreateResult>).detail;
    if (detail?.entity?.id) listener(detail);
  };
  window.addEventListener(QUICK_CREATE_EVENT, handler);
  return () => window.removeEventListener(QUICK_CREATE_EVENT, handler);
}
