type Listener = (message: string) => void;

const listeners = new Set<Listener>();
const DEDUPE_MS = 1400;
let lastShownAt = 0;

export function subscribeApiSuccess(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call when any green success toast is shown so the client does not fire a second one. */
export function markApiSuccessToastShown(): void {
  lastShownAt = Date.now();
}

export function notifyApiSuccess(message: string): void {
  const text = String(message ?? '').trim() || DEFAULT_SAVE_SUCCESS_MESSAGE;
  if (Date.now() - lastShownAt < DEDUPE_MS) return;
  lastShownAt = Date.now();
  for (const listener of listeners) {
    listener(text);
  }
}

/** After the current save handler (so a page-level toast.success wins). */
export function queueApiSuccessToast(message: string): void {
  const text = String(message ?? '').trim() || DEFAULT_SAVE_SUCCESS_MESSAGE;
  setTimeout(() => {
    notifyApiSuccess(text);
  }, 0);
}

export const DEFAULT_SAVE_SUCCESS_MESSAGE = 'تم الحفظ';
export const DEFAULT_DELETE_SUCCESS_MESSAGE = 'تم الحذف';
