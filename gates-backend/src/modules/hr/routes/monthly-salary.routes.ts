import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createMonthlySalarySchema,
  updateMonthlySalarySchema,
  monthlySalaryQuerySchema,
} from '../schemas/monthly-salary.schema';
import { monthlySalaryService } from '../services/monthly-salary.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'monthly-salary', action: 'view' }),
  validate({ query: monthlySalaryQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await monthlySalaryService.listMonthlySalaries(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        employeeId: req.query.employeeId as string | undefined,
        contractId: req.query.contractId as string | undefined,
        periodYear: req.query.periodYear as string | undefined,
        periodMonth: req.query.periodMonth as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        search: req.query.search as string | undefined,
      });

      logger.info(
        { companyId, count: result.salaries.length },
        'Monthly salaries listed'
      );

      return void res.json({
        status: 'success',
        data: result.salaries,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing monthly salaries');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list monthly salaries',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'monthly-salary', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const salary = await monthlySalaryService.getMonthlySalaryById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: salary,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting monthly salary');
      const status =
        error instanceof Error &&
        error.message === 'Monthly salary not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get monthly salary',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'monthly-salary', action: 'edit' }),
  validate({ body: createMonthlySalarySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        date:
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date,
      };

      const salary = await monthlySalaryService.createMonthlySalary(companyId, data);

      logger.info({ companyId, salaryId: salary.id }, 'Monthly salary created');

      return void res.status(201).json({
        status: 'success',
        message: 'Monthly salary created successfully',
        data: salary,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating monthly salary');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create monthly salary',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'monthly-salary', action: 'edit' }),
  validate({ body: updateMonthlySalarySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        date:
          req.body.date && typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date,
      };

      const salary = await monthlySalaryService.updateMonthlySalary(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Monthly salary updated successfully',
        data: salary,
      });
    } catch (error) {
      logger.error(
        { error, salaryId: req.params.id },
        'Error updating monthly salary'
      );
      const status =
        error instanceof Error &&
        (error.message === 'Monthly salary not found' ||
          error.message.includes('MonthlySalary model not found'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update monthly salary',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'monthly-salary', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await monthlySalaryService.deleteMonthlySalary(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, salaryId: req.params.id },
        'Error deleting monthly salary'
      );
      const status =
        error instanceof Error &&
        (error.message === 'Monthly salary not found' ||
          error.message.includes('MonthlySalary model not found'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete monthly salary',
      });
    }
  }
);

export default router;

