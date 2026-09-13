import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentQuerySchema,
} from '../schemas/department.schema';
import { departmentService } from '../services/department.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'department', action: 'view' }),
  validate({ query: departmentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await departmentService.listDepartments(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        managementId: req.query.managementId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.departments.length },
        'Departments listed'
      );

      return void res.json({
        status: 'success',
        data: result.departments,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing departments');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list departments',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'department', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const department = await departmentService.getDepartmentById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: department,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting department');
      const status =
        error instanceof Error && error.message === 'Department not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get department',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'department', action: 'edit' }),
  validate({ body: createDepartmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const department = await departmentService.createDepartment(
        companyId,
        req.body
      );

      logger.info({ companyId, departmentId: department.id }, 'Department created');

      return void res.status(201).json({
        status: 'success',
        message: 'Department created successfully',
        data: department,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating department');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create department',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'department', action: 'edit' }),
  validate({ body: updateDepartmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const department = await departmentService.updateDepartment(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Department updated successfully',
        data: department,
      });
    } catch (error) {
      logger.error({ error, departmentId: req.params.id }, 'Error updating department');
      const status =
        error instanceof Error &&
        (error.message === 'Department not found' ||
          error.message === 'Management department not found' ||
          error.message === 'Department cannot be its own management')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update department',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'department', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await departmentService.deleteDepartment(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error, departmentId: req.params.id }, 'Error deleting department');
      const status =
        error instanceof Error && error.message === 'Department not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete department',
      });
    }
  }
);

export default router;
