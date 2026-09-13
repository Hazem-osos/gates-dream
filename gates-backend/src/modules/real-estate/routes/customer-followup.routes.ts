import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { customerFollowupService } from '../services/customer-followup.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/real-estate/customer-followup
 * List customer followups
 */
router.get(
  '/',
  authorize({ resource: 'property', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await customerFollowupService.listFollowups(companyId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        customerId: req.query.customerId as string | undefined,
        propertyId: req.query.propertyId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.followups,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing customer followups');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list customer followups',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/customer-followup
 * Create customer followup
 */
router.post(
  '/',
  authorize({ resource: 'property', action: 'edit' }),
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
        followupDate:
          typeof req.body.followupDate === 'string'
            ? new Date(req.body.followupDate)
            : req.body.followupDate,
        nextFollowupDate:
          req.body.nextFollowupDate && typeof req.body.nextFollowupDate === 'string'
            ? new Date(req.body.nextFollowupDate)
            : req.body.nextFollowupDate,
      };

      const followup = await customerFollowupService.createFollowup(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Customer followup created successfully',
        data: followup,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating customer followup');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create customer followup',
      });
    }
  }
);

export default router;

