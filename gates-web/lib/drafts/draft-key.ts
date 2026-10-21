export type DraftMode = 'new' | 'edit';

export type BuildDraftKeyInput = {
  companyId: string | null | undefined;
  userId?: string | null;
  documentType: string;
  mode?: DraftMode;
  documentId?: string | null;
  variantId?: string | null;
};

function token(value: string | null | undefined, fallback: string): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

function typePartFor(input: BuildDraftKeyInput): string {
  const documentType = token(input.documentType, 'document');
  const variant = String(input.variantId ?? '').trim();
  return variant ? `${documentType}:${variant}` : documentType;
}

/** Pre–per-user keys (`gates:draft:…:company:new`). Used only to migrate stored drafts. */
export function buildDraftKeyWithoutUser(input: BuildDraftKeyInput): string {
  const companyId = token(input.companyId, 'unknown');
  const typePart = typePartFor(input);
  const mode = input.mode ?? 'new';

  if (mode === 'edit') {
    const documentId = token(input.documentId, '');
    if (documentId) return `gates:draft:${typePart}:${companyId}:edit:${documentId}`;
  }

  return `gates:draft:${typePart}:${companyId}:new`;
}

/** Per user + company + screen. CREATE uses `:new`. EDIT uses `:edit:${documentId}`. */
export function buildDraftKey(input: BuildDraftKeyInput): string {
  const companyId = token(input.companyId, 'unknown');
  const userId = token(input.userId, 'anonymous');
  const typePart = typePartFor(input);
  const mode = input.mode ?? 'new';

  if (mode === 'edit') {
    const documentId = token(input.documentId, '');
    if (documentId) {
      return `gates:draft:${typePart}:${companyId}:${userId}:edit:${documentId}`;
    }
  }

  return `gates:draft:${typePart}:${companyId}:${userId}:new`;
}
