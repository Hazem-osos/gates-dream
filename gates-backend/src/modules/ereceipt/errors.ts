const SECRET = /secret|preshared|token|authorization|pin|clientSecret/i;

export function redactEreceiptLog(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactEreceiptLog(item));
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET.test(key) ? '[redacted]' : redactEreceiptLog(item);
  }
  return out;
}

export type FailureClass = 'RETRYABLE' | 'PERMANENT' | 'DUPLICATE' | 'CONFIG';

const CONFIG_CODES = new Set([
  'invalid_posserial',
  'invalid_pososversion',
  'invalid_posmodelframework',
  'invalid_presharedkey',
  'invalid_client',
  'unauthorized_client',
]);

export function classifySubmissionFailure(input: {
  httpStatus: number;
  errorCode?: string | null;
  message?: string | null;
}): FailureClass {
  const code = String(input.errorCode ?? '').trim();
  const message = String(input.message ?? '');
  if (code === 'DuplicateSubmission' || /DuplicateSubmission/i.test(message)) return 'DUPLICATE';
  if (CONFIG_CODES.has(code) || /invalid_pos|presharedkey|B2C/i.test(message)) return 'CONFIG';
  if (input.httpStatus === 401 || input.httpStatus === 408 || input.httpStatus === 429 || input.httpStatus >= 500 || input.httpStatus === 0) {
    return 'RETRYABLE';
  }
  return 'PERMANENT';
}

export function retryDelayMs(retryAfterHeader: string | null, attempt: number): number {
  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60 * 60 * 1000);
  return Math.min(30_000 * 2 ** Math.max(0, attempt - 1), 15 * 60 * 1000);
}
