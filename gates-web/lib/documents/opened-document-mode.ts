export type OpenedDocumentModeApi = {
  setMode: (mode: 'create' | 'view' | 'edit') => void;
  lockToView: () => void;
  unlockForEdit: () => void;
};

/**
 * Opening a saved record:
 * - screens without ترحيل stay in edit
 * - screens with ترحيل stay in edit unless the document is posted or cancelled
 */
export function syncOpenedDocumentMode(
  api: OpenedDocumentModeApi,
  input: {
    hasSavedId: boolean;
    hasPosting?: boolean;
    isPosted?: boolean;
    isCancelled?: boolean;
  }
): void {
  if (!input.hasSavedId) {
    api.setMode('create');
    return;
  }
  if (input.isCancelled || (input.hasPosting && input.isPosted)) {
    api.lockToView();
    return;
  }
  api.unlockForEdit();
}
