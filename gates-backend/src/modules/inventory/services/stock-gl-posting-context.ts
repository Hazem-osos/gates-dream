import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import type { StockGlPostingContext } from './stock-movement-gl.service';

/**
 * Single builder for the stock GL posting context, which was previously
 * duplicated inline at 20 call sites across the inventory routers. Carries
 * `isAdmin` so `advancedRightsService` can apply the legacy Admin bypass on
 * store-document post/unpost.
 *
 * The two odd fallbacks are the pre-existing behavior of those inline copies
 * and are kept deliberately: `branchId` falls back to `companyId` and
 * `fiscalYearId` to `''` when the headers are absent, which lets a stock
 * document post without branch/fiscal-year context rather than 400-ing. GL
 * posting itself still rejects an empty `fiscalYearId` downstream.
 */
export function buildStockGlPostingContext(
  req: AuthRequest,
  companyId: string
): StockGlPostingContext {
  return {
    companyId,
    branchId: req.branchId ?? companyId,
    fiscalYearId: req.fiscalYearId ?? '',
    userId: req.user?.sub ?? 'system',
    isAdmin: isAdminRequest(req),
  };
}
