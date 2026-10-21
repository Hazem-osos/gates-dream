'use client';

import type { ReactNode } from 'react';
import { useOptionalDocumentMode } from './DocumentModeContext';

export function DocumentFormLock({ children }: { children: ReactNode }) {
  const mode = useOptionalDocumentMode();
  const locked = mode?.isReadOnly ?? false;
  return (
    <fieldset
      disabled={locked}
      className={`m-0 w-full min-w-0 max-w-full border-0 p-0 [min-inline-size:0] ${
        locked ? 'disabled:opacity-90' : ''
      }`}
    >
      {children}
    </fieldset>
  );
}
