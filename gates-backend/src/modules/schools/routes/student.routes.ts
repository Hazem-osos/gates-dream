import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createStudentSchema,
  updateStudentSchema,
  studentQuerySchema,
  createInstallmentSchema,
  expensesRefundSchema,
} from '../schemas/student.schema';
import { studentService } from '../services/student.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/schools/students
 * List students
 */
router.get(
  '/',
  authorize({ resource: 'student', action: 'view' }),
  validate({ query: studentQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await studentService.listStudents(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        search: req.query.search as string | undefined,
        stageId: req.query.stageId as string | undefined,
        semesterId: req.query.semesterId as string | undefined,
        isFinished: req.query.isFinished as boolean | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.students,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing students');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list students',
      });
    }
  }
);

/**
 * GET /api/v1/schools/students/opening-balance
 * Get opening balance students (students with outstanding installments)
 */
router.get(
  '/opening-balance',
  authorize({ resource: 'student', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await studentService.getOpeningBalanceStudents(
        companyId,
        {
          page: req.query.page
            ? parseInt(req.query.page as string, 10)
            : undefined,
          limit: req.query.limit
            ? parseInt(req.query.limit as string, 10)
            : undefined,
          search: req.query.search as string | undefined,
          stageId: req.query.stageId as string | undefined,
          semesterId: req.query.semesterId as string | undefined,
          asOfDate: req.query.asOfDate
            ? new Date(req.query.asOfDate as string)
            : undefined,
        }
      );

      logger.info(
        { companyId, count: result.students.length },
        'Opening balance students retrieved'
      );

      return void res.json({
        status: 'success',
        data: result.students,
        pagination: result.pagination,
        summary: result.summary,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting opening balance students');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to get opening balance students',
      });
    }
  }
);

/**
 * GET /api/v1/schools/students/:id
 * Get student by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'student', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const student = await studentService.getStudentById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: student,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting student');
      const status =
        error instanceof Error && error.message === 'Student not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get student',
      });
    }
  }
);

/**
 * POST /api/v1/schools/students
 * Create student
 */
router.post(
  '/',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: createStudentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const student = await studentService.createStudent(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Student created successfully',
        data: student,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating student');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create student',
      });
    }
  }
);

/**
 * PUT /api/v1/schools/students/:id
 * Update student
 */
router.put(
  '/:id',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: updateStudentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const student = await studentService.updateStudent(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Student updated successfully',
        data: student,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating student');
      const status =
        error instanceof Error && error.message === 'Student not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update student',
      });
    }
  }
);

/**
 * DELETE /api/v1/schools/students/:id
 * Delete student
 */
router.delete(
  '/:id',
  authorize({ resource: 'student', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await studentService.deleteStudent(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting student');
      const status =
        error instanceof Error && error.message === 'Student not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete student',
      });
    }
  }
);

/**
 * POST /api/v1/schools/students/:id/installments
 * Add installment to student
 */
router.post(
  '/:id/installments',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: createInstallmentSchema }),
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

      const installment = await studentService.addInstallment(
        companyId,
        req.params.id,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Installment added successfully',
        data: installment,
      });
    } catch (error) {
      logger.error({ error }, 'Error adding installment');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add installment',
      });
    }
  }
);

/**
 * PATCH /api/v1/schools/students/:studentId/installments/:installmentId/pay
 * Mark installment as paid
 */
router.patch(
  '/:studentId/installments/:installmentId/pay',
  authorize({ resource: 'student', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const installment = await studentService.markInstallmentPaid(
        companyId,
        req.params.studentId,
        req.params.installmentId
      );

      return void res.json({
        status: 'success',
        message: 'Installment marked as paid',
        data: installment,
      });
    } catch (error) {
      logger.error({ error }, 'Error marking installment as paid');
      const status =
        error instanceof Error &&
        (error.message === 'Student not found' ||
          error.message === 'Installment not found')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to mark installment as paid',
      });
    }
  }
);

/**
 * POST /api/v1/schools/students/:id/transfer
 * Transfer student to different stage/semester
 */
router.post(
  '/:id/transfer',
  authorize({ resource: 'student', action: 'edit' }),
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
        stageId: req.body.stageId as string | undefined,
        semesterId: req.body.semesterId as string | undefined,
        transferDate: req.body.transferDate
          ? new Date(req.body.transferDate)
          : undefined,
        notes: req.body.notes as string | undefined,
      };

      const student = await studentService.transferStudent(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Student transferred successfully',
        data: student,
      });
    } catch (error) {
      logger.error({ error }, 'Error transferring student');
      const status =
        error instanceof Error &&
        (error.message === 'Student not found' ||
          error.message === 'Stage not found' ||
          error.message === 'Semester not found')
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to transfer student',
      });
    }
  }
);

/**
 * POST /api/v1/schools/students/:id/expenses-refund
 * Process expenses refund for a student
 */
router.post(
  '/:id/expenses-refund',
  authorize({ resource: 'student', action: 'edit' }),
  validate({ body: expensesRefundSchema }),
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

      const result = await studentService.expensesRefund(
        companyId,
        req.params.id,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Expenses refund processed successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error processing expenses refund');
      const status =
        error instanceof Error && error.message === 'Student not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to process expenses refund',
      });
    }
  }
);

export default router;
