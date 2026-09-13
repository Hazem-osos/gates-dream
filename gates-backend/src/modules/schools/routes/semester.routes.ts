import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createSemesterSchema,
  updateSemesterSchema,
  semesterQuerySchema,
} from '../schemas/semester.schema';
import { semesterService } from '../services/semester.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'semester', action: 'view' }),
  validate({ query: semesterQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await semesterService.listSemesters(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        isActive: req.query.isActive as boolean | undefined,
      });

      logger.info(
        { companyId, count: result.semesters.length },
        'Semesters listed'
      );

      return void res.json({
        status: 'success',
        data: result.semesters,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing semesters');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list semesters',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'semester', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const semester = await semesterService.getSemesterById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: semester,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting semester');
      const status =
        error instanceof Error && error.message === 'Semester not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get semester',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'semester', action: 'edit' }),
  validate({ body: createSemesterSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const semester = await semesterService.createSemester(companyId, req.body);

      logger.info({ companyId, semesterId: semester.id }, 'Semester created');

      return void res.status(201).json({
        status: 'success',
        message: 'Semester created successfully',
        data: semester,
      });
    } catch (error) {
      logger.error({ error, body: req.body }, 'Error creating semester');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create semester',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'semester', action: 'edit' }),
  validate({ body: updateSemesterSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const semester = await semesterService.updateSemester(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Semester updated successfully',
        data: semester,
      });
    } catch (error) {
      logger.error(
        { error, semesterId: req.params.id },
        'Error updating semester'
      );
      const status =
        error instanceof Error && error.message === 'Semester not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update semester',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'semester', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await semesterService.deleteSemester(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error(
        { error, semesterId: req.params.id },
        'Error deleting semester'
      );
      const status =
        error instanceof Error && error.message === 'Semester not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete semester',
      });
    }
  }
);

export default router;
