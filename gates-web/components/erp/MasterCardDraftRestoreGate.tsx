'use client';

import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';

type Props<T> = {
  editingId?: string | null;
  restoreOffer: T | null;
  acceptRestore: () => T | null;
  dismissRestore: () => void;
  onRestored: (payload: T) => void;
  message: string;
};

export function MasterCardDraftRestoreGate<T>({
  editingId,
  restoreOffer,
  acceptRestore,
  dismissRestore,
  onRestored,
  message,
}: Props<T>) {
  return (
    <PageDraftRestoreGate<T>
      restoreOffer={restoreOffer}
      hide={Boolean(editingId)}
      message={message}
      acceptRestore={acceptRestore}
      dismissRestore={dismissRestore}
      onRestored={onRestored}
    />
  );
}
