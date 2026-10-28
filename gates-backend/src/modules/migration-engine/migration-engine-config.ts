/** Infrastructure tuning for large legacy databases (no transform semantics). */

const DEFAULT_BATCH = 200;
const MIN_BATCH = 10;
const MAX_BATCH = 2_000;

export function resolveMigrationBatchSize(override?: number): number {
  const env = Number(process.env.MIGRATION_DEFAULT_BATCH_SIZE ?? '');
  const base = Number.isFinite(env) && env > 0 ? env : DEFAULT_BATCH;
  const n = override ?? base;
  return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.floor(n)));
}

export function migrationProgressFlushMs(): number {
  const n = Number(process.env.MIGRATION_PROGRESS_FLUSH_MS ?? '3000');
  return Number.isFinite(n) && n >= 500 ? n : 3000;
}

export function migrationJobLockTtlMs(): number {
  const n = Number(process.env.MIGRATION_JOB_LOCK_TTL_MS ?? '');
  return Number.isFinite(n) && n >= 30_000 ? n : 5 * 60_000;
}

export function migrationJobLockHeartbeatMs(): number {
  const n = Number(process.env.MIGRATION_JOB_LOCK_HEARTBEAT_MS ?? '');
  const ttl = migrationJobLockTtlMs();
  const defaultHb = Math.max(15_000, Math.floor(ttl / 3));
  return Number.isFinite(n) && n >= 5_000 ? Math.min(n, ttl - 5_000) : defaultHb;
}

export function migrationChunkMaxBytes(): number {
  const n = Number(process.env.MIGRATION_UPLOAD_CHUNK_MAX_BYTES ?? '');
  return Number.isFinite(n) && n > 0 ? n : 32 * 1024 * 1024;
}

/** Assembled .bak cap. Default 4096 MB. Raising it does not resize Railway disks. */
export function migrationPackageMaxBytes(): number {
  const mb = Number(process.env.MIGRATION_UPLOAD_MAX_MB ?? '4096');
  const n = Number.isFinite(mb) && mb > 0 ? mb : 4096;
  return Math.floor(n) * 1024 * 1024;
}

/** Express 2022: 10 GB maximum data size of one database. Not a .bak size limit. */
export const SQL_EXPRESS_MAX_DATA_BYTES = 10 * 1024 * 1024 * 1024;

export function expressRestoreVerdict(
  uncompressedBackupBytes: number | null
): 'unknown' | 'too_large' | 'within_data_limit' {
  if (uncompressedBackupBytes == null || !Number.isFinite(uncompressedBackupBytes)) return 'unknown';
  if (uncompressedBackupBytes > SQL_EXPRESS_MAX_DATA_BYTES) return 'too_large';
  return 'within_data_limit';
}

/**
 * Disk on the SQL volume during restore: uncompressed data, a log of similar size,
 * and the .bak file until it is deleted. Do not size the disk from the .bak alone.
 */
export function sqlDiskBytesRequired(bakFileBytes: number, uncompressedBackupBytes: number | null): number {
  return restoreStorageBudget({ bakFileBytes, uncompressedBackupBytes }).total;
}

export type RestoreStorageBudget = {
  dataBytes: number;
  logBytes: number;
  stagingBytes: number;
  tempBytes: number;
  marginBytes: number;
  total: number;
  uncompressedKnown: boolean;
};

/** HEADERONLY BackupSize is uncompressed. Log, staging, temp, and a margin are extra. */
export function restoreStorageBudget(params: {
  bakFileBytes: number;
  uncompressedBackupBytes: number | null;
}): RestoreStorageBudget {
  const stagingBytes = Math.max(0, params.bakFileBytes);
  const uncompressedKnown = params.uncompressedBackupBytes != null && params.uncompressedBackupBytes > 0;
  const dataBytes = uncompressedKnown ? params.uncompressedBackupBytes! : Math.max(stagingBytes, 1) * 4;
  const logBytes = dataBytes;
  const tempBytes = Math.ceil(dataBytes * 0.1);
  const marginBytes = Math.ceil((dataBytes + logBytes + stagingBytes + tempBytes) * 0.2);
  return {
    dataBytes,
    logBytes,
    stagingBytes,
    tempBytes,
    marginBytes,
    total: dataBytes + logBytes + stagingBytes + tempBytes + marginBytes,
    uncompressedKnown,
  };
}

export type RestoreCapacityPlan = {
  uploadMaxBytes: number;
  apiVolumeBytes: number;
  sqlVolumeBytes: number;
  sqlRamBytes: number;
  concurrentRestores: 1;
};

/**
 * Disk/RAM the isolated restore needs for one backup of `uploadMaxBytes`.
 * API volume holds the uploaded file. SQL volume holds the staged bak plus data and log.
 */
export function restoreCapacityPlan(uploadMaxBytes = migrationPackageMaxBytes()): RestoreCapacityPlan {
  const upload = Math.max(0, Math.floor(uploadMaxBytes));
  const gib = 1024 * 1024 * 1024;
  return {
    uploadMaxBytes: upload,
    apiVolumeBytes: upload + gib,
    sqlVolumeBytes: sqlDiskBytesRequired(upload, null),
    sqlRamBytes: 8 * gib,
    concurrentRestores: 1,
  };
}
