import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPriceQuoteSchema,
  priceQuoteQuerySchema,
} from '../schemas/price-quote.schema';
import { priceQuoteService } from '../services/price-quote.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/price-quotes
 * Create price quote
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createPriceQuoteSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceQuote = await priceQuoteService.createPriceQuote(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        quoteNumber: req.body.quoteNumber,
        date: req.body.date,
        customerId: req.body.customerId,
        warehouseId: req.body.warehouseId || undefined,
        currencyId: req.body.currencyId || undefined,
        exchangeRate: req.body.exchangeRate,
        paymentMethod: req.body.paymentMethod,
        isSalesTaxInvoice: req.body.isSalesTaxInvoice,
        delegateId: req.body.delegateId || undefined,
        costCenterId: req.body.costCenterId || undefined,
        conditions: req.body.conditions,
        validUntil: req.body.validUntil,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, priceQuoteId: priceQuote.id },
        'Price quote created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Price quote created successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating price quote');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create price quote',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/price-quotes
 * List price quotes
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: priceQuoteQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await priceQuoteService.listPriceQuotes(companyId, {
        branchId: req.query.branchId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
        isConverted: req.query.isConverted as boolean | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        skip: req.query.skip as number | undefined,
        take: req.query.take as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.data,
        pagination: {
          total: result.total,
          skip: result.skip,
          take: result.take,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing price quotes');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list price quotes',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/price-quotes/:id
 * Get price quote by ID
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

      const priceQuote = await priceQuoteService.getPriceQuoteById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting price quote');
      const status =
        error instanceof Error && error.message === 'Price quote not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/post
 * Post price quote
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceQuote = await priceQuoteService.postPriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote posted');

      return void res.json({
        status: 'success',
        message: 'Price quote posted successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/unpost
 * Unpost price quote
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceQuote = await priceQuoteService.unpostPriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote unposted');

      return void res.json({
        status: 'success',
        message: 'Price quote unposted successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('not posted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/approve
 * Approve price quote
 */
router.post(
  '/:id/approve',
  authorize({ resource: 'invoice', action: 'approve' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceQuote = await priceQuoteService.approvePriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote approved');

      return void res.json({
        status: 'success',
        message: 'Price quote approved successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error approving price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to approve price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/unapprove
 * Unapprove price quote
 */
router.post(
  '/:id/unapprove',
  authorize({ resource: 'invoice', action: 'approve' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const priceQuote = await priceQuoteService.unapprovePriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote unapproved');

      return void res.json({
        status: 'success',
        message: 'Price quote unapproved successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error unapproving price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('not approved'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unapprove price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/cancel
 * Cancel price quote
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

      const priceQuote = await priceQuoteService.cancelPriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote cancelled');

      return void res.json({
        status: 'success',
        message: 'Price quote cancelled successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/restore
 * Restore cancelled price quote
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

      const priceQuote = await priceQuoteService.restorePriceQuote(
        companyId,
        req.params.id
      );

      logger.info({ companyId, priceQuoteId: req.params.id }, 'Price quote restored');

      return void res.json({
        status: 'success',
        message: 'Price quote restored successfully',
        data: priceQuote,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring price quote');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore price quote',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/price-quotes/:id/convert-to-invoice
 * Convert price quote to sales invoice
 */
router.post(
  '/:id/convert-to-invoice',
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

      const invoice = await priceQuoteService.convertToInvoice(
        companyId,
        req.params.id
      );

      logger.info(
        { companyId, priceQuoteId: req.params.id, invoiceId: invoice.id },
        'Price quote converted to invoice'
      );

      return void res.json({
        status: 'success',
        message: 'Price quote converted to invoice successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error converting price quote to invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Price quote not found' ||
          error.message.includes('Cannot') ||
          error.message.includes('already converted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to convert price quote to invoice',
      });
    }
  }
);

export default router;

