'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type DocumentMode = 'create' | 'view' | 'edit';

export type DocumentModeContextValue = {
  mode: DocumentMode;
  isReadOnly: boolean;
  isEditing: boolean;
  isCreating: boolean;
  setMode: (mode: DocumentMode) => void;
  unlockForEdit: () => void;
  lockToView: () => void;
};

const DocumentModeContext = createContext<DocumentModeContextValue | null>(null);

export function DocumentModeProvider({
  children,
  initialMode = 'create',
}: {
  children: ReactNode;
  initialMode?: DocumentMode;
}) {
  const [mode, setMode] = useState<DocumentMode>(initialMode);

  const unlockForEdit = useCallback(() => setMode('edit'), []);
  const lockToView = useCallback(() => setMode('view'), []);

  const value = useMemo<DocumentModeContextValue>(
    () => ({
      mode,
      isReadOnly: mode === 'view',
      isEditing: mode === 'edit',
      isCreating: mode === 'create',
      setMode,
      unlockForEdit,
      lockToView,
    }),
    [lockToView, mode, unlockForEdit]
  );

  return <DocumentModeContext.Provider value={value}>{children}</DocumentModeContext.Provider>;
}

export function useDocumentMode(): DocumentModeContextValue {
  const ctx = useContext(DocumentModeContext);
  if (!ctx) {
    throw new Error('useDocumentMode must be used inside DocumentModeProvider');
  }
  return ctx;
}

export function useOptionalDocumentMode(): DocumentModeContextValue | null {
  return useContext(DocumentModeContext);
}
