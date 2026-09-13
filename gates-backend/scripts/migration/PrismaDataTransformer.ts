import type { LegacyRow } from './types';
import {
  legacyBool,
  legacyDate,
  legacyDecimal,
  legacyTrim,
  padGlNum,
} from './utils/legacy-values';

export class PrismaDataTransformer {
  transformCompany(row: LegacyRow) {
    const code = legacyTrim(row.CompanyCode);
    return {
      legacyCompanyCode: code,
      arabicName: legacyTrim(row.CompanyNameA) || `Company ${code}`,
      englishName: legacyTrim(row.CompanyNameE) || null,
      phone1: legacyTrim(row.Telephone1) || null,
      address: legacyTrim(row.Address) || null,
      isActive: true,
    };
  }

  transformBranch(row: LegacyRow, companyId: string) {
    const branchCode = legacyTrim(row.BranchCode);
    return {
      companyId,
      legacyBranchCode: branchCode,
      arabicName: legacyTrim(row.BranchNameA) || `Branch ${branchCode}`,
      address: legacyTrim(row.Address) || null,
    };
  }

  transformFiscalYear(row: LegacyRow, companyId: string) {
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

  transformAccount(row: LegacyRow, companyId: string) {
    const code = legacyTrim(row.AccountCode);
    return {
      companyId,
      code,
      arabicName: legacyTrim(row.AccountNameA) || code,
      englishName: legacyTrim(row.AccountNameE) || null,
      accountType: this.mapAccountType(legacyTrim(row.AccountType)),
      accountSide: legacyTrim(row.AccountSide) || null,
      currencyCode: legacyTrim(row.CurrencyCode) || null,
      // Delphi's Deleted flag means "retired from new entries", not erased: the account can
      // still carry posted history. Soft-deleting it here would drop that history from reports.
      isActive: !legacyBool(row.Deleted, false),
      deletedAt: null,
    };
  }

  transformCostCenter(row: LegacyRow, companyId: string) {
    const code = legacyTrim(row.CCenterCode ?? row.CostCenterCode ?? row.Code);
    return {
      companyId,
      code,
      arabicName: legacyTrim(row.CCenterNameA ?? row.CostCenterNameA) || code,
      englishName: legacyTrim(row.CCenterNameE ?? row.CostCenterNameE) || null,
      isActive: true,
    };
  }

  transformCustomer(row: LegacyRow, companyId: string, mainAccountId?: string) {
    const code = legacyTrim(row.CustomerCode ?? row.Code);
    return {
      companyId,
      code,
      arabicName: legacyTrim(row.CustomerNameA ?? row.NameA) || code,
      englishName: legacyTrim(row.CustomerNameE ?? row.NameE) || null,
      mainAccountId: mainAccountId ?? null,
      phone1: legacyTrim(row.Phone ?? row.Telephone1) || null,
      creditLimit: legacyDecimal(row.CreditLimit ?? row.MaxCredit, 4),
      isActive: !legacyBool(row.Deleted, false),
    };
  }

  transformSupplier(row: LegacyRow, companyId: string, mainAccountId?: string) {
    const code = legacyTrim(row.SupplierCode ?? row.Code);
    return {
      companyId,
      code,
      arabicName: legacyTrim(row.SupplierNameA ?? row.NameA) || code,
      englishName: legacyTrim(row.SupplierNameE ?? row.NameE) || null,
      mainAccountId: mainAccountId ?? null,
      phone1: legacyTrim(row.Phone ?? row.Telephone1) || null,
      isActive: !legacyBool(row.Deleted, false),
    };
  }

  transformWarehouse(row: LegacyRow, companyId: string, branchId?: string) {
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

  transformItem(row: LegacyRow, companyId: string) {
    const serial = legacyTrim(row.ItemCode ?? row.Serial ?? row.Code);
    return {
      companyId,
      serial,
      arabicName: legacyTrim(row.ItemNameA ?? row.NameA) || serial,
      englishName: legacyTrim(row.ItemNameE ?? row.NameE) || null,
      isActive: !legacyBool(row.InactiveItem ?? row.Deleted, false),
    };
  }

  transformJournalHeader(
    row: LegacyRow,
    ids: {
      companyId: string;
      branchId?: string;
      fiscalYearId?: string;
    }
  ) {
    const glNum = padGlNum(row.GlNum ?? row.GLNum);
    const status = legacyTrim(row.Status);
    const isPosted = status.toLowerCase() === 'post';
    return {
      companyId: ids.companyId,
      branchId: ids.branchId,
      fiscalYearId: ids.fiscalYearId,
      legacyGlNum: glNum,
      date: legacyDate(row.Date) ?? new Date(),
      hijriDate: legacyTrim(row.DateH) || null,
      descriptionAr: legacyTrim(row.DescA) || null,
      descriptionEn: legacyTrim(row.DescE) || null,
      description: legacyTrim(row.DescA) || legacyTrim(row.DescE) || null,
      currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
      exchangeRate: legacyDecimal(row.Change ?? 1, 6),
      postingStatus: isPosted ? 'Post' : 'UnPost',
      isPosted,
      isBalanced: legacyBool(row.Balanced, true),
      isCancelled: legacyBool(row.Deleted, false),
      deletedAt: legacyBool(row.Deleted, false) ? new Date() : null,
      sourceType: legacyTrim(row.Type) || null,
      sourceNumber: legacyTrim(row.SourceNum) || null,
      sourceYearId: legacyTrim(row.YearID) || null,
      entryType: legacyTrim(row.GLInvoiceType) || 'GL',
      createdBy: legacyTrim(row.UserCode) || 'legacy-import',
    };
  }

  transformJournalLine(row: LegacyRow, journalEntryId: string, accountId: string, costCenterId?: string) {
    const lineNumber = parseInt(String(row.LineNum ?? row.IdNum ?? '1'), 10) || 1;
    const debit = legacyDecimal(row.DebitValue ?? row.Debit, 4);
    const credit = legacyDecimal(row.CreditValue ?? row.Credit, 4);
    const rate = legacyDecimal(row.Change ?? 1, 6);
    return {
      journalEntryId,
      lineNumber,
      lineOrder: lineNumber,
      accountId,
      costCenterId,
      description: legacyTrim(row.DescA ?? row.Description) || null,
      debit,
      credit,
      exchangeRate: rate,
      debitBase: legacyDecimal(debit * rate, 4),
      creditBase: legacyDecimal(credit * rate, 4),
    };
  }

  transformInvoiceHeader(
    row: LegacyRow,
    ids: {
      companyId: string;
      branchId?: string;
      fiscalYearId?: string;
      customerId?: string;
      supplierId?: string;
      warehouseId?: string;
    }
  ) {
    const invoiceNum = legacyTrim(row.InvoiceNum);
    const trxType = legacyTrim(row.TrxType ?? row.Type);
    const invoiceKind = this.mapInvoiceKind(trxType);
    return {
      companyId: ids.companyId,
      branchId: ids.branchId,
      fiscalYearId: ids.fiscalYearId,
      invoiceNumber: invoiceNum,
      invoiceKind,
      invoiceType: invoiceKind === 'PURCHASE' ? 'purchase' : 'sales',
      date: legacyDate(row.Date) ?? new Date(),
      hijriDate: legacyTrim(row.DateH) || null,
      currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
      exchangeRate: legacyDecimal(row.Change ?? 1, 6),
      sourceYearId: legacyTrim(row.YearID) || null,
      customerId: ids.customerId,
      supplierId: ids.supplierId,
      warehouseId: ids.warehouseId,
      totalAmount: legacyDecimal(row.TotalValue ?? row.Total, 2),
      discountAmount: legacyDecimal(row.DiscountValue ?? row.Discount, 2),
      taxAmount: legacyDecimal(row.DaribaValue ?? row.TaxValue, 2),
      netAmount: legacyDecimal(row.NetValue ?? row.Net, 2),
      remainingAmount: legacyDecimal(row.RemainingValue ?? row.NetValue ?? row.Net, 2),
      isPosted: legacyTrim(row.Status).toLowerCase() === 'post',
      isCancelled: legacyBool(row.Deleted, false),
      paymentMethod: legacyTrim(row.CashType) ? 'cash' : 'credit',
    };
  }

  transformInvoiceLine(
    row: LegacyRow,
    invoiceId: string,
    itemId: string,
    unitId: string
  ) {
    const qty = legacyDecimal(row.Quantity ?? row.Qty, 3);
    const price = legacyDecimal(row.Price ?? row.UnitPrice, 4);
    const lineOrder = parseInt(String(row.LineNum ?? row.IdNum ?? '1'), 10) || 1;
    return {
      invoiceId,
      itemId,
      unitId,
      quantity: qty,
      baseQuantity: qty,
      price,
      total: legacyDecimal(row.TotalValue ?? qty * price, 2),
      discountAmount: legacyDecimal(row.DiscountValue, 2),
      taxAmount: legacyDecimal(row.DaribaValue, 2),
      lineOrder,
    };
  }

  transformCashHeader(
    row: LegacyRow,
    ids: {
      companyId: string;
      branchId?: string;
      fiscalYearId?: string;
      customerId?: string;
      supplierId?: string;
      offsetAccountId?: string;
    }
  ) {
    const kindRaw = legacyTrim(row.TrxType ?? row.Type ?? row.CashType).toUpperCase();
    const transactionKind = kindRaw.includes('PAY') ? 'PAYMENT' : 'RECEIPT';
    return {
      companyId: ids.companyId,
      branchId: ids.branchId,
      fiscalYearId: ids.fiscalYearId,
      transactionKind,
      voucherNumber: legacyTrim(row.CashNum ?? row.VoucherNum ?? row.TrxNum),
      date: legacyDate(row.Date) ?? new Date(),
      description: legacyTrim(row.DescA ?? row.Description) || null,
      amount: legacyDecimal(row.Amount ?? row.Value, 2),
      currencyCode: legacyTrim(row.CurrencyCode) || 'EGP',
      customerId: ids.customerId,
      supplierId: ids.supplierId,
      offsetAccountId: ids.offsetAccountId,
      isPosted: legacyTrim(row.Status).toLowerCase() === 'post',
      isCancelled: legacyBool(row.Deleted, false),
    };
  }

  private mapAccountType(t: string): string | null {
    switch (t) {
      case '1':
        return 'asset';
      case '2':
        return 'liability';
      case '3':
        return 'equity';
      case '4':
        return 'revenue';
      case '5':
        return 'expense';
      default:
        return null;
    }
  }

  private mapInvoiceKind(trxType: string): string {
    const t = trxType.toUpperCase();
    if (t.includes('PUR') || t === 'P') return 'PURCHASE';
    if (t.includes('RET') && t.includes('S')) return 'SALE_RETURN';
    if (t.includes('RET')) return 'PURCHASE_RETURN';
    return 'SALE';
  }
}

export const prismaDataTransformer = new PrismaDataTransformer();
