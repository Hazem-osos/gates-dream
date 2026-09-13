import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCommissionValueSchema,
  updateCommissionValueSchema,
  commissionValueQuerySchema,
} from '../schemas/representative-commission-value.schema';
import { representativeCommissionValueService } from '../services/representative-commission-value.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: commissionValueQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const result = await representativeCommissionValueService.list(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
      });
      return void res.json({
        status: 'success',
        data: result.rows,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing commission value policies');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر العرض',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await representativeCommissionValueService.getById(companyId, req.params.id);
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      return void res.status(404).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'غير موجود',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createCommissionValueSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await representativeCommissionValueService.create(companyId, req.body);
      return void res.status(201).json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating commission value policy');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحفظ',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateCommissionValueSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const row = await representativeCommissionValueService.update(
        companyId,
        req.params.id,
        req.body
      );
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Error updating commission value policy');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر التعديل',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      await representativeCommissionValueService.remove(companyId, req.params.id);
      return void res.status(204).send();
    } catch (error) {
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحذف',
      });
    }
  }
);

export default router;
