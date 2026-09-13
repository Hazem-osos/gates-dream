import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createOtherAdditionDiscountTypeSchema,
  updateOtherAdditionDiscountTypeSchema,
  otherAdditionDiscountTypeQuerySchema,
} from '../schemas/other-addition-discount-type.schema';
import { otherAdditionDiscountTypeService } from '../services/other-addition-discount-type.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: otherAdditionDiscountTypeQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const result = await otherAdditionDiscountTypeService.listOtherAdditionDiscountTypes(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        type: req.query.type as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.types,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing other addition/discount types');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر عرض الإضافات والخصومات',
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

      const row = await otherAdditionDiscountTypeService.getOtherAdditionDiscountTypeById(
        companyId,
        req.params.id
      );
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Error getting other addition/discount type');
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
  validate({ body: createOtherAdditionDiscountTypeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const row = await otherAdditionDiscountTypeService.createOtherAdditionDiscountType(
        companyId,
        req.body
      );
      return void res.status(201).json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating other addition/discount type');
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
  validate({ body: updateOtherAdditionDiscountTypeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }

      const row = await otherAdditionDiscountTypeService.updateOtherAdditionDiscountType(
        companyId,
        req.params.id,
        req.body
      );
      return void res.json({ status: 'success', data: row });
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Error updating other addition/discount type');
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

      await otherAdditionDiscountTypeService.deleteOtherAdditionDiscountType(companyId, req.params.id);
      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, id: req.params.id }, 'Error deleting other addition/discount type');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'تعذر الحذف',
      });
    }
  }
);

export default router;
