export const DEFAULT_PIECE_UNIT_CODE = 'PCS';
export const DEFAULT_PIECE_UNIT_NAME = 'قطعة';

export function isDefaultPieceUnit(unit: {
  code?: string | null;
  arabicName?: string | null;
}): boolean {
  return unit.code === DEFAULT_PIECE_UNIT_CODE || unit.arabicName === DEFAULT_PIECE_UNIT_NAME;
}

export function findDefaultPieceUnitId(
  units: Array<{ id: string; code?: string | null; arabicName?: string | null }>
): string {
  return units.find(isDefaultPieceUnit)?.id ?? '';
}

/** Item ↔ unit helpers for invoice lines and selectors */

export type ItemUnitLink = {
  unitId?: string;
  isBaseUnit?: boolean;
  conversionFactor?: number | string | null;
  isFactorFixed?: boolean | null;
  unit?: {
    id: string;
    code?: string | null;
    arabicName?: string;
    englishName?: string | null;
  };
};

export type ItemWithUnits = {
  id: string;
  units?: ItemUnitLink[];
};

export function unitsForItem(item: ItemWithUnits | undefined): ItemUnitLink[] {
  return (
    item?.units?.filter((u) => u.unit?.id || u.unitId) ?? []
  );
}

export function defaultUnitIdForItem(item: ItemWithUnits | undefined): string {
  if (!item?.units?.length) return '';
  const base = item.units.find((u) => u.isBaseUnit) ?? item.units[0];
  return base?.unit?.id ?? base?.unitId ?? '';
}

/** Map GET /inventory/item-units rows to line-grid unit links. */
export function itemUnitRowsToLinks(
  rows: Array<{
    unitId: string;
    isBaseUnit?: boolean;
    isFactorFixed?: boolean | null;
    conversionFactor?: number | string | null;
    unit?: { id: string; code?: string | null; arabicName?: string; englishName?: string | null };
  }>
): ItemUnitLink[] {
  return rows.map((row) => ({
    unitId: row.unitId,
    isBaseUnit: row.isBaseUnit,
    isFactorFixed: row.isFactorFixed,
    conversionFactor: row.conversionFactor,
    unit: row.unit
      ? {
          id: row.unit.id,
          code: row.unit.code,
          arabicName: row.unit.arabicName ?? '—',
          englishName: row.unit.englishName,
        }
      : { id: row.unitId, arabicName: '—' },
  }));
}

export function formatUnitLabel(link: ItemUnitLink): string {
  const u = link.unit;
  if (!u) return '—';
  const code = u.code?.trim();
  return code ? `${u.arabicName ?? code} (${code})` : (u.arabicName ?? '—');
}

export function baseUnitLinkForItem(item: ItemWithUnits | undefined): ItemUnitLink | undefined {
  if (!item?.units?.length) return undefined;
  return item.units.find((u) => u.isBaseUnit) ?? item.units[0];
}

export function baseUnitLabelForItem(item: ItemWithUnits | undefined): string {
  const link = baseUnitLinkForItem(item);
  return link ? formatUnitLabel(link) : '—';
}

export function baseQuantityForLine(
  item: ItemWithUnits | undefined,
  unitId: string | undefined,
  quantity: number
): number | null {
  if (!item?.units?.length || !unitId || !Number.isFinite(quantity)) return null;
  const link = item.units.find((u) => (u.unit?.id ?? u.unitId) === unitId);
  const factor = link?.conversionFactor != null ? Number(link.conversionFactor) : 1;
  if (!Number.isFinite(factor) || factor <= 0) return null;
  return quantity * factor;
}
