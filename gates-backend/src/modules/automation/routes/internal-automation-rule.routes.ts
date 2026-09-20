/**
 * Isolated n8n / service-to-service surface.
 *
 * Mounted at `/internal/v1/automation` OUTSIDE the JWT + tenant + CSRF
 * `/api/v1` stack. Do not remount these routes under `/api/v1`.
 *
 * Auth (required — there is no anonymous fallback):
 *   Header: X-API-Key: <secret>
 *   or:     Authorization: ApiKey <secret>
 *
 * Accepted secrets:
 *   1. AUTOMATION_INTERNAL_API_KEY from the server environment (platform n8n).
 *      This is the intended multi-tenant lookup credential.
 *   2. A GATES API key created via POST /api/v1/api-keys. A tenant-scoped
 *      key may only query its own companyId.
 *
 * PRODUCTION TODO before exposing this route:
 *   - Set AUTOMATION_INTERNAL_API_KEY in the server environment (do not
 *     commit it; do not put it in rule JSON).
 *   - Restrict network access (private n8n → API only).
 *   - Prefer a dedicated, rotatable API key with permission
 *     `automation:internal` once platform-level keys are first-class.
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
import { internalAutomationRuleLookupQuerySchema } from '../schemas/automation-rule.schema';
import { automationRuleService } from '../services/automation-rule.instance';

const router = Router();

router.use(authenticateInternalAutomation);

/**
 * GET /internal/v1/automation/rules?companyId=<uuid>&eventType=<string>
 *
 * Returns only enabled rules for that tenant + eventType.
 */
router.get(
  '/rules',
  validate({ query: internalAutomationRuleLookupQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId, eventType } = req.query as {
        companyId: string;
        eventType: string;
      };
      assertInternalCompanyAccess(companyId, req.internalAutomation);

      const rules = await automationRuleService.listEnabledForEvent(companyId, eventType);
      return void res.json({ rules });
    } catch (error) {
      logger.error({ error }, 'Error looking up automation rules for n8n');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to look up automation rules',
      });
    }
  }
);

export default router;
