import { roundTo4 } from '../../../shared/utils/decimal-round';

export type MaterialRequirementLine = {
  rawItemId: string;
  quantity: number;
};

export type RawLinesSnapshotEntry = {
  rawItemId?: string;
  quantity?: number | string;
};

/**
 * Order UI saves absolute issue quantities in processMetadata.rawLinesSnapshot.
 * When present, material issue / stock must follow the snapshot — not BOM re-explode.
 */
export function materialRequirementsFromProcessMetadata(
  meta: { rawLinesSnapshot?: RawLinesSnapshotEntry[] } | null | undefined
): MaterialRequirementLine[] | null {
  const snap = meta?.rawLinesSnapshot;
  if (!Array.isArray(snap) || snap.length === 0) return null;

  const merged = new Map<string, number>();
  for (const line of snap) {
    const rawItemId = String(line.rawItemId ?? '').trim();
    const quantity = Number(line.quantity);
    if (!rawItemId || !Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(rawItemId, roundTo4((merged.get(rawItemId) ?? 0) + quantity));
  }

  if (merged.size === 0) return null;
  return Array.from(merged, ([rawItemId, quantity]) => ({ rawItemId, quantity }));
}
