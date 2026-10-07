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
 * @deprecated Legacy async job — writes MonthlySalary rows via BullMQ.
 * Canonical payroll calculation: POST /api/v1/hr/payroll-runs (PayrollRun).
 * See docs/hcm/HCM_PAYROLL_ARCHITECTURE.md.
 *
 * POST /api/v1/hr/payroll/calculate
 * Enqueue payroll calculation job
 */
router.post(
  '/calculate',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        'Deprecated: use POST /api/v1/hr/payroll-runs for canonical PayrollRun calculation. MonthlySalary async job removed.',
      canonicalEndpoint: '/api/v1/hr/payroll-runs',
    });
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
