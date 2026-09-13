import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  bulkCreateCustomersSchema,
  bulkUpdateCustomersSchema,
  bulkDeleteCustomersSchema,
} from '../schemas/customer.schema';
import { customerService } from '../services/customer.service';
import { partyCreditService } from '../services/party-credit.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { exportData } from '../../../shared/utils/export.service';
import { getMasterCatalogEtag } from '../../../shared/services/master-catalog-version.service';
import { sendJsonWithEtag } from '../../../shared/http/master-data-etag';
import { traceAudit } from '../../../shared/middleware/trace-audit.middleware';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);
// Legacy `Save_Trace` equivalent — legacy menu item `mnsmCustomer` (`untUserDefinition.pas`-style Add/Edit/Delete on customer cards).
router.use(traceAudit('mnsmCustomer'));

/**
 * GET /api/v1/accounting/customers
 * List customers
 */
router.get(
  '/',
  authorize({ resource: 'customer', action: 'view' }),
  validate({ query: customerQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await customerService.listCustomers(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        customerType: req.query.customerType as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        accountId: req.query.accountId as string | undefined,
      });

      const etag = await getMasterCatalogEtag(companyId, 'customer');
      sendJsonWithEtag(req, res, etag, {
        status: 'success',
        data: result.customers,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing customers');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list customers',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/customers/:id/credit-check
 */
router.get(
  '/:id/credit-check',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      const additional = req.query.additionalAmount
        ? Number(req.query.additionalAmount)
        : 0;
      const data = await partyCreditService.checkCustomerCredit(
        companyId,
        req.params.id,
        additional
      );
      return void res.json({ status: 'success', data });
    } catch (error) {
      const status =
        error instanceof Error && error.message === 'Customer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Credit check failed',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/customers/:id
 * Get customer by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await customerService.getCustomerById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting customer');
      const status =
        error instanceof Error && error.message === 'Customer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get customer',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/customers
 * Create customer
 */
router.post(
  '/',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createCustomerSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await customerService.createCustomer(
        companyId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Customer created successfully',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating customer');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create customer',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/customers/:id
 * Update customer
 */
router.put(
  '/:id',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: updateCustomerSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const customer = await customerService.updateCustomer(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Customer updated successfully',
        data: customer,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating customer');
      const status =
        error instanceof Error && error.message === 'Customer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update customer',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/customers/:id
 * Delete customer
 */
router.delete(
  '/:id',
  authorize({ resource: 'customer', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await customerService.deleteCustomer(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting customer');
      const status =
        error instanceof Error && error.message === 'Customer not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete customer',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/customers/bulk
 * Bulk create customers
 */
router.post(
  '/bulk',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: bulkCreateCustomersSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await customerService.bulkCreateCustomers(companyId, req.body.items);

      return void res.status(201).json({
        status: 'success',
        message: `Bulk operation completed: ${result.successful.length} succeeded, ${result.failed.length} failed`,
        data: {
          successful: result.successful,
          failed: result.failed,
          total: result.total,
          successCount: result.successful.length,
          failureCount: result.failed.length,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error bulk creating customers');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to bulk create customers',
      });
    }
  }
);

/**
 * PUT /api/v1/accounting/customers/bulk
 * Bulk update customers
 */
router.put(
  '/bulk',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: bulkUpdateCustomersSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await customerService.bulkUpdateCustomers(companyId, req.body.items);

      return void res.json({
        status: 'success',
        message: `Bulk operation completed: ${result.successful.length} succeeded, ${result.failed.length} failed`,
        data: {
          successful: result.successful,
          failed: result.failed,
          total: result.total,
          successCount: result.successful.length,
          failureCount: result.failed.length,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error bulk updating customers');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to bulk update customers',
      });
    }
  }
);

/**
 * DELETE /api/v1/accounting/customers/bulk
 * Bulk delete customers
 */
router.delete(
  '/bulk',
  authorize({ resource: 'customer', action: 'delete' }),
  validate({ body: bulkDeleteCustomersSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await customerService.bulkDeleteCustomers(companyId, req.body.ids);

      return void res.json({
        status: 'success',
        message: `Bulk operation completed: ${result.successful.length} succeeded, ${result.failed.length} failed`,
        data: {
          successful: result.successful,
          failed: result.failed,
          total: result.total,
          successCount: result.successful.length,
          failureCount: result.failed.length,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error bulk deleting customers');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to bulk delete customers',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/customers/export
 * Export customers to CSV/Excel/PDF
 */
router.get(
  '/export',
  // Legacy `HiddenScreen.CanPrint`: producing a CSV/Excel/PDF of a screen's
  // rows is the legacy "print" right, distinct from viewing the screen.
  authorize({ resource: 'customer', action: 'print' }),
  validate({ query: customerQuerySchema.extend({
    format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
    columns: z.string().optional(), // Comma-separated column names
  }) }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Get all customers (no pagination for export)
      const result = await customerService.listCustomers(companyId, {
        page: 1,
        limit: 10000, // Large limit for export
        search: req.query.search as string | undefined,
        customerType: req.query.customerType as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      const format = (req.query.format as 'csv' | 'excel' | 'pdf') || 'csv';
      const columns = req.query.columns
        ? (req.query.columns as string).split(',').map((c) => c.trim())
        : undefined;

      // Map data to flat structure for export
      const exportDataArray = result.customers.map((customer) => ({
        id: customer.id,
        serial: customer.serial || '',
        code: customer.code || '',
        arabicName: customer.arabicName,
        englishName: customer.englishName || '',
        customerType: customer.customerType || '',
        phone1: customer.phone1 || '',
        phone2: customer.phone2 || '',
        mobile: customer.mobile || '',
        email: customer.email || '',
        city: customer.city || '',
        country: customer.country || '',
        balance: customer.balance?.toString() || '0',
        isActive: customer.isActive ? 'Yes' : 'No',
        createdAt: customer.createdAt.toISOString(),
      }));

      const headers: Record<string, string> = {
        id: 'ID',
        serial: 'Serial',
        code: 'Code',
        arabicName: 'Arabic Name',
        englishName: 'English Name',
        customerType: 'Type',
        phone1: 'Phone 1',
        phone2: 'Phone 2',
        mobile: 'Mobile',
        email: 'Email',
        city: 'City',
        country: 'Country',
        balance: 'Balance',
        isActive: 'Active',
        createdAt: 'Created At',
      };

      exportData(res, exportDataArray, {
        format,
        filename: `customers_export_${Date.now()}.${format === 'excel' ? 'csv' : format}`,
        columns,
        headers,
      });
    } catch (error) {
      logger.error({ error }, 'Error exporting customers');
      if (!res.headersSent) {
        return void res.status(500).json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to export customers',
        });
      }
    }
  }
);

export default router;
