import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { StoredMigrationPackage } from './migration-package.storage';
import { migrationPackageMaxBytes } from '../migration-engine-config';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function migrationObjectStorageConfigured(): boolean {
  return Boolean(
    process.env.MIGRATION_S3_BUCKET?.trim() &&
      process.env.MIGRATION_S3_REGION?.trim() &&
      process.env.MIGRATION_S3_ACCESS_KEY_ID?.trim() &&
      process.env.MIGRATION_S3_SECRET_ACCESS_KEY?.trim()
  );
}

/** Tenant-scoped key. Original filenames are not used. */
export function backupObjectKey(companyId: string, packageId: string): string {
  if (!UUID.test(companyId) || !UUID.test(packageId)) {
    throw new Error('Unsafe backup object key');
  }
  return `migration-bak/${companyId}/${packageId}.bak`;
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

export function parseByteRange(
  header: string | undefined,
  size: number
): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || start >= size) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

type S3Module = typeof import('@aws-sdk/client-s3');

async function s3() {
  const mod: S3Module = await import('@aws-sdk/client-s3');
  const endpoint = process.env.MIGRATION_S3_ENDPOINT?.trim();
  const client = new mod.S3Client({
    region: process.env.MIGRATION_S3_REGION!.trim(),
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.MIGRATION_S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.MIGRATION_S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.MIGRATION_S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
  return { mod, client, bucket: process.env.MIGRATION_S3_BUCKET!.trim() };
}

export async function publishBackupObject(pkg: StoredMigrationPackage): Promise<void> {
  if (!migrationObjectStorageConfigured()) return;
  if (pkg.sizeBytes > migrationPackageMaxBytes()) {
    throw new Error('Backup exceeds MIGRATION_UPLOAD_MAX_MB');
  }
  const { mod, client, bucket } = await s3();
  const Key = backupObjectKey(pkg.companyId, pkg.id);
  await client.send(
    new mod.PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: createReadStream(pkg.storedPath),
      ContentLength: pkg.sizeBytes,
      Metadata: { sha256: pkg.sha256 },
    })
  );
}

export async function downloadBackupObject(pkg: StoredMigrationPackage, destPartial: string): Promise<void> {
  const { mod, client, bucket } = await s3();
  const Key = backupObjectKey(pkg.companyId, pkg.id);
  let existing = 0;
  try {
    existing = (await fs.stat(destPartial)).size;
  } catch {
    existing = 0;
  }
  const out = await client.send(
    new mod.GetObjectCommand({
      Bucket: bucket,
      Key,
      Range: existing > 0 ? `bytes=${existing}-` : undefined,
    })
  );
  if (!out.Body) throw new Error('Object storage returned an empty backup');
  const body = out.Body as Readable;
  await pipeline(body, createWriteStream(destPartial, { flags: existing > 0 && out.ContentRange ? 'a' : 'w' }));
}

export async function deleteBackupObject(pkg: Pick<StoredMigrationPackage, 'companyId' | 'id'>): Promise<void> {
  if (!migrationObjectStorageConfigured()) return;
  if (process.env.MIGRATION_S3_RETAIN === 'true') return;
  const { mod, client, bucket } = await s3();
  await client.send(
    new mod.DeleteObjectCommand({
      Bucket: bucket,
      Key: backupObjectKey(pkg.companyId, pkg.id),
    })
  );
}

export async function downloadFetchResumable(url: string, destPartial: string, token: string): Promise<void> {
  let existing = 0;
  try {
    existing = (await fs.stat(destPartial)).size;
  } catch {
    existing = 0;
  }
  const headers: Record<string, string> = {};
  if (token) headers['X-Migration-Restore-Token'] = token;
  if (existing > 0) headers.Range = `bytes=${existing}-`;
  const res = await fetch(url, { headers });
  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`Failed to download backup package (${res.status})`);
  }
  if (!res.body) throw new Error('Backup download was empty');
  const append = res.status === 206 && existing > 0;
  await pipeline(
    Readable.fromWeb(res.body as import('stream/web').ReadableStream),
    createWriteStream(destPartial, { flags: append ? 'a' : 'w' })
  );
}
