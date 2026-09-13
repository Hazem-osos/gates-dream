import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { branchQuerySchema } from '../schemas/branch.schema';
import { branchService } from '../services/branch.service';
import { companyCurrentService } from '../services/company-current.service';
import {
  companyBasicsSchema,
  updateCompanyCurrentSchema,
  upsertTenantBranchSchema,
  upsertTenantFiscalYearSchema,
} from '../schemas/company-current.schema';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import prisma from '../../../shared/database/prisma';
import { z } from 'zod';
import companyOnboardingRoutes from './company-onboarding.routes';
import { getBranchesEtag } from '../../../shared/services/master-catalog-version.service';
import { applyMasterDataEtag } from '../../../shared/http/master-data-etag';
import { assertOwnerOnly, tenantBackupService } from '../services/tenant-backup.service';

const router = Router();

router.use('/onboarding', companyOnboardingRoutes);

const fiscalYearListQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /api/v1/company/current
 */
router.get(
  '/current',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }
      const data = await companyCurrentService.getCurrent(companyId);
      return void res.json({ status: 'success', data });
    } catch (error) {
      logger.error({ error }, 'GET /company/current failed');
      const status =
        error instanceof Error && error.message === 'Company not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load company',
      });
    }
  }
);

/**
 * PUT /api/v1/company/current
 */
router.put(
  '/current',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: updateCompanyCurrentSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }
      const data = await companyCurrentService.updateCurrent(companyId, req.body);
      return void res.json({
        status: 'success',
        message: 'Company profile updated',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'PUT /company/current failed');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update company',
      });
    }
  }
);

async function handleListBranches(req: AuthRequest, res: Response) {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      logger.warn({}, 'GET branches: missing tenant companyId');
      return void res.status(400).json({
        status: 'error',
        message: 'Company context is required',
      });
    }

    const page = req.query.page as number | undefined;
    const limit = req.query.limit as number | undefined;
    const search = req.query.search as string | undefined;
    const etag = await getBranchesEtag(companyId, { page, limit, search });
    if (applyMasterDataEtag(req, res, etag)) return;

    const result = await branchService.listBranches(companyId, {
      page,
      limit,
      search,
    });

    logger.info(
      { companyId, count: result.branches.length },
      'Branches listed'
    );

    return void res.json({
      status: 'success',
      data: result.branches,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error({ error }, 'Error listing branches');
    return void res.status(500).json({
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Failed to list branches',
    });
  }
}

/**
 * GET /api/v1/company/branches
 * Lists branches for the authenticated tenant company (same data as GET /api/v1/companies/:companyId/branches).
 */
router.get(
  '/branches',
  authorize({ resource: 'branch', action: 'view' }),
  validate({ query: branchQuerySchema }),
  handleListBranches
);

/** GET /api/v1/settings/branches — same ETag + list as /company/branches */
export const settingsBranchesAliasRouter = Router();
settingsBranchesAliasRouter.get(
  '/',
  authorize({ resource: 'branch', action: 'view' }),
  validate({ query: branchQuerySchema }),
  handleListBranches
);

/**
 * POST /api/v1/company/branches — create or update branch (including default warehouse/safe)
 */
router.post(
  '/branches',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: upsertTenantBranchSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }
      const branch = await companyCurrentService.upsertBranch(companyId, req.body);
      return void res.status(req.body.id ? 200 : 201).json({
        status: 'success',
        data: branch,
      });
    } catch (error) {
      logger.error({ error }, 'POST /company/branches failed');
      const status =
        error instanceof Error &&
        (error.message === 'Branch not found' ||
          error.message.includes('not found for this company'))
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save branch',
      });
    }
  }
);

/**
 * PUT /api/v1/company/basics — company profile + main branch + fiscal year in one save
 */
router.put(
  '/basics',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: companyBasicsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }
      const data = await companyCurrentService.saveBasics(companyId, req.body);
      return void res.json({
        status: 'success',
        message: 'Company basics saved',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'PUT /company/basics failed');
      const status =
        error instanceof Error && error.message.includes('غير صالح')
          ? 400
          : error instanceof Error && error.message.includes('يجب أن يسبق')
            ? 400
            : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save company basics',
      });
    }
  }
);

/**
 * GET /api/v1/company/fiscal-years
 * Lists fiscal years for the authenticated tenant company (for X-Fiscal-Year-Id bootstrap).
 */
router.get(
  '/fiscal-years',
  authorize({ resource: 'company', action: 'view' }),
  validate({ query: fiscalYearListQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }

      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const [years, total] = await Promise.all([
        prisma.fiscalYear.findMany({
          where: { companyId, isActive: true },
          orderBy: { startDate: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            legacyYearId: true,
            arabicName: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        }),
        prisma.fiscalYear.count({ where: { companyId, isActive: true } }),
      ]);

      return void res.json({
        status: 'success',
        data: years,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing fiscal years (tenant /company/fiscal-years)');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to list fiscal years',
      });
    }
  }
);

router.post(
  '/fiscal-years',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: upsertTenantFiscalYearSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company context is required',
        });
      }
      const data = await companyCurrentService.upsertFiscalYear(companyId, req.body);
      return void res.status(201).json({
        status: 'success',
        message: 'Fiscal year saved',
        data,
      });
    } catch (error) {
      logger.error({ error }, 'POST /company/fiscal-years failed');
      const status =
        error instanceof Error &&
        (error.message.includes('غير صالح') || error.message.includes('يجب أن يسبق'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save fiscal year',
      });
    }
  }
);

router.post(
  '/backup',
  authorize({ resource: 'company', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      assertOwnerOnly(req);
      const companyId = req.companyId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company context is required' });
      }
      const file = await tenantBackupService.exportEncrypted(companyId);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return void res.send(file.buffer);
    } catch (error) {
      const status = error instanceof AppError ? error.statusCode : 500;
      logger.error({ err: error }, 'POST /company/backup failed');
      return void res.status(status || 500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to export backup',
      });
    }
  }
);

export default router;
