import {
  assertSafeLegacySqlHost,
  legacySqlHostLooksCombinedPort,
  legacySqlHostUnresolvedMessage,
} from '../../modules/migration-engine/legacy-source/legacy-source-ssrf';
import { MigrationTargetSafetyError } from '../../modules/migration-engine/target-safety';

describe('legacy-source-ssrf', () => {
  it('allows localhost in non-production', async () => {
    await expect(assertSafeLegacySqlHost('localhost')).resolves.toBeUndefined();
  });

  it('blocks localhost in production without allow flag', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.MIGRATION_ALLOW_PRIVATE_SQL_HOSTS;
    await expect(assertSafeLegacySqlHost('localhost')).rejects.toThrow(MigrationTargetSafetyError);
    process.env.NODE_ENV = prev;
  });

  it('blocks private IP in production without allow flag', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    delete process.env.MIGRATION_ALLOW_PRIVATE_SQL_HOSTS;
    await expect(assertSafeLegacySqlHost('10.0.0.5')).rejects.toThrow(MigrationTargetSafetyError);
    process.env.NODE_ENV = prev;
  });

  it('allows private IP when explicitly enabled', async () => {
    process.env.MIGRATION_ALLOW_PRIVATE_SQL_HOSTS = 'true';
    await expect(assertSafeLegacySqlHost('10.0.0.5')).resolves.toBeUndefined();
    delete process.env.MIGRATION_ALLOW_PRIVATE_SQL_HOSTS;
  });

  it('rejects host,port packed into Host before DNS', async () => {
    await expect(assertSafeLegacySqlHost('sql.office.local,1433')).rejects.toThrow(/host,port/i);
  });

  it('distinguishes packed port from unresolved public hostname', () => {
    expect(legacySqlHostLooksCombinedPort('db.example.com,1433')).toBe(true);
    expect(legacySqlHostLooksCombinedPort('db.example.com')).toBe(false);
    expect(legacySqlHostUnresolvedMessage('sql.office.local,1433')).toMatch(/host,port/i);
    expect(legacySqlHostUnresolvedMessage('sql.office.local')).toMatch(/could not be resolved from this server/i);
  });
});
