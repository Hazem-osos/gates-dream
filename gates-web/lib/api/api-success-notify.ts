type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function subscribeApiSuccess(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyApiSuccess(message: string): void {
  const text = message.trim() || 'تم الحفظ';
  for (const listener of listeners) {
    listener(text);
  }
}

export const DEFAULT_SAVE_SUCCESS_MESSAGE = 'تم الحفظ';
