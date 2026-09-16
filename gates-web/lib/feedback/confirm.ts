export type ConfirmTone = 'danger' | 'warning' | 'info';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

export type ConfirmRequest = Required<ConfirmOptions>;

type Listener = (request: ConfirmRequest | null) => void;

const listeners = new Set<Listener>();
const queue: Array<ConfirmRequest & { resolve: (value: boolean) => void }> = [];
let current: (ConfirmRequest & { resolve: (value: boolean) => void }) | null = null;

function isDeleteMessage(message: string) {
  return /حذف|امسح|إلغاء هذا|إلغاء هذه|إيقاف/.test(message);
}

export function normalizeConfirmOptions(input: string | ConfirmOptions): ConfirmRequest {
  const options = typeof input === 'string' ? { message: input } : input;
  const deleteLike = isDeleteMessage(options.message);
  return {
    title: options.title ?? (deleteLike ? 'تأكيد الحذف' : 'تأكيد العملية'),
    message: options.message,
    confirmLabel: options.confirmLabel ?? (deleteLike ? 'حذف' : 'تأكيد'),
    cancelLabel: options.cancelLabel ?? 'رجوع',
    tone: options.tone ?? (deleteLike ? 'danger' : 'warning'),
  };
}

function emit() {
  for (const listener of listeners) listener(current);
}

function dequeue() {
  current = queue.shift() ?? null;
  emit();
}

export function subscribeConfirm(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => listeners.delete(listener);
}

export function resolveConfirm(value: boolean) {
  current?.resolve(value);
  dequeue();
}

export function confirmAction(input: string | ConfirmOptions): Promise<boolean> {
  const request = normalizeConfirmOptions(input);
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && listeners.size === 0) {
      resolve(window.confirm(request.message));
      return;
    }
    queue.push({ ...request, resolve });
    if (!current) dequeue();
  });
}
