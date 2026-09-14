import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCurrencySchema,
  updateCurrencySchema,
  currencyQuerySchema,
} from '../schemas/currency.schema';
import { currencyService } from '../services/currency.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';

const router = Router();

function sendError(res: Response, error: unknown, fallback: string) {
  const status = error instanceof AppError ? error.statusCode : 500;
  return void res.status(status).json({
    status: 'error',
    message: error instanceof Error ? error.message : fallback,
  });
}

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/accounting/currencies
 * List currencies with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'currency', action: 'view' }),
  validate({ query: currencyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await currencyService.listCurrencies(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.currencies.length },
        'Currencies listed'
      );

      return void res.json({
        status: 'success',
        data: result.currencies,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing currencies');
      const status =
        error instanceof Error && 'statusCode' in error
          ? Number((error as { statusCode: number }).statusCode) || 500
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تعذّر تحميل العملات',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/currencies/:id
 * Get currency by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'currency', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const currency = await currencyService.getCurrencyById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: currency,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting currency');
      const status =
        error instanceof Error && error.message === 'Currency not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get currency',
      });
    }
  }
);

/**
 * POST /api/v1/accounting/currencies
 * Create currency
 */
router.post(
  '/',
  authorize({ resource: 'currency', action: 'edit' }),
  validate({ body: createCurrencySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const currency = await currencyService.createCurrency(
        companyId,
        req.body
      );

      logger.info({ companyId, currencyId: currency.id }, 'Currency created');

      return void res.status(201).json({
        status: 'success',
        message: 'Currency created successfully',
        data: currency,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating currency');
      return sendError(res, error, 'تعذّر حفظ العملة');
    }
  }
);

/**
 * PUT /api/v1/accounting/currencies/:id
 * Update currency
 */
router.put(
  '/:id',
  authorize({ resource: 'currency', action: 'edit' }),
  validate({ body: updateCurrencySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const currency = await currencyService.updateCurrency(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Currency updated successfully',
        data: currency,
      });
    } catch (error) {
      logger.error({ error, currencyId: req.params.id }, 'Error updating currency');
      return sendError(res, error, 'تعذّر تحديث العملة');
    }
  }
);

/**
 * DELETE /api/v1/accounting/currencies/:id
 * Delete currency (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'currency', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await currencyService.deleteCurrency(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'تم حذف العملة',
      });
    } catch (error) {
      logger.error({ error, currencyId: req.params.id }, 'Error deleting currency');
      return sendError(res, error, 'تعذّر حذف العملة');
    }
  }
);

export default router;
