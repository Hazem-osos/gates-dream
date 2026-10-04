import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { AppError } from '../../../shared/middleware/error-handler';
import type { StockGlPostingContext } from './stock-movement-gl.service';

/**
 * Single builder for the stock GL posting context, which was previously
 * duplicated inline at 20 call sites across the inventory routers. Carries
 * `isAdmin` so `advancedRightsService` can apply the legacy Admin bypass on
 * store-document post/unpost.
 *
 * Missing branch/fiscal-year headers stay empty so store documents can still
 * save. Posting fills `fiscalYearId` from the document date via
 * `attachDocumentFiscalYear`. Never use `companyId` as `branchId` — that
 * breaks the journal FK and failed every admin save-and-post.
 */
export function buildStockGlPostingContext(
  req: AuthRequest,
  companyId: string
): StockGlPostingContext {
  return {
    companyId,
    branchId: req.branchId || undefined,
    fiscalYearId: req.fiscalYearId || '',
    userId: req.user?.sub ?? 'system',
    isAdmin: isAdminRequest(req),
  };
}

/** Bind stock GL to the document date's open year; drop a fake company-as-branch id. */
export function attachDocumentFiscalYear(
  ctx: StockGlPostingContext | undefined,
  fiscalYearId: string,
  documentBranchId?: string | null
): StockGlPostingContext | undefined {
  if (!ctx) return undefined;
  const year = fiscalYearId.trim();
  let branchId =
    ctx.branchId && ctx.branchId !== ctx.companyId ? ctx.branchId : undefined;
  if (!branchId && documentBranchId && documentBranchId !== ctx.companyId) {
    branchId = documentBranchId;
  }
  return {
    ...ctx,
    fiscalYearId: year || ctx.fiscalYearId,
    branchId,
  };
}

/** Movement + MAC rows need a real branch; header context wins over a blank document row. */
export function resolveStockMovementBranchId(
  postingCtx: StockGlPostingContext | undefined,
  documentBranchId?: string | null
): string {
  const fromCtx = postingCtx?.branchId?.trim();
  if (fromCtx && fromCtx !== postingCtx?.companyId) return fromCtx;
  const fromDoc = documentBranchId?.trim();
  if (fromDoc && fromDoc !== postingCtx?.companyId) return fromDoc;
  throw new AppError(422, 'يجب اختيار الفرع قبل ترحيل المستند المخزني.');
}
