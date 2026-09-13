import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createEmployeeContractSchema,
  updateEmployeeContractSchema,
  employeeContractQuerySchema,
} from '../schemas/employee-contract.schema';
import { employeeContractService } from '../services/employee-contract.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'employee-contract', action: 'view' }),
  validate({ query: employeeContractQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await employeeContractService.listEmployeeContracts(
        companyId,
        {
          page: req.query.page as number | undefined,
          limit: req.query.limit as number | undefined,
          search: req.query.search as string | undefined,
          employeeId: req.query.employeeId as string | undefined,
          departmentId: req.query.departmentId as string | undefined,
          jobTitleId: req.query.jobTitleId as string | undefined,
          isActive: req.query.isActive as boolean | undefined,
          startDate: req.query.startDate as Date | undefined,
          endDate: req.query.endDate as Date | undefined,
        }
      );

      logger.info(
        { companyId, count: result.contracts.length },
        'Employee contracts listed'
      );

      return void res.json({
        status: 'success',
        data: result.contracts,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing employee contracts');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list employee contracts',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'employee-contract', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contract = await employeeContractService.getEmployeeContractById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: contract,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting employee contract');
      const status =
        error instanceof Error &&
        error.message === 'Employee contract not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get employee contract',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'employee-contract', action: 'edit' }),
  validate({ body: createEmployeeContractSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contract = await employeeContractService.createEmployeeContract(
        companyId,
        req.body
      );

      logger.info({ companyId, contractId: contract.id }, 'Employee contract created');

      return void res.status(201).json({
        status: 'success',
        message: 'Employee contract created successfully',
        data: contract,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating employee contract');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to create employee contract',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'employee-contract', action: 'edit' }),
  validate({ body: updateEmployeeContractSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const contract = await employeeContractService.updateEmployeeContract(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Employee contract updated successfully',
        data: contract,
      });
    } catch (error) {
      logger.error(
        { error, contractId: req.params.id },
        'Error updating employee contract'
      );
      const status =
        error instanceof Error &&
        (error.message === 'Employee contract not found' ||
          error.message === 'Contract start date must be before end date')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update employee contract',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'employee-contract', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await employeeContractService.deleteEmployeeContract(
        companyId,
        req.params.id
      );

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, contractId: req.params.id },
        'Error deleting employee contract'
      );
      const status =
        error instanceof Error &&
        error.message === 'Employee contract not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to delete employee contract',
      });
    }
  }
);

export default router;
