import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createNationalitySchema,
  updateNationalitySchema,
  nationalityQuerySchema,
} from '../schemas/nationality.schema';
import { nationalityService } from '../services/nationality.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/hr/nationalities
 * List nationalities
 */
router.get(
  '/',
  authorize({ resource: 'nationality', action: 'view' }),
  validate({ query: nationalityQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await nationalityService.listNationalities(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.nationalities,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing nationalities');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list nationalities',
      });
    }
  }
);

/**
 * GET /api/v1/hr/nationalities/:id
 * Get nationality by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'nationality', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const nationality = await nationalityService.getNationalityById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: nationality,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting nationality');
      const status =
        error instanceof Error && error.message === 'Nationality not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get nationality',
      });
    }
  }
);

/**
 * POST /api/v1/hr/nationalities
 * Create nationality
 */
router.post(
  '/',
  authorize({ resource: 'nationality', action: 'edit' }),
  validate({ body: createNationalitySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const nationality = await nationalityService.createNationality(
        companyId,
        req.body
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Nationality created successfully',
        data: nationality,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating nationality');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create nationality',
      });
    }
  }
);

/**
 * PUT /api/v1/hr/nationalities/:id
 * Update nationality
 */
router.put(
  '/:id',
  authorize({ resource: 'nationality', action: 'edit' }),
  validate({ body: updateNationalitySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const nationality = await nationalityService.updateNationality(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Nationality updated successfully',
        data: nationality,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating nationality');
      const status =
        error instanceof Error && error.message === 'Nationality not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update nationality',
      });
    }
  }
);

/**
 * DELETE /api/v1/hr/nationalities/:id
 * Delete nationality
 */
router.delete(
  '/:id',
  authorize({ resource: 'nationality', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await nationalityService.deleteNationality(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting nationality');
      const status =
        error instanceof Error && error.message === 'Nationality not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete nationality',
      });
    }
  }
);

export default router;
