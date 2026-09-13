import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createContractorAssignmentSchema,
  updateContractorAssignmentSchema,
  contractorAssignmentQuerySchema,
} from '../schemas/contractor-assignment.schema';
import { contractorAssignmentService } from '../services/contractor-assignment.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'contractor-assignment', action: 'view' }),
  validate({ query: contractorAssignmentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await contractorAssignmentService.listAssignments(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        contractorId: req.query.contractorId as string | undefined,
        workItemId: req.query.workItemId as string | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.assignments,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing contractor assignments');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list contractor assignments',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'contractor-assignment', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const assignment = await contractorAssignmentService.getAssignmentById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: assignment,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting contractor assignment');
      const status =
        error instanceof Error && error.message === 'Contractor assignment not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get contractor assignment',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'contractor-assignment', action: 'edit' }),
  validate({ body: createContractorAssignmentSchema }),
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
        assignmentDate:
          req.body.assignmentDate && typeof req.body.assignmentDate === 'string'
            ? new Date(req.body.assignmentDate)
            : req.body.assignmentDate,
      };

      const assignment = await contractorAssignmentService.createAssignment(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Contractor assignment created successfully',
        data: assignment,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating contractor assignment');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create contractor assignment',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'contractor-assignment', action: 'edit' }),
  validate({ body: updateContractorAssignmentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data: any = { ...req.body };
      if (data.assignmentDate && typeof data.assignmentDate === 'string') {
        data.assignmentDate = new Date(data.assignmentDate);
      }

      const assignment = await contractorAssignmentService.updateAssignment(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Contractor assignment updated successfully',
        data: assignment,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating contractor assignment');
      const status =
        error instanceof Error && error.message === 'Contractor assignment not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update contractor assignment',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'contractor-assignment', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await contractorAssignmentService.deleteAssignment(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting contractor assignment');
      const status =
        error instanceof Error && error.message === 'Contractor assignment not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete contractor assignment',
      });
    }
  }
);

export default router;

