import { isUuid, secretsEqual } from '../../modules/migration-engine/migration-service-auth';

describe('migration-service-auth', () => {
  it('validates UUIDs', () => {
    expect(isUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });

  it('compares secrets in constant time', () => {
    expect(secretsEqual('abc', 'abc')).toBe(true);
    expect(secretsEqual('abc', 'abd')).toBe(false);
    expect(secretsEqual('', 'x')).toBe(false);
  });
});
