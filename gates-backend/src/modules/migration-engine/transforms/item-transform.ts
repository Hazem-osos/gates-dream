import { money } from '../accounting/journal-money';
import { isLegacyItemGroup, isLegacyStockItem } from '../inventory/inventory-decision';
import { legacyBool, legacyTrim } from './legacy-values';

export function unitCompanyCode(unitCode: string, unitName: string): string {
  const code = legacyTrim(unitCode) || 'U';
  const name = legacyTrim(unitName)
    .replace(/\s+/g, '_')
    .slice(0, 40);
  return name ? `${code}:${name}` : code;
}

export function transformItemCategory(row: Record<string, unknown>, companyId: string) {
  const code = legacyTrim(row.ItemCode);
  return {
    companyId,
    code,
    arabicName: legacyTrim(row.ItemNameA) || code,
    englishName: legacyTrim(row.ItemNameE) || null,
    isActive: !legacyBool(row.Deleted, false),
  };
}

export function transformLegacyItem(row: Record<string, unknown>, companyId: string, categoryId?: string | null) {
  const serial = legacyTrim(row.ItemCode);
  return {
    companyId,
    serial,
    arabicName: legacyTrim(row.ItemNameA) || serial,
    englishName: legacyTrim(row.ItemNameE) || null,
    categoryId: categoryId ?? null,
    isActive: !legacyBool(row.Deleted, false),
    inactiveItem: legacyBool(row.Deleted, false),
    isService: false,
    isAssembly: legacyTrim(row.ItemNameA).includes('تجميعي'),
  };
}

export function transformLegacyUnit(row: Record<string, unknown>, companyId: string) {
  const unitCode = legacyTrim(row.UnitCode);
  const arabicName = legacyTrim(row.UnitNameA) || unitCode;
  return {
    companyId,
    code: unitCompanyCode(unitCode, arabicName),
    arabicName,
    englishName: legacyTrim(row.UnitNameE) || null,
    isActive: true,
  };
}

export function itemUnitFactor(row: Record<string, unknown>) {
  const factor = money(row.Change ?? 1);
  const fixed = legacyTrim(row.Fixed);
  const isFactorFixed = !fixed || fixed === 'ثابت' || fixed.toLowerCase() === 'fixed' || fixed.toUpperCase() === 'T';
  return { factor, isFactorFixed, ok: factor.gt(0) };
}

export { isLegacyItemGroup, isLegacyStockItem };
