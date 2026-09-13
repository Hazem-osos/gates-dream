import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createExtractSchema,
  updateExtractSchema,
  extractQuerySchema,
} from '../schemas/extract.schema';
import { extractService } from '../services/extract.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/extracts
 * List extracts
 */
router.get(
  '/',
  authorize({ resource: 'extract', action: 'view' }),
  validate({ query: extractQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await extractService.listExtracts(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        projectId: req.query.projectId as string | undefined,
        contractorId: req.query.contractorId as string | undefined,
        extractType: req.query.extractType as string | undefined,
        statementType: req.query.statementType as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.extracts,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing extracts');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list extracts',
      });
    }
  }
);

/**
 * GET /api/v1/extracts/:id
 * Get extract by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'extract', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const extract = await extractService.getExtractById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting extract');
      const status =
        error instanceof Error && error.message === 'Extract not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get extract',
      });
    }
  }
);

/**
 * POST /api/v1/extracts
 * Create extract
 */
router.post(
  '/',
  authorize({ resource: 'extract', action: 'edit' }),
  validate({ body: createExtractSchema }),
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
        extractDate:
          typeof req.body.extractDate === 'string'
            ? new Date(req.body.extractDate)
            : req.body.extractDate,
      };

      const extract = await extractService.createExtract(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Extract created successfully',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating extract');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create extract',
      });
    }
  }
);

/**
 * PUT /api/v1/extracts/:id
 * Update extract
 */
router.put(
  '/:id',
  authorize({ resource: 'extract', action: 'edit' }),
  validate({ body: updateExtractSchema }),
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
      if (data.extractDate && typeof data.extractDate === 'string') {
        data.extractDate = new Date(data.extractDate);
      }

      const extract = await extractService.updateExtract(companyId, req.params.id, data);

      return void res.json({
        status: 'success',
        message: 'Extract updated successfully',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating extract');
      const status =
        error instanceof Error && error.message === 'Extract not found'
          ? 404
          : error instanceof Error && error.message.includes('Cannot update')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update extract',
      });
    }
  }
);

/**
 * DELETE /api/v1/extracts/:id
 * Delete extract
 */
router.delete(
  '/:id',
  authorize({ resource: 'extract', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await extractService.deleteExtract(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting extract');
      const status =
        error instanceof Error && error.message === 'Extract not found'
          ? 404
          : error instanceof Error && error.message.includes('Cannot delete')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete extract',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/:id/post
 * Post extract
 */
router.post(
  '/:id/post',
  authorize({ resource: 'extract', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const extract = await extractService.postExtract(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Extract posted successfully',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error posting extract');
      const status =
        error instanceof Error && error.message === 'Extract not found'
          ? 404
          : error instanceof Error && (error.message.includes('already') || error.message.includes('cancelled'))
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to post extract',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/:id/unpost
 * Unpost extract
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'extract', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const extract = await extractService.unpostExtract(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Extract unposted successfully',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error unposting extract');
      const status =
        error instanceof Error && error.message === 'Extract not found'
          ? 404
          : error instanceof Error && error.message.includes('not posted')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to unpost extract',
      });
    }
  }
);

/**
 * POST /api/v1/extracts/:id/cancel
 * Cancel extract
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'extract', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const extract = await extractService.cancelExtract(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Extract cancelled successfully',
        data: extract,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling extract');
      const status =
        error instanceof Error && error.message === 'Extract not found'
          ? 404
          : error instanceof Error && error.message.includes('Cannot cancel')
          ? 400
          : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to cancel extract',
      });
    }
  }
);

export default router;

