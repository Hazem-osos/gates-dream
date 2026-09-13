import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createEmployeeAdvanceSchema,
  updateEmployeeAdvanceSchema,
  employeeAdvanceQuerySchema,
} from '../schemas/employee-advance.schema';
import { employeeAdvanceService } from '../services/employee-advance.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'employee-advance', action: 'view' }),
  validate({ query: employeeAdvanceQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await employeeAdvanceService.listEmployeeAdvances(
        companyId,
        {
          page: req.query.page as number | undefined,
          limit: req.query.limit as number | undefined,
          search: req.query.search as string | undefined,
          employeeId: req.query.employeeId as string | undefined,
          startDate: req.query.startDate as Date | undefined,
          endDate: req.query.endDate as Date | undefined,
        }
      );

      logger.info(
        { companyId, count: result.advances.length },
        'Employee advances listed'
      );

      return void res.json({
        status: 'success',
        data: result.advances,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing employee advances');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list employee advances',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'employee-advance', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const advance = await employeeAdvanceService.getEmployeeAdvanceById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: advance,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting employee advance');
      const status =
        error instanceof Error &&
        error.message === 'Employee advance not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get employee advance',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'employee-advance', action: 'edit' }),
  validate({ body: createEmployeeAdvanceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || 'system';
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const advance = await employeeAdvanceService.createEmployeeAdvance(
        companyId,
        userId,
        req.body
      );

      logger.info({ companyId, advanceId: advance.id }, 'Employee advance created');

      return void res.status(201).json({
        status: 'success',
        message: 'Employee advance created successfully',
        data: advance,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating employee advance');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create employee advance',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'employee-advance', action: 'edit' }),
  validate({ body: updateEmployeeAdvanceSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const advance = await employeeAdvanceService.updateEmployeeAdvance(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Employee advance updated successfully',
        data: advance,
      });
    } catch (error) {
      logger.error(
        { error, advanceId: req.params.id },
        'Error updating employee advance'
      );
      const status =
        error instanceof Error &&
        (error.message === 'Employee advance not found' ||
          error.message.includes('EmployeeAdvance model not found'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update employee advance',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'employee-advance', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await employeeAdvanceService.deleteEmployeeAdvance(
        companyId,
        req.params.id
      );

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, advanceId: req.params.id },
        'Error deleting employee advance'
      );
      const status =
        error instanceof Error &&
        (error.message === 'Employee advance not found' ||
          error.message.includes('EmployeeAdvance model not found'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete employee advance',
      });
    }
  }
);

export default router;
