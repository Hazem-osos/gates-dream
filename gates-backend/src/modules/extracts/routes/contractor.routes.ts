import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createContractorSchema,
  updateContractorSchema,
  contractorQuerySchema,
} from '../schemas/contractor.schema';
import {
  updateContractorSettingsSchema,
} from '../schemas/contractor-settings.schema';
import { contractorService } from '../services/contractor.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/extracts/contractors
 * List contractors
 */
router.get(
  '/',
  authorize({ resource: 'contractor', action: 'view' }),
  validate({ query: contractorQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await contractorService.listContractors(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.contractors,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing contractors');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list contractors',
      });
    }
  }
);

/**
 * GET /api/v1/extracts/contractors/:id
 * Get contractor by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'contractor', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contractor = await contractorService.getContractorById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: contractor,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting contractor');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get contractor',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/contractors
 * Create contractor
 */
router.post(
  '/',
  authorize({ resource: 'contractor', action: 'edit' }),
  validate({ body: createContractorSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contractor = await contractorService.createContractor(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Contractor created successfully',
        data: contractor,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating contractor');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create contractor',
      });
    }
  }
);

/**
 * PUT /api/v1/extracts/contractors/:id
 * Update contractor
 */
router.put(
  '/:id',
  authorize({ resource: 'contractor', action: 'edit' }),
  validate({ body: updateContractorSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contractor = await contractorService.updateContractor(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Contractor updated successfully',
        data: contractor,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating contractor');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update contractor',
      });
    }
  }
);

/**
 * DELETE /api/v1/extracts/contractors/:id
 * Delete contractor
 */
router.delete(
  '/:id',
  authorize({ resource: 'contractor', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await contractorService.deleteContractor(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting contractor');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete contractor',
      });
    }
  }
);

/**
 * GET /api/v1/extracts/contractors/:id/settings
 * Get contractor settings
 */
router.get(
  '/:id/settings',
  authorize({ resource: 'contractor', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await contractorService.getContractorSettings(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting contractor settings');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get contractor settings',
      });
    }
  }
);

/**
 * PUT /api/v1/extracts/contractors/:id/settings
 * Update contractor settings
 */
router.put(
  '/:id/settings',
  authorize({ resource: 'contractor', action: 'edit' }),
  validate({ body: updateContractorSettingsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const settings = await contractorService.updateContractorSettings(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Contractor settings updated successfully',
        data: settings,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating contractor settings');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update contractor settings',
      });
    }
  }
);

/**
 * DELETE /api/v1/extracts/contractors/:id/settings
 * Delete contractor settings
 */
router.delete(
  '/:id/settings',
  authorize({ resource: 'contractor', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await contractorService.deleteContractorSettings(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Contractor settings deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error deleting contractor settings');
      const status =
        error instanceof Error && error.message === 'Contractor not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete contractor settings',
      });
    }
  }
);

export default router;

