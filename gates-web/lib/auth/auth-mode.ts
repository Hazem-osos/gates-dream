/**
 * Mirrors the backend `API_AUTH_MODE`. `enforce` means every API call needs a JWT and
 * an expired session must bounce the user to /login.
 */
export type AuthMode = 'enforce' | 'anonymous';

export function resolveAuthMode(): AuthMode {
  const mode = process.env.NEXT_PUBLIC_AUTH_MODE?.trim().toLowerCase();
  if (mode === 'enforce') return 'enforce';
  if (mode === 'anonymous') return 'anonymous';
  return process.env.NODE_ENV === 'production' ? 'enforce' : 'anonymous';
}

export function isAuthEnforced(): boolean {
  return resolveAuthMode() === 'enforce';
}

/** Sends the browser to /login preserving the current location. */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  if (pathname.startsWith('/login')) return;
  const target = new URL('/login', window.location.origin);
  target.searchParams.set('redirect', `${pathname}${search}`);
  window.location.assign(target.toString());
}
