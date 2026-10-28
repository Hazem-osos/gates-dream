/**
 * Windows Migration Agent talks to these without a user JWT. Device/restore tokens still apply.
 * Callers pass the full `originalUrl`. Both patterns are anchored at the start: unanchored, any
 * URL that merely *ended* with one of these paths skipped user authentication.
 */
export function isPublicMigrationAgentPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? '';
  return (
    /^\/api\/v1\/migration-engine\/connector\/v1\/(pair|poll|complete)\/?$/.test(path) ||
    /^\/api\/v1\/migration-engine\/internal\/packages\/[^/]+\/[^/]+\/bak\/?$/.test(path)
  );
}
