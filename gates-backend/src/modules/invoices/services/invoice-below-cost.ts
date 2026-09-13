import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../../../shared/cache/tenant-context.cache';
import { itemCostService } from '../../inventory/services/item-cost.service';
import {
  findBelowCostViolation,
  SELL_BELOW_COST_MESSAGE,
  type BelowCostLine,
} from './invoice-below-cost-math';

export {
  findBelowCostViolation,
  isSellingBelowCost,
  SELL_BELOW_COST_MESSAGE,
  type BelowCostItemFlag,
  type BelowCostLine,
} from './invoice-below-cost-math';

export async function assertNotSellingBelowCost(params: {
  companyId: string;
  invoiceKind: string;
  lines: BelowCostLine[];
  asOf: Date;
  userId?: string;
  allowOverride?: boolean;
  force?: boolean;
}): Promise<void> {
  if (params.invoiceKind !== 'SALE') return;
  if (params.allowOverride) return;

  if (params.userId && !params.force) {
    const cached = await getCachedUserPermissions(params.userId, params.companyId);
    if (permissionGrantedFromCache(cached, 'invoice', 'override_tier_price')) {
      return;
    }
  }

  const settings = await prisma.companySettings.findUnique({
    where: { companyId: params.companyId },
    select: { preventSellingBelowCost: true },
  });

  const itemFlags = await prisma.item.findMany({
    where: {
      id: { in: [...new Set(params.lines.map((line) => line.itemId))] },
      companyId: params.companyId,
    },
    select: { id: true, noSellBelowCost: true, arabicName: true, averageCost: true },
  });
  const byId = new Map(
    itemFlags.map((item) => [
      item.id,
      {
        id: item.id,
        noSellBelowCost: item.noSellBelowCost,
        arabicName: item.arabicName,
        averageCost: Number(item.averageCost ?? 0),
      },
    ])
  );
  const companyWide = params.force === true || settings?.preventSellingBelowCost === true;
  const needsCheck = companyWide || itemFlags.some((item) => item.noSellBelowCost);
  if (!needsCheck) return;

  const costs = await itemCostService.getCostsAsOf(
    params.companyId,
    [...byId.keys()],
    params.asOf
  );

  const violation = findBelowCostViolation(params.lines, costs, byId, companyWide);
  if (violation) {
    const costLabel = Number(violation.cost).toLocaleString('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
    throw new AppError(
      422,
      params.force
        ? `لا يمكن البيع بأقل من سعر التكلفة المرجح ([${costLabel}])`
        : SELL_BELOW_COST_MESSAGE
    );
  }
}
