import fs from 'node:fs';
import path from 'node:path';
import {
  expressRestoreVerdict,
  migrationPackageMaxBytes,
  restoreCapacityPlan,
  restoreStorageBudget,
  SQL_EXPRESS_MAX_DATA_BYTES,
} from '../../modules/migration-engine/migration-engine-config';
import { isolatedMssqlHostRejection } from '../../modules/migration-engine/migration-sql-safety';

describe('restore capacity', () => {
  const previous = process.env.MIGRATION_UPLOAD_MAX_MB;

  afterEach(() => {
    if (previous === undefined) delete process.env.MIGRATION_UPLOAD_MAX_MB;
    else process.env.MIGRATION_UPLOAD_MAX_MB = previous;
  });

  it('keeps the 4096 MB package cap unless the env is raised', () => {
    delete process.env.MIGRATION_UPLOAD_MAX_MB;
    expect(migrationPackageMaxBytes()).toBe(4096 * 1024 * 1024);
  });

  it('sizes API and SQL disks above the upload, one restore at a time', () => {
    const upload = 4096 * 1024 * 1024;
    const plan = restoreCapacityPlan(upload);
    expect(plan.apiVolumeBytes).toBeGreaterThan(upload);
    expect(plan.sqlVolumeBytes).toBe(restoreStorageBudget({ bakFileBytes: upload, uncompressedBackupBytes: null }).total);
    expect(plan.concurrentRestores).toBe(1);
    expect(plan.sqlRamBytes).toBe(8 * 1024 * 1024 * 1024);
  });
});

describe('Railway private SQL host', () => {
  it('allows gates-restore-sql.railway.internal only when marked dedicated and not the MySQL host', () => {
    const databaseUrl = 'mysql://root:secret@mysql.railway.internal:3306/railway';
    const host = 'gates-restore-sql.railway.internal';
    expect(isolatedMssqlHostRejection(host, { databaseUrl, dedicated: false })).toMatch(/DEDICATED/);
    expect(isolatedMssqlHostRejection(host, { databaseUrl, dedicated: true })).toBeNull();
    expect(isolatedMssqlHostRejection('mysql.railway.internal', { databaseUrl, dedicated: true })).toMatch(
      /MySQL target/
    );
  });
});

describe('restore SQL image', () => {
  const dockerfile = fs.readFileSync(path.join(__dirname, '../../../Dockerfile.restore-sql'), 'utf8');
  const entry = fs.readFileSync(
    path.join(__dirname, '../../../scripts/migration-restore-entrypoint.sh'),
    'utf8'
  );

  it('runs sqlservr and the restore worker on one disk and refuses a public port', () => {
    expect(dockerfile).toContain('mcr.microsoft.com/mssql/server:2022-latest');
    expect(dockerfile).not.toMatch(/EXPOSE\s+1433/);
    expect(dockerfile).toContain('MIGRATION_SQL_SEES_BACKUP_DIR=true');
    expect(entry).toContain('/opt/mssql/bin/sqlservr');
    expect(entry).toContain('MIGRATION_ISOLATED_MSSQL_ADVERTISE_HOST');
    expect(entry).toContain('Developer and Evaluation are for tests only');
    expect(entry).toContain('sqlservr stopped');
    expect(entry).toContain('restore worker stopped');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('gates-restore-healthcheck.sh');
  });
});

describe('express data limit', () => {
  it('treats 10 GB as database data, not the .bak size', () => {
    expect(expressRestoreVerdict(2 * 1024 * 1024 * 1024)).toBe('within_data_limit');
    expect(expressRestoreVerdict(SQL_EXPRESS_MAX_DATA_BYTES + 1)).toBe('too_large');
    expect(expressRestoreVerdict(null)).toBe('unknown');
  });

  it('counts data, log, staging, temp, and a margin from BackupSize', () => {
    const budget = restoreStorageBudget({ bakFileBytes: 1_000, uncompressedBackupBytes: 8_000 });
    expect(budget.dataBytes).toBe(8_000);
    expect(budget.logBytes).toBe(8_000);
    expect(budget.stagingBytes).toBe(1_000);
    expect(budget.tempBytes).toBeGreaterThan(0);
    expect(budget.marginBytes).toBeGreaterThan(0);
    expect(budget.total).toBeGreaterThan(8_000 * 2 + 1_000);
    expect(budget.uncompressedKnown).toBe(true);
  });
});
