/**
 * Security: without ENCRYPTION_KEY the helper fell back to a constant that is published in
 * this public repository, and startup only logged the problem. In production a missing or
 * malformed key must be an error, never the fallback.
 */
jest.mock('../../shared/cache/redis', () => ({
  redisClient: { isReady: () => false, getClient: jest.fn() },
}));

import { decrypt, encrypt, validateEncryptionKey } from '../../shared/security/secrets-manager';

const VALID = 'ab'.repeat(32);
const original = { NODE_ENV: process.env.NODE_ENV, ENCRYPTION_KEY: process.env.ENCRYPTION_KEY };

afterEach(() => {
  process.env.NODE_ENV = original.NODE_ENV;
  if (original.ENCRYPTION_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = original.ENCRYPTION_KEY;
});

describe('validateEncryptionKey', () => {
  it('rejects a missing key in production', () => {
    expect(() => validateEncryptionKey({ NODE_ENV: 'production' })).toThrow();
  });

  it('rejects a key that is not 64 hex characters in production', () => {
    expect(() => validateEncryptionKey({ NODE_ENV: 'production', ENCRYPTION_KEY: 'short-passphrase' })).toThrow();
    expect(() => validateEncryptionKey({ NODE_ENV: 'production', ENCRYPTION_KEY: 'zz'.repeat(32) })).toThrow();
  });

  it('accepts a 64-hex key in production', () => {
    expect(() => validateEncryptionKey({ NODE_ENV: 'production', ENCRYPTION_KEY: VALID })).not.toThrow();
  });

  it('does not block development', () => {
    expect(() => validateEncryptionKey({ NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('encrypt in production without a key', () => {
  it('fails instead of using the published fallback key', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('smtp-password')).toThrow();
  });

  it('round-trips with a real key', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = VALID;
    expect(decrypt(encrypt('smtp-password'))).toBe('smtp-password');
  });
});
