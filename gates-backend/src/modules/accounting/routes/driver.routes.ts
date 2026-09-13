import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { createDriverSchema, updateDriverSchema } from '../schemas/driver.schema';
import { driverService } from '../services/driver.service';
import { AuthRequest } from '../../../shared/auth/types';
import { z } from 'zod';

const driverQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'customer', action: 'view' }),
  validate({ query: driverQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    const result = await driverService.listDrivers(companyId, {
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
      search: req.query.search as string | undefined,
      isActive: req.query.isActive as boolean | undefined,
    });
    return void res.json({ status: 'success', data: result.drivers, pagination: result.pagination });
  }
);

router.get(
  '/:id',
  authorize({ resource: 'customer', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    try {
      const data = await driverService.getDriverById(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Driver not found' });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: createDriverSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    const data = await driverService.createDriver(companyId, req.body);
    return void res.status(201).json({ status: 'success', data });
  }
);

router.put(
  '/:id',
  authorize({ resource: 'customer', action: 'edit' }),
  validate({ body: updateDriverSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    try {
      const data = await driverService.updateDriver(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data });
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Driver not found' });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'customer', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
    }
    try {
      await driverService.deleteDriver(companyId, req.params.id);
      return void res.status(204).send();
    } catch {
      return void res.status(404).json({ status: 'error', message: 'Driver not found' });
    }
  }
);

export default router;
