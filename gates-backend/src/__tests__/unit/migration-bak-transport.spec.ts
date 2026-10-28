import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { backupObjectKey, parseByteRange, sha256File } from '../../modules/migration-engine/services/migration-bak-transport';
import { stageBackupForRestore } from '../../modules/migration-engine/services/migration-bak-staging.service';
import type { StoredMigrationPackage } from '../../modules/migration-engine/services/migration-package.storage';

const companyId = '11111111-1111-4111-8111-111111111111';
const packageId = '22222222-2222-4222-8222-222222222222';

function pkg(partial: Partial<StoredMigrationPackage>): StoredMigrationPackage {
  return {
    id: packageId,
    companyId,
    originalName: 'legacy.bak',
    storedPath: '',
    sizeBytes: 0,
    sha256: '',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    ...partial,
  };
}

describe('backup object keys', () => {
  it('scopes the object to the tenant and package id', () => {
    expect(backupObjectKey(companyId, packageId)).toBe(`migration-bak/${companyId}/${packageId}.bak`);
  });

  it('rejects a path-like id', () => {
    expect(() => backupObjectKey('../etc', packageId)).toThrow(/Unsafe/);
  });
});

describe('byte range', () => {
  it('parses a resume range and rejects a backwards range', () => {
    expect(parseByteRange('bytes=4-', 10)).toEqual({ start: 4, end: 9 });
    expect(parseByteRange('bytes=9-1', 10)).toBeNull();
  });
});

describe('stage backup onto the SQL directory', () => {
  let root: string;
  const previous: Record<string, string | undefined> = {};

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'gates-bak-'));
    for (const key of [
      'MIGRATION_PACKAGES_DIR',
      'MIGRATION_ISOLATED_BACKUP_DIR',
      'MIGRATION_S3_BUCKET',
      'MIGRATION_RESTORE_PACKAGE_FETCH_URL',
    ]) {
      previous[key] = process.env[key];
    }
    process.env.MIGRATION_PACKAGES_DIR = root;
    process.env.MIGRATION_ISOLATED_BACKUP_DIR = path.join(root, 'sql-backups');
    delete process.env.MIGRATION_S3_BUCKET;
    delete process.env.MIGRATION_RESTORE_PACKAGE_FETCH_URL;
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  it('copies a local file, checks sha256, and reuses it after the source disappears', async () => {
    const sourceDir = path.join(root, companyId);
    await fs.mkdir(sourceDir, { recursive: true });
    const source = path.join(sourceDir, `${packageId}.bak`);
    await fs.writeFile(source, 'backup-bytes');
    const sha256 = createHash('sha256').update('backup-bytes').digest('hex');
    const stored = pkg({ storedPath: source, sizeBytes: 12, sha256 });

    const staged = await stageBackupForRestore(stored);
    expect(await sha256File(staged.localPath)).toBe(sha256);
    expect(staged.sqlServerDiskPath.endsWith(`${packageId}.bak`)).toBe(true);

    await fs.rm(source);
    const again = await stageBackupForRestore(stored);
    expect(again.localPath).toBe(staged.localPath);
    expect(await sha256File(again.localPath)).toBe(sha256);
  });

  it('refuses a checksum mismatch and deletes the partial file', async () => {
    const sourceDir = path.join(root, companyId);
    await fs.mkdir(sourceDir, { recursive: true });
    const source = path.join(sourceDir, `${packageId}.bak`);
    await fs.writeFile(source, 'backup-bytes');
    const stored = pkg({ storedPath: source, sizeBytes: 12, sha256: 'ab'.repeat(32) });
    await expect(stageBackupForRestore(stored)).rejects.toThrow(/checksum mismatch/);
    await expect(fs.stat(path.join(root, 'sql-backups', `${packageId}.bak`))).rejects.toThrow();
    await expect(fs.stat(path.join(root, 'sql-backups', `${packageId}.bak.partial`))).rejects.toThrow();
  });
});
