import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { buildInvoicePostingContext } from '../../invoices/services/invoice-posting-context';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceQuerySchema,
  collectPaymentSchema,
} from '../schemas/invoice.schema';
import { invoiceService } from '../services/invoice.service';
import { invoiceM5Service } from '../../invoices/services/invoice-m5.service';
import { legacyUpdateBodyToM5 } from '../../invoices/services/invoice-legacy-bridge.service';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/invoices
 * List invoices with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: invoiceQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await invoiceService.listInvoices(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        invoiceType: req.query.invoiceType as string | undefined,
        startDate:
          req.query.startDate instanceof Date
            ? req.query.startDate
            : req.query.startDate
              ? new Date(req.query.startDate as string)
              : undefined,
        endDate:
          req.query.endDate instanceof Date
            ? req.query.endDate
            : req.query.endDate
              ? new Date(req.query.endDate as string)
              : undefined,
        customerId: req.query.customerId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.invoices.length },
        'Invoices listed'
      );

      return void res.json({
        status: 'success',
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing invoices');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list invoices',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/invoices/:id
 * Get invoice by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.getInvoiceById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting invoice');
      const status =
        error instanceof Error && error.message === 'Invoice not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices
 * Create invoice
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createInvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date string to Date if provided
      const data = {
        ...req.body,
        date:
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date,
      };

      const invoice = await invoiceService.createInvoice(companyId, data);

      logger.info(
        { companyId, invoiceId: invoice!.id },
        'Invoice created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Invoice created successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating invoice');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create invoice',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/invoices/:id
 * Update invoice
 */
router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: updateInvoiceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date string to Date if provided
      const data: Record<string, unknown> = { ...req.body };
      if (req.body.date) {
        data.date =
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date;
      }

      const m5Body = legacyUpdateBodyToM5(data as Parameters<typeof legacyUpdateBodyToM5>[0]);
      const invoice = await invoiceM5Service.update(companyId, req.params.id, m5Body);

      return void res.json({
        status: 'success',
        message: 'Invoice updated successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error, invoiceId: req.params.id }, 'Error updating invoice');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
              (error.message === 'Invoice not found' ||
                error.message.includes('Cannot update') ||
                error.message.includes('Unpost') ||
                error.message.includes('Cancelled') ||
                error.message.includes('Negative stock') ||
                error.message.includes('credit'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/post
 * Post invoice (updates inventory quantities)
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  tenantAndFiscalContextMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const ctx = buildInvoicePostingContext(req);
      const invoice = await invoiceService.postInvoice(
        companyId,
        req.params.id,
        ctx
      );

      return void res.json({
        status: 'success',
        message: 'Invoice posted successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting invoice');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
              (error.message === 'Invoice not found' ||
                error.message.includes('already') ||
                error.message.includes('Cannot') ||
                error.message.includes('Insufficient') ||
                error.message.includes('credit'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to post invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/unpost
 * Unpost invoice (reverses inventory quantity changes)
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  tenantAndFiscalContextMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const ctx = buildInvoicePostingContext(req);
      const invoice = await invoiceService.unpostInvoice(
        companyId,
        req.params.id,
        ctx
      );

      return void res.json({
        status: 'success',
        message: 'Invoice unposted successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting invoice');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
              (error.message === 'Invoice not found' ||
                error.message.includes('not posted') ||
                error.message.includes('Cannot') ||
                error.message.includes('insufficient'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to unpost invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/approve
 * Approve invoice
 */
router.post(
  '/:id/approve',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.approveInvoice(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Invoice approved successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error approving invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Invoice not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot') ||
          error.message.includes('must be posted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to approve invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/unapprove
 * Unapprove invoice
 */
router.post(
  '/:id/unapprove',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.unapproveInvoice(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Invoice unapproved successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error unapproving invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Invoice not found' ||
          error.message.includes('not approved'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to unapprove invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/cancel
 * Cancel invoice
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.cancelInvoice(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Invoice cancelled successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Invoice not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to cancel invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/restore
 * Restore invoice (undo cancel)
 */
router.post(
  '/:id/restore',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.restoreInvoice(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Invoice restored successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Invoice not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to restore invoice',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/invoices/:id/payment
 * Collect payment for invoice
 */
router.post(
  '/:id/payment',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: collectPaymentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await invoiceService.collectPayment(
        companyId,
        req.params.id,
        req.body.paymentAmount
      );

      return void res.json({
        status: 'success',
        message: 'Payment collected successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error collecting payment');
      const status =
        error instanceof Error &&
        (error.message === 'Invoice not found' ||
          error.message.includes('must be posted') ||
          error.message.includes('Cannot') ||
          error.message.includes('exceeds'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to collect payment',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/invoices/:id
 * Delete invoice (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const hard = req.query.hard === 'true';
      if (hard) {
        await invoiceM5Service.remove(companyId, req.params.id);
      } else {
        await invoiceM5Service.cancel(companyId, req.params.id);
      }

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, invoiceId: req.params.id }, 'Error deleting invoice');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
              (error.message === 'Invoice not found' ||
                error.message.includes('Cannot delete') ||
                error.message.includes('Posted') ||
                error.message.includes('settlements'))
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete invoice',
      });
    }
  }
);

export default router;
