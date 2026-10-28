import type { MigrationContext } from '../migration-context';
import { legacyTrim } from '../transforms/legacy-values';
import { money, money2 } from '../accounting/journal-money';
import { legacyTableExists } from '../accounting-source-profile';

export type UnappliedCashRow = {
  BranchCode?: unknown;
  YearID?: unknown;
  Type?: unknown;
  CashNum?: unknown;
  Amount?: unknown;
  Value?: unknown;
  CustomerCode?: unknown;
  SupplierCode?: unknown;
  GLNum?: unknown;
};

export type UnappliedCashReport = {
  preserved: number;
  skippedAlready: number;
  totalLegacyAmount: string;
};

/**
 * Posted cash vouchers with no active invoice allocation lines — preserved as metadata (no PaymentAllocation).
 */
export async function preserveUnappliedCashBalances(ctx: MigrationContext): Promise<UnappliedCashReport> {
  if (!(await legacyTableExists(ctx.source, 'CashTrxHeader'))) {
    return { preserved: 0, skippedAlready: 0, totalLegacyAmount: '0.00' };
  }

  const rows = await ctx.source.querySql<UnappliedCashRow>(
    `SELECT h.BranchCode, h.YearID, h.Type, h.CashNum, h.Amount, h.Amount AS Value,
            h.AccountNo AS CustomerCode, h.AccountNo AS SupplierCode, h.GLNum
     FROM dbo.CashTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc
       AND RTRIM(h.Status)='Post'
       AND RTRIM(ISNULL(h.Deleted,''))<>'T'
       AND NOT EXISTS (
         SELECT 1 FROM dbo.CashTrxDetail d
         WHERE RTRIM(d.CompanyCode)=@cc
           AND RTRIM(d.BranchCode)=h.BranchCode
           AND RTRIM(d.YearID)=h.YearID
           AND RTRIM(ISNULL(d.Type,''))=RTRIM(ISNULL(h.Type,''))
           AND RTRIM(d.CashNum)=h.CashNum
           AND RTRIM(ISNULL(d.InvoiceNum,''))<>''
           AND RTRIM(ISNULL(d.InvoiceType,''))<>''
           AND RTRIM(ISNULL(d.Accepted,''))<>'F'
       )`,
    { cc: ctx.legacyCompanyCode }
  );

  let preserved = 0;
  let skippedAlready = 0;
  let total = money(0);

  for (const row of rows) {
    const key = {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(row.BranchCode),
      yearId: legacyTrim(row.YearID),
      type: legacyTrim(row.Type),
      cashNum: legacyTrim(row.CashNum),
    };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'UnappliedCashTrx', key)) {
      skippedAlready += 1;
      continue;
    }
    const amt = money(row.Amount ?? row.Value ?? 0);
    total = total.add(amt);

    const cashMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'CashTrxHeader', key);
    const description = [
      `Unapplied/advance cash ${key.type} ${key.cashNum} year ${key.yearId} branch ${key.branchCode}`,
      `amount=${money2(amt)}`,
      cashMap ? `cashTransactionId=${cashMap.targetId}` : 'cash shell not imported',
      row.CustomerCode ? `customer=${legacyTrim(row.CustomerCode)}` : '',
      row.SupplierCode ? `supplier=${legacyTrim(row.SupplierCode)}` : '',
      row.GLNum ? `GLNum=${legacyTrim(row.GLNum)}` : '',
    ]
      .filter(Boolean)
      .join('; ');

    if (!ctx.dryRun) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: 'SETTLEMENT_HISTORICAL',
        severity: 'INFO',
        category: 'UNAPPLIED_CASH_PRESERVED',
        sourceEntity: 'CashTrxHeader',
        sourceKey: `${key.yearId}|${key.branchCode}|${key.type}|${key.cashNum}`,
        description,
      });
      await ctx.idMap.recordMapping({
        jobId: ctx.migrationJobId,
        sourceEntity: 'UnappliedCashTrx',
        sourceKeyParts: key,
        targetModel: cashMap ? 'CashTransaction' : 'MigrationIssue',
        targetId: cashMap?.targetId ?? ctx.migrationJobId,
        outcome: 'CREATED_BY_MIGRATION',
        readOnly: true,
      });
    }
    preserved += 1;
  }

  return { preserved, skippedAlready, totalLegacyAmount: money2(total) };
}

export async function reconcileUnappliedCash(ctx: MigrationContext) {
  const count = await ctx.prisma.migrationIdMap.count({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'UnappliedCashTrx' },
  });
  const issues = await ctx.prisma.migrationIssue.count({
    where: {
      migrationJobId: ctx.migrationJobId,
      category: 'UNAPPLIED_CASH_PRESERVED',
    },
  });
  return { unappliedCashPreserved: count, issueRows: issues };
}
