export type DraftMode = 'new' | 'edit';

export type BuildDraftKeyInput = {
  companyId: string | null | undefined;
  documentType: string;
  mode?: DraftMode;
  documentId?: string | null;
  variantId?: string | null;
};

function token(value: string | null | undefined, fallback: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

/** Tenant-aware draft key. CREATE uses `:new`. EDIT (future) uses `:edit:${documentId}`. */
export function buildDraftKey(input: BuildDraftKeyInput): string {
  const companyId = token(input.companyId, 'unknown');
  const documentType = token(input.documentType, 'document');
  const mode = input.mode ?? 'new';
  const variant = String(input.variantId ?? '').trim();
  const typePart = variant ? `${documentType}:${variant}` : documentType;

  if (mode === 'edit') {
    const documentId = token(input.documentId, '');
    if (documentId) return `gates:draft:${typePart}:${companyId}:edit:${documentId}`;
  }

  return `gates:draft:${typePart}:${companyId}:new`;
}
