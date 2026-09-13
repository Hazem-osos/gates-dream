import type { StorageProvider, StorageProviderKind } from './storage-provider';
import { localDiskStorageProvider } from './local-storage.provider';
import { s3StorageProvider } from './s3-storage.provider';

const OBJECT_MODES = new Set(['s3', 'minio', 'r2']);

/** Picks archive backend from ARCHIVE_STORAGE_PROVIDER (local | s3 | minio | r2). */
export function resolveStorageProvider(): StorageProvider {
  const mode = process.env.ARCHIVE_STORAGE_PROVIDER?.trim().toLowerCase() ?? 'local';
  if (OBJECT_MODES.has(mode)) return s3StorageProvider;
  return localDiskStorageProvider;
}

export function resolveStorageProviderKind(): StorageProviderKind {
  return resolveStorageProvider().kind;
}
