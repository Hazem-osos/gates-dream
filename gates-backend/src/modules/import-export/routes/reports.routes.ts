import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';
import { z } from 'zod';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

const reportQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  letterType: z.enum(['incoming', 'outgoing']).optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
});

/**
 * GET /api/v1/import-export/reports/guarantee-letters
 * Get guarantee letters report
 */
router.get(
  '/guarantee-letters',
  authorize({ resource: 'import-export-report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { fromDate, toDate, letterType, page = 1, limit = 100 } = req.query;

      const where: any = {
        companyId,
        deletedAt: null,
      };

      if (fromDate) {
        where.issueDate = { ...where.issueDate, gte: new Date(fromDate as string) };
      }

      if (toDate) {
        where.issueDate = { ...where.issueDate, lte: new Date(toDate as string) };
      }

      if (letterType) {
        where.letterType = letterType;
      }

      const skip = ((page as number) - 1) * (limit as number);

      const [letters, total] = await Promise.all([
        prisma.letterOfGuarantee.findMany({
          where,
          skip,
          take: limit as number,
          orderBy: { issueDate: 'desc' },
        }),
        prisma.letterOfGuarantee.count({ where }),
      ]);

      return void res.json({
        status: 'success',
        data: letters,
        pagination: {
          page: page as number,
          limit: limit as number,
          total,
          totalPages: Math.ceil(total / (limit as number)),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting guarantee letters report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get guarantee letters report',
      });
    }
  }
);

/**
 * GET /api/v1/import-export/reports/extended-guarantee-letters
 * Get extended guarantee letters report (renewed letters)
 */
router.get(
  '/extended-guarantee-letters',
  authorize({ resource: 'import-export-report', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { fromDate, toDate, page = 1, limit = 100 } = req.query;

      const where: any = {
        companyId,
        deletedAt: null,
        isRenewed: true,
      };

      if (fromDate) {
        where.renewedAt = { ...where.renewedAt, gte: new Date(fromDate as string) };
      }

      if (toDate) {
        where.renewedAt = { ...where.renewedAt, lte: new Date(toDate as string) };
      }

      const skip = ((page as number) - 1) * (limit as number);

      const [letters, total] = await Promise.all([
        prisma.letterOfGuarantee.findMany({
          where,
          skip,
          take: limit as number,
          orderBy: { renewedAt: 'desc' },
          include: {
            renewedFrom: true,
          },
        }),
        prisma.letterOfGuarantee.count({ where }),
      ]);

      return void res.json({
        status: 'success',
        data: letters,
        pagination: {
          page: page as number,
          limit: limit as number,
          total,
          totalPages: Math.ceil(total / (limit as number)),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting extended guarantee letters report');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get extended guarantee letters report',
      });
    }
  }
);

export default router;

