'use client';

import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';

/** CREATE-mode draft autosave for master cards (disabled while editing a saved id). */
export function useMasterCardCreateDraft<T>(opts: {
  documentType: string;
  editingId?: string | null;
  value: T;
  isEmpty: (payload: T) => boolean;
  applyRestore: (payload: T) => void;
  restoreMessage: string;
}) {
  const editingId = opts.editingId ?? null;
  return useDraftAutosave({
    documentType: opts.documentType,
    mode: editingId ? 'edit' : 'new',
    documentId: editingId,
    value: opts.value,
    enabled: !editingId,
    applyRestore: opts.applyRestore,
    isEmpty: opts.isEmpty,
    restoreMessage: opts.restoreMessage,
  });
}
