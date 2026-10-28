import { timingSafeEqual } from 'node:crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Constant-time compare for shared service tokens (restore fetch, etc.). */
export function secretsEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireNonEmptyConnectorToken(headerValue: string): string {
  const token = headerValue.trim();
  if (token.length < 16) {
    throw new Error('Missing or invalid connector token');
  }
  return token;
}
