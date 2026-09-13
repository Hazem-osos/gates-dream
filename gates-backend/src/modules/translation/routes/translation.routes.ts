import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  translateMessageSchema,
  translateScreenSchema,
  bulkTranslateMessagesSchema,
  translationQuerySchema,
} from '../schemas/translation.schema';
import { translationService } from '../services/translation.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/translation/messages
 * List translations
 */
router.get(
  '/messages',
  authorize({ resource: 'translation', action: 'view' }),
  validate({ query: translationQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await translationService.listTranslations(companyId, {
        language1: req.query.language1 as string | undefined,
        language2: req.query.language2 as string | undefined,
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
        page: req.query.page as number | undefined,
        limit: req.query.limit as number | undefined,
      });

      return void res.json({
        status: 'success',
        data: result.translations,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing translations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list translations',
      });
    }
  }
);

/**
 * GET /api/v1/translation/messages/:key
 * Get translation by key
 */
router.get(
  '/messages/:key',
  authorize({ resource: 'translation', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const translation = await translationService.getTranslation(
        companyId,
        req.params.key,
        req.query.category as string | undefined
      );

      if (!translation) {
        return void res.status(404).json({
          status: 'error',
          message: 'Translation not found',
        });
      }

      return void res.json({
        status: 'success',
        data: translation,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting translation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get translation',
      });
    }
  }
);

/**
 * POST /api/v1/translation/messages
 * Create or update translation
 */
router.post(
  '/messages',
  authorize({ resource: 'translation', action: 'edit' }),
  validate({ body: translateMessageSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const translation = await translationService.saveTranslation(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Translation saved successfully',
        data: translation,
      });
    } catch (error) {
      logger.error({ error }, 'Error saving translation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save translation',
      });
    }
  }
);

/**
 * POST /api/v1/translation/messages/bulk
 * Bulk save translations
 */
router.post(
  '/messages/bulk',
  authorize({ resource: 'translation', action: 'edit' }),
  validate({ body: bulkTranslateMessagesSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await translationService.bulkSaveTranslations(companyId, req.body.translations);

      return void res.json({
        status: 'success',
        message: `Translations saved: ${result.successful} succeeded, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error bulk saving translations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to bulk save translations',
      });
    }
  }
);

/**
 * GET /api/v1/translation/screens/:screenName
 * Get screen translations
 */
router.get(
  '/screens/:screenName',
  authorize({ resource: 'translation', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const translations = await translationService.getScreenTranslations(
        companyId,
        req.params.screenName
      );

      if (!translations) {
        return void res.status(404).json({
          status: 'error',
          message: 'Screen translations not found',
        });
      }

      return void res.json({
        status: 'success',
        data: translations,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting screen translations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get screen translations',
      });
    }
  }
);

/**
 * POST /api/v1/translation/screens
 * Save screen translations
 */
router.post(
  '/screens',
  authorize({ resource: 'translation', action: 'edit' }),
  validate({ body: translateScreenSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const translations = await translationService.saveScreenTranslations(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Screen translations saved successfully',
        data: translations,
      });
    } catch (error) {
      logger.error({ error }, 'Error saving screen translations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to save screen translations',
      });
    }
  }
);

/**
 * GET /api/v1/translation/export
 * Export translations
 */
router.get(
  '/export',
  authorize({ resource: 'translation', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const format = (req.query.format as 'csv' | 'json') || 'json';
      const content = await translationService.exportTranslations(companyId, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="translations_${Date.now()}.csv"`);
        return void res.send('\ufeff' + content); // BOM for Excel compatibility
      } else {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="translations_${Date.now()}.json"`);
        return void res.send(content);
      }
    } catch (error) {
      logger.error({ error }, 'Error exporting translations');
      if (!res.headersSent) {
        return void res.status(500).json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to export translations',
        });
      }
    }
  }
);

export default router;

