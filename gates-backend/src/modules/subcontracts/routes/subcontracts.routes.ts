import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams, validateQuery } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import {
  calculateDraftInvoiceSchema,
  createMaterialReconciliationSchema,
  createSitePenaltySchema,
  createSubcontractSchema,
  createSubcontractorSchema,
  debitNoteQuerySchema,
  bulkUpsertBoqSchema,
  idParamSchema,
  invoiceParamsSchema,
  submitInvoiceSchema,
  taxForm41PreviewQuerySchema,
  taxForm41QuerySchema,
} from '../schemas/subcontract.validation';
import { materialReconciliationService } from '../services/material-reconciliation.service';
import { subcontractCommandService } from '../services/subcontract-command.service';
import { subcontractInvoiceCommandService } from '../services/subcontract-invoice-command.service';
import { taxForm41ExportService } from '../services/tax-form-41-export.service';
import { subcontractDashboardService } from '../services/subcontract-dashboard.service';
import { enqueueAcceptedJob } from '../../../shared/jobs/accept-job';
import { ASYNC_QUEUE_NAMES } from '../../../workers/queue-manager';
import {
  allocateExistingCashToCertificateSchema,
  contractingCertificateCollectionSchema,
} from '../../contracting/settlement/contracting-certificate-settlement.schema';
import { contractingPartyReconciliationService } from '../../contracting/reconciliation/contracting-party-reconciliation.service';
import { reverseContractingCertificateSchema } from '../../contracting/reversal/contracting-certificate-reversal.schema';
import { contractingCertificateReversalService } from '../../contracting/reversal/contracting-certificate-reversal.service';
import { getSubcontractorPartyStatement } from '../../contracting/reconciliation/contracting-party-statement.service';
import { contractingCertificateSettlementService } from '../../contracting/settlement/contracting-certificate-settlement.service';
import { subcontractPreliminaryCertificateCommandService } from '../../contracting/preliminary/subcontract-preliminary-certificate-command.service';
import { preliminaryCertificateIntegrityService } from '../../contracting/preliminary/preliminary-certificate-integrity.service';
import {
  approveSubPreliminarySchema,
  convertPreliminarySchema,
  rejectPreliminarySchema,
  saveSubPreliminarySchema,
  subPrelimParamsSchema,
} from '../../contracting/preliminary/preliminary-certificate.schema';
import { subcontractVariationCommandService } from '../../contracting/variation/subcontract-variation-command.service';
import {
  cancelApprovedVariationOrderSchema,
  rejectVariationOrderSchema,
  saveSubcontractVariationOrderSchema,
  subcontractVariationParamsSchema,
} from '../../contracting/variation/contract-variation.schema';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

function postingContext(req: AuthRequest) {
  return journalEntryService.buildPostingContext(
    requireCompanyId(req),
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.get(
  '/reports/tax-form-41/preview',
  authorize({ resource: 'extract', action: 'view' }),
  validateQuery(taxForm41PreviewQuerySchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const { year, quarter } = req.query as unknown as { year: number; quarter: 1 | 2 | 3 | 4 };
    const data = await taxForm41ExportService.previewQuarterlyForm41(companyId, { year, quarter });
    res.json({ status: 'success', data });
  })
);

router.get(
  '/reports/tax-form-41',
  authorize({ resource: 'extract', action: 'print' }),
  validateQuery(taxForm41QuerySchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const { year, quarter, format } = req.query as unknown as {
      year: number;
      quarter: 1 | 2 | 3 | 4;
      format: 'CSV' | 'EXCEL';
    };
    const file = await taxForm41ExportService.exportQuarterlyForm41(companyId, { year, quarter, format });
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  })
);

router.post(
  '/reports/tax-form-41/export',
  authorize({ resource: 'extract', action: 'print' }),
  validateQuery(taxForm41QuerySchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const { year, quarter, format } = req.query as unknown as {
      year: number;
      quarter: 1 | 2 | 3 | 4;
      format: 'CSV' | 'EXCEL';
    };
    await enqueueAcceptedJob(
      res,
      ASYNC_QUEUE_NAMES.TAX_PORTAL_SYNC,
      'form41-export',
      {
        companyId,
        userId: (req as AuthRequest).user?.sub ?? 'system',
        kind: 'form41-export' as const,
        year,
        quarter,
        format,
      },
      'Form 41 export queued'
    );
  })
);

router.get(
  '/reports/debit-note',
  authorize({ resource: 'extract', action: 'print' }),
  validateQuery(debitNoteQuerySchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const note = await taxForm41ExportService.generateContractorDebitNote(companyId, {
      penaltyId: req.query.penaltyId as string | undefined,
      materialLogId: req.query.materialLogId as string | undefined,
    });
    res.json({ status: 'success', data: note });
  })
);

router.get(
  '/dashboard/summary',
  authorize({ resource: 'extract', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await subcontractDashboardService.getSummary(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/',
  authorize({ resource: 'extract', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.listSubcontracts(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/directory/subcontractors',
  authorize({ resource: 'extract', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.listSubcontractors(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.post(
  '/directory/subcontractors',
  authorize({ resource: 'extract', action: 'edit' }),
  validateBody(createSubcontractorSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.createSubcontractor(
      requireCompanyId(req as AuthRequest),
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/',
  authorize({ resource: 'extract', action: 'edit' }),
  validateBody(createSubcontractSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.createSubcontract(requireCompanyId(req as AuthRequest), req.body);
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/:id',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.getSubcontract(requireCompanyId(req as AuthRequest), req.params.id);
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/boq',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(bulkUpsertBoqSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.upsertBoqItems(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/:id/invoices/draft',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(calculateDraftInvoiceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      invoiceId?: string;
      invoiceNumber?: string;
      periodStartDate: Date;
      periodEndDate: Date;
      type?: 'INTERIM_RUNNING' | 'FINAL_SETTLEMENT';
      items: Array<{ boqItemId?: string; subcontractBOQItemId?: string; currentQuantity: string | number }>;
      applyEarlyPaymentDiscount?: boolean;
      notes?: string;
    };
    const data = await subcontractInvoiceCommandService.createOrUpdateDraftInvoice(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      {
        invoiceId: body.invoiceId,
        invoiceNumber: body.invoiceNumber,
        periodStartDate: body.periodStartDate,
        periodEndDate: body.periodEndDate,
        type: body.type,
        applyEarlyPaymentDiscount: body.applyEarlyPaymentDiscount,
        notes: body.notes,
        items: body.items.map((line) => ({
          subcontractBOQItemId: line.subcontractBOQItemId ?? line.boqItemId!,
          currentQuantity: line.currentQuantity,
        })),
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/:id/invoices/:invoiceId/submit',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(invoiceParamsSchema),
  validateBody(submitInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractInvoiceCommandService.submitToSiteEngineer(
      requireCompanyId(req as AuthRequest),
      req.params.invoiceId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/invoices/:invoiceId/approve-consultant',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(invoiceParamsSchema),
  validateBody(submitInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractInvoiceCommandService.approveByConsultant(
      requireCompanyId(req as AuthRequest),
      req.params.invoiceId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/invoices/:invoiceId/approve-tech-office',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(invoiceParamsSchema),
  validateBody(submitInvoiceSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractInvoiceCommandService.approveByTechOffice(
      requireCompanyId(req as AuthRequest),
      req.params.invoiceId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/invoices/:invoiceId/post-finance',
  authorize({ resource: 'extract', action: 'post' }),
  validateParams(invoiceParamsSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await subcontractInvoiceCommandService.lockAndPostInvoice(
      ctx.companyId,
      req.params.invoiceId,
      ctx
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/invoices/:invoiceId/settlement',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(invoiceParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingCertificateSettlementService.getSubcontractInvoiceSettlement(
      requireCompanyId(req as AuthRequest),
      req.params.invoiceId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/invoices/:invoiceId/payments',
  authorize({ resource: 'treasury', action: 'post' }),
  validateParams(invoiceParamsSchema),
  validateBody(contractingCertificateCollectionSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await contractingCertificateSettlementService.paySubcontractInvoice(
      ctx,
      req.params.invoiceId,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/:id/invoices/:invoiceId/payments/allocate',
  authorize({ resource: 'treasury', action: 'post' }),
  validateParams(invoiceParamsSchema),
  validateBody(allocateExistingCashToCertificateSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data =
      await contractingCertificateSettlementService.allocateExistingPaymentToSubcontractInvoice(
        ctx,
        req.params.invoiceId,
        req.body
      );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/:id/invoices/:invoiceId/reverse-finance',
  authorize({ resource: 'extract', action: 'post' }),
  validateParams(invoiceParamsSchema),
  validateBody(reverseContractingCertificateSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await contractingCertificateReversalService.reverseSubcontractInvoice(
      ctx,
      req.params.invoiceId,
      req.body
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/invoices/:invoiceId/party-reconciliation',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(invoiceParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingPartyReconciliationService.reconcileSubcontractInvoicePartyAccounting(
      requireCompanyId(req as AuthRequest),
      req.params.invoiceId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/subcontractors/:subcontractorId/party-statement',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await getSubcontractorPartyStatement(
      requireCompanyId(req as AuthRequest),
      req.params.subcontractorId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/penalties',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(createSitePenaltySchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractCommandService.createSitePenalty(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/:id/material-reconciliation',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(createMaterialReconciliationSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      materialId: string;
      warehouseIssueSlipNumber?: string;
      standardEngineeredQty: string | number;
      actualIssuedQty: string | number;
      marketPricePerUnit: string | number;
    };
    const data = await materialReconciliationService.calculateMaterialOverusePenalty({
      companyId: requireCompanyId(req as AuthRequest),
      subcontractId: req.params.id,
      materialId: body.materialId,
      warehouseIssueSlipNumber: body.warehouseIssueSlipNumber,
      standardEngineeredQty: body.standardEngineeredQty,
      actualIssuedQty: body.actualIssuedQty,
      marketPricePerUnit: body.marketPricePerUnit,
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/:id/variation-orders',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractVariationCommandService.listBySubcontract(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/variation-orders/:variationOrderId',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(subcontractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractVariationCommandService.get(
      requireCompanyId(req as AuthRequest),
      req.params.variationOrderId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/variation-orders',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(saveSubcontractVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await subcontractVariationCommandService.saveDraft(
      requireCompanyId(auth),
      req.params.id,
      auth.user?.sub ?? 'system',
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/:id/variation-orders/:variationOrderId/submit',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(subcontractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await subcontractVariationCommandService.submit(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/variation-orders/:variationOrderId/begin-review',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subcontractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractVariationCommandService.beginReview(
      requireCompanyId(req as AuthRequest),
      req.params.variationOrderId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/variation-orders/:variationOrderId/approve',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subcontractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await subcontractVariationCommandService.approve(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/variation-orders/:variationOrderId/reject',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subcontractVariationParamsSchema),
  validateBody(rejectVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await subcontractVariationCommandService.reject(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/variation-orders/:variationOrderId/cancel',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subcontractVariationParamsSchema),
  validateBody(cancelApprovedVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await subcontractVariationCommandService.cancelApproved(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/preliminary-certificates',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractPreliminaryCertificateCommandService.listBySubcontract(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/preliminary-certificates/:certificateId',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(subPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractPreliminaryCertificateCommandService.get(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/:id/preliminary-certificates/:certificateId/integrity',
  authorize({ resource: 'extract', action: 'view' }),
  validateParams(subPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await preliminaryCertificateIntegrityService.checkSubcontract(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/preliminary-certificates',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(saveSubPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await subcontractPreliminaryCertificateCommandService.saveDraft(
      requireCompanyId(auth),
      req.params.id,
      auth.user?.sub ?? 'system',
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/:id/preliminary-certificates/:certificateId/submit',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(subPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await subcontractPreliminaryCertificateCommandService.submit(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/preliminary-certificates/:certificateId/begin-review',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await subcontractPreliminaryCertificateCommandService.beginReview(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/preliminary-certificates/:certificateId/approve',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subPrelimParamsSchema),
  validateBody(approveSubPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as {
      lines: Array<{ subcontractBOQItemId: string; approvedCurrentQuantity: number }>;
    };
    const data = await subcontractPreliminaryCertificateCommandService.approve(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.lines
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/:id/preliminary-certificates/:certificateId/reject',
  authorize({ resource: 'extract', action: 'approve' }),
  validateParams(subPrelimParamsSchema),
  validateBody(rejectPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await subcontractPreliminaryCertificateCommandService.reject(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/preliminary-certificates/:certificateId/convert',
  authorize({ resource: 'extract', action: 'edit' }),
  validateParams(subPrelimParamsSchema),
  validateBody(convertPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { idempotencyKey: string };
    const data = await subcontractPreliminaryCertificateCommandService.convertToSubcontractInvoice(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.idempotencyKey
    );
    res.status(201).json({ status: 'success', data });
  })
);

export default router;
