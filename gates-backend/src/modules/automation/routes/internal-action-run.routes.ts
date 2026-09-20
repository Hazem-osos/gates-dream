/**
 * Read-only n8n / S2S execution log.
 * Mounted at `/internal/v1/automation` with the same S2S auth as rule lookup.
 */
import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import {
  authenticateInternalAutomation,
  assertInternalCompanyAccess,
} from '../../../shared/middleware/internal-automation-auth.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import {
  internalAutomationActionRunGetQuerySchema,
  internalAutomationActionRunIdParamSchema,
  internalAutomationActionRunListQuerySchema,
} from '../schemas/automation-action-run.schema';
import {
  automationActionRunService,
  loadRuleNames,
} from '../services/automation-action-run.instance';
import { toAutomationActionRunView } from '../services/automation-action-run.mapper';

const router = Router();

router.use(authenticateInternalAutomation);

/**
 * GET /internal/v1/automation/action-runs
 */
router.get(
  '/action-runs',
  validate({ query: internalAutomationActionRunListQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as unknown as {
        companyId: string;
        eventId?: string;
        eventType?: string;
        ruleId?: string;
        status?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
        page: number;
        limit: number;
      };
      assertInternalCompanyAccess(query.companyId, req.internalAutomation);

      const result = await automationActionRunService.list(query);
      const names = await loadRuleNames(
        query.companyId,
        result.runs.map((run) => run.ruleId)
      );
      return void res.json({
        runs: result.runs.map((run) =>
          toAutomationActionRunView(run, names.get(run.ruleId) ?? null)
        ),
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing automation action runs');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list automation action runs',
      });
    }
  }
);

/**
 * GET /internal/v1/automation/action-runs/:id
 */
router.get(
  '/action-runs/:id',
  validate({
    params: internalAutomationActionRunIdParamSchema,
    query: internalAutomationActionRunGetQuerySchema,
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { companyId } = req.query as { companyId: string };
      assertInternalCompanyAccess(companyId, req.internalAutomation);

      const run = await automationActionRunService.getById(companyId, id);
      if (!run) {
        throw new AppError(404, 'Automation action run not found');
      }
      const names = await loadRuleNames(companyId, [run.ruleId]);
      return void res.json({
        run: toAutomationActionRunView(run, names.get(run.ruleId) ?? null),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      logger.error({ error }, 'Error loading automation action run');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load automation action run',
      });
    }
  }
);

export default router;
