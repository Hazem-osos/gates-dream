import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createCompanySchema,
  updateCompanySchema,
  companyQuerySchema,
} from '../schemas/company.schema';
import { companyService } from '../services/company.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import companySettingsRoutes from './company-settings.routes';
import { copyCompanyDataSchema } from '../schemas/company-copy.schema';
import { companyCopyService } from '../services/company-copy.service';
import branchRoutes from './branch.routes';
import branchPermissionsRoutes from './branch-permissions.routes';

const router = Router();

// Note: Company management typically requires admin privileges
// Some endpoints might not need tenant context since companies are top-level entities
router.use(authenticate);

/**
 * GET /api/v1/companies
 * List companies with pagination and filters.
 *
 * SECURITY: previously returned every tenant's company row to any authenticated user
 * with `company:view` — a routine permission for ordinary company admins configuring
 * their own settings, not a platform-admin-only one. Scoped to the caller's own company
 * (`req.companyId`) so this behaves like the single-row "my company" lookup the frontend
 * (`useFirstCompany`) already assumes it is.
 */
router.get(
  '/',
  authorize({ resource: 'company', action: 'view' }),
  validate({ query: companyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const result = await companyService.listCompanies({
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
        callerCompanyId: req.companyId,
      });

      logger.info({ count: result.companies.length }, 'Companies listed');

      return void res.json({
        status: 'success',
        data: result.companies,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing companies');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list companies',
      });
    }
  }
);

/**
 * GET /api/v1/companies/:id
 * Get company by ID.
 *
 * SECURITY: `:id` is caller-supplied — without this check any authenticated user could
 * read (and, on the sibling PUT/DELETE/restore routes, mutate) any other tenant's company
 * record by guessing/enumerating its UUID.
 */
router.get(
  '/:id',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.companyId !== req.params.id) {
        throw new AppError(403, 'You may only access your own company');
      }
      const company = await companyService.getCompanyById(req.params.id);

      return void res.json({
        status: 'success',
        data: company,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting company');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get company',
      });
    }
  }
);

/**
 * POST /api/v1/companies
 * Create a new company
 */
router.post(
  '/',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: createCompanySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const company = await companyService.createCompany(req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Company created successfully',
        data: company,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating company');
      const status =
        error instanceof Error &&
        error.message.includes('already exists')
          ? 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create company',
      });
    }
  }
);

/**
 * PUT /api/v1/companies/:id
 * Update company
 */
router.put(
  '/:id',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: updateCompanySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.companyId !== req.params.id) {
        throw new AppError(403, 'You may only update your own company');
      }
      const company = await companyService.updateCompany(
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Company updated successfully',
        data: company,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating company');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
          (error.message === 'Company not found' ||
            error.message.includes('already exists'))
          ? error.message === 'Company not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update company',
      });
    }
  }
);

/**
 * DELETE /api/v1/companies/:id
 * Delete company (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'company', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.companyId !== req.params.id) {
        throw new AppError(403, 'You may only delete your own company');
      }
      await companyService.deleteCompany(req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting company');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete company',
      });
    }
  }
);

/**
 * PATCH /api/v1/companies/:id/restore
 * Restore company (set isActive to true)
 */
router.patch(
  '/:id/restore',
  authorize({ resource: 'company', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      if (req.companyId !== req.params.id) {
        throw new AppError(403, 'You may only restore your own company');
      }
      const company = await companyService.restoreCompany(req.params.id);

      return void res.json({
        status: 'success',
        message: 'Company restored successfully',
        data: company,
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring company');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error && error.message === 'Company not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to restore company',
      });
    }
  }
);

/**
 * POST /api/v1/companies/:id/copy-data
 * Copy data from one company to another
 */
router.post(
  '/:id/copy-data',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: copyCompanyDataSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await companyCopyService.copyCompanyData(
        req.body.fromCompanyId,
        req.params.id, // toCompanyId
        {
          chartOfAccounts: req.body.chartOfAccounts,
          costCenters: req.body.costCenters,
          customers: req.body.customers,
          suppliers: req.body.suppliers,
          delegates: req.body.delegates,
          currencies: req.body.currencies,
          periods: req.body.periods,
          items: req.body.items,
          units: req.body.units,
          warehouses: req.body.warehouses,
          priceLists: req.body.priceLists,
          employees: req.body.employees,
          lookupTables: req.body.lookupTables,
        },
        req.companyId! // caller's own tenant — must match toCompanyId, enforced in the service
      );

      logger.info(
        {
          fromCompanyId: req.body.fromCompanyId,
          toCompanyId: req.params.id,
          result,
        },
        'Company data copy completed'
      );

      return void res.json({
        status: 'success',
        message: 'Company data copied successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error copying company data');
      const status =
        error instanceof AppError
          ? error.statusCode
          : error instanceof Error &&
            (error.message === 'Source company not found' ||
              error.message === 'Target company not found' ||
              error.message === 'Source and target companies cannot be the same')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to copy company data',
      });
    }
  }
);

// Mount company settings routes
router.use('/', companySettingsRoutes);

// Mount branch routes
router.use('/', branchRoutes);

// Mount branch permissions routes
router.use('/', branchPermissionsRoutes);

export default router;

