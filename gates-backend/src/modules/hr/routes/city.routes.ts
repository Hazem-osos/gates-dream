import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createCitySchema,
  updateCitySchema,
  cityQuerySchema,
} from '../schemas/city.schema';
import { cityService } from '../services/city.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'city', action: 'view' }),
  validate({ query: cityQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await cityService.listCities(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info({ companyId, count: result.cities.length }, 'Cities listed');

      return void res.json({
        status: 'success',
        data: result.cities,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing cities');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list cities',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'city', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const city = await cityService.getCityById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: city,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting city');
      const status =
        error instanceof Error && error.message === 'City not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get city',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'city', action: 'edit' }),
  validate({ body: createCitySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const city = await cityService.createCity(companyId, req.body);

      logger.info({ companyId, cityId: city.id }, 'City created');

      return void res.status(201).json({
        status: 'success',
        message: 'City created successfully',
        data: city,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating city');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create city',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'city', action: 'edit' }),
  validate({ body: updateCitySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const city = await cityService.updateCity(companyId, req.params.id, req.body);

      return void res.json({
        status: 'success',
        message: 'City updated successfully',
        data: city,
      });
    } catch (error) {
      logger.error({ error, cityId: req.params.id }, 'Error updating city');
      const status =
        error instanceof Error && error.message === 'City not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update city',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'city', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await cityService.deleteCity(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, cityId: req.params.id }, 'Error deleting city');
      const status =
        error instanceof Error && error.message === 'City not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete city',
      });
    }
  }
);

export default router;
