import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams } from '../../../shared/middleware/validate';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import {
  calculateDraftClientInvoiceSchema,
  createClientContractSchema,
  createSiteStockSchema,
  idParamSchema,
  notesOnlySchema,
  postClientInvoiceSchema,
  projectIdParamSchema,
} from '../schemas/contracting.validation';
import { clientContractService } from '../client-billing/services/client-contract.service';
import { clientInvoiceCommandService } from '../client-billing/services/client-invoice-command.service';
import {
  allocateExistingCashToCertificateSchema,
  contractingCertificateCollectionSchema,
} from '../settlement/contracting-certificate-settlement.schema';
import { contractingCertificateSettlementService } from '../settlement/contracting-certificate-settlement.service';
import { contractingPartyReconciliationService } from '../reconciliation/contracting-party-reconciliation.service';
import { reverseContractingCertificateSchema } from '../reversal/contracting-certificate-reversal.schema';
import { contractingCertificateReversalService } from '../reversal/contracting-certificate-reversal.service';
import { ownerPreliminaryCertificateCommandService } from '../preliminary/owner-preliminary-certificate-command.service';
import { preliminaryCertificateIntegrityService } from '../preliminary/preliminary-certificate-integrity.service';
import {
  approveOwnerPreliminarySchema,
  contractIdParamSchema,
  convertPreliminarySchema,
  ownerPrelimParamsSchema,
  rejectPreliminarySchema,
  saveOwnerPreliminarySchema,
} from '../preliminary/preliminary-certificate.schema';
import { contractVariationCommandService } from '../variation/contract-variation-command.service';
import { contractVariationIntegrityService } from '../variation/contract-variation-integrity.service';
import {
  cancelApprovedVariationOrderSchema,
  contractVariationParamsSchema,
  rejectVariationOrderSchema,
  saveContractVariationOrderSchema,
} from '../variation/contract-variation.schema';

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
  '/projects/:projectId/contract',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await clientContractService.getClientContractByProject(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId/site-stock',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await clientContractService.listSiteStock(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/contracts',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateBody(createClientContractSchema),
  asyncHandler(async (req, res) => {
    const data = await clientContractService.createClientContract(
      requireCompanyId(req as AuthRequest),
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:id',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await clientContractService.getClientContract(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:id/invoices/draft',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(calculateDraftClientInvoiceSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      invoiceId?: string;
      invoiceNumber?: string;
      periodStartDate: Date;
      periodEndDate: Date;
      type?: 'INTERIM' | 'FINAL_SETTLEMENT';
      items: Array<{ projectBOQItemId: string; currentQuantity: string | number }>;
      otherClientPenalties?: string | number;
      claimSiteStockMaterialIds?: string[];
      installSiteStockMaterialIds?: string[];
      allowVariationOrder?: boolean;
    };
    const data = await clientInvoiceCommandService.createOrUpdateDraft(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      {
        invoiceId: body.invoiceId,
        invoiceNumber: body.invoiceNumber,
        periodStartDate: body.periodStartDate,
        periodEndDate: body.periodEndDate,
        type: body.type,
        items: body.items,
        otherClientPenalties: body.otherClientPenalties,
        claimSiteStockMaterialIds: body.claimSiteStockMaterialIds,
        installSiteStockMaterialIds: body.installSiteStockMaterialIds,
        allowVariationOrder: body.allowVariationOrder,
      }
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/invoices/:id/submit',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(notesOnlySchema),
  asyncHandler(async (req, res) => {
    const data = await clientInvoiceCommandService.submitToClient(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/invoices/:id/approve',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(idParamSchema),
  validateBody(notesOnlySchema),
  asyncHandler(async (req, res) => {
    const data = await clientInvoiceCommandService.approveByClient(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/invoices/:id/post-finance',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(postClientInvoiceSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const body = req.body as { installSiteStockMaterialIds?: string[] };
    const data = await clientInvoiceCommandService.lockAndPostClientInvoice(
      ctx.companyId,
      req.params.id,
      ctx.userId,
      ctx.branchId,
      { installSiteStockMaterialIds: body.installSiteStockMaterialIds }
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/invoices/:id/settlement',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingCertificateSettlementService.getClientInvoiceSettlement(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/invoices/:id/collections',
  authorize({ resource: 'treasury', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(contractingCertificateCollectionSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await contractingCertificateSettlementService.collectClientInvoice(
      ctx,
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/invoices/:id/collections/allocate',
  authorize({ resource: 'treasury', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(allocateExistingCashToCertificateSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await contractingCertificateSettlementService.allocateExistingReceiptToClientInvoice(
      ctx,
      req.params.id,
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/projects/:projectId/site-stock',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(projectIdParamSchema),
  validateBody(createSiteStockSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as {
      materialDescription: string;
      deliveryDate: Date;
      warehouseReceiptRef?: string | null;
      deliveredQuantity: string | number;
      unitPrice: string | number;
      approvedPercentage?: string | number;
    };
    const data = await clientContractService.createSiteStock(requireCompanyId(req as AuthRequest), {
      projectId: req.params.projectId,
      materialDescription: body.materialDescription,
      deliveryDate: body.deliveryDate,
      warehouseReceiptRef: body.warehouseReceiptRef,
      deliveredQuantity: body.deliveredQuantity,
      unitPrice: body.unitPrice,
      approvedPercentage: body.approvedPercentage,
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/invoices/:id/reverse-finance',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(reverseContractingCertificateSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await contractingCertificateReversalService.reverseClientInvoice(
      ctx,
      req.params.id,
      req.body
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/client-invoices/:id/party-reconciliation',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractingPartyReconciliationService.reconcileClientInvoicePartyAccounting(
      requireCompanyId(req as AuthRequest),
      req.params.id
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/boq-scope',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(contractIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractVariationCommandService.getContractBoqScope(
      requireCompanyId(req as AuthRequest),
      req.params.contractId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/variation-orders/integrity',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(contractIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractVariationIntegrityService.reconcileContract(
      requireCompanyId(req as AuthRequest),
      req.params.contractId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/variation-orders',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(contractIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await contractVariationCommandService.listByContract(
      requireCompanyId(req as AuthRequest),
      req.params.contractId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/variation-orders/:variationOrderId',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(contractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await contractVariationCommandService.get(
      requireCompanyId(req as AuthRequest),
      req.params.variationOrderId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:contractId/variation-orders',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(contractIdParamSchema),
  validateBody(saveContractVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await contractVariationCommandService.saveDraft(
      requireCompanyId(auth),
      req.params.contractId,
      auth.user?.sub ?? 'system',
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/variation-orders/:variationOrderId/submit',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(contractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await contractVariationCommandService.submit(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/variation-orders/:variationOrderId/begin-review',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(contractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await contractVariationCommandService.beginReview(
      requireCompanyId(req as AuthRequest),
      req.params.variationOrderId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/variation-orders/:variationOrderId/approve',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(contractVariationParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await contractVariationCommandService.approve(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/variation-orders/:variationOrderId/reject',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(contractVariationParamsSchema),
  validateBody(rejectVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await contractVariationCommandService.reject(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/variation-orders/:variationOrderId/cancel',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(contractVariationParamsSchema),
  validateBody(cancelApprovedVariationOrderSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await contractVariationCommandService.cancelApproved(
      requireCompanyId(auth),
      req.params.variationOrderId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/preliminary-certificates',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(contractIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await ownerPreliminaryCertificateCommandService.listByContract(
      requireCompanyId(req as AuthRequest),
      req.params.contractId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/preliminary-certificates/:certificateId',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(ownerPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await ownerPreliminaryCertificateCommandService.get(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.get(
  '/contracts/:contractId/preliminary-certificates/:certificateId/integrity',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(ownerPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await preliminaryCertificateIntegrityService.checkOwner(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:contractId/preliminary-certificates',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(contractIdParamSchema),
  validateBody(saveOwnerPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await ownerPreliminaryCertificateCommandService.saveDraft(
      requireCompanyId(auth),
      req.params.contractId,
      auth.user?.sub ?? 'system',
      req.body
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/preliminary-certificates/:certificateId/submit',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(ownerPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const data = await ownerPreliminaryCertificateCommandService.submit(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system'
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/preliminary-certificates/:certificateId/begin-review',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(ownerPrelimParamsSchema),
  asyncHandler(async (req, res) => {
    const data = await ownerPreliminaryCertificateCommandService.beginReview(
      requireCompanyId(req as AuthRequest),
      req.params.certificateId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/preliminary-certificates/:certificateId/approve',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(ownerPrelimParamsSchema),
  validateBody(approveOwnerPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { lines: Array<{ projectBOQItemId: string; approvedCurrentQuantity: number }> };
    const data = await ownerPreliminaryCertificateCommandService.approve(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.lines
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/contracts/:contractId/preliminary-certificates/:certificateId/reject',
  authorize({ resource: 'invoice', action: 'approve' }),
  validateParams(ownerPrelimParamsSchema),
  validateBody(rejectPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { reason: string };
    const data = await ownerPreliminaryCertificateCommandService.reject(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.reason
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:contractId/preliminary-certificates/:certificateId/convert',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(ownerPrelimParamsSchema),
  validateBody(convertPreliminarySchema),
  asyncHandler(async (req, res) => {
    const auth = req as AuthRequest;
    const body = req.body as { idempotencyKey: string };
    const data = await ownerPreliminaryCertificateCommandService.convertToClientInvoice(
      requireCompanyId(auth),
      req.params.certificateId,
      auth.user?.sub ?? 'system',
      body.idempotencyKey
    );
    res.status(201).json({ status: 'success', data });
  })
);

export default router;
