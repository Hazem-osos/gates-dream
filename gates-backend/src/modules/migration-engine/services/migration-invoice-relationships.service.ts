import type { MigrationContext } from '../migration-context';
import { legacyTrim } from '../transforms/legacy-values';
import { loadInvoiceReturnLinks } from './legacy-journal-data.service';

/** Link return/credit invoices to originals when both sides are migrated — no invented reversals. */
export async function linkInvoiceReturnRelationships(ctx: MigrationContext): Promise<{ linked: number; pending: number }> {
  const links = await loadInvoiceReturnLinks(ctx.source, ctx.legacyCompanyCode);
  let linked = 0;
  let pending = 0;

  for (const row of links) {
    await ctx.throwIfPaused({ stage: 'COMMERCIAL', entity: 'InvoiceReturnLink' });
    const childKey = {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(row.BranchCode),
      yearId: legacyTrim(row.YearID),
      type: legacyTrim(row.Type),
      invoiceNum: legacyTrim(row.InvoiceNum),
    };
    const parentKey = {
      companyCode: ctx.legacyCompanyCode,
      branchCode: legacyTrim(row.BranchCode),
      yearId: legacyTrim(row.ReturnInvoiceYearID),
      type: legacyTrim(row.ReturnInvoiceType),
      invoiceNum: legacyTrim(row.ReturnInvoiceNum),
    };
    const childMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', childKey);
    const parentMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'InvoiceTrxHeader', parentKey);
    if (!childMap || !parentMap) {
      pending += 1;
      continue;
    }
    if (ctx.dryRun) {
      linked += 1;
      continue;
    }
    await ctx.prisma.invoice.update({
      where: { id: childMap.targetId },
      data: {
        originalInvoiceId: parentMap.targetId,
        originalInvoiceNumber: legacyTrim(row.ReturnInvoiceNum),
      },
    });
    linked += 1;
  }

  return { linked, pending };
}
