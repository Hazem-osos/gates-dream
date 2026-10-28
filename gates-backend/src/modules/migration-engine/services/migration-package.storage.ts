import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import prisma from '../../../shared/database/prisma';
import { MigrationTargetSafetyError } from '../target-safety';
import { publishBackupObject } from './migration-bak-transport';

const ALLOWED_EXT = new Set(['.bak', '.zip', '.7z']);

export type StoredMigrationPackage = {
  id: string;
  companyId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  expiresAt: string;
};

function packagesRoot(): string {
  const root =
    process.env.MIGRATION_PACKAGES_DIR?.trim() ||
    path.join(process.cwd(), 'var', 'migration-packages');
  return root;
}

/** Ensure packages dir exists (Railway volume mount may be empty on first deploy). */
export async function ensureMigrationPackagesRoot(): Promise<string> {
  const root = packagesRoot();
  await fsp.mkdir(root, { recursive: true });
  return root;
}

async function resolvePackageFileOnDisk(
  pkg: Pick<StoredMigrationPackage, 'companyId' | 'storedPath'>
): Promise<string | null> {
  const candidates = [
    pkg.storedPath,
    path.join(packagesRoot(), pkg.companyId, path.basename(pkg.storedPath)),
  ];
  for (const candidate of [...new Set(candidates)]) {
    try {
      await fsp.access(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function purgeOrphanPackageRecord(companyId: string, packageId: string): Promise<void> {
  await prisma.migrationStoredPackage.deleteMany({ where: { id: packageId, companyId } }).catch(() => undefined);
  await fsp.unlink(metaPath(companyId, packageId)).catch(() => undefined);
}

function metaPath(companyId: string, packageId: string): string {
  return path.join(packagesRoot(), companyId, `${packageId}.json`);
}

function filePath(companyId: string, packageId: string, ext: string): string {
  return path.join(packagesRoot(), companyId, `${packageId}${ext}`);
}

function rowToStored(row: {
  id: string;
  companyId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: bigint;
  sha256: string;
  createdAt: Date;
  expiresAt: Date;
}): StoredMigrationPackage {
  return {
    id: row.id,
    companyId: row.companyId,
    originalName: row.originalName,
    storedPath: row.storedPath,
    sizeBytes: Number(row.sizeBytes),
    sha256: row.sha256,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** Strip multer part suffixes (`file.bak.part0`) so extension checks stay on the real backup type. */
export function normalizeBackupUploadBasename(name: string): string {
  return path.basename(name).replace(/\.part\d+$/i, '');
}

export function assertAllowedBackupFilename(name: string): string {
  const base = normalizeBackupUploadBasename(name);
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new MigrationTargetSafetyError(
      `امتداد النسخة غير مدعوم (${ext || 'بدون امتداد'}). المسموح: .bak أو .zip أو .7z`
    );
  }
  if (base.includes('..') || base.includes('/') || base.includes('\\')) {
    throw new MigrationTargetSafetyError('Invalid file name');
  }
  return ext;
}

export async function ensureCompanyPackageDir(companyId: string): Promise<string> {
  const dir = path.join(packagesRoot(), companyId);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function persistPackageRecord(record: StoredMigrationPackage): Promise<void> {
  await prisma.migrationStoredPackage.upsert({
    where: { id: record.id },
    create: {
      id: record.id,
      companyId: record.companyId,
      originalName: record.originalName,
      storedPath: record.storedPath,
      sizeBytes: BigInt(record.sizeBytes),
      sha256: record.sha256,
      createdAt: new Date(record.createdAt),
      expiresAt: new Date(record.expiresAt),
    },
    update: {
      originalName: record.originalName,
      storedPath: record.storedPath,
      sizeBytes: BigInt(record.sizeBytes),
      sha256: record.sha256,
      expiresAt: new Date(record.expiresAt),
    },
  });
  await fsp.writeFile(metaPath(record.companyId, record.id), JSON.stringify(record, null, 2), 'utf8').catch(
    () => undefined
  );
}

export async function finalizeUploadedPackage(params: {
  companyId: string;
  tempPath: string;
  originalName: string;
}): Promise<StoredMigrationPackage> {
  const ext = assertAllowedBackupFilename(params.originalName);
  const id = randomUUID();
  const dest = filePath(params.companyId, id, ext);
  await ensureCompanyPackageDir(params.companyId);
  await fsp.rename(params.tempPath, dest);

  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(dest);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });
  const sha256 = hash.digest('hex');
  const stat = await fsp.stat(dest);
  const ttlDays = Number(process.env.MIGRATION_PACKAGE_TTL_DAYS ?? '14');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlDays * 86_400_000);

  const record: StoredMigrationPackage = {
    id,
    companyId: params.companyId,
    originalName: path.basename(params.originalName),
    storedPath: dest,
    sizeBytes: stat.size,
    sha256,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  await persistPackageRecord(record);
  await publishBackupObject(record);
  return record;
}

async function materializePackageOnDisk(stored: StoredMigrationPackage): Promise<StoredMigrationPackage | null> {
  const resolvedPath = await resolvePackageFileOnDisk(stored);
  if (!resolvedPath) {
    await purgeOrphanPackageRecord(stored.companyId, stored.id);
    return null;
  }
  if (resolvedPath !== stored.storedPath) {
    stored = { ...stored, storedPath: resolvedPath };
    await persistPackageRecord(stored).catch(() => undefined);
  }
  return stored;
}

export async function listPackages(companyId: string): Promise<StoredMigrationPackage[]> {
  await ensureMigrationPackagesRoot();
  const rows = await prisma.migrationStoredPackage.findMany({
    where: { companyId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (rows.length) {
    const out: StoredMigrationPackage[] = [];
    for (const row of rows) {
      const pkg = await materializePackageOnDisk(rowToStored(row));
      if (pkg) out.push(pkg);
    }
    return out;
  }
  const dir = path.join(packagesRoot(), companyId);
  try {
    const files = await fsp.readdir(dir);
    const out: StoredMigrationPackage[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await fsp.readFile(path.join(dir, f), 'utf8');
      const parsed = JSON.parse(raw) as StoredMigrationPackage;
      const pkg = await materializePackageOnDisk(parsed);
      if (pkg) {
        out.push(pkg);
        await persistPackageRecord(pkg).catch(() => undefined);
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function getPackage(
  companyId: string,
  packageId: string
): Promise<StoredMigrationPackage | null> {
  const row = await prisma.migrationStoredPackage.findFirst({
    where: { id: packageId, companyId },
  });
  if (row) {
    const stored = rowToStored(row);
    const pkg = await materializePackageOnDisk(stored);
    if (!pkg) {
      throw new MigrationTargetSafetyError(
        'ملف الحزمة غير موجود على الخادم (سُجّلت الحزمة قبل تثبيت Volume أو بعد إعادة تشغيل بدون قرص دائم). ارفع النسخة .bak مرة أخرى — بعد اكتمال الرفع يجب أن يظهر حجم Volume في Railway.'
      );
    }
    return pkg;
  }
  try {
    const raw = await fsp.readFile(metaPath(companyId, packageId), 'utf8');
    const parsed = JSON.parse(raw) as StoredMigrationPackage;
    await persistPackageRecord(parsed).catch(() => undefined);
    return parsed;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Packages are stored for ops restore; live migration still uses LEGACY_FORENSIC_URL SQL connection. */
export function packagePreflightMessage(pkg: StoredMigrationPackage): string {
  return (
    `تم حفظ النسخة "${pkg.originalName}" (${Math.round(pkg.sizeBytes / 1024 / 1024)} MB). ` +
    'استعادة ملف .bak إلى SQL Server المعزول تتم من DevOps أو زر الاستعادة إن كان SQL متاحاً. ' +
    'بعد الاستعادة، استخدم «اتصال LegacyForensic» مع LEGACY_FORENSIC_URL على الخادم.'
  );
}
