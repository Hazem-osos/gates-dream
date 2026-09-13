import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { createBankSchema, updateBankSchema, bankQuerySchema } from '../schemas/bank.schema';
import { bankService } from '../services/bank.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

/**
 * GET /api/v1/accounting/banks
 * List banks
 */
router.get(
  '/',
  authorize({ resource: 'bank', action: 'view' }),
  validate({ query: bankQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const banks = await bankService.getBanks(companyId, {
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: banks,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing banks');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list banks',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/banks/:id
 * Get bank by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'bank', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bank = await bankService.getBankById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: bank,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting bank');
      const status = error instanceof Error && error.message === 'Bank not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get bank',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/banks
 * Create bank
 */
router.post(
  '/',
  authorize({ resource: 'bank', action: 'edit' }),
  validate({ body: createBankSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bank = await bankService.createBank(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Bank created successfully',
        data: bank,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating bank');
      const status =
        error instanceof Error && error.message.includes('already exists') ? 400 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create bank',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/banks/:id
 * Update bank
 */
router.put(
  '/:id',
  authorize({ resource: 'bank', action: 'edit' }),
  validate({ body: updateBankSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const bank = await bankService.updateBank(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'Bank updated successfully',
        data: bank,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error updating bank');
      const status =
        error instanceof Error && error.message === 'Bank not found'
          ? 404
          : error instanceof Error && error.message.includes('already exists')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update bank',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/banks/:id
 * Delete bank
 */
router.delete(
  '/:id',
  authorize({ resource: 'bank', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await bankService.deleteBank(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Bank deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting bank');
      const status =
        error instanceof Error &&
        (error.message === 'Bank not found' ||
          error.message.includes('active accounts'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete bank',
      });
    }
  }
);

export default router;

