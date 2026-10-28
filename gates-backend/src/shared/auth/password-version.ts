import { createHash } from 'node:crypto';

/**
 * A short fingerprint of the user's current password hash. It is put in the access token
 * at login (`pv` claim) and compared on every tenant request, so changing the password
 * ends every session issued before the change — without a schema change.
 *
 * Only a one-way fingerprint of the bcrypt hash leaves the server; the hash itself never does.
 */
export function passwordVersion(passwordHash: string | null | undefined): string | undefined {
  if (!passwordHash) return undefined;
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

/**
 * True when the token was issued before the current password. Tokens without `pv`
 * (issued before this check existed, or by Keycloak) are not judged here.
 */
export function isTokenFromOldPassword(
  tokenPv: string | undefined,
  currentPv: string | undefined
): boolean {
  return Boolean(tokenPv && currentPv && tokenPv !== currentPv);
}
