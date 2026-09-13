/**
 * Browser-only: sync JWT/session token to a first-party cookie so Edge middleware can read it.
 * HttpOnly cannot be set from JavaScript; this cookie is visible to JS (XSS risk — pair with CSP).
 */

import { AUTH_TOKEN_COOKIE_NAME } from './constants';

function secureCookieSuffix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

/**
 * Set or clear the auth cookie. Call whenever setAuthToken / clearAuthToken runs.
 */
export function syncAuthTokenCookie(token: string | null, persist: boolean): void {
  if (typeof document === 'undefined') return;

  const sameSite = 'SameSite=Lax';
  const path = 'Path=/';
  const suffix = `${path}; ${sameSite}${secureCookieSuffix()}`;

  if (!token) {
    document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; ${suffix}; Max-Age=0`;
    return;
  }

  const maxAgeSeconds = persist ? 60 * 60 * 24 * 7 : 60 * 60 * 24; // 7d vs 1d session tab
  const value = encodeURIComponent(token);
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=${value}; ${suffix}; Max-Age=${maxAgeSeconds}`;
}
