import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} from '../schemas/supplier.schema';
import { supplierService } from '../services/supplier.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { traceAudit } from '../../../shared/middleware/trace-audit.middleware';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);
// Legacy `Save_Trace` equivalent — legacy menu item `mnsmSupplier`.
router.use(traceAudit('mnsmSupplier'));

/**
 * GET /api/v1/accounting/suppliers
 * List suppliers with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'supplier', action: 'view' }),
  validate({ query: supplierQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await supplierService.listSuppliers(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        supplierType: req.query.supplierType as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.suppliers.length },
        'Suppliers listed'
      );

      return void res.json({
        status: 'success',
        data: result.suppliers,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing suppliers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list suppliers',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/suppliers/:id
 * Get supplier by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'supplier', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const supplier = await supplierService.getSupplierById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: supplier,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting supplier');
      const status =
        error instanceof Error && error.message === 'Supplier not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get supplier',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/suppliers
 * Create supplier
 */
router.post(
  '/',
  authorize({ resource: 'supplier', action: 'edit' }),
  validate({ body: createSupplierSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const supplier = await supplierService.createSupplier(
        companyId,
        req.body
      );

      logger.info({ companyId, supplierId: supplier.id }, 'Supplier created');

      return void res.status(201).json({
        status: 'success',
        message: 'Supplier created successfully',
        data: supplier,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating supplier');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create supplier',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/suppliers/:id
 * Update supplier
 */
router.put(
  '/:id',
  authorize({ resource: 'supplier', action: 'edit' }),
  validate({ body: updateSupplierSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const supplier = await supplierService.updateSupplier(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Supplier updated successfully',
        data: supplier,
      });
    } catch (error) {
      logger.error({ error, supplierId: req.params.id }, 'Error updating supplier');
      const status =
        error instanceof Error && error.message === 'Supplier not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update supplier',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/suppliers/:id
 * Delete supplier (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'supplier', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await supplierService.deleteSupplier(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, supplierId: req.params.id }, 'Error deleting supplier');
      const status =
        error instanceof Error && error.message === 'Supplier not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete supplier',
      });
    }
  }
);

export default router;
