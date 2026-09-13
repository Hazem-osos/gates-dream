import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Router, Response } from 'express';
import type { Job } from 'bullmq';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';
import { payrollQueue } from '../../workers/queues/payroll.queue';
import { reportsQueue } from '../../workers/queues/reports.queue';
import { findJobAcrossQueues } from '../../workers/queue-manager';
import { logger } from '../logger';
import type { AuthRequest } from '../auth/types';
import { requireRedisEnabled } from './require-redis';

const router = Router();

router.use(authenticate);

async function loadTenantJob(req: AuthRequest, jobId: string): Promise<Job | null> {
  const job =
    (await findJobAcrossQueues(jobId)) ??
    (await payrollQueue.getJob(jobId)) ??
    (await reportsQueue.getJob(jobId));
  if (!job) return null;

  const jobCompanyId = (job.data as { companyId?: string } | undefined)?.companyId;
  const callerCompanyId = req.companyId || req.tenantId;
  if (!jobCompanyId || !callerCompanyId || jobCompanyId !== callerCompanyId) {
    logger.warn(
      { jobId, jobCompanyId, callerCompanyId },
      'Blocked cross-tenant job-status lookup'
    );
    return null;
  }
  return job;
}

function isSafeArtifactPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const allowed = [
    path.resolve(process.cwd(), 'reports'),
    path.resolve(process.cwd(), 'exports'),
    path.resolve(process.cwd(), 'storage'),
  ];
  return allowed.some((root) => resolved === root || resolved.startsWith(root + path.sep));
}

router.get(
  '/:jobId/file',
  authorize({ resource: 'job', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!requireRedisEnabled(res)) return;
      const job = await loadTenantJob(req, req.params.jobId);
      if (!job) {
        return void res.status(404).json({ status: 'error', message: 'Job not found' });
      }
      const state = await job.getState();
      if (state !== 'completed') {
        return void res.status(409).json({
          status: 'error',
          message: 'File is not ready yet',
          state,
        });
      }
      const result = job.returnvalue as { filePath?: string; fileName?: string; mimeType?: string } | undefined;
      if (!result?.filePath || !isSafeArtifactPath(result.filePath)) {
        return void res.status(404).json({ status: 'error', message: 'No downloadable file' });
      }
      await stat(result.filePath);
      res.setHeader('Content-Type', result.mimeType ?? 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(result.fileName ?? path.basename(result.filePath)).replace(/"/g, '')}"`
      );
      return void createReadStream(result.filePath).pipe(res);
    } catch (error) {
      logger.error({ error }, 'Error downloading job file');
      return void res.status(500).json({ status: 'error', message: 'Failed to download file' });
    }
  }
);

router.get(
  '/:jobId',
  authorize({ resource: 'job', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!requireRedisEnabled(res)) return;

      const job = await loadTenantJob(req, req.params.jobId);
      if (!job) {
        return void res.status(404).json({
          status: 'error',
          message: 'Job not found',
        });
      }

      const state = await job.getState();
      const progress = await job.progress;
      const result = await job.returnvalue;
      const failedReason = await job.failedReason;

      return void res.json({
        jobId: job.id,
        state,
        progress,
        result,
        failedReason,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting job status');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to get job status',
      });
    }
  }
);

export default router;
