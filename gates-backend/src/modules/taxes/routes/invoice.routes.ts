import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { taxSignatureService, TaxInvoice } from '../services/tax-signature.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * POST /api/v1/taxes/invoices/sign
 * Sign invoice with digital signature
 */
router.post(
  '/sign',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const invoice: TaxInvoice = req.body;

      // Validate invoice data
      if (!invoice.invoiceNumber || !invoice.invoiceDate || !invoice.items) {
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid invoice data',
        });
      }

      // Sign invoice
      const signedInvoice = taxSignatureService.signInvoice(invoice);

      logger.info(
        { invoiceNumber: invoice.invoiceNumber, companyId: req.companyId },
        'Invoice signed'
      );

      return void res.json({
        status: 'success',
        data: signedInvoice,
      });
    } catch (error) {
      logger.error({ error }, 'Error signing invoice');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to sign invoice',
      });
    }
  }
);

/**
 * POST /api/v1/taxes/invoices/submit
 * Submit signed invoice to tax authority
 */
router.post(
  '/submit',
  authorize({ resource: 'invoice', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { invoice, signature, hash, timestamp } = req.body;

      if (!invoice || !signature) {
        return void res.status(400).json({
          status: 'error',
          message: 'Signed invoice data required',
        });
      }

      // Verify signature
      const isValid = taxSignatureService.verifySignature({
        invoice,
        signature,
        hash,
        timestamp,
      });

      if (!isValid) {
        return void res.status(400).json({
          status: 'error',
          message: 'Invalid signature',
        });
      }

      // Submit to tax authority
      const submissionId = await taxSignatureService.submitInvoice({
        invoice,
        signature,
        hash,
        timestamp,
      });

      logger.info(
        { invoiceNumber: invoice.invoiceNumber, submissionId },
        'Invoice submitted to tax authority'
      );

      return void res.json({
        status: 'success',
        message: 'Invoice submitted successfully',
        submissionId,
      });
    } catch (error) {
      logger.error({ error }, 'Error submitting invoice');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to submit invoice',
      });
    }
  }
);

/**
 * POST /api/v1/taxes/invoices/verify
 * Verify invoice signature
 */
router.post(
  '/verify',
  authorize({ resource: 'invoice', action: 'view' }),
  async (req: Request, res: Response) => {
    try {
      const { invoice, signature, hash, timestamp } = req.body;

      if (!invoice || !signature) {
        return void res.status(400).json({
          status: 'error',
          message: 'Signed invoice data required',
        });
      }

      const isValid = taxSignatureService.verifySignature({
        invoice,
        signature,
        hash,
        timestamp,
      });

      return void res.json({
        status: 'success',
        valid: isValid,
      });
    } catch (error) {
      logger.error({ error }, 'Error verifying signature');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to verify signature',
      });
    }
  }
);

export default router;
