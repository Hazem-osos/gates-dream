/**
 * Completeness: every legacy row the pipeline is meant to carry must be in the id-map.
 *
 * Totals can balance while rows are missing (two lost journals of equal size, a skipped
 * invoice line, a merged allocation). This compares source row counts with what this job
 * mapped, entity by entity, so any loss blocks activation instead of passing silently.
 */
import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';

export interface CompletenessRow {
  entity: string;
  source: number;
  migrated: number;
  missing: number;
}

const POSTED = `RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'`;

async function count(ctx: MigrationContext, sql: string): Promise<number> {
  const rows = await ctx.source.querySql<{ n: number }>(sql, { cc: ctx.legacyCompanyCode });
  return Number(rows[0]?.n ?? 0);
}

async function mapped(ctx: MigrationContext, sourceEntity: string): Promise<number> {
  return ctx.prisma.migrationIdMap.count({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity },
  });
}

export async function reconcileCompleteness(ctx: MigrationContext): Promise<CompletenessRow[]> {
  const checks: Array<{ entity: string; table: string; sql: string; idMapEntity: string }> = [
    {
      entity: 'Customer',
      table: 'Customer',
      sql: `SELECT COUNT(*) AS n FROM dbo.Customer WHERE RTRIM(CompanyCode)=@cc`,
      idMapEntity: 'Customer',
    },
    {
      entity: 'Supplier',
      table: 'Supplier',
      sql: `SELECT COUNT(*) AS n FROM dbo.Supplier WHERE RTRIM(CompanyCode)=@cc`,
      idMapEntity: 'Supplier',
    },
    {
      entity: 'Posted journal (GLTrxHeader)',
      table: 'GLTrxHeader',
      sql: `SELECT COUNT(*) AS n FROM dbo.GLTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}`,
      idMapEntity: 'GLTrxHeader',
    },
    {
      entity: 'Invoice (posted, draft, cancelled)',
      table: 'InvoiceTrxHeader',
      sql:
        process.env.MIGRATION_COMMERCIAL_SKIP_SHELLS === 'true'
          ? `SELECT COUNT(*) AS n FROM dbo.InvoiceTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}`
          : `SELECT COUNT(*) AS n FROM dbo.InvoiceTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc`,
      idMapEntity: 'InvoiceTrxHeader',
    },
    {
      entity: 'Posted cash voucher (CashTrxHeader)',
      table: 'CashTrxHeader',
      sql: `SELECT COUNT(*) AS n FROM dbo.CashTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}`,
      idMapEntity: 'CashTrxHeader',
    },
    {
      entity: 'Invoice payment allocation (CashTrxDetail)',
      table: 'CashTrxDetail',
      sql: `SELECT COUNT(*) AS n FROM dbo.CashTrxDetail d
            JOIN dbo.CashTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
             AND h.YearID=d.YearID AND RTRIM(ISNULL(h.Type,''))=RTRIM(ISNULL(d.Type,'')) AND h.CashNum=d.CashNum
            WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED}
              AND RTRIM(ISNULL(d.InvoiceNum,''))<>''
              AND RTRIM(ISNULL(d.Accepted,'T')) NOT IN ('F','0','N','False','No')`,
      idMapEntity: 'CashTrxDetail',
    },
    {
      entity: 'Inward cheque (CKTrxDetail)',
      table: 'CKTrxDetail',
      sql: `SELECT COUNT(*) AS n FROM dbo.CKTrxDetail WHERE RTRIM(CompanyCode)=@cc AND ISNULL(Amount,0)>0`,
      idMapEntity: 'CKTrxDetail',
    },
    {
      entity: 'Outward cheque (PKTrxDetail)',
      table: 'PKTrxDetail',
      sql: `SELECT COUNT(*) AS n FROM dbo.PKTrxDetail WHERE RTRIM(CompanyCode)=@cc AND ISNULL(Amount,0)>0`,
      idMapEntity: 'PKTrxDetail',
    },
  ];

  const out: CompletenessRow[] = [];
  for (const c of checks) {
    if (!(await legacyTableExists(ctx.source, c.table))) continue;
    const source = await count(ctx, c.sql);
    const migratedCount = await mapped(ctx, c.idMapEntity);
    out.push({ entity: c.entity, source, migrated: migratedCount, missing: Math.max(0, source - migratedCount) });
  }

  // Invoice lines of the invoices this job imported.
  const invoiceIds = (
    await ctx.prisma.migrationIdMap.findMany({
      where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'InvoiceTrxHeader' },
      select: { targetId: true },
    })
  ).map((r) => r.targetId);
  if (invoiceIds.length && (await legacyTableExists(ctx.source, 'InvoiceTrxDetail'))) {
    const source = await count(
      ctx,
      `SELECT COUNT(*) AS n FROM dbo.InvoiceTrxDetail d
       JOIN dbo.InvoiceTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
        AND h.YearID=d.YearID AND h.Type=d.Type AND h.InvoiceNum=d.InvoiceNum
       WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED}`
    );
    const postedInvoiceIds = (
      await ctx.prisma.invoice.findMany({
        where: { id: { in: invoiceIds }, companyId: ctx.targetCompanyId, isPosted: true },
        select: { id: true },
      })
    ).map((r) => r.id);
    const migratedLines = postedInvoiceIds.length
      ? await ctx.prisma.invoiceLine.count({ where: { invoiceId: { in: postedInvoiceIds } } })
      : 0;
    out.push({
      entity: 'Posted invoice line (InvoiceTrxDetail)',
      source,
      migrated: migratedLines,
      missing: Math.max(0, source - migratedLines),
    });
  }
  return out;
}
