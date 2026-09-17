import { Router, Response, NextFunction } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createAccountSchema,
  updateAccountSchema,
  accountQuerySchema,
} from '../schemas/account.schema';
import { accountService } from '../services/account.service';
import { coaSeederService } from '../services/coa-seeder.service';
import { tenantProvisioningService } from '../services/tenant-provisioning.service';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import { getCoaTreeEtag, getMasterCatalogEtag } from '../../../shared/services/master-catalog-version.service';
import { applyMasterDataEtag, sendJsonWithEtag } from '../../../shared/http/master-data-etag';
import { traceAudit } from '../../../shared/middleware/trace-audit.middleware';
import { refuseProductionSeed } from '../../../shared/config/prod-seed';

const router = Router();

// All routes require authentication and tenant context
router.use(authenticate);
router.use(setTenantContext);
// Legacy `Save_Trace` equivalent — legacy menu item `mnsmAccountcard`.
router.use(traceAudit('mnsmAccountcard'));

/**
 * POST /api/v1/accounting/accounts/seed-default-coa
 * POST /api/v1/accounting/accounts/seed-defaults (alias)
 * Seed standard chart of accounts + default unit / warehouse / safe
 */
async function handleSeedDefaults(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company ID is required',
      });
    }

    const force = req.body?.force === true;
    if (force && refuseProductionSeed()) {
      return void res.status(403).json({
        status: 'error',
        message: 'إعادة تنزيل الدليل معطلة على بيئة التشغيل',
      });
    }
    const industry =
      typeof req.body?.industry === 'string' && req.body.industry.trim()
        ? req.body.industry.trim()
        : undefined;
    const coaAutoNumbering =
      typeof req.body?.coaAutoNumbering === 'boolean'
        ? req.body.coaAutoNumbering
        : req.body?.numberingMode === 'manual'
          ? false
          : true;
    const result = await coaSeederService.seedDefaults(companyId, {
      force,
      industry,
      coaAutoNumbering,
    });

    return void res.json({
      status: 'success',
      message: result.skipped
        ? 'Chart of accounts already populated; master data verified'
        : 'Default chart of accounts seeded successfully',
      data: result,
      success: true,
      count: result.count,
    });
  } catch (error) {
    logger.error({ error }, 'Error seeding default COA');
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to seed default COA',
    });
  }
}

router.post(
  '/seed-default-coa',
  authorize({ resource: 'account', action: 'edit' }),
  handleSeedDefaults
);

router.post(
  '/seed-defaults',
  authorize({ resource: 'account', action: 'edit' }),
  handleSeedDefaults
);

/**
 * GET /api/v1/accounting/accounts/gl-defaults
 * Resolved default GL account IDs for master-data forms
 */
router.get(
  '/gl-defaults',
  authorize({ resource: 'account', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const data = await tenantProvisioningService.getGlDefaults(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'Error getting GL defaults');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get GL defaults',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/accounts
 * List accounts with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'account', action: 'view' }),
  validate({ query: accountQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await accountService.listAccounts(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        accountType: req.query.accountType as string | undefined,
        parentId: req.query.parentId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        leafOnly: req.query.leafOnly as boolean | undefined,
        headerOnly: req.query.headerOnly as boolean | undefined,
        statementType: req.query.statementType as
          | 'BALANCE_SHEET'
          | 'INCOME_STATEMENT'
          | undefined,
      });

      logger.info(
        { companyId, count: result.accounts.length },
        'Accounts listed'
      );

      const etag = await getMasterCatalogEtag(companyId, 'account');
      sendJsonWithEtag(req, res, etag, {
        status: 'success',
        data: result.accounts,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing accounts');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list accounts',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/accounts/tree
 * Alias for hierarchy (interactive COA clients)
 */
router.get('/tree', authorize({ resource: 'account', action: 'view' }), handleCoaTree);

async function handleCoaTree(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId || req.tenantId;
    const parentId = req.query.parentId as string | undefined;

    if (!companyId) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company ID is required',
      });
    }

    const etag = await getCoaTreeEtag(companyId, parentId);
    if (applyMasterDataEtag(req, res, etag)) return;

    const hierarchy = await accountService.getAccountHierarchy(companyId, parentId);
    return void res.json({
      status: 'success',
      data: hierarchy,
    });
  } catch (error) {
    logger.error({ error }, 'Error getting account hierarchy');
    return void res.status(500).json({
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to get account hierarchy',
    });
  }
}

/**
 * GET /api/v1/accounting/accounts/suggest-code
 * GET /api/v1/accounting/accounts/next-code (alias)
 */
async function handleSuggestCode(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company ID is required',
      });
    }
    const parentId = (req.query.parentId as string) || null;
    const code = await accountService.suggestNextAccountCode(companyId, parentId);
    return void res.json({ status: 'success', data: { code, parentId } });
  } catch (error) {
    const status = error instanceof AppError ? error.statusCode : 500;
    return void res.status(status).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to suggest account code',
    });
  }
}

router.get(
  '/suggest-code',
  authorize({ resource: 'account', action: 'view' }),
  handleSuggestCode
);

router.get('/next-code', authorize({ resource: 'account', action: 'view' }), handleSuggestCode);

/**
 * GET /api/v1/accounting/accounts/hierarchy
 * Get account hierarchy (tree structure)
 */
router.get(
  '/hierarchy',
  authorize({ resource: 'account', action: 'view' }),
  handleCoaTree
);

/**
 * GET /api/v1/accounting/accounts/:id
 * Get account by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'account', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const account = await accountService.getAccountById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: account,
      });
    } catch (error) {
      logger.error({ error, accountId: req.params.id }, 'Error getting account');
      const status =
        error instanceof Error && error.message === 'Account not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get account',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/accounts
 * Create a new account
 */
router.post(
  '/',
  authorize({ resource: 'account', action: 'edit' }),
  validate({ body: createAccountSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const account = await accountService.createAccount(companyId, req.body);

      logger.info({ companyId, accountId: account.id }, 'Account created');

      return void res.status(201).json({
        status: 'success',
        message: 'تم حفظ الحساب',
        data: account,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, body: req.body }, 'Error creating account');
      }
      return next(error);
    }
  }
);

/**
 * PUT /api/v1/accounting/accounts/:id
 * Update account
 */
router.put(
  '/:id',
  authorize({ resource: 'account', action: 'edit' }),
  validate({ body: updateAccountSchema }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const account = await accountService.updateAccount(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'تم تحديث الحساب',
        data: account,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, accountId: req.params.id }, 'Error updating account');
      }
      return next(error);
    }
  }
);

/**
 * DELETE /api/v1/accounting/accounts/:id
 * Delete unused account, or mark cancelled-only accounts as ملغي.
 */
router.delete(
  '/:id',
  authorize({ resource: 'account', action: 'delete' }),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const result = await accountService.deleteAccount(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, accountId: req.params.id }, 'Error deleting account');
      }
      return next(error);
    }
  }
);

/** GET /api/v1/accounting/chart-of-accounts — same ETag + tree as /accounts/tree */
export const chartOfAccountsAliasRouter = Router();
chartOfAccountsAliasRouter.use(authenticate);
chartOfAccountsAliasRouter.use(setTenantContext);
chartOfAccountsAliasRouter.use(traceAudit('mnsmAccountcard'));
chartOfAccountsAliasRouter.get(
  '/',
  authorize({ resource: 'account', action: 'view' }),
  handleCoaTree
);

export default router;
