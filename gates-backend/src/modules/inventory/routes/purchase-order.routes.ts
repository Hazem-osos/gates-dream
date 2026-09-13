import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPurchaseOrderSchema,
  purchaseOrderQuerySchema,
} from '../schemas/purchase-order.schema';
import { purchaseOrderService } from '../services/purchase-order.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/purchase-orders
 * Create purchase order
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createPurchaseOrderSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const purchaseOrder = await purchaseOrderService.createPurchaseOrder(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        orderNumber: req.body.orderNumber,
        date: req.body.date,
        supplierId: req.body.supplierId,
        warehouseId: req.body.warehouseId || undefined,
        currencyId: req.body.currencyId || undefined,
        exchangeRate: req.body.exchangeRate,
        conditions: req.body.conditions,
        expectedDeliveryDate: req.body.expectedDeliveryDate,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, purchaseOrderId: purchaseOrder.id },
        'Purchase order created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Purchase order created successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating purchase order');
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
            : 'Failed to create purchase order',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/purchase-orders
 * List purchase orders
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: purchaseOrderQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await purchaseOrderService.listPurchaseOrders(companyId, {
        branchId: req.query.branchId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
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
      logger.error({ error }, 'Error listing purchase orders');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list purchase orders',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/purchase-orders/:id
 * Get purchase order by ID
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

      const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting purchase order');
      const status =
        error instanceof Error && error.message === 'Purchase order not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/post
 * Post purchase order
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

      const purchaseOrder = await purchaseOrderService.postPurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order posted');

      return void res.json({
        status: 'success',
        message: 'Purchase order posted successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to post purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/unpost
 * Unpost purchase order
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

      const purchaseOrder = await purchaseOrderService.unpostPurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order unposted');

      return void res.json({
        status: 'success',
        message: 'Purchase order unposted successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('not posted'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unpost purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/approve
 * Approve purchase order
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

      const purchaseOrder = await purchaseOrderService.approvePurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order approved');

      return void res.json({
        status: 'success',
        message: 'Purchase order approved successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error approving purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to approve purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/unapprove
 * Unapprove purchase order
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

      const purchaseOrder = await purchaseOrderService.unapprovePurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order unapproved');

      return void res.json({
        status: 'success',
        message: 'Purchase order unapproved successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error unapproving purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('not approved'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unapprove purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/cancel
 * Cancel purchase order
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

      const purchaseOrder = await purchaseOrderService.cancelPurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order cancelled');

      return void res.json({
        status: 'success',
        message: 'Purchase order cancelled successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('already'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/restore
 * Restore cancelled purchase order
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

      const purchaseOrder = await purchaseOrderService.restorePurchaseOrder(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseOrderId: req.params.id }, 'Purchase order restored');

      return void res.json({
        status: 'success',
        message: 'Purchase order restored successfully',
        data: purchaseOrder,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring purchase order');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore purchase order',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-orders/:id/convert-to-invoice
 * Convert purchase order to purchase invoice
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

      const invoice = await purchaseOrderService.convertToInvoice(
        companyId,
        req.params.id
      );

      logger.info(
        { companyId, purchaseOrderId: req.params.id, invoiceId: invoice?.id },
        'Purchase order converted to invoice'
      );

      return void res.json({
        status: 'success',
        message: 'Purchase order converted to invoice successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error converting purchase order to invoice');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase order not found' ||
          error.message.includes('Cannot') ||
          error.message.includes('must be approved'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to convert purchase order to invoice',
      });
    }
  }
);

export default router;

