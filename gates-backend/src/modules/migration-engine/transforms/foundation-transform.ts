import { legacyDate, legacyTrim } from './legacy-values';

export type LegacyRow = Record<string, unknown>;

export function transformBranch(row: LegacyRow, companyId: string) {
  const branchCode = legacyTrim(row.BranchCode);
  return {
    companyId,
    legacyBranchCode: branchCode,
    arabicName: legacyTrim(row.BranchNameA) || `Branch ${branchCode}`,
    address: legacyTrim(row.Address) || null,
  };
}

export function transformFiscalYear(row: LegacyRow, companyId: string) {
  const yearCode = legacyTrim(row.YearCode ?? row.YearID);
  const statusRaw = legacyTrim(row.Status).toLowerCase();
  return {
    companyId,
    legacyYearId: yearCode,
    arabicName: legacyTrim(row.YearNameA) || yearCode,
    englishName: legacyTrim(row.YearNameE) || null,
    startDate: legacyDate(row.FromDate) ?? new Date(),
    endDate: legacyDate(row.ToDate) ?? new Date(),
    status: statusRaw.includes('close') ? 'Close' : 'Open',
  };
}

export function transformCostCenter(row: LegacyRow, companyId: string) {
  const code = legacyTrim(row.CCenterCode ?? row.CostCenterCode ?? row.Code);
  return {
    companyId,
    code,
    arabicName: legacyTrim(row.CCenterNameA ?? row.CostCenterNameA) || code,
    englishName: legacyTrim(row.CCenterNameE ?? row.CostCenterNameE) || null,
    isActive: true,
  };
}

export function transformWarehouse(row: LegacyRow, companyId: string, branchId?: string) {
  const storeCode = legacyTrim(row.StoreCode ?? row.Code);
  return {
    companyId,
    branchId,
    legacyStoreCode: storeCode,
    code: storeCode,
    arabicName: legacyTrim(row.StoreNameA ?? row.NameA) || storeCode,
    englishName: legacyTrim(row.StoreNameE ?? row.NameE) || null,
    isActive: true,
  };
}
