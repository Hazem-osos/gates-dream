import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createLocationSchema,
  updateLocationSchema,
  locationQuerySchema,
} from '../schemas/location.schema';
import { locationService } from '../services/location.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/inventory/locations
 * List locations with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'location', action: 'view' }),
  validate({ query: locationQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await locationService.listLocations(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        warehouseId: req.query.warehouseId as string | undefined,
      });

      logger.info(
        { companyId, count: result.locations.length },
        'Locations listed'
      );

      return void res.json({
        status: 'success',
        data: result.locations,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing locations');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list locations',
      });
    }
  }
);

/**
 * GET /api/v1/inventory/locations/:id
 * Get location by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'location', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const location = await locationService.getLocationById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: location,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting location');
      const status =
        error instanceof Error && error.message === 'Location not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get location',
      });
    }
  }
);

/**
 * POST /api/v1/inventory/locations
 * Create location
 */
router.post(
  '/',
  authorize({ resource: 'location', action: 'edit' }),
  validate({ body: createLocationSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const location = await locationService.createLocation(
        companyId,
        req.body
      );

      logger.info({ companyId, locationId: location.id }, 'Location created');

      return void res.status(201).json({
        status: 'success',
        message: 'Location created successfully',
        data: location,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating location');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create location',
      });
    }
  }
);

/**
 * PUT /api/v1/inventory/locations/:id
 * Update location
 */
router.put(
  '/:id',
  authorize({ resource: 'location', action: 'edit' }),
  validate({ body: updateLocationSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const location = await locationService.updateLocation(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Location updated successfully',
        data: location,
      });
    } catch (error) {
      logger.error({ error, locationId: req.params.id }, 'Error updating location');
      const status =
        error instanceof Error && error.message === 'Location not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update location',
      });
    }
  }
);

/**
 * DELETE /api/v1/inventory/locations/:id
 * Delete location
 */
router.delete(
  '/:id',
  authorize({ resource: 'location', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await locationService.deleteLocation(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, locationId: req.params.id }, 'Error deleting location');
      const status =
        error instanceof Error && error.message === 'Location not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete location',
      });
    }
  }
);

export default router;
