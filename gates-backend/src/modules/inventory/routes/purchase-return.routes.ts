import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createPurchaseReturnSchema,
  purchaseReturnQuerySchema,
} from '../schemas/purchase-return.schema';
import { purchaseReturnService } from '../services/purchase-return.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/inventory/purchase-returns
 * Create purchase return
 */
router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  validate({ body: createPurchaseReturnSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const purchaseReturn = await purchaseReturnService.createPurchaseReturn(companyId, {
        companyId,
        branchId: req.body.branchId || req.branchId || undefined,
        description: req.body.description,
        serial: req.body.serial,
        returnNumber: req.body.returnNumber,
        date: req.body.date,
        originalInvoiceId: req.body.originalInvoiceId,
        supplierId: req.body.supplierId,
        warehouseId: req.body.warehouseId,
        currencyId: req.body.currencyId || undefined,
        exchangeRate: req.body.exchangeRate,
        paymentMethod: req.body.paymentMethod,
        costCenterId: req.body.costCenterId || undefined,
        delegateId: req.body.delegateId || undefined,
        lines: req.body.lines,
      });

      logger.info(
        { companyId, purchaseReturnId: purchaseReturn.id },
        'Purchase return created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Purchase return created successfully',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating purchase return');
      const status =
        error instanceof Error &&
        (error.message.includes('not found') ||
          error.message.includes('do not belong') ||
          error.message.includes('Insufficient'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create purchase return',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/purchase-returns
 * List purchase returns
 */
router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  validate({ query: purchaseReturnQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await purchaseReturnService.listPurchaseReturns(companyId, {
        branchId: req.query.branchId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
        originalInvoiceId: req.query.originalInvoiceId as string | undefined,
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
      logger.error({ error }, 'Error listing purchase returns');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list purchase returns',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/purchase-returns/:id
 * Get purchase return by ID
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

      const purchaseReturn = await purchaseReturnService.getPurchaseReturnById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting purchase return');
      const status =
        error instanceof Error && error.message === 'Purchase return not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get purchase return',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/post
 * Retired: `purchaseReturnService.postPurchaseReturn` moved inventory
 * quantity and `Supplier.balance` without ever writing a `JournalEntry` —
 * a direct double-entry bypass that left Inventory and AP overstated in
 * the GL. The frontend never called this legacy route; purchase returns
 * are created and posted through `POST /api/v1/invoices` with
 * `invoiceKind: 'PURCHASE_RETURN'`, which posts balanced GL via
 * `invoicePostingOrchestrator`. Retired rather than fixed in place to
 * avoid maintaining two parallel purchase-return posting paths.
 */
router.post(
  '/:id/post',
  authorize({ resource: 'invoice', action: 'post' }),
  (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        "Legacy purchase-return posting removed (no GL entries were written). Create/post the return via POST /api/v1/invoices with invoiceKind: 'PURCHASE_RETURN'.",
    });
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/unpost
 * Retired alongside `:id/post` — see the note above.
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'invoice', action: 'post' }),
  (_req: AuthRequest, res: Response) => {
    return void res.status(410).json({
      status: 'error',
      message:
        "Legacy purchase-return unposting removed (no GL entries were written). Unpost the return via POST /api/v1/invoices/:id/unpost for the corresponding PURCHASE_RETURN invoice.",
    });
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/approve
 * Approve purchase return
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

      const purchaseReturn = await purchaseReturnService.approvePurchaseReturn(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseReturnId: req.params.id }, 'Purchase return approved');

      return void res.json({
        status: 'success',
        message: 'Purchase return approved successfully',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error approving purchase return');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase return not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to approve purchase return',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/unapprove
 * Unapprove purchase return
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

      const purchaseReturn = await purchaseReturnService.unapprovePurchaseReturn(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseReturnId: req.params.id }, 'Purchase return unapproved');

      return void res.json({
        status: 'success',
        message: 'Purchase return unapproved successfully',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error unapproving purchase return');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase return not found' ||
          error.message.includes('not approved'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to unapprove purchase return',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/cancel
 * Cancel purchase return
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

      const purchaseReturn = await purchaseReturnService.cancelPurchaseReturn(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseReturnId: req.params.id }, 'Purchase return cancelled');

      return void res.json({
        status: 'success',
        message: 'Purchase return cancelled successfully',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling purchase return');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase return not found' ||
          error.message.includes('already') ||
          error.message.includes('Cannot'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to cancel purchase return',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/purchase-returns/:id/restore
 * Restore cancelled purchase return
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

      const purchaseReturn = await purchaseReturnService.restorePurchaseReturn(
        companyId,
        req.params.id
      );

      logger.info({ companyId, purchaseReturnId: req.params.id }, 'Purchase return restored');

      return void res.json({
        status: 'success',
        message: 'Purchase return restored successfully',
        data: purchaseReturn,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring purchase return');
      const status =
        error instanceof Error &&
        (error.message === 'Purchase return not found' ||
          error.message.includes('not cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore purchase return',
      });
    }
  }
);

export default router;

