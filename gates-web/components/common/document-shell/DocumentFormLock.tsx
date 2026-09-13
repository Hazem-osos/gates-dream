'use client';

import type { ReactNode } from 'react';
import { useOptionalDocumentMode } from './DocumentModeContext';

export function DocumentFormLock({ children }: { children: ReactNode }) {
  const mode = useOptionalDocumentMode();
  const locked = mode?.isReadOnly ?? false;
  return (
    <fieldset
      disabled={locked}
      className={locked ? 'disabled:opacity-90 disabled:pointer-events-none' : undefined}
    >
      {children}
    </fieldset>
  );
}
