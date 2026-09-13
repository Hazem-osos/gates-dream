import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createBranchSchema,
  updateBranchSchema,
  branchQuerySchema,
} from '../schemas/branch.schema';
import { branchService } from '../services/branch.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { getBranchesEtag } from '../../../shared/services/master-catalog-version.service';
import { applyMasterDataEtag } from '../../../shared/http/master-data-etag';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/companies/:companyId/branches
 * List branches for a company
 */
router.get(
  '/:companyId/branches',
  authorize({ resource: 'branch', action: 'view' }),
  validate({ query: branchQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
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
          error instanceof Error
            ? error.message
            : 'Failed to list branches',
      });
    }
  }
);

/**
 * GET /api/v1/companies/:companyId/branches/:id
 * Get branch by ID
 */
router.get(
  '/:companyId/branches/:id',
  authorize({ resource: 'branch', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const branch = await branchService.getBranchById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: branch,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting branch');
      const status =
        error instanceof Error && error.message === 'Branch not found'
          ? 404
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to get branch',
      });
    }
  }
);

/**
 * POST /api/v1/companies/:companyId/branches
 * Create a new branch
 */
router.post(
  '/:companyId/branches',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: createBranchSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Ensure companyId in body matches URL param
      const data = {
        ...req.body,
        companyId: req.params.companyId,
      };

      const branch = await branchService.createBranch(data);

      return void res.status(201).json({
        status: 'success',
        message: 'Branch created successfully',
        data: branch,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating branch');
      const status =
        error instanceof Error &&
        (error.message === 'Company not found' ||
          error.message.includes('already exists'))
          ? error.message === 'Company not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to create branch',
      });
    }
  }
);

/**
 * PUT /api/v1/companies/:companyId/branches/:id
 * Update branch
 */
router.put(
  '/:companyId/branches/:id',
  authorize({ resource: 'branch', action: 'edit' }),
  validate({ body: updateBranchSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const branch = await branchService.updateBranch(
        companyId,
        req.params.id,
        req.body
      );

      return void res.json({
        status: 'success',
        message: 'Branch updated successfully',
        data: branch,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating branch');
      const status =
        error instanceof Error &&
        (error.message === 'Branch not found' ||
          error.message.includes('already exists'))
          ? error.message === 'Branch not found'
            ? 404
            : 409
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to update branch',
      });
    }
  }
);

/**
 * DELETE /api/v1/companies/:companyId/branches/:id
 * Delete branch
 */
router.delete(
  '/:companyId/branches/:id',
  authorize({ resource: 'branch', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.params.companyId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await branchService.deleteBranch(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting branch');
      const status =
        error instanceof Error &&
        (error.message === 'Branch not found' ||
          error.message.includes('warehouse'))
          ? error.message === 'Branch not found'
            ? 404
            : 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to delete branch',
      });
    }
  }
);

export default router;

