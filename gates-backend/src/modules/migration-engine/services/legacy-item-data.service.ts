import type { LegacySourceAdapter } from '../types';

export async function loadLegacyItems(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT CompanyCode, ItemCode, ParentItem, ItemNameA, ItemNameE, ItemStatus, ItemType, HasChild, Deleted, ItemCat
     FROM dbo.Item WHERE RTRIM(CompanyCode)=@cc
     ORDER BY ItemLevel, ItemCode`,
    { cc: companyCode }
  );
}

export async function loadLegacyItemUnits(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT CompanyCode, ItemCode, UnitCode, UnitNameA, UnitNameE, Change, Fixed, BarCode
     FROM dbo.ItemUnit WHERE RTRIM(CompanyCode)=@cc
     ORDER BY ItemCode, UnitCode`,
    { cc: companyCode }
  );
}

export async function loadLegacyStores(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT CompanyCode, StoreCode, ParentStore, StoreNameA, StoreNameE, StoreType, HasChild, Deleted,
            StoreAccountCode, CostAccountCode, OfferAccountCode, Address, Ameen
     FROM dbo.Store WHERE RTRIM(CompanyCode)=@cc
     ORDER BY StoreLevel, StoreCode`,
    { cc: companyCode }
  );
}
