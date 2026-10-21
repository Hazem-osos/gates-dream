'use client';

import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';

type Props<T> = {
  /** Draft payload offered for restore (from `useDraftAutosave`). */
  restoreOffer: T | null;
  /** When true, hide the banner (e.g. saved document id in URL). */
  hide?: boolean;
  message: string;
  acceptRestore: () => T | null;
  dismissRestore: () => void;
  onRestored: (payload: T) => void;
};

/** Browser-only unsaved data: استعادة / تجاهل. Never a server-saved مسودة. */
export function PageDraftRestoreGate<T>({
  restoreOffer,
  hide,
  message,
  acceptRestore,
  dismissRestore,
  onRestored,
}: Props<T>) {
  if (!restoreOffer || hide) return null;
  return (
    <PageDraftRestoreBanner
      message={message}
      onRestore={() => {
        const payload = acceptRestore();
        if (payload != null) onRestored(payload);
      }}
      onDismiss={dismissRestore}
    />
  );
}
