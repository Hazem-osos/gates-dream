import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { geospatialService, NearbyPropertiesQuery } from '../services/geospatial.service';
import { realEstateUnitService } from '../services/real-estate-unit.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/real-estate/properties
 * List sellable units for reservation / booking screens (alias of units list).
 */
router.get(
  '/',
  authorize({ resource: 'property', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const units = await realEstateUnitService.listUnits(companyId, {
        status: (req.query.status as string) || undefined,
        limit: req.query.limit ? Number(req.query.limit) : 500,
      });

      const data = units.map((u) => ({
        id: u.id,
        propertyId: u.id,
        unitCode: u.unitCode,
        code: u.unitCode,
        arabicName: `${u.building.project.projectName} — ${u.building.name} — ${u.unitCode}`,
        englishName: u.unitCode,
        status: u.status,
        totalPrice: u.totalPrice,
        building: u.building,
      }));

      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'Error listing properties');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list properties',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/properties/nearby
 * Find properties within radius
 */
router.post(
  '/nearby',
  authorize({ resource: 'property', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { center, radius, limit } = req.body as NearbyPropertiesQuery;

      if (!center || !center.latitude || !center.longitude || !radius) {
        return void res.status(400).json({
          status: 'error',
          message: 'center (latitude, longitude) and radius are required',
        });
      }

      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const properties = await geospatialService.findNearbyProperties({
        center,
        radius,
        limit,
        companyId,
      });

      logger.info(
        {
          center,
          radius,
          count: properties.length,
          companyId: req.companyId,
        },
        'Nearby properties found'
      );

      return void res.json({
        status: 'success',
        data: properties,
        count: properties.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error finding nearby properties');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to find nearby properties',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/properties/bounds
 * Find properties within bounding box
 */
router.post(
  '/bounds',
  authorize({ resource: 'property', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { northEast, southWest } = req.body;

      if (!northEast || !southWest) {
        return void res.status(400).json({
          status: 'error',
          message: 'northEast and southWest coordinates are required',
        });
      }

      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const properties = await geospatialService.findPropertiesInBounds(
        northEast,
        southWest,
        companyId
      );

      return void res.json({
        status: 'success',
        data: properties,
        count: properties.length,
      });
    } catch (error) {
      logger.error({ error }, 'Error finding properties in bounds');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to find properties in bounds',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/properties/distance
 * Calculate distance between two points
 */
router.post(
  '/distance',
  authorize({ resource: 'property', action: 'view' }),
  async (req: Request, res: Response) => {
    try {
      const { point1, point2 } = req.body;

      if (!point1 || !point2) {
        return void res.status(400).json({
          status: 'error',
          message: 'point1 and point2 are required',
        });
      }

      const distance = await geospatialService.calculateDistance(point1, point2);

      return void res.json({
        status: 'success',
        distance, // in meters
        distanceKm: distance / 1000,
      });
    } catch (error) {
      logger.error({ error }, 'Error calculating distance');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to calculate distance',
      });
    }
  }
);

/**
 * GET /api/v1/real-estate/properties/geospatial-status
 * Check geospatial support availability
 */
router.get(
  '/geospatial-status',
  authorize({ resource: 'property', action: 'view' }),
  async (_req: Request, res: Response) => {
    try {
      const isAvailable = await geospatialService.checkGeospatialSupport();

      return void res.json({
        status: 'success',
        geospatialAvailable: isAvailable,
        method: 'Haversine formula (MySQL-compatible)',
        message: isAvailable
          ? 'Geospatial queries are available using Haversine formula'
          : 'Geospatial queries not available',
      });
    } catch (error) {
      logger.error({ error }, 'Error checking geospatial status');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to check geospatial status',
      });
    }
  }
);

export default router;
