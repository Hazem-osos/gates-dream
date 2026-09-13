import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createEmployeeProcedureSchema,
  updateEmployeeProcedureSchema,
  employeeProcedureQuerySchema,
} from '../schemas/employee-procedure.schema';
import { employeeProcedureService } from '../services/employee-procedure.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'employee-procedure', action: 'view' }),
  validate({ query: employeeProcedureQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await employeeProcedureService.listEmployeeProcedures(
        companyId,
        {
          page: req.query.page as number | undefined,
          limit: req.query.limit as number | undefined,
          search: req.query.search as string | undefined,
          employeeId: req.query.employeeId as string | undefined,
          procedureType: req.query.procedureType as string | undefined,
          startDate: req.query.startDate as Date | undefined,
          endDate: req.query.endDate as Date | undefined,
        }
      );

      logger.info(
        { companyId, count: result.procedures.length },
        'Employee procedures listed'
      );

      return void res.json({
        status: 'success',
        data: result.procedures,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing employee procedures');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list employee procedures',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'employee-procedure', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const procedure = await employeeProcedureService.getEmployeeProcedureById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: procedure,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting employee procedure');
      const status =
        error instanceof Error &&
        error.message === 'Employee procedure not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get employee procedure',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'employee-procedure', action: 'edit' }),
  validate({ body: createEmployeeProcedureSchema }),
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

      const procedure = await employeeProcedureService.createEmployeeProcedure(
        companyId,
        {
          ...req.body,
          createdBy: userId,
        }
      );

      logger.info(
        { companyId, procedureId: procedure.id },
        'Employee procedure created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Employee procedure created successfully',
        data: procedure,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating employee procedure');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create employee procedure',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'employee-procedure', action: 'edit' }),
  validate({ body: updateEmployeeProcedureSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const procedure = await employeeProcedureService.updateEmployeeProcedure(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Employee procedure updated successfully',
        data: procedure,
      });
    } catch (error) {
      logger.error(
        { error, procedureId: req.params.id },
        'Error updating employee procedure'
      );
      const status =
        error instanceof Error &&
        error.message === 'Employee procedure not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update employee procedure',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'employee-procedure', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await employeeProcedureService.deleteEmployeeProcedure(
        companyId,
        req.params.id
      );

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, procedureId: req.params.id },
        'Error deleting employee procedure'
      );
      const status =
        error instanceof Error &&
        error.message === 'Employee procedure not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete employee procedure',
      });
    }
  }
);

export default router;
