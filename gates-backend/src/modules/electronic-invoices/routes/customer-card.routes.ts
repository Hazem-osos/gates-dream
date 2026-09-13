import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createElectronicInvoiceCustomerSchema,
  updateElectronicInvoiceCustomerSchema,
  electronicInvoiceCustomerQuerySchema,
} from '../schemas/customer-card.schema';
import { electronicInvoiceCustomerService } from '../services/customer-card.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  validate({ query: electronicInvoiceCustomerQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await electronicInvoiceCustomerService.listCustomers(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.customers,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing electronic invoice customers');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list electronic invoice customers',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await electronicInvoiceCustomerService.getCustomerById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting electronic invoice customer');
      const status =
        error instanceof Error && error.message === 'Electronic invoice customer not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get electronic invoice customer',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: createElectronicInvoiceCustomerSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await electronicInvoiceCustomerService.createCustomer(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Electronic invoice customer created successfully',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating electronic invoice customer');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create electronic invoice customer',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: updateElectronicInvoiceCustomerSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await electronicInvoiceCustomerService.updateCustomer(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Electronic invoice customer updated successfully',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating electronic invoice customer');
      const status =
        error instanceof Error && error.message === 'Electronic invoice customer not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update electronic invoice customer',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await electronicInvoiceCustomerService.deleteCustomer(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting electronic invoice customer');
      const status =
        error instanceof Error && error.message === 'Electronic invoice customer not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete electronic invoice customer',
      });
    }
  }
);

export default router;

