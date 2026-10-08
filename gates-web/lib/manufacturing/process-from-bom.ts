import { distributeOutputLineCosts } from '@/lib/manufacturing/bom-cost-distribution';

export type BomFormMetadataLike = {
  distributeCostByUnits?: boolean;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  standardExecutionTime?: number;
  stage?: string;
  costCenterId?: string;
  costCenter?: string;
  outputLines?: Array<{
    itemId: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    costPercent?: number;
    description?: string;
    warehouseId?: string;
  }>;
  additionalCosts?: Array<{
    accountId?: string;
    accountLabel?: string;
    value?: number;
    valuePercent?: number;
    description?: string;
    costCenter?: string;
    manufacturedItemId?: string;
  }>;
  rawLinesSnapshot?: Array<{
    rawItemId: string;
    quantity: number;
    scrapPercentage: number;
    unitPrice: number;
    lineDescription?: string;
    warehouseId?: string;
    manufacturedItemId?: string;
  }>;
};

export type BomLineLike = {
  rawItemId: string;
  quantity: string | number;
  scrapPercentage: string | number;
  lineDescription?: string | null;
  warehouseId?: string | null;
  manufacturedItemId?: string | null;
  rawItem?: { id: string; arabicName: string; serial?: string | null };
};

export type BomForProcess = {
  id: string;
  name: string;
  baseQuantity: string | number;
  standardLaborCost: string | number;
  standardOverheadCost: string | number;
  finishedItemId: string;
  finishedItem?: { id: string; arabicName: string; serial?: string | null };
  formMetadata?: BomFormMetadataLike | null;
  lines?: BomLineLike[];
};

export type ProcessOutputRow = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  costPercent: number;
  warehouseId: string;
};

export type ProcessRawRow = {
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  warehouseId: string;
  manufacturedItemId: string;
};

export type ProcessAdditionalRow = {
  accountId: string;
  accountLabel: string;
  value: number;
  valuePercent: number;
  description: string;
  costCenter: string;
  manufacturedItemId: string;
};

export type ProcessVarianceRow = {
  id: string;
  itemName: string;
  estimated: number;
  actual: number;
};

export type LoadedManufacturingProcess = {
  stage: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  costCenter: string;
  distributeCostByUnits: boolean;
  laborCost: number;
  overheadCost: number;
  outputs: ProcessOutputRow[];
  raws: ProcessRawRow[];
  additionalCosts: ProcessAdditionalRow[];
  varianceExtras?: ProcessVarianceRow[];
  varianceActualOverrides?: Record<string, number>;
};

export function emptyProcessOutputRow(): ProcessOutputRow {
  return {
    itemId: '',
    itemName: '',
    quantity: 1,
    unit: '—',
    unitPrice: 0,
    lineTotal: 0,
    costPercent: 0,
    warehouseId: '',
  };
}

export function emptyProcessRawRow(): ProcessRawRow {
  return {
    itemId: '',
    itemName: '',
    quantity: 1,
    unit: '—',
    unitPrice: 0,
    lineTotal: 0,
    warehouseId: '',
    manufacturedItemId: '',
  };
}

export function emptyProcessAdditionalRow(): ProcessAdditionalRow {
  return {
    accountId: '',
    accountLabel: '',
    value: 0,
    valuePercent: 0,
    description: '',
    costCenter: '',
    manufacturedItemId: '',
  };
}

export function createEmptyLoadedProcess(ctx: {
  stage?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  costCenter?: string;
  distributeCostByUnits?: boolean;
  laborCost?: number;
  overheadCost?: number;
}): LoadedManufacturingProcess {
  return {
    stage: ctx.stage ?? '',
    fromWarehouseId: ctx.fromWarehouseId ?? '',
    toWarehouseId: ctx.toWarehouseId ?? '',
    costCenter: ctx.costCenter ?? '',
    distributeCostByUnits: ctx.distributeCostByUnits ?? false,
    laborCost: ctx.laborCost ?? 0,
    overheadCost: ctx.overheadCost ?? 0,
    outputs: [emptyProcessOutputRow()],
    raws: [emptyProcessRawRow()],
    additionalCosts: [emptyProcessAdditionalRow()],
    varianceExtras: [],
    varianceActualOverrides: {},
  };
}

export function processHasLineContent(process: LoadedManufacturingProcess): boolean {
  const hasOutput = process.outputs.some((o) => o.itemId.trim() && o.quantity > 0);
  const hasRaw = process.raws.some((r) => r.itemId.trim() && r.quantity > 0);
  return hasOutput || hasRaw;
}

type OrderProcessMetadataLike = {
  stage?: string;
  costCenter?: string;
  laborCost?: number;
  overheadCost?: number;
  distributeCostByUnits?: boolean;
  outputLinesSnapshot?: Array<{
    itemId: string;
    itemName?: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    lineTotal?: number;
    costPercent?: number;
    warehouseId?: string;
  }>;
  rawLinesSnapshot?: Array<{
    rawItemId: string;
    itemName?: string;
    quantity: number;
    unitPrice?: number;
    lineTotal?: number;
    warehouseId?: string;
    manufacturedItemId?: string;
  }>;
  additionalCosts?: Array<{
    accountId?: string;
    accountLabel?: string;
    value?: number;
    valuePercent?: number;
    description?: string;
    costCenter?: string;
    manufacturedItemId?: string;
  }>;
  varianceExtras?: ProcessVarianceRow[];
  varianceActualOverrides?: Record<string, number>;
};

export function buildLoadedProcessFromOrderMetadata(
  meta: OrderProcessMetadataLike | null | undefined,
  bom: BomForProcess,
  modelCount: number,
  resolveItemName?: (id: string) => string | undefined
): LoadedManufacturingProcess | null {
  const fromBom = buildLoadedProcessFromBom(bom, modelCount);
  if (!fromBom) return null;
  if (!meta) return fromBom;

  const nameFor = (id: string, fallback?: string) =>
    resolveItemName?.(id) ?? fallback ?? id;

  const outSnap = meta.outputLinesSnapshot;
  const rawSnap = meta.rawLinesSnapshot;

  if (Array.isArray(outSnap) && outSnap.length > 0) {
    fromBom.outputs = outSnap.map((o) => {
      const qty = round4(num(o.quantity));
      const unitPrice = num(o.unitPrice);
      return {
        itemId: o.itemId,
        itemName: o.itemName ?? nameFor(o.itemId),
        quantity: qty,
        unit: (o.unit && o.unit.trim()) || '—',
        unitPrice,
        lineTotal: round4(num(o.lineTotal) || qty * unitPrice),
        costPercent: num(o.costPercent),
        warehouseId: o.warehouseId ?? fromBom.toWarehouseId,
      };
    });
  }

  if (Array.isArray(rawSnap) && rawSnap.length > 0) {
    fromBom.raws = rawSnap.map((r) => {
      const qty = round4(num(r.quantity));
      const storedTotal = round4(num(r.lineTotal));
      let unitPrice = num(r.unitPrice);
      let lineTotal =
        storedTotal > 0 ? storedTotal : round4(qty * unitPrice);
      if (unitPrice <= 0 && qty > 0 && lineTotal > 0) {
        unitPrice = round4(lineTotal / qty);
      }
      return {
        itemId: r.rawItemId,
        itemName: r.itemName ?? nameFor(r.rawItemId),
        quantity: qty,
        unit: '—',
        unitPrice,
        lineTotal,
        warehouseId: r.warehouseId ?? fromBom.fromWarehouseId,
        manufacturedItemId: r.manufacturedItemId ?? '',
      };
    });
  }

  if (Array.isArray(meta.additionalCosts) && meta.additionalCosts.length > 0) {
    fromBom.additionalCosts = meta.additionalCosts.map((c) => ({
      accountId: c.accountId ?? '',
      accountLabel: c.accountLabel ?? '',
      value: round4(num(c.value)),
      valuePercent: num(c.valuePercent),
      description: c.description ?? '',
      costCenter: c.costCenter ?? '',
      manufacturedItemId: c.manufacturedItemId ?? '',
    }));
  }

  if (meta.stage) fromBom.stage = meta.stage;
  if (meta.costCenter) fromBom.costCenter = meta.costCenter;
  if (meta.laborCost != null && Number.isFinite(Number(meta.laborCost))) {
    fromBom.laborCost = round4(num(meta.laborCost));
  }
  if (meta.overheadCost != null && Number.isFinite(Number(meta.overheadCost))) {
    fromBom.overheadCost = round4(num(meta.overheadCost));
  }
  if (meta.distributeCostByUnits != null) {
    fromBom.distributeCostByUnits = Boolean(meta.distributeCostByUnits);
  }
  if (meta.varianceExtras?.length) fromBom.varianceExtras = meta.varianceExtras;
  if (meta.varianceActualOverrides) {
    fromBom.varianceActualOverrides = meta.varianceActualOverrides;
  }

  return fromBom;
}

function num(v: string | number | null | undefined): number {
  return Number(v ?? 0);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function buildLoadedProcessFromBom(
  bom: BomForProcess,
  modelCount: number
): LoadedManufacturingProcess | null {
  const count = Number(modelCount);
  if (!Number.isFinite(count) || count <= 0) return null;
  const baseQty = num(bom.baseQuantity);
  if (baseQty <= 0) return null;
  const scale = count / baseQty;

  const meta = bom.formMetadata ?? {};
  const snapshot = meta.rawLinesSnapshot ?? [];
  const dbLines = bom.lines ?? [];

  const raws: ProcessRawRow[] =
    dbLines.length > 0
      ? dbLines.map((line, idx) => {
          const snap = snapshot[idx];
          const qty = round4(
            num(snap?.quantity ?? line.quantity) * scale * (1 + num(snap?.scrapPercentage ?? line.scrapPercentage) / 100)
          );
          const unitPrice = num(snap?.unitPrice ?? 0);
          return {
            itemId: line.rawItemId,
            itemName: line.rawItem?.arabicName ?? line.rawItemId,
            quantity: qty,
            unit: '—',
            unitPrice,
            lineTotal: round4(qty * unitPrice),
            warehouseId: snap?.warehouseId ?? line.warehouseId ?? meta.fromWarehouseId ?? '',
            manufacturedItemId: snap?.manufacturedItemId ?? line.manufacturedItemId ?? '',
          };
        })
      : snapshot.map((snap) => {
          const qty = round4(
            num(snap.quantity) * scale * (1 + num(snap.scrapPercentage) / 100)
          );
          const unitPrice = num(snap.unitPrice);
          return {
            itemId: snap.rawItemId,
            itemName: snap.rawItemId,
            quantity: qty,
            unit: '—',
            unitPrice,
            lineTotal: round4(qty * unitPrice),
            warehouseId: snap.warehouseId ?? meta.fromWarehouseId ?? '',
            manufacturedItemId: snap.manufacturedItemId ?? '',
          };
        });

  const outputMeta =
    meta.outputLines && meta.outputLines.length > 0
      ? meta.outputLines
      : bom.finishedItem
        ? [
            {
              itemId: bom.finishedItemId,
              quantity: baseQty,
              unit: '',
              unitPrice: 0,
              costPercent: 100,
            },
          ]
        : [];

  const distributed = distributeOutputLineCosts({
    labor: num(bom.standardLaborCost) * scale,
    overhead: num(bom.standardOverheadCost) * scale,
    outputLines: outputMeta.map((o) => ({
      itemId: o.itemId,
      quantity: round4(num(o.quantity) * scale),
      costPercent: num(o.costPercent),
    })),
    rawLines: raws.map((r) => ({
      quantity: r.quantity,
      scrapPercentage: 0,
      unitPrice: r.unitPrice,
      manufacturedItemId: r.manufacturedItemId || undefined,
    })),
    additionalLines: (meta.additionalCosts ?? []).map((c) => ({
      value: round4(num(c.value) * scale),
      manufacturedItemId: c.manufacturedItemId,
    })),
    distributeCostByUnits: Boolean(meta.distributeCostByUnits),
  });

  const outputs: ProcessOutputRow[] = outputMeta.map((o, idx) => ({
    itemId: o.itemId,
    itemName: o.itemId === bom.finishedItemId ? (bom.finishedItem?.arabicName ?? o.itemId) : o.itemId,
    quantity: round4(num(o.quantity) * scale),
    unit: (o.unit && o.unit.trim()) || '—',
    unitPrice: distributed[idx]?.unitPrice ?? num(o.unitPrice),
    lineTotal: distributed[idx]?.lineTotal ?? round4(num(o.unitPrice) * num(o.quantity) * scale),
    costPercent: distributed[idx]?.costSharePercent ?? num(o.costPercent),
    warehouseId: o.warehouseId ?? meta.toWarehouseId ?? meta.fromWarehouseId ?? '',
  }));

  const additionalCosts: ProcessAdditionalRow[] = (meta.additionalCosts ?? []).map((c) => ({
    accountId: c.accountId ?? '',
    accountLabel: c.accountLabel ?? '',
    value: round4(num(c.value) * scale),
    valuePercent: num(c.valuePercent),
    description: c.description ?? '',
    costCenter: c.costCenter ?? '',
    manufacturedItemId: c.manufacturedItemId ?? '',
  }));

  return {
    stage: meta.stage ?? '',
    fromWarehouseId: meta.fromWarehouseId ?? '',
    toWarehouseId: meta.toWarehouseId ?? meta.fromWarehouseId ?? '',
    costCenter: meta.costCenterId ?? meta.costCenter ?? '',
    distributeCostByUnits: Boolean(meta.distributeCostByUnits),
    laborCost: round4(num(bom.standardLaborCost) * scale),
    overheadCost: round4(num(bom.standardOverheadCost) * scale),
    outputs,
    raws,
    additionalCosts,
  };
}

/** يملأ أسعار الخام من متوسط التكلفة ويعيد توزيع تكلفة المنتجات التامة. */
export function enrichLoadedProcessWithItemCosts(
  loaded: LoadedManufacturingProcess,
  resolveAverageCost: (itemId: string) => number
): LoadedManufacturingProcess {
  const raws = loaded.raws.map((r) => {
    const unitPrice =
      r.unitPrice > 0 ? r.unitPrice : Math.max(0, resolveAverageCost(r.itemId));
    const lineTotal = round4(r.quantity * unitPrice);
    return { ...r, unitPrice, lineTotal };
  });

  const distributed = distributeOutputLineCosts({
    labor: loaded.laborCost,
    overhead: loaded.overheadCost,
    outputLines: loaded.outputs.map((o) => ({
      itemId: o.itemId,
      quantity: o.quantity,
      costPercent: o.costPercent,
    })),
    rawLines: raws.map((r) => ({
      quantity: r.quantity,
      scrapPercentage: 0,
      unitPrice: r.unitPrice,
      manufacturedItemId: r.manufacturedItemId || undefined,
    })),
    additionalLines: loaded.additionalCosts.map((c) => ({
      value: c.value,
      manufacturedItemId: c.manufacturedItemId || undefined,
    })),
    distributeCostByUnits: loaded.distributeCostByUnits,
  });

  const outputs = loaded.outputs.map((o, idx) => ({
    ...o,
    unitPrice: distributed[idx]?.unitPrice ?? o.unitPrice,
    lineTotal: distributed[idx]?.lineTotal ?? o.lineTotal,
    costPercent: distributed[idx]?.costSharePercent ?? o.costPercent,
  }));

  return { ...loaded, raws, outputs };
}
