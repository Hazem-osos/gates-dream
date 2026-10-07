import { roundTo4 } from '../../../shared/utils/decimal-round';

export type RawLineCostInput = {
  quantity: number;
  scrapPercentage: number;
  unitPrice: number;
  manufacturedItemId?: string;
};

export type AdditionalCostLineInput = {
  value: number;
  manufacturedItemId?: string;
};

export type OutputLineCostInput = {
  itemId: string;
  quantity: number;
  costPercent: number;
};

export type ManufacturingCostComponents = {
  labor: number;
  overhead: number;
};

export function computeSingleRawLineCost(line: RawLineCostInput): number {
  const qty = Number(line.quantity);
  const scrap = Number(line.scrapPercentage) || 0;
  const price = Number(line.unitPrice) || 0;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return roundTo4(qty * (1 + scrap / 100) * price);
}

export function computeRawMaterialsTotal(lines: RawLineCostInput[]): number {
  return roundTo4(lines.reduce((sum, line) => sum + computeSingleRawLineCost(line), 0));
}

export function computeAdditionalCostsTotal(lines: AdditionalCostLineInput[]): number {
  return roundTo4(lines.reduce((sum, line) => sum + (Number(line.value) || 0), 0));
}

export function computeManufacturingCostPool(params: {
  rawMaterialsTotal: number;
  labor: number;
  overhead: number;
  additionalTotal: number;
}): number {
  const { rawMaterialsTotal, labor, overhead, additionalTotal } = params;
  return (
    (Number(rawMaterialsTotal) || 0) +
    (Number(labor) || 0) +
    (Number(overhead) || 0) +
    (Number(additionalTotal) || 0)
  );
}

export type DistributedOutputLine = {
  lineTotal: number;
  unitPrice: number;
  costSharePercent: number;
  directCost: number;
  sharedCost: number;
};

export type DistributeOutputLineCostsInput = ManufacturingCostComponents & {
  outputLines: OutputLineCostInput[];
  rawLines: RawLineCostInput[];
  additionalLines: AdditionalCostLineInput[];
  distributeCostByUnits: boolean;
};

function partitionCostsByManufacturedTarget(
  outputLines: OutputLineCostInput[],
  rawLines: RawLineCostInput[],
  additionalLines: AdditionalCostLineInput[]
): {
  directByItemId: Map<string, number>;
  generalRaw: number;
  generalAdditional: number;
} {
  const outputIds = new Set(outputLines.map((o) => o.itemId).filter(Boolean));
  const directByItemId = new Map<string, number>();
  for (const id of outputIds) directByItemId.set(id, 0);

  let generalRaw = 0;
  let generalAdditional = 0;

  for (const raw of rawLines) {
    const cost = computeSingleRawLineCost(raw);
    if (cost <= 0) continue;
    const target = raw.manufacturedItemId?.trim();
    if (target && outputIds.has(target)) {
      directByItemId.set(target, (directByItemId.get(target) ?? 0) + cost);
    } else {
      generalRaw += cost;
    }
  }

  for (const add of additionalLines) {
    const cost = Number(add.value) || 0;
    if (cost <= 0) continue;
    const target = add.manufacturedItemId?.trim();
    if (target && outputIds.has(target)) {
      directByItemId.set(target, (directByItemId.get(target) ?? 0) + cost);
    } else {
      generalAdditional += cost;
    }
  }

  return {
    directByItemId,
    generalRaw: roundTo4(generalRaw),
    generalAdditional: roundTo4(generalAdditional),
  };
}

export function distributeOutputLineCosts(input: DistributeOutputLineCostsInput): DistributedOutputLine[] {
  const { outputLines, rawLines, additionalLines, distributeCostByUnits } = input;
  const labor = Number(input.labor) || 0;
  const overhead = Number(input.overhead) || 0;

  if (outputLines.length === 0) return [];

  const { directByItemId, generalRaw, generalAdditional } = partitionCostsByManufacturedTarget(
    outputLines,
    rawLines,
    additionalLines
  );

  const directCosts = outputLines.map((o) => roundTo4(directByItemId.get(o.itemId) ?? 0));
  const sharedCosts = new Array<number>(outputLines.length).fill(0);

  if (distributeCostByUnits) {
    const pool = generalRaw + generalAdditional;
    const sumQty = outputLines.reduce(
      (s, l) => s + (Number(l.quantity) > 0 ? Number(l.quantity) : 0),
      0
    );
    outputLines.forEach((line, index) => {
      const qty = Number(line.quantity) || 0;
      if (pool <= 0 || sumQty <= 0 || qty <= 0) {
        sharedCosts[index] = 0;
        return;
      }
      sharedCosts[index] = roundTo4(pool * (qty / sumQty));
    });
  } else {
    const pool = generalRaw + generalAdditional + labor + overhead;
    const sumPercent = outputLines.reduce((s, l) => s + (Number(l.costPercent) || 0), 0);
    const useEqualPercent = sumPercent <= 0;
    const equalPercent = outputLines.length > 0 ? 100 / outputLines.length : 0;
    const weightSum = useEqualPercent ? outputLines.length : sumPercent;

    outputLines.forEach((line, index) => {
      const pct = useEqualPercent ? equalPercent : Number(line.costPercent) || 0;
      sharedCosts[index] = pool > 0 && weightSum > 0 ? roundTo4(pool * (pct / weightSum)) : 0;
    });
  }

  const results = outputLines.map((line, index) => {
    const qty = Number(line.quantity) || 0;
    const directCost = directCosts[index] ?? 0;
    const sharedCost = sharedCosts[index] ?? 0;
    const lineTotal = roundTo4(directCost + sharedCost);
    const unitPrice = qty > 0 ? roundTo4(lineTotal / qty) : 0;
    const manualPct = Number(line.costPercent) || 0;

    return {
      lineTotal,
      unitPrice,
      costSharePercent: roundTo4(manualPct),
      directCost,
      sharedCost,
    };
  });

  const sumTotals = results.reduce((s, r) => s + r.lineTotal, 0);
  if (sumTotals > 0 && (distributeCostByUnits || directCosts.some((d) => d > 0))) {
    for (const row of results) {
      row.costSharePercent = roundTo4((row.lineTotal / sumTotals) * 100);
    }
  }

  return results;
}

export function sumOutputCostPercents(
  lines: Pick<OutputLineCostInput, 'costPercent' | 'quantity'>[]
): number {
  return lines.reduce((s, l) => s + (Number(l.costPercent) || 0), 0);
}
