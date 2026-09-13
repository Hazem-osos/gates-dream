import { resolveApiAuthMode } from '../../shared/middleware/api-auth-mode.middleware';

describe('resolveApiAuthMode', () => {
  // H21 fix (Item 39): `anonymous` must never be the *implicit* fallback —
  // it previously kicked in for any non-"production" NODE_ENV (including a
  // blank/misconfigured one), silently exposing the whole API
  // unauthenticated. It now requires an explicit `API_AUTH_MODE=anonymous`.
  it('defaults to enforce outside production when API_AUTH_MODE is unset', () => {
    expect(resolveApiAuthMode({ NODE_ENV: 'development' })).toBe('enforce');
    expect(resolveApiAuthMode({})).toBe('enforce');
    expect(resolveApiAuthMode({ NODE_ENV: 'staging' })).toBe('enforce');
  });

  it('defaults to enforce in production', () => {
    expect(resolveApiAuthMode({ NODE_ENV: 'production' })).toBe('enforce');
  });

  it('honours an explicit mode outside production', () => {
    expect(resolveApiAuthMode({ NODE_ENV: 'development', API_AUTH_MODE: 'enforce' })).toBe(
      'enforce'
    );
    expect(resolveApiAuthMode({ NODE_ENV: 'test', API_AUTH_MODE: 'ANONYMOUS' })).toBe(
      'anonymous'
    );
    expect(resolveApiAuthMode({ NODE_ENV: 'development', API_AUTH_MODE: 'anonymous' })).toBe(
      'anonymous'
    );
  });

  it('refuses anonymous mode in production', () => {
    expect(() =>
      resolveApiAuthMode({ NODE_ENV: 'production', API_AUTH_MODE: 'anonymous' })
    ).toThrow(/not allowed when NODE_ENV=production/);
  });

  it('rejects unknown values', () => {
    expect(() => resolveApiAuthMode({ API_AUTH_MODE: 'open' })).toThrow(/Invalid API_AUTH_MODE/);
  });
});
