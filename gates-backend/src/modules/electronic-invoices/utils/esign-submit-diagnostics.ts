export type EsignSubmitStage =
  | 'canonical_rebuilt'
  | 'eta_authenticate'
  | 'eta_submit'
  | 'eta_interpreted';

export type EsignLocalVerify = 'passed' | 'skipped_already_signed';

export type EsignSubmitDiagnostics = {
  stage: EsignSubmitStage;
  originalCode?: string;
  originalStatusCode?: number;
  etaHttpStatus?: number;
  etaBodyPreview?: string;
  signingSessionId?: string;
  documentId?: string;
  contentHash?: string;
  localVerify: EsignLocalVerify;
};

const SECRET_JSON_KEYS =
  /"(access_token|refresh_token|client_secret|clientSecret|authorization|tokenPin|pin|password|secret|credential)"\s*:\s*"[^"]*"/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._\-+=/]+/gi;

export function sanitizeEtaPreview(text: unknown, max = 200): string {
  const raw = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const redacted = raw.replace(SECRET_JSON_KEYS, '"$1":"[redacted]"').replace(BEARER, 'Bearer [redacted]');
  return redacted.slice(0, max);
}

export function attachEtaHttpMeta(error: unknown, status: number, body: unknown): void {
  if (!error || typeof error !== 'object') return;
  const target = error as { etaHttpStatus?: number; etaBodyPreview?: string };
  target.etaHttpStatus = status;
  target.etaBodyPreview = sanitizeEtaPreview(body);
}

export function readEtaHttpMeta(error: unknown): { etaHttpStatus?: number; etaBodyPreview?: string } {
  if (!error || typeof error !== 'object') return {};
  const source = error as { etaHttpStatus?: unknown; etaBodyPreview?: unknown };
  return {
    etaHttpStatus: typeof source.etaHttpStatus === 'number' ? source.etaHttpStatus : undefined,
    etaBodyPreview:
      typeof source.etaBodyPreview === 'string' ? sanitizeEtaPreview(source.etaBodyPreview) : undefined,
  };
}

export function publicEsignDiagnostics(input: EsignSubmitDiagnostics): EsignSubmitDiagnostics {
  return {
    stage: input.stage,
    originalCode: input.originalCode,
    originalStatusCode: input.originalStatusCode,
    etaHttpStatus: input.etaHttpStatus,
    etaBodyPreview: input.etaBodyPreview ? sanitizeEtaPreview(input.etaBodyPreview) : undefined,
    signingSessionId: input.signingSessionId,
    documentId: input.documentId,
    contentHash: input.contentHash,
    localVerify: input.localVerify,
  };
}
