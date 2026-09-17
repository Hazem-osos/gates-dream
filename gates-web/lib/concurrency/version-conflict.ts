export const VERSION_CONFLICT_TITLE = 'تنبيه تعارض في التعديل';

export const VERSION_CONFLICT_BODY =
  "قام زميل آخر بتعديل هذا المستند أثناء قيامك بالعمل عليه. لمنع ضياع البيانات، اضغط 'تحديث ومقارنة' لرؤية التعديلات الأخيرة.";

export const VERSION_CONFLICT_ACTION = '🔄 إعادة تحميل المستند';

const CONFLICT_MESSAGE =
  /قام (زميل|مستخدم) آخر بتعديل|تنبيه تعارض|expectedVersion|منذ لحظات/i;

export function isVersionConflictError(payload: {
  httpStatus?: number;
  code?: string;
  message?: string;
}): boolean {
  if (payload.code === 'DOCUMENT_OCCUPIED') return false;
  const status = payload.httpStatus ?? Number.parseInt(payload.code ?? '', 10);
  if (status !== 409) return false;
  return CONFLICT_MESSAGE.test(payload.message ?? '');
}

export function isOptimisticLockApiError(error: { code?: string; message?: string }): boolean {
  return isVersionConflictError({
    code: error.code,
    message: error.message,
    httpStatus: Number.parseInt(error.code ?? '', 10),
  });
}

type VersionConflictState = {
  open: boolean;
  onReload: () => void;
};

type Listener = (state: VersionConflictState) => void;

const listeners = new Set<Listener>();

let state: VersionConflictState = {
  open: false,
  onReload: defaultReload,
};

function defaultReload() {
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

function emit() {
  for (const listener of listeners) listener(state);
}

export function subscribeVersionConflict(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function openVersionConflict(opts?: { onReload?: () => void }) {
  state = {
    open: true,
    onReload: opts?.onReload ?? defaultReload,
  };
  emit();
}

export function closeVersionConflict() {
  state = { ...state, open: false };
  emit();
}
