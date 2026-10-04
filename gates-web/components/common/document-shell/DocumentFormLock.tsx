'use client';

import type { ReactNode } from 'react';
import { useOptionalDocumentMode } from './DocumentModeContext';

export function DocumentFormLock({ children }: { children: ReactNode }) {
  const mode = useOptionalDocumentMode();
  const locked = mode?.isReadOnly ?? false;
  return (
    <fieldset
      disabled={locked}
      className={locked ? 'min-w-0 disabled:opacity-90' : 'min-w-0'}
    >
      {children}
    </fieldset>
  );
}
