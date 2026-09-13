import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import {
  createElectronicInvoiceSchema,
  updateElectronicInvoiceSchema,
} from '../schemas/invoice.schema';
import { electronicInvoiceService } from '../services/invoice.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

router.get(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await electronicInvoiceService.listInvoices(companyId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        customerId: req.query.customerId as string | undefined,
        invoiceType: req.query.invoiceType as string | undefined,
        status: req.query.status as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.invoices,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing electronic invoices');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list electronic invoices',
      });
    }
  }
);

router.get(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const invoice = await electronicInvoiceService.getInvoiceById(companyId, req.params.id);

      return void res.json({
        status: 'success',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error getting electronic invoice');
      const status =
        error instanceof Error && error.message === 'Electronic invoice not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get electronic invoice',
      });
    }
  }
);

router.post(
  '/',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: createElectronicInvoiceSchema }),
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
        invoiceDate:
          typeof req.body.invoiceDate === 'string'
            ? new Date(req.body.invoiceDate)
            : req.body.invoiceDate,
      };

      const invoice = await electronicInvoiceService.createInvoice(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Electronic invoice created successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating electronic invoice');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create electronic invoice',
      });
    }
  }
);

router.put(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: updateElectronicInvoiceSchema }),
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
      if (data.invoiceDate && typeof data.invoiceDate === 'string') {
        data.invoiceDate = new Date(data.invoiceDate);
      }

      const invoice = await electronicInvoiceService.updateInvoice(
        companyId,
        req.params.id,
        data
      );

      return void res.json({
        status: 'success',
        message: 'Electronic invoice updated successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error updating electronic invoice');
      const status =
        error instanceof Error && error.message === 'Electronic invoice not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update electronic invoice',
      });
    }
  }
);

router.delete(
  '/:id',
  authorize({ resource: 'electronic-invoice', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      await electronicInvoiceService.deleteInvoice(companyId, req.params.id);

      return void res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting electronic invoice');
      const status =
        error instanceof Error && error.message === 'Electronic invoice not found' ? 404 : 500;
      return void res.status(status).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete electronic invoice',
      });
    }
  }
);

router.post(
  '/:id/send',
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

      const invoice = await electronicInvoiceService.sendInvoice(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Electronic invoice sent successfully',
        data: invoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error sending electronic invoice');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to send electronic invoice',
      });
    }
  }
);

router.post(
  '/:id/send-return',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: createElectronicInvoiceSchema }),
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
        invoiceDate:
          typeof req.body.invoiceDate === 'string'
            ? new Date(req.body.invoiceDate)
            : req.body.invoiceDate,
      };

      const returnInvoice = await electronicInvoiceService.sendReturn(
        companyId,
        req.params.id,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Return invoice sent successfully',
        data: returnInvoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error sending return invoice');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to send return invoice',
      });
    }
  }
);

router.post(
  '/:id/send-amendment',
  authorize({ resource: 'electronic-invoice', action: 'edit' }),
  validate({ body: createElectronicInvoiceSchema }),
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
        invoiceDate:
          typeof req.body.invoiceDate === 'string'
            ? new Date(req.body.invoiceDate)
            : req.body.invoiceDate,
      };

      const amendmentInvoice = await electronicInvoiceService.sendAmendment(
        companyId,
        req.params.id,
        data
      );

      return void res.status(201).json({
        status: 'success',
        message: 'Amendment invoice sent successfully',
        data: amendmentInvoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error sending amendment invoice');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to send amendment invoice',
      });
    }
  }
);

export default router;

