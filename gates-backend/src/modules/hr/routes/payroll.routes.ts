import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { payrollQueue } from '../../../workers/queues/payroll.queue';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { requireRedisEnabled } from '../../../shared/jobs/require-redis';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/hr/payroll/calculate
 * Enqueue payroll calculation job
 */
router.post(
  '/calculate',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!requireRedisEnabled(res)) return;

      const { period } = req.body;
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || '';

      if (!period) {
        return void res.status(400).json({
          status: 'error',
          message: 'Period is required (format: YYYY-MM)',
        });
      }

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Enqueue job
      const job = await payrollQueue.add(
        'calculate-payroll',
        {
          companyId,
          period,
          userId,
        },
        {
          priority: 1, // Higher priority
        }
      );

      logger.info(
        { jobId: job.id, companyId, period, userId },
        'Payroll calculation job enqueued'
      );

      // Return 202 Accepted with job ID
      return void res.status(202).json({
        status: 'accepted',
        message: 'Payroll calculation job enqueued',
        jobId: job.id,
        statusUrl: `/api/v1/jobs/${job.id}`,
      });
    } catch (error) {
      logger.error({ error }, 'Error enqueuing payroll job');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to enqueue payroll calculation job',
      });
    }
  }
);

/**
 * GET /api/v1/hr/payroll/jobs/:jobId
 * Get job status
 */
router.get(
  '/jobs/:jobId',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: Request, res: Response) => {
    try {
      if (!requireRedisEnabled(res)) return;

      const { jobId } = req.params;
      const job = await payrollQueue.getJob(jobId);

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
