import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createExtractPaymentSchema,
  extractPaymentQuerySchema,
} from '../schemas/extract-payment.schema';
import { extractPaymentService } from '../services/extract-payment.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/extracts/payments
 * List extract payments
 */
router.get(
  '/',
  authorize({ resource: 'extract', action: 'view' }),
  validate({ query: extractPaymentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await extractPaymentService.listExtractPayments(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        extractId: req.query.extractId as string | undefined,
        contractorId: req.query.contractorId as string | undefined,
        projectId: req.query.projectId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing extract payments');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list extract payments',
      });
    }
  }
);

/**
 * GET /api/v1/extracts/payments/:id
 * Get extract payment by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'extract', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const payment = await extractPaymentService.getExtractPaymentById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting extract payment');
      const status =
        error instanceof Error && error.message === 'Extract payment not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get extract payment',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/payments
 * Create extract payment
 */
router.post(
  '/',
  authorize({ resource: 'extract', action: 'edit' }),
  validate({ body: createExtractPaymentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        paymentDate:
          typeof req.body.paymentDate === 'string'
            ? new Date(req.body.paymentDate)
            : req.body.paymentDate,
        dueDate:
          req.body.dueDate && typeof req.body.dueDate === 'string'
            ? new Date(req.body.dueDate)
            : req.body.dueDate,
        checkDate:
          req.body.checkDate && typeof req.body.checkDate === 'string'
            ? new Date(req.body.checkDate)
            : req.body.checkDate,
      };

      const payment = await extractPaymentService.createExtractPayment(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Extract payment created successfully',
        data: payment,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating extract payment');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create extract payment',
      });
    }
  }
);

export default router;

