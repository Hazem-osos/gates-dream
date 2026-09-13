import { advancedRightsService } from '../../platform/services/advanced-rights.service';
import type { StockGlPostingContext } from './stock-movement-gl.service';

/**
 * Legacy `AdvancedRights` families for the store documents that have a web
 * equivalent, per `legacy-advanced-rights-families.ts`:
 *
 * - `SCPost`  — StoreCheck (جرد), the physical count -> stocktaking
 * - `STPost`  — StoreTrans, the warehouse-to-warehouse transfer -> transfer
 * - `SIPost`  — StoreDist/adjust -> adjustment and other-adjustment
 * - `FTPost`  — `UntItemsFirstTime.pas`, opening balances -> opening stock
 *
 * `SLPost` (store collection) has no web screen yet and stays unwired.
 */
export const STORE_DOCUMENT_RIGHTS = {
  stocktaking: { post: 'scPost', unpost: 'scUnpost', label: 'stock counts' },
  transfer: { post: 'stPost', unpost: 'stUnpost', label: 'store transfers' },
  adjustment: { post: 'siPost', unpost: 'siUnpost', label: 'store adjustments' },
  openingStock: { post: 'ftPost', unpost: 'ftUnpost', label: 'opening stock' },
} as const;

export type StoreDocumentFamily = keyof typeof STORE_DOCUMENT_RIGHTS;

/**
 * No context means an internal caller (invoice posting, integration scripts)
 * rather than an HTTP request. Invoice-driven stock movement is already gated
 * on the invoice's own family, which is what legacy does too, so skipping here
 * avoids demanding a store-document right the operator never needed.
 */
export async function assertStoreDocumentRight(
  ctx: StockGlPostingContext | undefined,
  family: StoreDocumentFamily,
  mode: 'post' | 'unpost'
): Promise<void> {
  if (!ctx) return;
  const entry = STORE_DOCUMENT_RIGHTS[family];
  await advancedRightsService.assertCanPostFamily(
    ctx.companyId,
    ctx.userId,
    ctx.branchId,
    mode === 'post' ? entry.post : entry.unpost,
    { isAdmin: ctx.isAdmin, actionLabel: `${mode} ${entry.label}` }
  );
}
