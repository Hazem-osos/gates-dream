import type { LoadedManufacturingProcess } from '@/lib/manufacturing/process-from-bom';

export type BomCreateFromProcessPayload = {
  name: string;
  finishedItemId: string;
  baseQuantity: number;
  standardLaborCost: number;
  standardOverheadCost: number;
  formMetadata: Record<string, unknown>;
  lines: Array<{
    rawItemId: string;
    quantity: number;
    scrapPercentage: number;
    lineOrder: number;
    warehouseId?: string;
    manufacturedItemId?: string;
  }>;
};

export function buildBomCreatePayloadFromProcess(opts: {
  name: string;
  plannedQuantity: number;
  process: LoadedManufacturingProcess;
}): BomCreateFromProcessPayload | null {
  const outputs = opts.process.outputs.filter((o) => o.itemId.trim() && o.quantity > 0);
  const raws = opts.process.raws.filter((r) => r.itemId.trim() && r.quantity > 0);
  const finishedItemId = outputs[0]?.itemId.trim();
  if (!finishedItemId || raws.length === 0) return null;

  const baseQuantity =
    Number.isFinite(opts.plannedQuantity) && opts.plannedQuantity > 0 ? opts.plannedQuantity : 1;

  return {
    name: opts.name.trim() || 'نموذج تصنيع',
    finishedItemId,
    baseQuantity,
    standardLaborCost: Number(opts.process.laborCost) || 0,
    standardOverheadCost: Number(opts.process.overheadCost) || 0,
    formMetadata: {
      distributeCostByUnits: opts.process.distributeCostByUnits,
      fromWarehouseId: opts.process.fromWarehouseId || undefined,
      toWarehouseId: opts.process.toWarehouseId || undefined,
      stage: opts.process.stage || undefined,
      costCenter: opts.process.costCenter || undefined,
      outputLines: outputs.map((o) => ({
        itemId: o.itemId,
        quantity: o.quantity,
        unit: o.unit,
        unitPrice: o.unitPrice,
        costPercent: o.costPercent,
        warehouseId: o.warehouseId || undefined,
      })),
      additionalCosts: opts.process.additionalCosts
        .filter((c) => c.accountId || c.accountLabel || c.value > 0)
        .map((c) => ({
          accountId: c.accountId || undefined,
          accountLabel: c.accountLabel,
          value: c.value,
          valuePercent: c.valuePercent,
          description: c.description,
          costCenter: c.costCenter,
          manufacturedItemId: c.manufacturedItemId || undefined,
        })),
      rawLinesSnapshot: raws.map((r) => ({
        rawItemId: r.itemId,
        quantity: r.quantity,
        scrapPercentage: 0,
        unitPrice: r.unitPrice,
        warehouseId: r.warehouseId || undefined,
        manufacturedItemId: r.manufacturedItemId || undefined,
      })),
    },
    lines: raws.map((r, index) => ({
      rawItemId: r.itemId,
      quantity: r.quantity,
      scrapPercentage: 0,
      lineOrder: index + 1,
      warehouseId: r.warehouseId || undefined,
      manufacturedItemId: r.manufacturedItemId || undefined,
    })),
  };
}
