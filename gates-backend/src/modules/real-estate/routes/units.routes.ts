import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { realEstateUnitService } from '../services/real-estate-unit.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.post(
  '/projects',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.createProject(companyId, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر إنشاء المشروع',
      });
    }
  }
);

router.get(
  '/projects',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.listProjects(companyId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحميل المشاريع',
      });
    }
  }
);

router.get(
  '/projects/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.getProject(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحميل المشروع',
      });
    }
  }
);

router.put(
  '/projects/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.updateProject(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحديث المشروع',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.createUnit(companyId, req.body);
      return void res.status(201).json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر إنشاء الوحدة',
      });
    }
  }
);

router.get(
  '/',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.listUnits(companyId, {
        projectId: req.query.projectId as string | undefined,
        buildingId: req.query.buildingId as string | undefined,
        status: req.query.status as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحميل الوحدات',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.getUnit(companyId, req.params.id);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحميل الوحدة',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    }
    try {
      const data = await realEstateUnitService.updateUnit(companyId, req.params.id, req.body);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'تعذر تحديث الوحدة',
      });
    }
  }
);

export default router;
