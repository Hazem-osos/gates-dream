import type { LegacySourceAdapter } from '../types';
import { resolveLegacyInvoiceWarehouse } from '../inventory/inventory-decision';
import { legacyTrim } from '../transforms/legacy-values';

const POSTED = `RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'`;

export interface LegacyStockMovementRow {
  family: 'INV' | 'ST' | 'SC' | 'SK' | 'SA';
  yearId: string;
  branchCode: string;
  type: string;
  docNum: string;
  rowKey: string;
  date: Date;
  itemCode: string;
  warehouseCode: string;
  otherWarehouseCode: string;
  unitCode: string;
  qty1: unknown;
  qty2: unknown;
  transMainQty: unknown;
  transQty: unknown;
  qty: unknown;
  change: unknown;
  price: unknown;
  costPrice: unknown;
  affectStore: boolean;
  posted: boolean;
  deleted: boolean;
  glNum: string;
}

export function movementCursor(row: LegacyStockMovementRow): string {
  return [row.date.toISOString(), row.family, row.yearId, row.type, row.docNum, row.rowKey, row.warehouseCode].join('|');
}

export async function loadPostedInvoiceStockLines(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<LegacyStockMovementRow[]> {
  const rows = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.InvoiceNum, h.Date, h.Status, h.Deleted, h.AffectStore, h.GLNum,
            d.ItemCode, d.StoreCode AS LineStore, h.StoreCode AS HeaderStore, d.UnitCode1, d.UnitCode2,
            d.Qty1, d.Qty2, d.CostPrice, d.Price, d.GridNum, d.Serial
     FROM dbo.InvoiceTrxDetail d
     INNER JOIN dbo.InvoiceTrxHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.InvoiceNum=d.InvoiceNum AND h.Type=d.Type
     WHERE RTRIM(d.CompanyCode)=@cc
     ORDER BY h.Date, h.YearID, h.InvoiceNum, d.GridNum, d.Serial, d.ItemCode`,
    { cc: companyCode }
  );
  return rows.map((row, index) => ({
    family: 'INV' as const,
    yearId: legacyTrim(row.YearID),
    branchCode: legacyTrim(row.BranchCode),
    type: legacyTrim(row.Type),
    docNum: legacyTrim(row.InvoiceNum),
    rowKey: `${legacyTrim(row.ItemCode)}:${String(row.GridNum ?? '')}:${String(row.Serial ?? '')}:${index}`,
    date: row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0)),
    itemCode: legacyTrim(row.ItemCode),
    warehouseCode: resolveLegacyInvoiceWarehouse(row.LineStore, row.HeaderStore).warehouseCode,
    otherWarehouseCode: '',
    unitCode: legacyTrim(row.UnitCode2) || legacyTrim(row.UnitCode1),
    qty1: row.Qty1,
    qty2: row.Qty2,
    transMainQty: null,
    transQty: null,
    qty: row.Qty2 ?? row.Qty1,
    change: 1,
    price: row.Price,
    costPrice: row.CostPrice,
    affectStore: legacyTrim(row.AffectStore).toUpperCase() === 'T',
    posted: legacyTrim(row.Status).toLowerCase() === 'post',
    deleted: legacyTrim(row.Deleted).toUpperCase() === 'T',
    glNum: legacyTrim(row.GLNum),
  }));
}

export async function loadPostedStoreTransLines(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<LegacyStockMovementRow[]> {
  const rows = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.StoreTransCode, h.Date, h.Status, h.Deleted, h.GLNum,
            h.FromStoreCode, h.ToStoreCode, d.ItemCode, d.Qty, d.TransQty, d.TransMainQty, d.Change,
            d.UnitCode, d.Price, d.RowNum
     FROM dbo.StoreTransDetail d
     INNER JOIN dbo.StoreTransHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.StoreTransCode=d.StoreTransCode AND h.Type=d.Type
     WHERE RTRIM(d.CompanyCode)=@cc
     ORDER BY h.Date, h.YearID, h.StoreTransCode, d.RowNum, d.ItemCode`,
    { cc: companyCode }
  );
  return rows.map((row, index) => ({
    family: 'ST' as const,
    yearId: legacyTrim(row.YearID),
    branchCode: legacyTrim(row.BranchCode),
    type: legacyTrim(row.Type),
    docNum: legacyTrim(row.StoreTransCode),
    rowKey: `${legacyTrim(row.ItemCode)}:${String(row.RowNum ?? '')}:${index}`,
    date: row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0)),
    itemCode: legacyTrim(row.ItemCode),
    warehouseCode: legacyTrim(row.FromStoreCode),
    otherWarehouseCode: legacyTrim(row.ToStoreCode),
    unitCode: legacyTrim(row.UnitCode),
    qty1: row.Qty,
    qty2: row.TransMainQty,
    transMainQty: row.TransMainQty,
    transQty: row.TransQty,
    qty: row.Qty,
    change: row.Change,
    price: row.Price,
    costPrice: row.Price,
    affectStore: true,
    posted: legacyTrim(row.Status).toLowerCase() === 'post',
    deleted: legacyTrim(row.Deleted).toUpperCase() === 'T',
    glNum: legacyTrim(row.GLNum),
  }));
}

export async function loadPostedStoreCollLines(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<LegacyStockMovementRow[]> {
  const rows = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.StoreCollCode, h.Date, h.Status, h.Deleted, h.GLNum,
            h.FromStoreCode, h.ToStoreCode, d.ItemCode, d.Qty, d.TransQty, d.UnitCode, d.Price
     FROM dbo.StoreCollDetail d
     INNER JOIN dbo.StoreCollHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.StoreCollCode=d.StoreCollCode AND h.Type=d.Type
     WHERE RTRIM(d.CompanyCode)=@cc
     ORDER BY h.Date, h.YearID, h.StoreCollCode, d.ItemCode`,
    { cc: companyCode }
  );
  return rows.map((row, index) => ({
    family: 'SC' as const,
    yearId: legacyTrim(row.YearID),
    branchCode: legacyTrim(row.BranchCode),
    type: legacyTrim(row.Type),
    docNum: legacyTrim(row.StoreCollCode),
    rowKey: `${legacyTrim(row.ItemCode)}:${index}`,
    date: row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0)),
    itemCode: legacyTrim(row.ItemCode),
    warehouseCode: legacyTrim(row.FromStoreCode),
    otherWarehouseCode: legacyTrim(row.ToStoreCode),
    unitCode: legacyTrim(row.UnitCode),
    qty1: row.Qty,
    qty2: row.TransQty,
    transMainQty: row.TransQty,
    transQty: row.TransQty,
    qty: row.Qty,
    change: 1,
    price: row.Price,
    costPrice: row.Price,
    affectStore: true,
    posted: legacyTrim(row.Status).toLowerCase() === 'post',
    deleted: legacyTrim(row.Deleted).toUpperCase() === 'T',
    glNum: legacyTrim(row.GLNum),
  }));
}

export async function loadPostedPurchaseLineCosts(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.InvoiceNum, h.Date, h.DateH, d.ItemCode, d.CostPrice, d.Serial, h.AffectStore
     FROM dbo.InvoiceTrxDetail d
     INNER JOIN dbo.InvoiceTrxHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.InvoiceNum=d.InvoiceNum AND h.Type=d.Type
     WHERE RTRIM(d.CompanyCode)=@cc
       AND RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'
       AND RTRIM(h.Type)='PI01'
       AND CAST(ISNULL(d.CostPrice,0) AS DECIMAL(18,6)) > 0
     ORDER BY d.ItemCode, h.Date, d.Serial`,
    { cc: companyCode }
  );
}

export async function loadLegacyItemCosts(adapter: LegacySourceAdapter, companyCode: string) {
  return adapter.querySql<Record<string, unknown>>(
    `SELECT CompanyCode, BranchCode, SourceNum, SourceYearId, SourceType, Serial, ItemCode, Date, DateH, Cost, SaveDateTime
     FROM dbo.ItemCost WHERE RTRIM(CompanyCode)=@cc
     ORDER BY ItemCode, SaveDateTime, Serial`,
    { cc: companyCode }
  );
}

/** Posted stocktake variance lines — delta = ActualQty - Qty (book). */
export async function loadPostedStoreCheckDetailLines(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<LegacyStockMovementRow[]> {
  const rows = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.StoreCheckCode, h.Date, h.Status, h.Deleted, h.GLNum, h.StoreCode,
            d.ItemCode, d.Qty, d.ActualQty, d.UnitCode, d.Price, d.ItemAddQty, d.ItemRemoveQty, d.Remarks
     FROM dbo.StoreCheckDetail d
     INNER JOIN dbo.StoreCheckHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.StoreCheckCode=d.StoreCheckCode
     WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(h.Performed,''))='T'
     ORDER BY h.Date, h.StoreCheckCode, d.ItemCode`,
    { cc: companyCode }
  );
  return rows.map((row, index) => {
    const book = Number(row.Qty ?? 0);
    const actual = Number(row.ActualQty ?? 0);
    const delta = actual - book;
    return {
      family: 'SK' as const,
      yearId: legacyTrim(row.YearID),
      branchCode: legacyTrim(row.BranchCode),
      type: legacyTrim(row.Type),
      docNum: legacyTrim(row.StoreCheckCode),
      rowKey: `${legacyTrim(row.ItemCode)}:${index}`,
      date: row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0)),
      itemCode: legacyTrim(row.ItemCode),
      warehouseCode: legacyTrim(row.StoreCode),
      otherWarehouseCode: '',
      unitCode: legacyTrim(row.UnitCode),
      qty1: delta,
      qty2: delta,
      transMainQty: null,
      transQty: null,
      qty: delta,
      change: 1,
      price: row.Price,
      costPrice: row.Price,
      affectStore: delta !== 0,
      posted: true,
      deleted: false,
      glNum: legacyTrim(row.GLNum),
    };
  });
}

/** Posted store adjustment after stocktake — net ItemAddQty - ItemRemoveQty. */
export async function loadPostedStoreAdjustDetailLines(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<LegacyStockMovementRow[]> {
  const rows = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.YearID, h.BranchCode, h.Type, h.StoreCheckCode, h.Date, h.Status, h.Deleted, h.GLNum, h.StoreCode,
            d.ItemCode, d.Qty, d.ActualQty, d.UnitCode, d.Price, d.ItemAddQty, d.ItemRemoveQty
     FROM dbo.StoreAdjustDetail d
     INNER JOIN dbo.StoreAdjustHeader h
       ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID
      AND h.StoreCheckCode=d.StoreCheckCode
     WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED}
     ORDER BY h.Date, h.StoreCheckCode, d.ItemCode`,
    { cc: companyCode }
  );
  return rows.map((row, index) => {
    const add = Number(row.ItemAddQty ?? 0);
    const rem = Number(row.ItemRemoveQty ?? 0);
    const delta = add - rem;
    return {
      family: 'SA' as const,
      yearId: legacyTrim(row.YearID),
      branchCode: legacyTrim(row.BranchCode),
      type: legacyTrim(row.Type),
      docNum: legacyTrim(row.StoreCheckCode),
      rowKey: `${legacyTrim(row.ItemCode)}:${index}`,
      date: row.Date instanceof Date ? row.Date : new Date(String(row.Date ?? 0)),
      itemCode: legacyTrim(row.ItemCode),
      warehouseCode: legacyTrim(row.StoreCode),
      otherWarehouseCode: '',
      unitCode: legacyTrim(row.UnitCode),
      qty1: delta,
      qty2: delta,
      transMainQty: null,
      transQty: null,
      qty: delta,
      change: 1,
      price: row.Price,
      costPrice: row.Price,
      affectStore: delta !== 0,
      posted: true,
      deleted: legacyTrim(row.Deleted).toUpperCase() === 'T',
      glNum: legacyTrim(row.GLNum),
    };
  });
}

export async function countPostedStocktake(adapter: LegacySourceAdapter, companyCode: string): Promise<number> {
  const rows = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM dbo.StoreCheckHeader h
     WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(h.Performed,''))='T'`,
    { cc: companyCode }
  );
  return Number(rows[0]?.cnt ?? 0);
}
