/**
 * Fixed assets (الأصول الثابتة) — /api/v1/fixed-assets
 * route → zod schema → service. Permission resource: `fixed-asset`.
 */
import { Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { asyncSafeRouter } from '../../../shared/middleware/async-handler';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import {
  assetCreateSchema,
  assetListQuerySchema,
  assetUpdateSchema,
  categoryBodySchema,
  disposalBodySchema,
  idParamSchema,
  movementReportQuerySchema,
  runPeriodSchema,
} from '../schemas/fixed-asset.schemas';
import { fixedAssetCategoryService } from '../services/fixed-asset-category.service';
import { fixedAssetService } from '../services/fixed-asset.service';
import { fixedAssetDepreciationService } from '../services/fixed-asset-depreciation.service';
import { fixedAssetDisposalService } from '../services/fixed-asset-disposal.service';
import { fixedAssetReportService } from '../services/fixed-asset-report.service';

const RESOURCE = 'fixed-asset';
const can = (action: 'view' | 'edit' | 'delete' | 'post' | 'unpost') =>
  authorize({ resource: RESOURCE, action });

const router = asyncSafeRouter();
router.use(authenticate);
router.use(setTenantContext);

function companyOf(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

function ctxOf(req: AuthRequest) {
  return journalEntryService.buildPostingContext(
    companyOf(req),
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

const ok = (res: Response, data: unknown, status = 200, message?: string) =>
  void res.status(status).json({ status: 'success', ...(message ? { message } : {}), data });

// ── Categories ──────────────────────────────────────────────────────────────
router.get('/categories', can('view'), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetCategoryService.list(companyOf(req)));
});
router.post('/categories', can('edit'), validate({ body: categoryBodySchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetCategoryService.create(companyOf(req), req.body), 201, 'تم حفظ الفئة');
});
router.put(
  '/categories/:id',
  can('edit'),
  validate({ params: idParamSchema, body: categoryBodySchema }),
  async (req: AuthRequest, res: Response) => {
    ok(res, await fixedAssetCategoryService.update(companyOf(req), req.params.id, req.body), 200, 'تم تعديل الفئة');
  }
);
router.delete('/categories/:id', can('delete'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetCategoryService.remove(companyOf(req), req.params.id), 200, 'تم حذف الفئة');
});

// ── Assets ──────────────────────────────────────────────────────────────────
router.get('/assets', can('view'), validate({ query: assetListQuerySchema }), async (req: AuthRequest, res: Response) => {
  const result = await fixedAssetService.list(companyOf(req), req.query as never);
  res.json({ status: 'success', data: result.data, pagination: result.pagination });
});
router.get('/assets/summary', can('view'), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetReportService.summary(companyOf(req)));
});
router.get('/assets/:id', can('view'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetService.getById(companyOf(req), req.params.id));
});
router.get('/assets/:id/schedule', can('view'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetReportService.schedule(companyOf(req), req.params.id));
});
router.post('/assets', can('edit'), validate({ body: assetCreateSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetService.create(ctxOf(req), req.body), 201, 'تم حفظ الأصل');
});
router.put(
  '/assets/:id',
  can('edit'),
  validate({ params: idParamSchema, body: assetUpdateSchema }),
  async (req: AuthRequest, res: Response) => {
    ok(res, await fixedAssetService.update(ctxOf(req), req.params.id, req.body), 200, 'تم تعديل الأصل');
  }
);
router.delete('/assets/:id', can('delete'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetService.remove(ctxOf(req), req.params.id), 200, 'تم حذف الأصل');
});
router.post('/assets/:id/activate', can('post'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetService.activate(ctxOf(req), req.params.id), 200, 'تم تفعيل الأصل');
});
router.post('/assets/:id/deactivate', can('unpost'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetService.deactivate(ctxOf(req), req.params.id), 200, 'تم إلغاء تفعيل الأصل');
});

// ── Depreciation runs ───────────────────────────────────────────────────────
router.get('/depreciation-runs', can('view'), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDepreciationService.list(companyOf(req)));
});
router.post(
  '/depreciation-runs/preview',
  can('view'),
  validate({ body: runPeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    ok(res, await fixedAssetDepreciationService.preview(companyOf(req), req.body.periodEnd));
  }
);
router.post('/depreciation-runs', can('post'), validate({ body: runPeriodSchema }), async (req: AuthRequest, res: Response) => {
  ok(
    res,
    await fixedAssetDepreciationService.post(ctxOf(req), req.body.periodEnd, req.body.notes),
    201,
    'تم ترحيل الإهلاك'
  );
});
router.get('/depreciation-runs/:id', can('view'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDepreciationService.getById(companyOf(req), req.params.id));
});
router.post(
  '/depreciation-runs/:id/unpost',
  can('unpost'),
  validate({ params: idParamSchema }),
  async (req: AuthRequest, res: Response) => {
    ok(res, await fixedAssetDepreciationService.unpost(ctxOf(req), req.params.id), 200, 'تم إلغاء ترحيل الإهلاك');
  }
);
router.post(
  '/depreciation-runs/:id/repost',
  can('post'),
  validate({ params: idParamSchema }),
  async (req: AuthRequest, res: Response) => {
    ok(res, await fixedAssetDepreciationService.repost(ctxOf(req), req.params.id), 200, 'تم ترحيل الإهلاك');
  }
);
router.delete('/depreciation-runs/:id', can('delete'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDepreciationService.remove(ctxOf(req), req.params.id), 200, 'تم حذف التشغيل');
});

// ── Disposals ───────────────────────────────────────────────────────────────
router.get('/disposals', can('view'), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDisposalService.list(companyOf(req)));
});
router.post('/disposals/preview', can('view'), validate({ body: disposalBodySchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDisposalService.preview(companyOf(req), req.body));
});
router.post('/disposals', can('post'), validate({ body: disposalBodySchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDisposalService.post(ctxOf(req), req.body), 201, 'تم ترحيل الاستبعاد');
});
router.post('/disposals/:id/unpost', can('unpost'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDisposalService.unpost(ctxOf(req), req.params.id), 200, 'تم إلغاء ترحيل الاستبعاد');
});
router.delete('/disposals/:id', can('delete'), validate({ params: idParamSchema }), async (req: AuthRequest, res: Response) => {
  ok(res, await fixedAssetDisposalService.remove(ctxOf(req), req.params.id), 200, 'تم حذف مستند الاستبعاد');
});

// ── Reports ─────────────────────────────────────────────────────────────────
router.get('/reports/movement', can('view'), validate({ query: movementReportQuerySchema }), async (req: AuthRequest, res: Response) => {
  const q = req.query as unknown as { from: Date; to: Date; categoryId?: string };
  ok(res, await fixedAssetReportService.movement(companyOf(req), q.from, q.to, q.categoryId));
});

export default router;
