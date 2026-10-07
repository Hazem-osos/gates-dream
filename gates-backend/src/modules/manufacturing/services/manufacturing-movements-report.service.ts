import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { distributeOutputLineCosts } from '../utils/bom-cost-distribution';
import type {
  ManufacturingReportFilters,
  ManufacturingReportOptions,
  ManufacturingReportResult,
} from './reports.service';

type BomFormMetadata = {
  distributeCostByUnits?: boolean;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  standardExecutionTime?: number;
  stage?: string;
  costCenter?: string;
  outputLines?: Array<{
    itemId: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    costPercent?: number;
    warehouseId?: string;
  }>;
  additionalCosts?: Array<{
    accountLabel?: string;
    value?: number;
    manufacturedItemId?: string;
  }>;
  rawLinesSnapshot?: Array<{
    rawItemId: string;
    quantity: number;
    scrapPercentage: number;
    unitPrice: number;
    manufacturedItemId?: string;
  }>;
};

type ProcessMetadata = {
  stage?: string;
  costCenter?: string;
  operationShiftNumber?: string;
  additionalCosts?: Array<{ accountLabel?: string; value?: number }>;
  rawLinesSnapshot?: Array<{
    rawItemId: string;
    quantity: number;
    unitPrice?: number;
    manufacturedItemId?: string;
  }>;
  outputLinesSnapshot?: Array<{
    itemId: string;
    quantity: number;
    unitPrice?: number;
  }>;
};

export type MfgMovementDetailRow = {
  key: string;
  label: string;
  unit: string;
  standardQuantity: number;
  actualQuantity: number;
  standardPrice: number;
  actualPrice: number;
  quantityVariance: number;
  priceVariance: number;
  totalVariance: number;
};

export type MfgMovementMasterRow = {
  id: string;
  rowNumber: number;
  orderNumber: string;
  bomId: string;
  modelName: string;
  date: string;
  stage: string;
  costCenter: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  materialCost: number;
  additionalCost: number;
  variance: number;
  batchNumber: string;
  productionTime: number;
  isPosted: boolean;
  status: string;
  details: {
    outputs: MfgMovementDetailRow[];
    raws: MfgMovementDetailRow[];
    additionalCosts: MfgMovementDetailRow[];
  };
};

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

function varianceParts(
  standardQty: number,
  actualQty: number,
  standardPrice: number,
  actualPrice: number
) {
  const quantityVariance = roundTo4((actualQty - standardQty) * standardPrice);
  const priceVariance = roundTo4((actualPrice - standardPrice) * actualQty);
  return {
    quantityVariance,
    priceVariance,
    totalVariance: roundTo4(quantityVariance + priceVariance),
  };
}

function buildStandardProcess(
  bom: {
    baseQuantity: unknown;
    standardLaborCost: unknown;
    standardOverheadCost: unknown;
    finishedItemId: string;
    formMetadata: unknown;
    lines: Array<{
      rawItemId: string;
      quantity: unknown;
      scrapPercentage: unknown;
      manufacturedItemId: string | null;
      rawItem: { arabicName: string; serial: string | null } | null;
    }>;
    finishedItem: { arabicName: string; serial: string | null } | null;
  },
  modelCount: number
) {
  const count = modelCount;
  const baseQty = num(bom.baseQuantity) || 1;
  const scale = count / baseQty;
  const meta = (bom.formMetadata ?? {}) as BomFormMetadata;
  const snapshot = meta.rawLinesSnapshot ?? [];

  const raws = bom.lines.map((line, idx) => {
    const snap = snapshot[idx];
    const qty = roundTo4(
      num(snap?.quantity ?? line.quantity) * scale * (1 + num(snap?.scrapPercentage ?? line.scrapPercentage) / 100)
    );
    const unitPrice = num(snap?.unitPrice);
    return {
      itemId: line.rawItemId,
      itemName: line.rawItem?.arabicName ?? line.rawItemId,
      unit: line.rawItem?.serial ?? '—',
      quantity: qty,
      unitPrice,
      lineTotal: roundTo4(qty * unitPrice),
      manufacturedItemId: snap?.manufacturedItemId ?? line.manufacturedItemId ?? '',
    };
  });

  const outputMeta =
    meta.outputLines && meta.outputLines.length > 0
      ? meta.outputLines
      : [
          {
            itemId: bom.finishedItemId,
            quantity: baseQty,
            unit: bom.finishedItem?.serial ?? '',
            unitPrice: 0,
            costPercent: 100,
          },
        ];

  const distributed = distributeOutputLineCosts({
    labor: num(bom.standardLaborCost) * scale,
    overhead: num(bom.standardOverheadCost) * scale,
    outputLines: outputMeta.map((o) => ({
      itemId: o.itemId,
      quantity: roundTo4(num(o.quantity) * scale),
      costPercent: num(o.costPercent),
    })),
    rawLines: bom.lines.map((line, idx) => {
      const snap = snapshot[idx];
      return {
        quantity: num(snap?.quantity ?? line.quantity) * scale,
        scrapPercentage: num(snap?.scrapPercentage ?? line.scrapPercentage),
        unitPrice: num(snap?.unitPrice),
        manufacturedItemId: snap?.manufacturedItemId ?? line.manufacturedItemId ?? undefined,
      };
    }),
    additionalLines: (meta.additionalCosts ?? []).map((c) => ({
      value: roundTo4(num(c.value) * scale),
      manufacturedItemId: c.manufacturedItemId,
    })),
    distributeCostByUnits: Boolean(meta.distributeCostByUnits),
  });

  const outputs = outputMeta.map((o, idx) => ({
    itemId: o.itemId,
    itemName: o.itemId === bom.finishedItemId ? (bom.finishedItem?.arabicName ?? o.itemId) : o.itemId,
    unit: o.unit ?? bom.finishedItem?.serial ?? '—',
    quantity: roundTo4(num(o.quantity) * scale),
    unitPrice: distributed[idx]?.unitPrice ?? num(o.unitPrice),
    lineTotal: distributed[idx]?.lineTotal ?? 0,
  }));

  const additionalCosts = (meta.additionalCosts ?? []).map((c) => ({
    accountLabel: c.accountLabel ?? '',
    value: roundTo4(num(c.value) * scale),
  }));

  const standardMaterial = roundTo4(raws.reduce((s, r) => s + r.lineTotal, 0));
  const standardAdditional = roundTo4(additionalCosts.reduce((s, c) => s + c.value, 0));
  const standardLabor = roundTo4(num(bom.standardLaborCost) * scale);
  const standardOverhead = roundTo4(num(bom.standardOverheadCost) * scale);
  const standardTotal = roundTo4(
    standardMaterial + standardAdditional + standardLabor + standardOverhead
  );

  return {
    meta,
    scale,
    raws,
    outputs,
    additionalCosts,
    standardMaterial,
    standardAdditional,
    standardLabor,
    standardOverhead,
    standardTotal,
  };
}

export async function loadProductionMovementRows(
  filters: ManufacturingReportFilters
): Promise<MfgMovementMasterRow[]> {
  const { companyId, fromDate, toDate, bomId, stage, costCenterId, showUnposted } = filters;

  if (!fromDate || !toDate) {
    throw new Error('From date and to date are required');
  }

  let costCenterLabel: string | undefined;
  if (costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: String(costCenterId), companyId },
      select: { arabicName: true, code: true },
    });
    if (cc) costCenterLabel = cc.arabicName || cc.code;
  }

  const postedStatuses = ['IN_PROGRESS', 'COMPLETED'];
  const statusFilter = showUnposted === false ? { in: postedStatuses } : undefined;

  const orders = await prisma.productionOrder.findMany({
    where: {
      companyId,
      createdAt: { gte: fromDate, lte: toDate },
      ...(bomId ? { bomId: String(bomId) } : {}),
      ...(statusFilter ? { status: statusFilter } : { status: { not: 'CANCELLED' } }),
    },
    include: {
      bom: {
        include: {
          lines: {
            orderBy: { lineOrder: 'asc' },
            include: { rawItem: { select: { id: true, arabicName: true, serial: true } } },
          },
          finishedItem: { select: { id: true, arabicName: true, serial: true } },
        },
      },
      materialIssues: { include: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const rows: MfgMovementMasterRow[] = [];
  let rowNumber = 0;

  for (const order of orders) {
    const procMeta = (order.processMetadata ?? {}) as ProcessMetadata;
    const orderStage = procMeta.stage ?? (order.bom.formMetadata as BomFormMetadata)?.stage ?? '';
    const orderCostCenter =
      procMeta.costCenter ?? (order.bom.formMetadata as BomFormMetadata)?.costCenter ?? '';

    if (stage && orderStage !== stage) continue;
    if (costCenterLabel && !orderCostCenter.includes(costCenterLabel) && orderCostCenter !== costCenterLabel) {
      continue;
    }

    rowNumber += 1;
    const qty = num(order.plannedQuantity);
    let standard = buildStandardProcess(order.bom, qty);
    const orderRawSnap = procMeta.rawLinesSnapshot;
    if (Array.isArray(orderRawSnap) && orderRawSnap.length > 0) {
      const raws = orderRawSnap
        .filter((snap) => snap.rawItemId && num(snap.quantity) > 0)
        .map((snap) => {
          const lineQty = roundTo4(num(snap.quantity));
          const unitPrice = num(snap.unitPrice);
          const bomLine = order.bom.lines.find((l) => l.rawItemId === snap.rawItemId);
          return {
            itemId: snap.rawItemId,
            itemName: bomLine?.rawItem?.arabicName ?? snap.rawItemId,
            unit: bomLine?.rawItem?.serial ?? '—',
            quantity: lineQty,
            unitPrice,
            lineTotal: roundTo4(lineQty * unitPrice),
            manufacturedItemId: snap.manufacturedItemId ?? bomLine?.manufacturedItemId ?? '',
          };
        });
      if (raws.length > 0) {
        standard = { ...standard, raws, standardMaterial: roundTo4(raws.reduce((s, r) => s + r.lineTotal, 0)) };
      }
    }
    const isPosted = postedStatuses.includes(order.status);

    const issueLines = order.materialIssues.flatMap((i) => i.lines);
    const actualByRaw = new Map<string, { qty: number; unitCost: number }>();
    for (const line of issueLines) {
      actualByRaw.set(line.rawItemId, {
        qty: num(line.quantity),
        unitCost: num(line.unitCost),
      });
    }

    const metaAdditional = procMeta.additionalCosts ?? standard.additionalCosts;
    const actualMaterial = isPosted ? num(order.totalMaterialCost) : standard.standardMaterial;
    const actualAdditional = isPosted
      ? roundTo4(metaAdditional.reduce((s, c) => s + num(c.value), 0))
      : standard.standardAdditional;
    const actualLabor = isPosted ? num(order.totalLaborCost) : standard.standardLabor;
    const actualOverhead = isPosted ? num(order.totalOverheadCost) : standard.standardOverhead;
    const actualTotal = roundTo4(actualMaterial + actualAdditional + actualLabor + actualOverhead);
    const unitCost = qty > 0 ? roundTo4(actualTotal / qty) : 0;

    const rawDetails: MfgMovementDetailRow[] = standard.raws.map((r) => {
      const actual = actualByRaw.get(r.itemId);
      const actualQty = actual?.qty ?? r.quantity;
      const actualPrice = actual?.unitCost ?? r.unitPrice;
      const parts = varianceParts(r.quantity, actualQty, r.unitPrice, actualPrice);
      return {
        key: r.itemId,
        label: r.itemName,
        unit: r.unit,
        standardQuantity: r.quantity,
        actualQuantity: actualQty,
        standardPrice: r.unitPrice,
        actualPrice: actualPrice,
        ...parts,
      };
    });

    const completedQty = num(order.actualQuantity) || qty;
    const outputDetails: MfgMovementDetailRow[] = standard.outputs.map((o) => {
      const actualQty = order.status === 'COMPLETED' ? roundTo4(o.quantity * (completedQty / qty)) : o.quantity;
      const actualPrice =
        order.status === 'COMPLETED' && order.unitCost != null ? num(order.unitCost) : o.unitPrice;
      const parts = varianceParts(o.quantity, actualQty, o.unitPrice, actualPrice);
      return {
        key: o.itemId,
        label: o.itemName,
        unit: o.unit,
        standardQuantity: o.quantity,
        actualQuantity: actualQty,
        standardPrice: o.unitPrice,
        actualPrice: actualPrice,
        ...parts,
      };
    });

    const additionalDetails: MfgMovementDetailRow[] = standard.additionalCosts.map((c, idx) => {
      const postedValue = isPosted ? num(metaAdditional[idx]?.value ?? c.value) : 0;
      const actualPrice = isPosted ? postedValue : c.value;
      const parts = varianceParts(1, 1, c.value, actualPrice);
      return {
        key: `${c.accountLabel}-${idx}`,
        label: c.accountLabel || 'تكلفة إضافية',
        unit: '—',
        standardQuantity: 1,
        actualQuantity: 1,
        standardPrice: c.value,
        actualPrice: actualPrice,
        quantityVariance: 0,
        priceVariance: parts.priceVariance,
        totalVariance: parts.totalVariance,
      };
    });

    const variance = roundTo4(
      rawDetails.reduce((s, d) => s + d.totalVariance, 0) +
        outputDetails.reduce((s, d) => s + d.totalVariance, 0) +
        additionalDetails.reduce((s, d) => s + d.totalVariance, 0)
    );

    rows.push({
      id: order.id,
      rowNumber,
      orderNumber: order.orderNumber,
      bomId: order.bomId,
      modelName: order.bom.name,
      date: order.createdAt.toISOString().slice(0, 10),
      stage: orderStage,
      costCenter: orderCostCenter,
      quantity: qty,
      unitCost,
      totalCost: actualTotal,
      materialCost: actualMaterial,
      additionalCost: actualAdditional,
      variance,
      batchNumber: procMeta.operationShiftNumber ?? '',
      productionTime: num((order.bom.formMetadata as BomFormMetadata)?.standardExecutionTime),
      isPosted,
      status: order.status,
      details: {
        outputs: outputDetails,
        raws: rawDetails,
        additionalCosts: additionalDetails,
      },
    });
  }

  return rows;
}

export async function getProductionManufacturingMovementsReport(
  filters: ManufacturingReportFilters,
  options: ManufacturingReportOptions = {}
): Promise<ManufacturingReportResult> {
  const { page = 1, limit = 100 } = options;
  const rows = await loadProductionMovementRows(filters);

  const skip = (page - 1) * limit;
  const pageRows = rows.slice(skip, skip + limit);

  return {
    data: pageRows,
    summary: {
      totalOperations: rows.length,
      totalQuantity: roundTo4(rows.reduce((s, r) => s + r.quantity, 0)),
      totalCost: roundTo4(rows.reduce((s, r) => s + r.totalCost, 0)),
      totalVariance: roundTo4(rows.reduce((s, r) => s + r.variance, 0)),
      totalMaterialCost: roundTo4(rows.reduce((s, r) => s + r.materialCost, 0)),
      totalAdditionalCost: roundTo4(rows.reduce((s, r) => s + r.additionalCost, 0)),
      postedCount: rows.filter((r) => r.isPosted).length,
      unpostedCount: rows.filter((r) => !r.isPosted).length,
    },
    pagination: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit) || 1,
    },
  };
}
