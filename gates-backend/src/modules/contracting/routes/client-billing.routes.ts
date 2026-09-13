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

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
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

export default router;
