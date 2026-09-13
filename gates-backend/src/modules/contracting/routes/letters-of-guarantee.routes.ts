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
  amendLgAmountSchema,
  extendLgSchema,
  idParamSchema,
  issueLgSchema,
  liquidateLgSchema,
  projectIdParamSchema,
  releaseLgSchema,
} from '../schemas/contracting.validation';
import { projectLgService } from '../letters-of-guarantee/services/project-lg.service';

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

router.post(
  '/',
  authorize({ resource: 'invoice', action: 'post' }),
  validateBody(issueLgSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await projectLgService.issueLetterOfGuarantee(ctx.companyId, ctx.userId, {
      ...req.body,
      branchId: ctx.branchId,
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.get(
  '/projects/:projectId',
  authorize({ resource: 'invoice', action: 'view' }),
  validateParams(projectIdParamSchema),
  asyncHandler(async (req, res) => {
    const data = await projectLgService.listByProject(
      requireCompanyId(req as AuthRequest),
      req.params.projectId
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/extend',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(extendLgSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await projectLgService.extendLetterOfGuarantee(
      ctx.companyId,
      req.params.id,
      ctx.userId,
      { ...req.body, branchId: ctx.branchId }
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/amend-amount',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(amendLgAmountSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await projectLgService.amendLgAmount(ctx.companyId, req.params.id, ctx.userId, {
      ...req.body,
      branchId: ctx.branchId,
    });
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/release',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(releaseLgSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await projectLgService.releaseAndReturnLg(ctx.companyId, req.params.id, ctx.userId, {
      ...req.body,
      branchId: ctx.branchId,
    });
    res.json({ status: 'success', data });
  })
);

router.post(
  '/:id/liquidate',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(liquidateLgSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await projectLgService.liquidateLg(ctx.companyId, req.params.id, ctx.userId, {
      ...req.body,
      branchId: ctx.branchId,
    });
    res.json({ status: 'success', data });
  })
);

export default router;
