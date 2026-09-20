/**
 * User-facing execution history for Gates Automation ("Run history").
 *
 * Mounted under `/api/v1/automation/runs` — same JWT + tenant-session stack
 * as `/api/v1/automation/rules`. companyId always comes from the
 * authenticated session, never from the client. This is deliberately
 * separate from `/internal/v1/automation/action-runs` (X-API-Key, n8n/S2S) —
 * the browser must never see that surface or its credentials.
 */
import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import {
  automationRunListQuerySchema,
  automationRunIdParamSchema,
} from '../schemas/automation-run.schema';
import { automationActionRunService, loadRuleNames } from '../services/automation-action-run.instance';
import { toAutomationActionRunView } from '../services/automation-action-run.mapper';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) {
    throw new AppError(400, 'Company ID is required');
  }
  return companyId;
}

/**
 * GET /api/v1/automation/runs
 */
router.get(
  '/',
  authorize({ resource: 'automation-rule', action: 'view' }),
  validate({ query: automationRunListQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const query = req.query as unknown as {
        eventId?: string;
        eventType?: string;
        ruleId?: string;
        status?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
        page: number;
        limit: number;
      };

      const result = await automationActionRunService.list({ companyId, ...query });
      const names = await loadRuleNames(companyId, result.runs.map((run) => run.ruleId));

      return void res.json({
        status: 'success',
        data: result.runs.map((run) => toAutomationActionRunView(run, names.get(run.ruleId) ?? null)),
        pagination: { page: result.page, limit: result.limit, total: result.total },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing automation runs');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list automation runs',
      });
    }
  }
);

/**
 * GET /api/v1/automation/runs/:id
 */
router.get(
  '/:id',
  authorize({ resource: 'automation-rule', action: 'view' }),
  validate({ params: automationRunIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const run = await automationActionRunService.getById(companyId, req.params.id);
      if (!run) {
        throw new AppError(404, 'Automation run not found');
      }
      const names = await loadRuleNames(companyId, [run.ruleId]);
      return void res.json({
        status: 'success',
        data: toAutomationActionRunView(run, names.get(run.ruleId) ?? null),
      });
    } catch (error) {
      logger.error({ error, runId: req.params.id }, 'Error getting automation run');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get automation run',
      });
    }
  }
);

export default router;
