/** Saved to the server but not posted yet — not a browser-only draft. */
export const DOCUMENT_UNPOSTED_LABEL = 'غير مرحّل';

/** No server record yet (new document). */
export const DOCUMENT_NEW_LABEL = 'جديد';

export function unpostedDocumentStatusLabel(hasSavedId: boolean): string {
  return hasSavedId ? DOCUMENT_UNPOSTED_LABEL : DOCUMENT_NEW_LABEL;
}
