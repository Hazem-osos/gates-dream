/**
 * Isolated n8n adapter: generic GATES action execution for every
 * catalog action with `executedBy: 'gates'` EXCEPT gates.createPurchaseRequest,
 * which keeps its own dedicated endpoint (`internal-purchase-request.routes.ts`).
 * Mounted at `/internal/v1/automation` with the same S2S auth as rule lookup.
 *
 * Same deterministic HTTP error contract as the purchase-request adapter:
 * 2xx success/duplicate replay, 400 permanent validation/config/domain
 * failure, 401/403 auth, 404 unknown company, 409 in-progress/transient
 * claim race (retryable), 5xx unexpected/infrastructure failure (retryable).
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
import { executeAutomationActionSchema } from '../schemas/automation-action-execute.schema';
import { automationActionDispatchService } from '../services/automation-action-dispatch.instance';
import { AutomationActionDispatchError } from '../services/automation-action-dispatch.types';
import { CREATE_PURCHASE_REQUEST_ACTION } from '../catalog/action-catalog';

const router = Router();

router.use(authenticateInternalAutomation);

/**
 * POST /internal/v1/automation/actions/execute
 */
router.post(
  '/actions/execute',
  validate({ body: executeAutomationActionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.body.actionType === CREATE_PURCHASE_REQUEST_ACTION) {
        return void res.status(400).json({
          status: 'error',
          message: 'gates.createPurchaseRequest must use POST /internal/v1/automation/purchase-requests',
        });
      }

      assertInternalCompanyAccess(req.body.companyId, req.internalAutomation);

      const result = await automationActionDispatchService.execute(req.body);
      return void res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (error instanceof AutomationActionDispatchError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      logger.error({ error }, 'Error executing automation action');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to execute automation action',
      });
    }
  }
);

export default router;
