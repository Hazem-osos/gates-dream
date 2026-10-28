import { assessBakRestore } from '../../modules/migration-engine/services/migration-bak-restore.service';
import { isolatedMssqlHostRejection } from '../../modules/migration-engine/migration-sql-safety';
import { buildRestoreReaderStatements } from '../../modules/migration-engine/services/migration-bak-sqlcmd';
import {
  assertAllowedBackupFilename,
  type StoredMigrationPackage,
} from '../../modules/migration-engine/services/migration-package.storage';

function pkg(ext: string): StoredMigrationPackage {
  return {
    id: 'p1',
    companyId: 'c1',
    originalName: `legacy${ext}`,
    storedPath: `/tmp/legacy${ext}`,
    sizeBytes: 1024,
    sha256: 'abc',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
}

describe('migration package filenames', () => {
  it('accepts chunked upload part names (.bak.part0)', () => {
    expect(assertAllowedBackupFilename('legacy.bak.part0')).toBe('.bak');
    expect(assertAllowedBackupFilename('legacy.bak.part12')).toBe('.bak');
  });
});

describe('migration-bak-restore', () => {
  it('marks zip as not applicable for restore', async () => {
    const a = await assessBakRestore(pkg('.zip'));
    expect(a.status).toBe('NOT_APPLICABLE');
  });

  it('blocks bak when restore not enabled', async () => {
    const prev = process.env.MIGRATION_BAK_RESTORE_ENABLED;
    delete process.env.MIGRATION_BAK_RESTORE_ENABLED;
    const a = await assessBakRestore(pkg('.bak'));
    expect(a.status).toBe('BLOCKED');
    process.env.MIGRATION_BAK_RESTORE_ENABLED = prev;
  });
});

describe('isolated MSSQL host gate', () => {
  const databaseUrl = 'mysql://root:secret@mysql.internal:3306/railway';

  it('rejects the Gates MySQL host even when marked dedicated', () => {
    expect(
      isolatedMssqlHostRejection('mysql.internal', { databaseUrl, dedicated: true })
    ).toMatch(/MySQL target/);
  });

  it('rejects a Railway-looking host until the dedicated flag is set', () => {
    expect(
      isolatedMssqlHostRejection('restore-sql.railway.internal', { databaseUrl, dedicated: false })
    ).toMatch(/DEDICATED/);
    expect(
      isolatedMssqlHostRejection('restore-sql.railway.internal', { databaseUrl, dedicated: true })
    ).toBeNull();
  });
});

describe('restore reader SQL', () => {
  it('creates a reader login and sets the database read-only', () => {
    const sql = buildRestoreReaderStatements('GatesLegacyRestore_abc123', 'gates_ro_abc123', "p'wd");
    expect(sql.join('\n')).toContain('CREATE LOGIN [gates_ro_abc123]');
    expect(sql.join('\n')).toContain("N'p''wd'");
    expect(sql.join('\n')).toContain('db_datareader');
    expect(sql.join('\n')).toContain('SET READ_ONLY');
    expect(sql.join('\n')).not.toContain('sa');
  });
});
