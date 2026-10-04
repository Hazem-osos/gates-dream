/**
 * Where to send the user after successful login or register.
 * Login uses `?redirect=` or dashboard. Register should use {@link resolvePostRegisterRedirect} once only.
 */
const DEFAULT_POST_AUTH = '/dashboard';

export function resolvePostAuthRedirect(searchParams: { get(name: string): string | null } | null): string {
  const from = searchParams?.get('from')?.trim();
  if (from && from.startsWith('/') && !from.startsWith('//')) {
    return from;
  }
  const env =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_POST_AUTH_REDIRECT?.trim() : '';
  if (env && env.startsWith('/') && !env.startsWith('//')) {
    return env;
  }
  return DEFAULT_POST_AUTH;
}

/** Sign-up lands on the dashboard. The setup wizard is paused. */
export function resolvePostRegisterRedirect(): string {
  return DEFAULT_POST_AUTH;
}
