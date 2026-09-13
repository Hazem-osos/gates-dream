import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  databaseBackupSchema,
  databaseRestoreSchema,
  exportDataSchema,
  importDataSchema,
  approveDocumentsSchema,
  renumberOperationsSchema,
} from '../schemas/database-backup.schema';
import { databaseBackupService } from '../services/database-backup.service';
import { exportImportService } from '../services/export-import.service';
import { approveDocumentsService } from '../services/approve-documents.service';
import { renumberOperationsService } from '../services/renumber-operations.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/database-tools/backup
 * Create database backup
 */
router.post(
  '/backup',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: databaseBackupSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await databaseBackupService.createBackup(companyId, req.body);

      return void res.status(201).json({
        status: 'success',
        message: 'Database backup created successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating database backup');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create database backup',
      });
    }
  }
);

/**
 * POST /api/v1/database-tools/restore
 * Restore database from backup
 */
router.post(
  '/restore',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: databaseRestoreSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await databaseBackupService.restoreBackup(companyId, req.body);

      return void res.json({
        status: 'success',
        message: 'Database restored successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error restoring database backup');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to restore database backup',
      });
    }
  }
);

/**
 * GET /api/v1/database-tools/backups
 * List available backups
 */
router.get(
  '/backups',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const backups = await databaseBackupService.listBackups(companyId, req.query.path as string | undefined);

      return void res.json({
        status: 'success',
        data: backups,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing backups');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list backups',
      });
    }
  }
);

/**
 * POST /api/v1/database-tools/export
 * Export data from database
 */
router.post(
  '/export',
  authorize({ resource: 'database-tool', action: 'view' }),
  validate({ body: exportDataSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await exportImportService.exportData({
        ...req.body,
        companyId,
      });

      return void res.json({
        status: 'success',
        message: 'Data exported successfully',
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error exporting data');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to export data',
      });
    }
  }
);

/**
 * POST /api/v1/database-tools/import
 * Import data into database
 */
router.post(
  '/import',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: importDataSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await exportImportService.importData({
        ...req.body,
        companyId,
      });

      return void res.json({
        status: 'success',
        message: `Data imported successfully: ${result.imported} imported, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error importing data');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to import data',
      });
    }
  }
);

/**
 * POST /api/v1/database-tools/approve-documents
 * Approve documents (journal entries, invoices, etc.)
 */
router.post(
  '/approve-documents',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: approveDocumentsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await approveDocumentsService.approveDocuments({
        ...req.body,
        companyId,
      });

      return void res.json({
        status: 'success',
        message: `Documents approved: ${result.approved} approved, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error approving documents');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to approve documents',
      });
    }
  }
);

/**
 * GET /api/v1/database-tools/unapproved-documents
 * Get list of unapproved documents
 */
router.get(
  '/unapproved-documents',
  authorize({ resource: 'database-tool', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const documents = await approveDocumentsService.getUnapprovedDocuments(
        companyId,
        req.query.documentType as string | undefined
      );

      return void res.json({
        status: 'success',
        data: documents,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting unapproved documents');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get unapproved documents',
      });
    }
  }
);

/**
 * POST /api/v1/database-tools/renumber-operations
 * Renumber operations sequentially
 */
router.post(
  '/renumber-operations',
  authorize({ resource: 'database-tool', action: 'edit' }),
  validate({ body: renumberOperationsSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await renumberOperationsService.renumberOperations({
        ...req.body,
        companyId,
        fromDate: req.body.fromDate ? new Date(req.body.fromDate) : undefined,
        toDate: req.body.toDate ? new Date(req.body.toDate) : undefined,
      });

      return void res.json({
        status: 'success',
        message: `${result.renumbered} operations renumbered successfully`,
        data: result,
      });
    } catch (error) {
      logger.error({ error }, 'Error renumbering operations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to renumber operations',
      });
    }
  }
);

export default router;

