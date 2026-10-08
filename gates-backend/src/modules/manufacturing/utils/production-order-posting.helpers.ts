import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  materialRequirementsFromProcessMetadata,
  type RawLinesSnapshotEntry,
} from './production-order-material-requirements';

export type ProductionMaterialPostingFingerprint = {
  bomId: string;
  plannedQuantity: number;
  warehouseIdRaw: string;
  warehouseIdFinished: string;
  processMetadata: { rawLinesSnapshot?: RawLinesSnapshotEntry[] } | null | undefined;
};

export function additionalCostsTotalFromMetadata(meta: unknown): number {
  if (!meta || typeof meta !== 'object') return 0;
  const rows = (meta as { additionalCosts?: Array<{ value?: number | string }> }).additionalCosts ?? [];
  return roundTo4(
    rows.reduce((sum, row) => {
      const v = Number(row.value);
      return sum + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0)
  );
}

export function productionMaterialPostingFingerprint(
  input: ProductionMaterialPostingFingerprint
): string {
  const snap = materialRequirementsFromProcessMetadata(input.processMetadata);
  const lines = snap
    ? snap.map((l) => `${l.rawItemId}:${l.quantity}`).sort().join('|')
    : '';
  return [
    input.bomId,
    String(input.plannedQuantity),
    input.warehouseIdRaw,
    input.warehouseIdFinished,
    lines,
  ].join('::');
}

export function productionMaterialPostingChanged(
  before: ProductionMaterialPostingFingerprint,
  after: ProductionMaterialPostingFingerprint
): boolean {
  return productionMaterialPostingFingerprint(before) !== productionMaterialPostingFingerprint(after);
}

/** True when issue used ProdUnified (additional BOM costs at issue time). */
export function productionOrderUsesUnifiedIssue(order: {
  additionalCostsJournalEntryId?: string | null;
}): boolean {
  return Boolean(order.additionalCostsJournalEntryId);
}
