import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  loadProductionMovementRows,
  type MfgMovementDetailRow,
  type MfgMovementMasterRow,
} from './manufacturing-movements-report.service';
import type {
  ManufacturingReportFilters,
  ManufacturingReportOptions,
  ManufacturingReportResult,
} from './reports.service';

export type CostVarianceOperationDetail = {
  orderId: string;
  orderNumber: string;
  date: string;
  modelName: string;
  standardQuantity: number;
  actualQuantity: number;
  quantityVariance: number;
  standardPrice: number;
  actualPrice: number;
  priceVariance: number;
  totalVariance: number;
  isPosted: boolean;
};

export type CostVarianceItemLine = {
  lineKey: string;
  lineKind: 'manufactured' | 'raw';
  itemCode: string;
  itemName: string;
  unit: string;
  standardQuantity: number;
  actualQuantity: number;
  quantityVariance: number;
  totalPrice: number;
  variancePercent: number;
  operations: CostVarianceOperationDetail[];
};

export type CostVarianceAdditionalLine = {
  lineKey: string;
  accountLabel: string;
  standardCost: number;
  actualCost: number;
  costVariance: number;
  variancePercent: number;
  operations: CostVarianceOperationDetail[];
};

export type CostVarianceReportPayload = {
  itemLines: CostVarianceItemLine[];
  additionalLines: CostVarianceAdditionalLine[];
  varianceTypes: string[];
};

function pct(variance: number, base: number): number {
  if (!base) return variance === 0 ? 0 : 100;
  return roundTo4((variance / base) * 100);
}

function opDetail(
  order: MfgMovementMasterRow,
  line: MfgMovementDetailRow
): CostVarianceOperationDetail {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    date: order.date,
    modelName: order.modelName,
    standardQuantity: line.standardQuantity,
    actualQuantity: line.actualQuantity,
    quantityVariance: line.quantityVariance,
    standardPrice: line.standardPrice,
    actualPrice: line.actualPrice,
    priceVariance: line.priceVariance,
    totalVariance: line.totalVariance,
    isPosted: order.isPosted,
  };
}

function parseVarianceTypes(raw: unknown): Set<'manufactured' | 'raw' | 'additional'> {
  const set = new Set<'manufactured' | 'raw' | 'additional'>();
  const str = String(raw ?? 'manufactured');
  for (const part of str.split(',').map((p) => p.trim())) {
    if (part === 'manufactured' || part === 'raw' || part === 'additional') set.add(part);
  }
  if (set.size === 0) set.add('manufactured');
  return set;
}

export async function getProductionCostVarianceReport(
  filters: ManufacturingReportFilters,
  options: ManufacturingReportOptions = {}
): Promise<ManufacturingReportResult> {
  const { page = 1, limit = 200 } = options;
  const varianceTypes = parseVarianceTypes(filters.varianceTypes);
  const orders = await loadProductionMovementRows(filters);

  const itemIds = new Set<string>();
  for (const order of orders) {
    if (varianceTypes.has('manufactured')) {
      for (const o of order.details.outputs) itemIds.add(o.key);
    }
    if (varianceTypes.has('raw')) {
      for (const r of order.details.raws) itemIds.add(r.key);
    }
  }

  const itemCodes = new Map<string, string>();
  if (itemIds.size > 0) {
    const items = await prisma.item.findMany({
      where: { companyId: filters.companyId, id: { in: [...itemIds] } },
      select: { id: true, serial: true },
    });
    for (const it of items) itemCodes.set(it.id, it.serial ?? it.id);
  }

  const itemAgg = new Map<string, CostVarianceItemLine>();
  const additionalAgg = new Map<string, CostVarianceAdditionalLine>();

  for (const order of orders) {
    if (varianceTypes.has('manufactured')) {
      for (const line of order.details.outputs) {
        const kind: 'manufactured' | 'raw' = 'manufactured';
        const aggKey = `${kind}:${line.key}`;
        let row = itemAgg.get(aggKey);
        if (!row) {
          row = {
            lineKey: aggKey,
            lineKind: kind,
            itemCode: itemCodes.get(line.key) ?? line.key,
            itemName: line.label,
            unit: line.unit,
            standardQuantity: 0,
            actualQuantity: 0,
            quantityVariance: 0,
            totalPrice: 0,
            variancePercent: 0,
            operations: [],
          };
          itemAgg.set(aggKey, row);
        }
        row.standardQuantity = roundTo4(row.standardQuantity + line.standardQuantity);
        row.actualQuantity = roundTo4(row.actualQuantity + line.actualQuantity);
        row.quantityVariance = roundTo4(row.quantityVariance + line.quantityVariance);
        row.totalPrice = roundTo4(row.totalPrice + line.totalVariance);
        row.operations.push(opDetail(order, line));
      }
    }

    if (varianceTypes.has('raw')) {
      for (const line of order.details.raws) {
        const kind: 'manufactured' | 'raw' = 'raw';
        const aggKey = `${kind}:${line.key}`;
        let row = itemAgg.get(aggKey);
        if (!row) {
          row = {
            lineKey: aggKey,
            lineKind: kind,
            itemCode: itemCodes.get(line.key) ?? line.key,
            itemName: line.label,
            unit: line.unit,
            standardQuantity: 0,
            actualQuantity: 0,
            quantityVariance: 0,
            totalPrice: 0,
            variancePercent: 0,
            operations: [],
          };
          itemAgg.set(aggKey, row);
        }
        row.standardQuantity = roundTo4(row.standardQuantity + line.standardQuantity);
        row.actualQuantity = roundTo4(row.actualQuantity + line.actualQuantity);
        row.quantityVariance = roundTo4(row.quantityVariance + line.quantityVariance);
        row.totalPrice = roundTo4(row.totalPrice + line.totalVariance);
        row.operations.push(opDetail(order, line));
      }
    }

    if (varianceTypes.has('additional')) {
      for (const line of order.details.additionalCosts) {
        const accountLabel = line.label || line.key;
        const aggKey = accountLabel;
        let row = additionalAgg.get(aggKey);
        if (!row) {
          row = {
            lineKey: aggKey,
            accountLabel,
            standardCost: 0,
            actualCost: 0,
            costVariance: 0,
            variancePercent: 0,
            operations: [],
          };
          additionalAgg.set(aggKey, row);
        }
        row.standardCost = roundTo4(row.standardCost + line.standardPrice);
        row.actualCost = roundTo4(row.actualCost + line.actualPrice);
        row.costVariance = roundTo4(row.costVariance + line.totalVariance);
        row.operations.push(opDetail(order, line));
      }
    }
  }

  const itemLines = [...itemAgg.values()].map((row) => {
    const standardValue = roundTo4(
      row.operations.reduce((s, o) => s + o.standardQuantity * o.standardPrice, 0)
    );
    row.variancePercent = pct(row.totalPrice, standardValue);
    return row;
  });

  const additionalLines = [...additionalAgg.values()].map((row) => {
    row.variancePercent = pct(row.costVariance, row.standardCost);
    return row;
  });

  itemLines.sort((a, b) => a.itemCode.localeCompare(b.itemCode, 'ar'));
  additionalLines.sort((a, b) => a.accountLabel.localeCompare(b.accountLabel, 'ar'));

  const payload: CostVarianceReportPayload = {
    itemLines,
    additionalLines,
    varianceTypes: [...varianceTypes],
  };

  const flatCount = itemLines.length + additionalLines.length;

  return {
    data: [payload],
    summary: {
      totalLines: flatCount,
      totalItemLines: itemLines.length,
      totalAdditionalLines: additionalLines.length,
      totalQuantityVariance: roundTo4(itemLines.reduce((s, r) => s + r.quantityVariance, 0)),
      totalPriceVariance: roundTo4(
        itemLines.reduce((s, r) => s + r.totalPrice, 0) +
          additionalLines.reduce((s, r) => s + r.costVariance, 0)
      ),
      operationCount: orders.length,
    },
    pagination: {
      page,
      limit,
      total: flatCount,
      totalPages: Math.ceil(flatCount / limit) || 1,
    },
  };
}
