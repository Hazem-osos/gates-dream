import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';
import { legacyTrim } from '../transforms/legacy-values';
import { companySettingService } from '../../platform/services/company-setting.service';

type MaxRow = { branchCode?: unknown; yearId?: unknown; docSuffix?: unknown; maxNum?: unknown };

/**
 * Highest all-digit value of a legacy number column. A single non-numeric number (e.g. 'A12')
 * must not abort the query (plain CAST would). SQL Server 2008-safe (no TRY_CAST).
 */
function numericMax(column: string): string {
  return `MAX(CASE WHEN RTRIM(${column}) <> '' AND RTRIM(${column}) NOT LIKE '%[^0-9]%' AND LEN(RTRIM(${column})) <= 18 THEN CAST(RTRIM(${column}) AS BIGINT) END)`;
}

function parseMaxNum(value: unknown): number {
  const s = legacyTrim(value).replace(/\D/g, '');
  if (!s) return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Seeds `document_sequences.lastNumber` from legacy MAX(*) plus CompanySetting SerialStart* already imported.
 */
export async function syncDocumentSequencesFromLegacy(ctx: MigrationContext): Promise<{ upserted: number }> {
  if (ctx.dryRun) {
    return { upserted: 3 };
  }

  let upserted = 0;
  const companyId = ctx.targetCompanyId;
  const cc = ctx.legacyCompanyCode;

  const glRows = await ctx.source.querySql<MaxRow>(
    `SELECT RTRIM(h.BranchCode) AS branchCode, RTRIM(h.YearID) AS yearId,
            ${numericMax('h.GLNum')} AS maxNum
     FROM dbo.GLTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc
     GROUP BY h.BranchCode, h.YearID`,
    { cc }
  );
  for (const row of glRows) {
    const branchCode = legacyTrim(row.branchCode);
    const yearId = legacyTrim(row.yearId);
    const branch = branchCode
      ? await ctx.prisma.branch.findFirst({
          where: { companyId, legacyBranchCode: branchCode },
          select: { id: true },
        })
      : null;
    const fiscalYear = yearId
      ? await ctx.prisma.fiscalYear.findFirst({
          where: { companyId, legacyYearId: yearId },
          select: { id: true },
        })
      : null;
    const scope = (await companySettingService.getEntry(companyId, 'SerialGL')) === 'C' ? 'C' : 'Y';
    const lastNumber = parseMaxNum(row.maxNum);
    await upsertDocumentSequenceCounter(ctx, {
      companyId,
      branchId: branch?.id ?? null,
      fiscalYearId: scope === 'Y' ? fiscalYear?.id ?? null : null,
      docType: 'GL',
      scope,
      lastNumber,
    });
    upserted += 1;
  }

  const cashTypes = ['BP01', 'BR01', 'KP01', 'KR01'];
  for (const cashType of cashTypes) {
    const rows = await ctx.source.querySql<MaxRow>(
      `SELECT RTRIM(h.BranchCode) AS branchCode, RTRIM(h.YearID) AS yearId,
              ${numericMax('h.CashNum')} AS maxNum
       FROM dbo.CashTrxHeader h
       WHERE RTRIM(h.CompanyCode)=@cc AND RTRIM(ISNULL(h.Type,''))=@typ
       GROUP BY h.BranchCode, h.YearID`,
      { cc, typ: cashType }
    );
    for (const row of rows) {
      const branchCode = legacyTrim(row.branchCode);
      const yearId = legacyTrim(row.yearId);
      const branch = branchCode
        ? await ctx.prisma.branch.findFirst({
            where: { companyId, legacyBranchCode: branchCode },
            select: { id: true },
          })
        : null;
      const fiscalYear = yearId
        ? await ctx.prisma.fiscalYear.findFirst({
            where: { companyId, legacyYearId: yearId },
            select: { id: true },
          })
        : null;
      const cont = await companySettingService.getEntry(companyId, `SerialContanious${cashType}`);
      const scope = cont === 'P' ? 'Y' : 'C';
      const docType = `CASH-${cashType}`;
      const lastNumber = parseMaxNum(row.maxNum);
      await upsertDocumentSequenceCounter(ctx, {
        companyId,
        branchId: branch?.id ?? null,
        fiscalYearId: scope === 'Y' ? fiscalYear?.id ?? null : null,
        docType,
        scope,
        lastNumber,
      });
      upserted += 1;
    }
  }

  const invoiceTypes = await ctx.source.querySql<{ typ?: unknown }>(
    `SELECT DISTINCT RTRIM(Type) AS typ FROM dbo.InvoiceTrxHeader WHERE RTRIM(CompanyCode)=@cc AND RTRIM(ISNULL(Type,''))<>''`,
    { cc }
  );
  for (const { typ } of invoiceTypes) {
    const invoiceType = legacyTrim(typ);
    if (!invoiceType) continue;
    const rows = await ctx.source.querySql<MaxRow>(
      `SELECT RTRIM(h.BranchCode) AS branchCode, RTRIM(h.YearID) AS yearId,
              ${numericMax('h.InvoiceNum')} AS maxNum
       FROM dbo.InvoiceTrxHeader h
       WHERE RTRIM(h.CompanyCode)=@cc AND RTRIM(h.Type)=@typ
       GROUP BY h.BranchCode, h.YearID`,
      { cc, typ: invoiceType }
    );
    const cont = await companySettingService.getEntry(companyId, `SerialContanious${invoiceType}`);
    const scope = cont === 'P' ? 'Y' : 'C';
    const docType = `INV-${invoiceType}`;
    for (const row of rows) {
      const branchCode = legacyTrim(row.branchCode);
      const yearId = legacyTrim(row.yearId);
      const branch = branchCode
        ? await ctx.prisma.branch.findFirst({
            where: { companyId, legacyBranchCode: branchCode },
            select: { id: true },
          })
        : null;
      const fiscalYear = yearId
        ? await ctx.prisma.fiscalYear.findFirst({
            where: { companyId, legacyYearId: yearId },
            select: { id: true },
          })
        : null;
      await upsertDocumentSequenceCounter(ctx, {
        companyId,
        branchId: branch?.id ?? null,
        fiscalYearId: scope === 'Y' ? fiscalYear?.id ?? null : null,
        docType,
        scope,
        lastNumber: parseMaxNum(row.maxNum),
      });
      upserted += 1;
    }
  }

  const storeFamilies: Array<{ table: string; numCol: string; typeCol: string; docPrefix: string }> = [
    { table: 'StoreTransHeader', numCol: 'StoreTransCode', typeCol: 'Type', docPrefix: 'STORE-TRANS' },
    { table: 'StoreCollHeader', numCol: 'StoreCollCode', typeCol: 'Type', docPrefix: 'STORE-COLL' },
    { table: 'StoreDistHeader', numCol: 'StoreDistCode', typeCol: 'Type', docPrefix: 'STORE-DIST' },
    { table: 'StoreAdjustHeader', numCol: 'StoreCheckCode', typeCol: 'Type', docPrefix: 'STORE-ADJUST' },
    { table: 'StoreCheckHeader', numCol: 'StoreCheckCode', typeCol: 'Type', docPrefix: 'STORE-CHECK' },
  ];
  for (const fam of storeFamilies) {
    if (!(await legacyTableExists(ctx.source, fam.table))) continue;
    try {
      const types = await ctx.source.querySql<{ typ?: unknown }>(
        `SELECT DISTINCT RTRIM(${fam.typeCol}) AS typ FROM dbo.${fam.table} WHERE RTRIM(CompanyCode)=@cc`,
        { cc }
      );
      for (const { typ } of types) {
        const t = legacyTrim(typ);
        if (!t) continue;
        const rows = await ctx.source.querySql<MaxRow>(
          `SELECT RTRIM(h.BranchCode) AS branchCode, RTRIM(h.YearID) AS yearId,
                  ${numericMax(`h.${fam.numCol}`)} AS maxNum
           FROM dbo.${fam.table} h
           WHERE RTRIM(h.CompanyCode)=@cc AND RTRIM(h.${fam.typeCol})=@typ
           GROUP BY h.BranchCode, h.YearID`,
          { cc, typ: t }
        );
        const cont = await companySettingService.getEntry(companyId, `SerialContanious${t}`);
        const scope = cont === 'P' ? 'Y' : 'C';
        const docType = `${fam.docPrefix}-${t}`;
        for (const row of rows) {
          const branchCode = legacyTrim(row.branchCode);
          const yearId = legacyTrim(row.yearId);
          const branch = branchCode
            ? await ctx.prisma.branch.findFirst({
                where: { companyId, legacyBranchCode: branchCode },
                select: { id: true },
              })
            : null;
          const fiscalYear = yearId
            ? await ctx.prisma.fiscalYear.findFirst({
                where: { companyId, legacyYearId: yearId },
                select: { id: true },
              })
            : null;
          await upsertDocumentSequenceCounter(ctx, {
            companyId,
            branchId: branch?.id ?? null,
            fiscalYearId: scope === 'Y' ? fiscalYear?.id ?? null : null,
            docType,
            scope,
            lastNumber: parseMaxNum(row.maxNum),
          });
          upserted += 1;
        }
      }
    } catch (err) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: 'FOUNDATION',
        severity: 'WARNING',
        category: 'DOCUMENT_SEQUENCE_SYNC_FAILED',
        sourceEntity: fam.table,
        sourceKey: fam.table,
        description: `Next-number counters for ${fam.table} were not synced (${err instanceof Error ? err.message : String(err)}); new documents of this family may reuse legacy numbers.`,
      });
    }
  }

  for (const chequeFam of [
    { table: 'CKTrxDetail', numCol: 'CKNum', docPrefix: 'CK' },
    { table: 'PKTrxDetail', numCol: 'PKNum', docPrefix: 'PK' },
  ]) {
    const types = await ctx.source.querySql<{ typ?: unknown }>(
      `SELECT DISTINCT RTRIM(Type) AS typ FROM dbo.${chequeFam.table} WHERE RTRIM(CompanyCode)=@cc`,
      { cc }
    );
    for (const { typ } of types) {
      const t = legacyTrim(typ);
      if (!t) continue;
      const rows = await ctx.source.querySql<MaxRow>(
        `SELECT RTRIM(d.BranchCode) AS branchCode, RTRIM(d.YearID) AS yearId,
                ${numericMax(`d.${chequeFam.numCol}`)} AS maxNum
         FROM dbo.${chequeFam.table} d
         WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(d.Type)=@typ
         GROUP BY d.BranchCode, d.YearID`,
        { cc, typ: t }
      );
      const docType = `${chequeFam.docPrefix}-${t}`;
      for (const row of rows) {
        const branchCode = legacyTrim(row.branchCode);
        const yearId = legacyTrim(row.yearId);
        const branch = branchCode
          ? await ctx.prisma.branch.findFirst({
              where: { companyId, legacyBranchCode: branchCode },
              select: { id: true },
            })
          : null;
        const fiscalYear = yearId
          ? await ctx.prisma.fiscalYear.findFirst({
              where: { companyId, legacyYearId: yearId },
              select: { id: true },
            })
          : null;
        await upsertDocumentSequenceCounter(ctx, {
          companyId,
          branchId: branch?.id ?? null,
          fiscalYearId: fiscalYear?.id ?? null,
          docType,
          scope: 'Y',
          lastNumber: parseMaxNum(row.maxNum),
        });
        upserted += 1;
      }
    }
  }

  const optionalFamilies: Array<{ table: string; numCol: string; typeCol: string; docPrefix: string }> = [
    { table: 'TempPayment', numCol: 'PaymentNum', typeCol: 'Type', docPrefix: 'TEMP-PAYMENT' },
    { table: 'IATrxHeader', numCol: 'IANum', typeCol: 'Type', docPrefix: 'IA' },
    { table: 'EtemadTrxHeader', numCol: 'EtemadNum', typeCol: 'Type', docPrefix: 'ETEMAD' },
  ];
  for (const fam of optionalFamilies) {
    if (!(await legacyTableExists(ctx.source, fam.table))) continue;
    try {
      const types = await ctx.source.querySql<{ typ?: unknown }>(
        `SELECT DISTINCT RTRIM(${fam.typeCol}) AS typ FROM dbo.${fam.table} WHERE RTRIM(CompanyCode)=@cc`,
        { cc }
      );
      for (const { typ } of types) {
        const t = legacyTrim(typ);
        if (!t) continue;
        const rows = await ctx.source.querySql<MaxRow>(
          `SELECT RTRIM(h.BranchCode) AS branchCode, RTRIM(h.YearID) AS yearId,
                  ${numericMax(`h.${fam.numCol}`)} AS maxNum
           FROM dbo.${fam.table} h
           WHERE RTRIM(h.CompanyCode)=@cc AND RTRIM(h.${fam.typeCol})=@typ
           GROUP BY h.BranchCode, h.YearID`,
          { cc, typ: t }
        );
        const docType = `${fam.docPrefix}-${t}`;
        for (const row of rows) {
          const branchCode = legacyTrim(row.branchCode);
          const yearId = legacyTrim(row.yearId);
          const branch = branchCode
            ? await ctx.prisma.branch.findFirst({
                where: { companyId, legacyBranchCode: branchCode },
                select: { id: true },
              })
            : null;
          const fiscalYear = yearId
            ? await ctx.prisma.fiscalYear.findFirst({
                where: { companyId, legacyYearId: yearId },
                select: { id: true },
              })
            : null;
          await upsertDocumentSequenceCounter(ctx, {
            companyId,
            branchId: branch?.id ?? null,
            fiscalYearId: fiscalYear?.id ?? null,
            docType,
            scope: 'Y',
            lastNumber: parseMaxNum(row.maxNum),
          });
          upserted += 1;
        }
      }
    } catch {
      /* optional table / column mismatch */
    }
  }

  return { upserted };
}

export async function upsertDocumentSequenceCounter(
  ctx: MigrationContext,
  data: {
    companyId: string;
    branchId: string | null;
    fiscalYearId: string | null;
    docType: string;
    scope: string;
    lastNumber: number;
  }
) {
  const existing = await ctx.prisma.documentSequence.findFirst({
    where: {
      companyId: data.companyId,
      branchId: data.branchId,
      fiscalYearId: data.fiscalYearId,
      docType: data.docType,
    },
  });
  if (existing) {
    if (data.lastNumber > existing.lastNumber) {
      await ctx.prisma.documentSequence.update({
        where: { id: existing.id },
        data: { lastNumber: data.lastNumber, scope: data.scope },
      });
    }
    return;
  }
  await ctx.prisma.documentSequence.create({
    data: {
      companyId: data.companyId,
      branchId: data.branchId,
      fiscalYearId: data.fiscalYearId,
      docType: data.docType,
      scope: data.scope,
      lastNumber: data.lastNumber,
      padding: 8,
    },
  });
}
