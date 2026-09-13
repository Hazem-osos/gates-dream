import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountQuerySchema,
} from '../schemas/bank-account.schema';
import { bankAccountService } from '../services/bank-account.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { bankBoxRightsService } from '../../treasury/services/bank-box-rights.service';
import { companySettingsService } from '../../company/services/company-settings.service';

const router = Router();

/**
 * GET /api/v1/accounting/bank-accounts
 * List bank accounts
 */
router.get(
  '/',
  authorize({ resource: 'bank-account', action: 'view' }),
  validate({ query: bankAccountQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      let allowedBankAccountIds: string[] | null | undefined;
      if (!isAdminRequest(req) && req.user?.sub) {
        allowedBankAccountIds = await bankBoxRightsService.listViewableBankAccountIds(
          companyId,
          req.user.sub
        );
      }

      const [bankAccounts, settings] = await Promise.all([
        bankAccountService.getBankAccounts(companyId, {
          bankId: req.query.bankId as string | undefined,
          isActive: req.query.isActive as boolean | undefined,
          allowedBankAccountIds,
        }),
        companySettingsService.getCompanySettings(companyId).catch(() => null),
      ]);
      const digits = settings?.accountsGuideDigits ?? 0;

      return void res.json({
        status: 'success',
        data: bankAccounts.map((account) => ({
          ...account,
          glAccountCode: account.glAccount?.code
            ? digits > 0
              ? account.glAccount.code.padStart(digits, '0')
              : account.glAccount.code
            : null,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Error listing bank accounts');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list bank accounts',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/bank-accounts/:id
 * Get bank account by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'bank-account', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bankAccount = await bankAccountService.getBankAccountById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: bankAccount,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting bank account');
      const status =
        error instanceof Error && error.message === 'Bank account not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bank account',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/bank-accounts
 * Create bank account
 */
router.post(
  '/',
  authorize({ resource: 'bank-account', action: 'edit' }),
  validate({ body: createBankAccountSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bankAccount = await bankAccountService.createBankAccount(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Bank account created successfully',
        data: bankAccount,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating bank account');
      const status =
        error instanceof Error &&
        (error.message.includes('already exists') || error.message === 'Bank not found')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create bank account',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/bank-accounts/:id
 * Update bank account
 */
router.put(
  '/:id',
  authorize({ resource: 'bank-account', action: 'edit' }),
  validate({ body: updateBankAccountSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bankAccount = await bankAccountService.updateBankAccount(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Bank account updated successfully',
        data: bankAccount,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error updating bank account');
      const status =
        error instanceof Error && error.message === 'Bank account not found'
          ? 404
          : error instanceof Error && error.message.includes('already exists')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update bank account',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/bank-accounts/:id
 * Delete bank account
 */
router.delete(
  '/:id',
  authorize({ resource: 'bank-account', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await bankAccountService.deleteBankAccount(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Bank account deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting bank account');
      const status =
        error instanceof Error && error.message === 'Bank account not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete bank account',
      });
    }
  }
);

export default router;

