import { apiClient } from '@/lib/api/client';
import type { MigrationPackageRow } from './migration-types';

const CHUNK_SIZE = 4 * 1024 * 1024;
const CHUNK_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MIGRATION_POST_TIMEOUT_MS = 5 * 60 * 1000;

export type MigrationUploadProgress = {
  percent: number;
  phase: 'init' | 'uploading' | 'finalizing' | 'done';
  uploadedBytes: number;
  totalBytes: number;
  chunkIndex?: number;
  totalChunks?: number;
  fileName?: string;
};

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/** Always chunked so progress updates steadily and large .bak files survive proxies. */
export async function uploadMigrationPackage(
  file: File,
  onProgress?: (state: MigrationUploadProgress) => void
): Promise<MigrationPackageRow> {
  if (!file.size) {
    throw new Error('الملف فارغ');
  }
  return uploadMigrationPackageChunked(file, onProgress);
}

async function uploadMigrationPackageChunked(
  file: File,
  onProgress?: (state: MigrationUploadProgress) => void
): Promise<MigrationPackageRow> {
  const totalBytes = file.size;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));

  const emit = (partial: Omit<MigrationUploadProgress, 'totalBytes' | 'fileName'> & { totalBytes?: number }) => {
    onProgress?.({
      totalBytes,
      fileName: file.name,
      ...partial,
    });
  };

  emit({ percent: 0, phase: 'init', uploadedBytes: 0, totalChunks });

  const init = await apiClient.post<{ uploadId: string }>(
    '/migration-engine/packages/upload/init',
    {
      originalName: file.name,
      totalChunks,
    },
    { timeout: MIGRATION_POST_TIMEOUT_MS }
  );
  const uploadId = init.data?.uploadId;
  if (!uploadId) {
    throw new Error('تعذّر بدء جلسة الرفع — تحقق من الاتصال بالخادم');
  }

  emit({ percent: 2, phase: 'uploading', uploadedBytes: 0, chunkIndex: 0, totalChunks });

  for (let index = 0; index < totalChunks; index += 1) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalBytes);
    const blob = file.slice(start, end);
    const form = new FormData();
    form.append('uploadId', uploadId);
    form.append('index', String(index));
    form.append('file', blob, file.name);
    await apiClient.upload<{ percent: number }>('/migration-engine/packages/upload/chunk', form, {
      timeout: CHUNK_UPLOAD_TIMEOUT_MS,
    });
    const uploadedBytes = end;
    const percent = 2 + Math.round(((index + 1) / totalChunks) * 93);
    emit({
      percent: Math.min(percent, 95),
      phase: 'uploading',
      uploadedBytes,
      chunkIndex: index + 1,
      totalChunks,
    });
  }

  emit({ percent: 97, phase: 'finalizing', uploadedBytes: totalBytes, totalChunks });

  const done = await apiClient.post<MigrationPackageRow>(
    '/migration-engine/packages/upload/complete',
    { uploadId },
    { timeout: MIGRATION_POST_TIMEOUT_MS }
  );
  if (!done.data?.id) {
    throw new Error('فشل إتمام الرفع — أعد المحاولة');
  }

  emit({ percent: 100, phase: 'done', uploadedBytes: totalBytes, totalChunks });
  return done.data;
}

export { formatMb as formatMigrationUploadMb };
