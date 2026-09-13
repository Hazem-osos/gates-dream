import { Router, type Response } from 'express';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { asyncHandler } from '../../shared/middleware/async-handler';
import type { AuthRequest } from '../../shared/auth/types';
import { AppError } from '../../shared/middleware/error-handler';
import { logger } from '../../shared/logger';
import { assertOwnerOnly, tenantBackupService } from '../company/services/tenant-backup.service';

const router = Router();

router.get(
  '/backup/export',
  authorize({ resource: 'company', action: 'view' }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    assertOwnerOnly(req);
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      throw new AppError(400, 'Company context is required');
    }
    const exportedBy = req.user?.email || req.user?.username || req.user?.sub || 'unknown';
    try {
      const file = await tenantBackupService.exportPlainJson(companyId, exportedBy);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return void res.send(file.json);
    } catch (error) {
      logger.error({ err: error }, 'GET /tenant/backup/export failed');
      throw error;
    }
  })
);

export default router;
