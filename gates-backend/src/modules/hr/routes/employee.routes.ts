import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from '../schemas/employee.schema';
import { employeeService } from '../services/employee.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/hr/employees
 * List employees
 */
router.get(
  '/',
  authorize({ resource: 'employee', action: 'view' }),
  validate({ query: employeeQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await employeeService.listEmployees(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.employees,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing employees');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list employees',
      });
    }
  }
);

/**
 * GET /api/v1/hr/employees/:id
 * Get employee by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'employee', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const employee = await employeeService.getEmployeeById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: employee,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting employee');
      const status =
        error instanceof Error && error.message === 'Employee not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get employee',
      });
    }
  }
);

/**
 * POST /api/v1/hr/employees
 * Create employee
 */
router.post(
  '/',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: createEmployeeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert birthDate string to Date if provided
      const data = {
        ...req.body,
        birthDate: req.body.birthDate
          ? new Date(req.body.birthDate as string)
          : undefined,
        joinDate: req.body.joinDate
          ? new Date(req.body.joinDate as string)
          : undefined,
      };

      const employee = await employeeService.createEmployee(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Employee created successfully',
        data: employee,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating employee');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create employee',
      });
    }
  }
);

/**
 * PUT /api/v1/hr/employees/:id
 * Update employee
 */
router.put(
  '/:id',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: updateEmployeeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert birthDate string to Date if provided
      const data = {
        ...req.body,
        birthDate: req.body.birthDate
          ? new Date(req.body.birthDate as string)
          : undefined,
        joinDate: req.body.joinDate
          ? new Date(req.body.joinDate as string)
          : undefined,
      };

      const employee = await employeeService.updateEmployee(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Employee updated successfully',
        data: employee,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating employee');
      const status =
        error instanceof Error && error.message === 'Employee not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update employee',
      });
    }
  }
);

/**
 * DELETE /api/v1/hr/employees/:id
 * Delete employee
 */
router.delete(
  '/:id',
  authorize({ resource: 'employee', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await employeeService.deleteEmployee(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting employee');
      const status =
        error instanceof Error && error.message === 'Employee not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete employee',
      });
    }
  }
);

export default router;
