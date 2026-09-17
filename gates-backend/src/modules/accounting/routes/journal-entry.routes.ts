import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  journalEntryQuerySchema,
} from '../schemas/journal-entry.schema';
import { journalEntryService } from '../services/journal-entry.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { requestPermittedBranchIds } from '../../../shared/auth/branch-scope';
import {
  keysetDirectionFromRequest,
  setKeysetPaginationHeaders,
  wantsKeysetPagination,
} from '../../../utils/pagination/keyset-headers';

const router = Router();

function routeContext(req: AuthRequest) {
  return {
    branchId: req.branchId,
    fiscalYearId: req.fiscalYearId,
    userId: req.user?.sub || 'system',
    isAdmin: isAdminRequest(req),
  };
}

function sendRouteError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
  }
  if (error instanceof Error) {
    if (/not found/i.test(error.message) || error.message.includes('غير موجود')) {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    const known = [
      'already',
      'Cannot',
      'not posted',
      'not approved',
      'not cancelled',
      'ليس ملغياً',
      'استعادة القيد',
      'balanced',
      'متزن',
      'مقفلة',
      'مغلقة',
    ];
    const status = known.some((k) => error.message.includes(k)) ? 400 : 500;
    return res.status(status).json({ status: 'error', message: error.message });
  }
  return res.status(500).json({ status: 'error', message: fallback });
}

function isExpectedJournalError(error: unknown): boolean {
  return error instanceof AppError && error.statusCode < 500;
}

router.use(authenticate);
router.use(setTenantContext);
router.use(tenantAndFiscalContextMiddleware);

/**
 * GET /api/v1/accounting/journal-entries
 * List journal entries with pagination and filters
 */
router.get(
  '/',
  authorize({ resource: 'journal-entry', action: 'view' }),
  validate({ query: journalEntryQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await journalEntryService.listJournalEntries(companyId, {
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
        cursor: req.query.cursor as string | undefined,
        direction: keysetDirectionFromRequest(req),
        search: req.query.search as string | undefined,
        startDate:
          req.query.startDate instanceof Date
            ? req.query.startDate
            : req.query.startDate
              ? new Date(req.query.startDate as string)
              : undefined,
        endDate:
          req.query.endDate instanceof Date
            ? req.query.endDate
            : req.query.endDate
              ? new Date(req.query.endDate as string)
              : undefined,
        isPosted: req.query.isPosted as boolean | undefined,
        isApproved: req.query.isApproved as boolean | undefined,
        isCancelled: req.query.isCancelled as boolean | undefined,
        includeLines: req.query.includeLines as boolean | undefined,
        entryType: req.query.entryType as string | undefined,
        sortBy: req.query.sortBy as 'voucherNumber' | 'date' | 'createdAt' | undefined,
        sortDir: req.query.sortDir as 'asc' | 'desc' | undefined,
        branchId: req.query.branchId as string | undefined,
        permittedBranchIds: await requestPermittedBranchIds(req),
      });

      logger.info(
        { companyId, count: result.journalEntries.length },
        'Journal entries listed'
      );

      if (wantsKeysetPagination(req)) {
        setKeysetPaginationHeaders(res, result);
      }

      return void res.json({
        status: 'success',
        data: result.journalEntries,
        items: result.items,
        nextCursor: result.nextCursor,
        prevCursor: result.prevCursor,
        hasMore: result.hasMore,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing journal entries');
      return void res.status(500).json({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to list journal entries',
      });
    }
  }
);

/**
 * GET /api/v1/accounting/journal-entries/next-number
 * Preview the next GL serial without consuming it.
 */
router.get(
  '/next-number',
  authorize({ resource: 'journal-entry', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const branchId = req.branchId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }
      if (!branchId) {
        return void res.status(400).json({
          status: 'error',
          message: 'يجب اختيار الفرع قبل الترحيل',
        });
      }

      const preview = await documentSequenceService.peekNextGlNumber({
        companyId,
        branchId,
        fiscalYearId: req.fiscalYearId,
      });

      return void res.json({
        status: 'success',
        data: preview,
      });
    } catch (error) {
      return sendRouteError(res, error, 'Failed to preview journal number');
    }
  }
);

/**
 * GET /api/v1/accounting/journal-entries/:id
 * Get journal entry by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'journal-entry', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.getJournalEntryById(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        data: journalEntry,
      });
    } catch (error) {
      if (!isExpectedJournalError(error) && !(error instanceof Error && /not found/i.test(error.message))) {
        logger.error({ error }, 'Error getting journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر تحميل القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries
 * Create journal entry
 */
router.post(
  '/',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  validate({ body: createJournalEntrySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      const userId = req.user?.sub || 'system';
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date string to Date if provided
      const data = {
        ...req.body,
        date:
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date,
      };

      const journalEntry = await journalEntryService.createJournalEntry(
        companyId,
        userId,
        data,
        routeContext(req)
      );

      logger.info(
        { companyId, journalEntryId: journalEntry!.id },
        'Journal entry created'
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Journal entry created successfully',
        data: journalEntry,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error, body: req.body }, 'Error creating journal entry');
      }
      return sendRouteError(res, error, 'تعذّر حفظ القيد');
    }
  }
);

/**
 * PUT /api/v1/accounting/journal-entries/:id
 * Update journal entry
 */
router.put(
  '/:id',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  validate({ body: updateJournalEntrySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      // Convert date string to Date if provided
      const data: any = { ...req.body };
      if (req.body.date) {
        data.date =
          typeof req.body.date === 'string'
            ? new Date(req.body.date)
            : req.body.date;
      }

      const journalEntry = await journalEntryService.updateJournalEntry(
        companyId,
        req.params.id,
        data,
        routeContext(req)
      );

      return void res.json({
        status: 'success',
        message: 'Journal entry updated successfully',
        data: journalEntry,
      });
    } catch (error) {
      return void sendRouteError(res, error, 'تعذّر تحديث القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/post
 * Post journal entry
 */
router.post(
  '/:id/post',
  authorize({ resource: 'journal-entry', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.postJournalEntry(
        companyId,
        req.params.id,
        routeContext(req)
      );

      return void res.json({
        status: 'success',
        message: 'Journal entry posted successfully',
        data: journalEntry,
      });
    } catch (error) {
      if (!isExpectedJournalError(error)) {
        logger.error({ error }, 'Error posting journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر ترحيل القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/unpost
 * Unpost journal entry
 */
router.post(
  '/:id/unpost',
  authorize({ resource: 'journal-entry', action: 'post' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.unpostJournalEntry(
        companyId,
        req.params.id,
        routeContext(req)
      );

      return void res.json({
        status: 'success',
        message: 'تم فك ترحيل القيد',
        data: journalEntry,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error }, 'Error unposting journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر فك ترحيل القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/approve
 * Approve journal entry
 */
router.post(
  '/:id/approve',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.approveJournalEntry(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Journal entry approved successfully',
        data: journalEntry,
      });
    } catch (error) {
      if (!isExpectedJournalError(error)) {
        logger.error({ error }, 'Error approving journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر اعتماد القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/unapprove
 * Unapprove journal entry
 */
router.post(
  '/:id/unapprove',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.unapproveJournalEntry(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'Journal entry unapproved successfully',
        data: journalEntry,
      });
    } catch (error) {
      return void sendRouteError(res, error, 'تعذّر إلغاء اعتماد القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/cancel
 * Cancel journal entry
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.cancelJournalEntry(
        companyId,
        req.params.id
      );

      return void res.json({
        status: 'success',
        message: 'تم إلغاء القيد',
        data: journalEntry,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error }, 'Error cancelling journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر إلغاء القيد');
    }
  }
);

/**
 * POST /api/v1/accounting/journal-entries/:id/restore
 * Restore journal entry (undo cancel)
 */
router.post(
  '/:id/restore',
  authorize({ resource: 'journal-entry', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const journalEntry = await journalEntryService.restoreJournalEntry(
        companyId,
        req.params.id,
        routeContext(req)
      );

      return void res.json({
        status: 'success',
        message: 'تم استعادة القيد وترحيله',
        data: journalEntry,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode >= 500) {
        logger.error({ error }, 'Error restoring journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر استعادة القيد');
    }
  }
);

/**
 * DELETE /api/v1/accounting/journal-entries/:id
 * Delete journal entry (soft delete)
 */
router.delete(
  '/:id',
  authorize({ resource: 'journal-entry', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await journalEntryService.deleteJournalEntry(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      if (!isExpectedJournalError(error) && !(error instanceof Error && /not found|Cannot delete/i.test(error.message))) {
        logger.error({ error, journalEntryId: req.params.id }, 'Error deleting journal entry');
      }
      return void sendRouteError(res, error, 'تعذّر حذف القيد');
    }
  }
);

export default router;
