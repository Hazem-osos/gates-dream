/**
 * Isolated n8n adapter: create a DRAFT PurchaseOrder.
 * Mounted at `/internal/v1/automation` with the same S2S auth as rule lookup.
 *
 * ── HTTP error contract (deterministic — n8n retry policy depends on it) ──
 *
 * 2xx  Success or safe idempotent replay.
 *      201 = a new draft PurchaseOrder was created.
 *      200 = `duplicate: true` — an already-SUCCEEDED action was replayed;
 *            the same PurchaseOrder is returned, nothing new was created.
 *
 * 400  Malformed request / validation failure / invalid or foreign domain
 *      reference (unknown supplierId, warehouseId, or itemId for this
 *      company). Retrying the exact same body cannot fix this.
 *
 * 401  Internal automation authentication missing or invalid
 *      (`authenticateInternalAutomation`). Retrying without fixing the
 *      credential cannot fix this.
 *
 * 403  Authenticated caller does not have access to the requested
 *      companyId (`assertInternalCompanyAccess`), or the company account
 *      is inactive. Retrying cannot fix this.
 *
 * 404  companyId does not correspond to an existing company. Retrying
 *      cannot fix this.
 *
 * 409  Action currently in progress, or a transient claim-insert race
 *      (`AutomationActionRun` unique-constraint conflict resolved to no
 *      existing row). A bounded retry can reasonably succeed because the
 *      concurrent request usually finishes first.
 *
 * 429  Rate limited by `apiRateLimiter` at the app-level mount.
 *
 * 5xx  Unexpected/infrastructure failure (unclassified domain error,
 *      unique-constraint race with no recoverable row, or the defensive
 *      "PurchaseOrder returned posted/approved" invariant check). Safe to
 *      retry — `automationIdempotencyKey` guarantees at most one
 *      PurchaseOrder is ever created regardless of how many times the
 *      same eventId/ruleId/actionType is retried.
 *
 * n8n side (not implemented here — do not add retry orchestration in the
 * backend): RETRY on 408/409/429/5xx/network-or-timeout errors with a
 * bounded attempt count; DO NOT RETRY on 400/401/403/404 or any other
 * permanent domain failure — those will fail identically every time.
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
import { createAutomationPurchaseRequestSchema } from '../schemas/automation-purchase-request.schema';
import { automationPurchaseRequestService } from '../services/automation-purchase-request.instance';
import { AutomationPurchaseRequestError } from '../services/automation-action-run.types';

const router = Router();

router.use(authenticateInternalAutomation);

/**
 * POST /internal/v1/automation/purchase-requests
 */
router.post(
  '/purchase-requests',
  validate({ body: createAutomationPurchaseRequestSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertInternalCompanyAccess(req.body.companyId, req.internalAutomation);

      const result = await automationPurchaseRequestService.createDraftPurchaseOrder(req.body);
      return void res.status(result.duplicate ? 200 : 201).json(result);
    } catch (error) {
      if (error instanceof AutomationPurchaseRequestError) {
        return void res.status(error.statusCode).json({
          status: 'error',
          message: error.message,
        });
      }
      logger.error({ error }, 'Error creating automated purchase order');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create purchase order',
      });
    }
  }
);

export default router;
