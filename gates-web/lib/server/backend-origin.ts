/** Runtime backend origin for server-side proxy (Railway private network or local). */
export function resolveBackendOrigin(): string {
  const raw =
    process.env.BACKEND_PROXY_TARGET?.trim() ||
    process.env.BACKEND_INTERNAL_URL?.trim() ||
    'http://127.0.0.1:3001';
  return raw.replace(/\/$/, '');
}
