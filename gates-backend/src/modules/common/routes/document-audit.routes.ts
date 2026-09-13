import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { documentAuditService } from '../../accounting/services/document-audit.service';
import { documentAuditQuerySchema } from '../../accounting/schemas/approval.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/audit/logs?entityType=INVOICE&entityId=...
 * Document lifecycle audit trail (backed by activity_logs, kind=document-audit).
 */
router.get(
  '/logs',
  authorize({ resource: 'activity-log', action: 'view' }),
  validate({ query: documentAuditQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) throw new AppError(400, 'Company ID is required');

      const q = req.query as unknown as {
        entityType: 'INVOICE' | 'JOURNAL_ENTRY' | 'STOCK_MOVEMENT';
        entityId: string;
        page?: number;
        limit?: number;
      };

      const result = await documentAuditService.listForEntity(
        companyId,
        q.entityType,
        q.entityId,
        { page: q.page, limit: q.limit }
      );

      return void res.json({
        status: 'success',
        data: result.logs,
        pagination: result.pagination,
      });
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'Failed to load audit logs',
      });
    }
  }
);

export default router;
