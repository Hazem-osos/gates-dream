import { z } from 'zod';
import { BaseAiTool } from './base-ai-tool';
import { optionalUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  warehouseId: optionalUuid,
  itemId: optionalUuid,
  lowStockOnly: z.boolean().optional(),
});

type Params = z.infer<typeof paramsSchema>;

export type InventoryStatusPort = {
  getInventoryReport: (
    filters: { companyId: string; warehouseId?: string; itemId?: string },
    options?: { limit?: number; includeSummary?: boolean }
  ) => Promise<{ data?: Array<Record<string, any>>; summary?: Record<string, unknown> }>;
  getItemsExceedingOrderLimitReport?: (
    filters: { companyId: string; warehouseId?: string },
    options?: { limit?: number }
  ) => Promise<{ data?: Array<Record<string, any>>; summary?: Record<string, unknown> }>;
};

type LowStockRow = {
  itemId: string | null;
  itemName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  quantity: number;
  orderLimit: number;
  lowerLimit: number;
  reason: 'out_of_stock' | 'below_reorder';
};

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function classifyRow(row: Record<string, any>): LowStockRow | null {
  const quantity = num(row.quantity ?? row.currentQuantity);
  const orderLimit = num(row.orderLimit ?? row.item?.orderLimit);
  const lowerLimit = num(row.lowerLimit ?? row.item?.lowerLimit);
  const threshold = orderLimit > 0 ? orderLimit : lowerLimit;
  const outOfStock = quantity <= 0;
  const belowReorder = threshold > 0 && quantity <= threshold;
  if (!outOfStock && !belowReorder) return null;
  return {
    itemId: row.itemId ?? row.item?.id ?? null,
    itemName: row.item?.arabicName ?? row.item?.englishName ?? row.itemName ?? null,
    warehouseId: row.warehouseId ?? row.warehouse?.id ?? null,
    warehouseName: row.warehouse?.arabicName ?? row.warehouseName ?? null,
    quantity,
    orderLimit,
    lowerLimit,
    reason: outOfStock ? 'out_of_stock' : 'below_reorder',
  };
}

/**
 * Valuation uses InventoryReportsService (qty × averageCost already maintained by
 * InventoryCostingService). Costing writers are never registered here.
 *
 * Low stock / نواقص matches Item.orderLimit (حد الطلب) and Item.lowerLimit,
 * scoped through ItemQuantity → item.companyId + warehouse.companyId.
 */
export class GetInventoryStatusTool extends BaseAiTool<Params> {
  readonly name = 'getInventoryStatus';
  readonly description =
    'Inventory valuation, warehouse shortages (نواقص المخزن), and items at or below reorder point (حد الطلب / orderLimit). Read-only.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'item:view';

  constructor(private readonly reports: InventoryStatusPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    try {
      return await this.loadStatus(params, context);
    } catch (error) {
      console.error('[AI Chat Error]', error);
      return {
        error: error instanceof Error ? error.message : 'Inventory query failed',
        totalItems: 0,
        totalQuantity: 0,
        totalValuation: 0,
        lowStockCount: 0,
        lowStock: [] as LowStockRow[],
        belowReorderCount: 0,
      };
    }
  }

  private async loadStatus(params: Params, context: SecurityContext) {
    let rows: Array<Record<string, any>> = [];
    let summary: Record<string, unknown> = {};
    let queryError: string | undefined;

    try {
      const report = await this.reports.getInventoryReport(
        {
          companyId: context.companyId,
          warehouseId: params.warehouseId,
          itemId: params.itemId,
        },
        { limit: 500, includeSummary: true }
      );
      rows = Array.isArray(report.data) ? report.data : [];
      summary = report.summary ?? {};
    } catch (error) {
      console.error('[AI Chat Error]', error);
      queryError = error instanceof Error ? error.message : 'Inventory query failed';
    }

    const fromBalances = rows
      .map((row) => classifyRow(row))
      .filter((row): row is LowStockRow => Boolean(row));

    let fromReorder: LowStockRow[] = [];
    if (this.reports.getItemsExceedingOrderLimitReport) {
      try {
        const reorder = await this.reports.getItemsExceedingOrderLimitReport(
          {
            companyId: context.companyId,
            warehouseId: params.warehouseId,
          },
          { limit: 200 }
        );
        fromReorder = (Array.isArray(reorder.data) ? reorder.data : [])
          .map((row) => classifyRow(row))
          .filter((row): row is LowStockRow => Boolean(row));
      } catch (error) {
        console.error('[AI Chat Error]', error);
        queryError ??= error instanceof Error ? error.message : 'Reorder query failed';
      }
    }

    const merged = new Map<string, LowStockRow>();
    for (const row of [...fromBalances, ...fromReorder]) {
      const key = `${row.itemId ?? ''}:${row.warehouseId ?? ''}`;
      if (!merged.has(key)) merged.set(key, row);
    }

    const lowStock = [...merged.values()]
      .filter((row) => (params.itemId ? row.itemId === params.itemId : true))
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 50);

    return {
      ...(queryError ? { error: queryError } : {}),
      totalItems: num(summary.totalItems ?? rows.length),
      totalQuantity: num(summary.totalQuantity),
      totalValuation: num(summary.totalValue),
      lowStockCount: lowStock.length,
      belowReorderCount: lowStock.filter((row) => row.reason === 'below_reorder').length,
      lowStock: params.lowStockOnly === false ? [] : lowStock,
    };
  }
}
