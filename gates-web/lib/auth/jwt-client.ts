/** Dev client-only JWT payload read (no signature verification). */
export function readJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function jwtSubject(token: string): string | null {
  const p = readJwtPayload(token);
  const sub = p?.sub;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}
