import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { approvalWorkflowService } from '../services/approval-workflow.service';
import {
  approvalActionSchema,
  approvalEntityQuerySchema,
  approvalRejectSchema,
} from '../schemas/approval.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function ctx(req: AuthRequest) {
  const companyId = req.companyId ?? req.tenantId;
  const userId = req.user?.sub;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  if (!userId) throw new AppError(401, 'User context is required');
  return { companyId, userId };
}

router.get(
  '/state',
  authorize({ resource: 'report', action: 'view' }),
  validate({ query: approvalEntityQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId } = ctx(req);
      const q = req.query as unknown as { entityType: 'INVOICE' | 'JOURNAL_ENTRY' | 'STOCK_MOVEMENT'; entityId: string };
      const data = await approvalWorkflowService.evaluateEntity(companyId, q.entityType, q.entityId);
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to evaluate approval state',
      });
    }
  }
);

router.post(
  '/submit',
  authorize({ resource: 'journal', action: 'edit' }),
  validate({ body: approvalActionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId, userId } = ctx(req);
      const data = await approvalWorkflowService.submit(
        companyId,
        req.body.entityType,
        req.body.entityId,
        userId
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Submit for approval failed',
      });
    }
  }
);

router.post(
  '/approve',
  authorize({ resource: 'journal', action: 'approve' }),
  validate({ body: approvalActionSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId, userId } = ctx(req);
      const data = await approvalWorkflowService.approve(
        companyId,
        req.body.entityType,
        req.body.entityId,
        userId,
        req.body.note
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Approval failed',
      });
    }
  }
);

router.post(
  '/reject',
  authorize({ resource: 'journal', action: 'approve' }),
  validate({ body: approvalRejectSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { companyId, userId } = ctx(req);
      const data = await approvalWorkflowService.reject(
        companyId,
        req.body.entityType,
        req.body.entityId,
        userId,
        req.body.reason
      );
      return void res.json({ status: 'success', data });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Rejection failed',
      });
    }
  }
);

export default router;
