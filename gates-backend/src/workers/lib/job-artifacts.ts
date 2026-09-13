import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';
import { resolveStorageProvider } from '../../modules/archive/storage/resolve-storage-provider';
import type { JobArtifactResult } from '../jobs/async-job.types';

function jobsRoot(): string {
  return path.resolve(process.cwd(), env.EXPORT_PATH, 'jobs');
}

export function jobArtifactDir(companyId: string, jobId: string): string {
  return path.join(jobsRoot(), companyId, jobId);
}

export async function storeJobArtifact(input: {
  companyId: string;
  jobId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<JobArtifactResult> {
  const safeName = input.fileName.replace(/[^\w.\-()]+/g, '_');
  const dir = jobArtifactDir(input.companyId, input.jobId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, safeName);
  await writeFile(filePath, input.buffer);

  try {
    const storage = resolveStorageProvider();
    await storage.put({
      companyId: input.companyId,
      attachmentId: `job-${input.jobId}`,
      fileName: safeName,
      mimeType: input.mimeType,
      buffer: input.buffer,
    });
  } catch (error) {
    logger.warn({ error, jobId: input.jobId }, 'Object-storage put skipped; local cache written');
  }

  return {
    success: true,
    companyId: input.companyId,
    fileName: safeName,
    filePath,
    downloadUrl: `/api/v1/jobs/${input.jobId}/file`,
    mimeType: input.mimeType,
  };
}

export async function readJobArtifact(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}
