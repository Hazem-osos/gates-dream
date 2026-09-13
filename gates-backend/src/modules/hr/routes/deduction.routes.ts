import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDeductionSchema,
  updateDeductionSchema,
  deductionQuerySchema,
} from '../schemas/deduction.schema';
import { deductionService } from '../services/deduction.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'deduction', action: 'view' }),
  validate({ query: deductionQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await deductionService.listDeductions(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.deductions.length },
        'Deductions listed'
      );

      return void res.json({
        status: 'success',
        data: result.deductions,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing deductions');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list deductions',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'deduction', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const deduction = await deductionService.getDeductionById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: deduction,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting deduction');
      const status =
        error instanceof Error && error.message === 'Deduction not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get deduction',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'deduction', action: 'edit' }),
  validate({ body: createDeductionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const deduction = await deductionService.createDeduction(
        companyId,
        req.body
      );

      logger.info({ companyId, deductionId: deduction.id }, 'Deduction created');

      return void res.status(201).json({
        status: 'success',
        message: 'Deduction created successfully',
        data: deduction,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating deduction');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create deduction',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'deduction', action: 'edit' }),
  validate({ body: updateDeductionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const deduction = await deductionService.updateDeduction(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Deduction updated successfully',
        data: deduction,
      });
    } catch (error) {
      logger.error({ error, deductionId: req.params.id }, 'Error updating deduction');
      const status =
        error instanceof Error && error.message === 'Deduction not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update deduction',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'deduction', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await deductionService.deleteDeduction(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, deductionId: req.params.id }, 'Error deleting deduction');
      const status =
        error instanceof Error && error.message === 'Deduction not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete deduction',
      });
    }
  }
);

export default router;
