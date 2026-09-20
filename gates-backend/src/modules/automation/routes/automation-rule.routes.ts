import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import {
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
  setAutomationRuleEnabledSchema,
  automationRuleQuerySchema,
  automationRuleIdParamSchema,
} from '../schemas/automation-rule.schema';
import { automationRuleService } from '../services/automation-rule.instance';

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
 * GET /api/v1/automation/rules
 * List rules for the authenticated session company only.
 */
router.get(
  '/',
  authorize({ resource: 'automation-rule', action: 'view' }),
  validate({ query: automationRuleQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const result = await automationRuleService.listRules(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        eventType: req.query.eventType as string | undefined,
        enabled: req.query.enabled as boolean | undefined,
      });
      return void res.json({
        status: 'success',
        data: result.rules,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing automation rules');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list automation rules',
      });
    }
  }
);

/**
 * GET /api/v1/automation/rules/:id
 */
router.get(
  '/:id',
  authorize({ resource: 'automation-rule', action: 'view' }),
  validate({ params: automationRuleIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const rule = await automationRuleService.getRuleById(companyId, req.params.id);
      return void res.json({ status: 'success', data: rule });
    } catch (error) {
      logger.error({ error, ruleId: req.params.id }, 'Error getting automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get automation rule',
      });
    }
  }
);

/**
 * POST /api/v1/automation/rules
 * companyId is taken from the session — never from the request body.
 */
router.post(
  '/',
  authorize({ resource: 'automation-rule', action: 'edit' }),
  validate({ body: createAutomationRuleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const rule = await automationRuleService.createRule(companyId, req.body);
      return void res.status(201).json({
        status: 'success',
        message: 'Automation rule created successfully',
        data: rule,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create automation rule',
      });
    }
  }
);

/**
 * PUT /api/v1/automation/rules/:id
 */
router.put(
  '/:id',
  authorize({ resource: 'automation-rule', action: 'edit' }),
  validate({ params: automationRuleIdParamSchema, body: updateAutomationRuleSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const rule = await automationRuleService.updateRule(companyId, req.params.id, req.body);
      return void res.json({
        status: 'success',
        message: 'Automation rule updated successfully',
        data: rule,
      });
    } catch (error) {
      logger.error({ error, ruleId: req.params.id }, 'Error updating automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update automation rule',
      });
    }
  }
);

/**
 * PATCH /api/v1/automation/rules/:id/enabled
 */
router.patch(
  '/:id/enabled',
  authorize({ resource: 'automation-rule', action: 'edit' }),
  validate({ params: automationRuleIdParamSchema, body: setAutomationRuleEnabledSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const rule = await automationRuleService.setEnabled(
        companyId,
        req.params.id,
        req.body.enabled
      );
      return void res.json({
        status: 'success',
        message: rule.enabled ? 'Automation rule enabled' : 'Automation rule disabled',
        data: rule,
      });
    } catch (error) {
      logger.error({ error, ruleId: req.params.id }, 'Error toggling automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update automation rule',
      });
    }
  }
);

/**
 * POST /api/v1/automation/rules/:id/duplicate
 * Creates a disabled copy of the rule (never auto-enabled).
 */
router.post(
  '/:id/duplicate',
  authorize({ resource: 'automation-rule', action: 'edit' }),
  validate({ params: automationRuleIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      const rule = await automationRuleService.duplicateRule(companyId, req.params.id);
      return void res.status(201).json({
        status: 'success',
        message: 'Automation rule duplicated successfully',
        data: rule,
      });
    } catch (error) {
      logger.error({ error, ruleId: req.params.id }, 'Error duplicating automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to duplicate automation rule',
      });
    }
  }
);

/**
 * DELETE /api/v1/automation/rules/:id
 */
router.delete(
  '/:id',
  authorize({ resource: 'automation-rule', action: 'delete' }),
  validate({ params: automationRuleIdParamSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = requireCompanyId(req);
      await automationRuleService.deleteRule(companyId, req.params.id);
      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, ruleId: req.params.id }, 'Error deleting automation rule');
      const status = error instanceof AppError ? error.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete automation rule',
      });
    }
  }
);

export default router;
