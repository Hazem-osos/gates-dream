import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { electronicInvoiceImportService } from '../services/import.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/electronic-invoices/import
 * Import tax invoices from external source
 */
router.post(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const { invoices, options } = req.body;

      if (!invoices || !Array.isArray(invoices)) {
        return void res.status(400).json({
          status: 'error',
          message: 'Invoices array is required',
        });
      }

      // Transform dates
      const transformedInvoices = invoices.map((invoice: any) => ({
        ...invoice,
        invoiceDate:
          typeof invoice.invoiceDate === 'string'
            ? new Date(invoice.invoiceDate)
            : invoice.invoiceDate,
      }));

      const result = await electronicInvoiceImportService.importTaxInvoices(
        companyId,
        transformedInvoices,
        options || {}
      );

      return void res.json({
        status: 'success',
        message: 'Tax invoices imported successfully',
        data: {
          successCount: result.success.length,
          failedCount: result.failed.length,
          success: result.success,
          failed: result.failed,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error importing tax invoices');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to import tax invoices',
      });
    }
  }
);

export default router;

