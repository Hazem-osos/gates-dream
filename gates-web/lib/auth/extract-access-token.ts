/** JWT-shaped string (header.payload.sig) — avoids treating short ids or "Bearer" as tokens. */
function isLikelyJwt(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  const parts = s.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0) && s.length > 20;
}

/**
 * Pull access token from auth responses: `{ data: { accessToken } }`, nested `data.data`, etc.
 * Handles stringified `data`, top-level JSON strings, and walks plain objects (bounded depth).
 */
export function extractAccessTokenFromApiPayload(payload: unknown): string | null {
  if (payload == null) return null;

  if (typeof payload === 'string') {
    const t = payload.trim().replace(/^\uFEFF/, '');
    if (!t) return null;
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        return extractAccessTokenFromApiPayload(JSON.parse(t));
      } catch {
        return null;
      }
    }
    return null;
  }

  if (typeof payload !== 'object') return null;

  const keys = ['accessToken', 'access_token', 'token'] as const;

  function isAuthTokenString(key: (typeof keys)[number], val: unknown): val is string {
    if (typeof val !== 'string') return false;
    const s = val.trim();
    if (!s) return false;
    // Known auth keys from our API — accept any non-trivial string (JWT can be non-standard shape).
    if (key === 'accessToken' || key === 'access_token') return s.length >= 8;
    // Generic `token` — only if it looks like a JWT to avoid matching "Bearer" etc.
    return isLikelyJwt(s);
  }

  function scan(obj: unknown, depth: number): string | null {
    if (depth > 12 || obj === null) return null;

    if (typeof obj === 'string') {
      const t = obj.trim().replace(/^\uFEFF/, '');
      if (t.startsWith('{') && t.endsWith('}')) {
        try {
          return scan(JSON.parse(t), depth + 1);
        } catch {
          return null;
        }
      }
      return null;
    }

    if (typeof obj !== 'object' || Array.isArray(obj)) return null;
    const o = obj as Record<string, unknown>;

    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(o, k) && isAuthTokenString(k, o[k])) {
        return (o[k] as string).trim();
      }
    }

    for (const v of Object.values(o)) {
      if (v === null || v === undefined) continue;
      const found = scan(v, depth + 1);
      if (found) return found;
    }
    return null;
  }

  return scan(payload, 0);
}

/** Normalize object key: `access_token`, `AccessToken` → `accesstoken` */
function normalizedAuthKeyName(key: string): string {
  return key.replace(/_/g, '').toLowerCase();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

/**
 * Read access token from POST /auth/login and POST /auth/register success bodies.
 * Handles top-level + nested `data`, wrappers (`result`/`payload`), casing, and deep scan.
 */
/** Bracket fast path (avoids prototype / key-enumeration edge cases). */
function readAccessTokenBracket(root: Record<string, unknown>): string | null {
  const data = root['data'];
  if (data !== null && data !== undefined && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    for (const k of ['accessToken', 'access_token'] as const) {
      const v = d[k];
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
  }
  for (const k of ['accessToken', 'access_token'] as const) {
    const v = root[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

export function getAccessTokenFromAuthSuccessResponse(body: unknown): string | null {
  let parsed: unknown = body;
  if (typeof parsed === 'string') {
    const t = parsed.trim().replace(/^\uFEFF/, '');
    if (!t) return null;
    if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
      try {
        parsed = JSON.parse(t);
      } catch {
        return extractAccessTokenFromApiPayload(body);
      }
    } else {
      return extractAccessTokenFromApiPayload(body);
    }
  }

  const root = asRecord(parsed);
  if (!root) return extractAccessTokenFromApiPayload(body);

  const direct = readAccessTokenBracket(root);
  if (direct) return direct;

  const pickToken = (rec: Record<string, unknown>): string | null => {
    for (const key of Object.keys(rec)) {
      if (normalizedAuthKeyName(key) !== 'accesstoken') continue;
      const v = rec[key];
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
  };

  const containerNames = new Set(['data', 'result', 'payload', 'body']);
  for (const key of Object.keys(root)) {
    if (!containerNames.has(key.toLowerCase())) continue;
    const inner = asRecord(root[key]);
    if (!inner) continue;
    const t = pickToken(inner);
    if (t) return t;
  }

  const fromRoot = pickToken(root);
  if (fromRoot) return fromRoot;

  return extractAccessTokenFromApiPayload(parsed);
}
