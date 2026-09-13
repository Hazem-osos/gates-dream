/**
 * Session identifiers shared by the API client (browser) and Next.js middleware (Edge).
 * Keep this module free of `window` / Node-only APIs so it is safe to import from middleware.
 */

/** Primary cookie + localStorage key (see lib/api/client.ts) */
export const AUTH_TOKEN_COOKIE_NAME = 'auth_token';

/** Optional alternate cookies set by other clients or proxies */
export const AUTH_TOKEN_COOKIE_ALIASES = ['accessToken', 'gates_session'] as const;
