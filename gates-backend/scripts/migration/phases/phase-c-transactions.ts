import type { MigrationContext } from '../types';
import { prismaDataTransformer } from '../PrismaDataTransformer';
import { legacyTrim, padGlNum } from '../utils/legacy-values';
import { logBatchProgress } from '../utils/migration-logger';

function track(ctx: MigrationContext, table: string) {
  let stat = ctx.stats.find((s) => s.table === table);
  if (!stat) {
    stat = { table, read: 0, upserted: 0, skipped: 0, failed: 0 };
    ctx.stats.push(stat);
  }
  return stat;
}

export async function runPhaseC(ctx: MigrationContext) {
  console.log('\n=== Phase C: Historical transactions ===');

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'GLTrxHeader',
    ctx.options
  )) {
    const stat = track(ctx, 'GLTrxHeader');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const branchCode = legacyTrim(row.BranchCode);
        const yearCode = legacyTrim(row.YearID);
        const glNum = padGlNum(row.GlNum);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchId = ctx.cache.get(ctx.cache.keyBranch(companyCode, branchCode));
        const fiscalYearId = ctx.cache.get(ctx.cache.keyYear(companyCode, yearCode));
        const headerData = prismaDataTransformer.transformJournalHeader(row, {
          companyId,
          branchId,
          fiscalYearId,
        });
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyJournal(companyCode, branchCode, yearCode, glNum), 'dry-je');
          stat.upserted += 1;
          continue;
        }
        // The legacy key is company + branch + year + GlNum, but an earlier partial run may
        // have landed the row before its branch resolved. Adopt that row instead of creating a
        // duplicate, otherwise the GL is imported twice and the trial balance doubles.
        const existing =
          (await ctx.prisma.journalEntry.findFirst({
            where: {
              companyId,
              branchId: branchId ?? null,
              fiscalYearId: fiscalYearId ?? null,
              legacyGlNum: glNum,
            },
          })) ??
          (branchId
            ? await ctx.prisma.journalEntry.findFirst({
                where: {
                  companyId,
                  branchId: null,
                  fiscalYearId: fiscalYearId ?? null,
                  legacyGlNum: glNum,
                },
              })
            : null);
        const entry = existing
          ? await ctx.prisma.journalEntry.update({
              where: { id: existing.id },
              data: headerData,
            })
          : await ctx.prisma.journalEntry.create({ data: headerData });
        ctx.cache.set(ctx.cache.keyJournal(companyCode, branchCode, yearCode, glNum), entry.id);
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('C', 'GLTrxHeader', row, e);
      }
    }
    logBatchProgress('C', 'GLTrxHeader', batchIndex, batchTotal, stat.upserted);
  }

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'GLTrxDetail',
    ctx.options
  )) {
    const stat = track(ctx, 'GLTrxDetail');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const branchCode = legacyTrim(row.BranchCode);
        const yearCode = legacyTrim(row.YearID);
        const glNum = padGlNum(row.GlNum);
        const journalEntryId = ctx.cache.require(
          ctx.cache.keyJournal(companyCode, branchCode, yearCode, glNum),
          'journal'
        );
        const accountCode = legacyTrim(row.AccountNo ?? row.AccountCode);
        const accountId = ctx.cache.require(
          ctx.cache.keyAccount(companyCode, accountCode),
          'account'
        );
        const ccCode = legacyTrim(row.CCenterCode);
        const costCenterId = ccCode
          ? ctx.cache.get(ctx.cache.keyCostCenter(companyCode, ccCode))
          : undefined;
        const lineData = prismaDataTransformer.transformJournalLine(
          row,
          journalEntryId,
          accountId,
          costCenterId
        );
        if (ctx.options.dryRun) {
          stat.upserted += 1;
          continue;
        }
        await ctx.prisma.journalEntryLine.upsert({
          where: {
            journalEntryId_lineNumber: {
              journalEntryId,
              lineNumber: lineData.lineNumber,
            },
          },
          update: lineData,
          create: lineData,
        });
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('C', 'GLTrxDetail', row, e);
      }
    }
    logBatchProgress('C', 'GLTrxDetail', batchIndex, batchTotal, stat.upserted);
  }

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'InvoiceTrxHeader',
    ctx.options
  )) {
    const stat = track(ctx, 'InvoiceTrxHeader');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const branchCode = legacyTrim(row.BranchCode);
        const yearCode = legacyTrim(row.YearID);
        const invoiceNum = legacyTrim(row.InvoiceNum);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchId = ctx.cache.get(ctx.cache.keyBranch(companyCode, branchCode));
        const fiscalYearId = ctx.cache.get(ctx.cache.keyYear(companyCode, yearCode));
        const customerCode = legacyTrim(row.CustomerCode);
        const supplierCode = legacyTrim(row.SupplierCode);
        const storeCode = legacyTrim(row.StoreCode);
        const headerData = prismaDataTransformer.transformInvoiceHeader(row, {
          companyId,
          branchId,
          fiscalYearId,
          customerId: customerCode
            ? ctx.cache.get(ctx.cache.keyCustomer(companyCode, customerCode))
            : undefined,
          supplierId: supplierCode
            ? ctx.cache.get(ctx.cache.keySupplier(companyCode, supplierCode))
            : undefined,
          warehouseId: storeCode
            ? ctx.cache.get(ctx.cache.keyWarehouse(companyCode, storeCode))
            : undefined,
        });
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyInvoice(companyCode, yearCode, invoiceNum), 'dry-inv');
          stat.upserted += 1;
          continue;
        }
        const existing = await ctx.prisma.invoice.findFirst({
          where: {
            companyId,
            invoiceNumber: invoiceNum,
            sourceYearId: yearCode,
          },
        });
        const invoice = existing
          ? await ctx.prisma.invoice.update({ where: { id: existing.id }, data: headerData })
          : await ctx.prisma.invoice.create({ data: headerData });
        ctx.cache.set(ctx.cache.keyInvoice(companyCode, yearCode, invoiceNum), invoice.id);
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('C', 'InvoiceTrxHeader', row, e);
      }
    }
    logBatchProgress('C', 'InvoiceTrxHeader', batchIndex, batchTotal, stat.upserted);
  }

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'InvoiceTrxDetail',
    ctx.options
  )) {
    const stat = track(ctx, 'InvoiceTrxDetail');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const yearCode = legacyTrim(row.YearID);
        const invoiceNum = legacyTrim(row.InvoiceNum);
        const itemCode = legacyTrim(row.ItemCode);
        const invoiceId = ctx.cache.require(
          ctx.cache.keyInvoice(companyCode, yearCode, invoiceNum),
          'invoice'
        );
        const itemId = ctx.cache.require(ctx.cache.keyItem(companyCode, itemCode), 'item');
        const unitId = ctx.cache.require(ctx.cache.keyUnit(companyCode, 'PCS'), 'unit');
        const lineData = prismaDataTransformer.transformInvoiceLine(row, invoiceId, itemId, unitId);
        if (ctx.options.dryRun) {
          stat.upserted += 1;
          continue;
        }
        const lineNo = lineData.lineOrder;
        const existing = await ctx.prisma.invoiceLine.findFirst({
          where: { invoiceId, lineOrder: lineNo },
        });
        if (existing) {
          await ctx.prisma.invoiceLine.update({ where: { id: existing.id }, data: lineData });
        } else {
          await ctx.prisma.invoiceLine.create({ data: lineData });
        }
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('C', 'InvoiceTrxDetail', row, e);
      }
    }
    logBatchProgress('C', 'InvoiceTrxDetail', batchIndex, batchTotal, stat.upserted);
  }

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'CashTrxHeader',
    ctx.options
  )) {
    const stat = track(ctx, 'CashTrxHeader');
    for (const row of batch) {
      stat.read += 1;
      try {
        const companyCode = legacyTrim(row.CompanyCode);
        const branchCode = legacyTrim(row.BranchCode);
        const yearCode = legacyTrim(row.YearID);
        const voucher = legacyTrim(row.CashNum ?? row.TrxNum);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchId = ctx.cache.get(ctx.cache.keyBranch(companyCode, branchCode));
        const fiscalYearId = ctx.cache.get(ctx.cache.keyYear(companyCode, yearCode));
        const customerCode = legacyTrim(row.CustomerCode);
        const supplierCode = legacyTrim(row.SupplierCode);
        const accountCode = legacyTrim(row.AccountCode);
        const data = prismaDataTransformer.transformCashHeader(row, {
          companyId,
          branchId,
          fiscalYearId,
          customerId: customerCode
            ? ctx.cache.get(ctx.cache.keyCustomer(companyCode, customerCode))
            : undefined,
          supplierId: supplierCode
            ? ctx.cache.get(ctx.cache.keySupplier(companyCode, supplierCode))
            : undefined,
          offsetAccountId: accountCode
            ? ctx.cache.get(ctx.cache.keyAccount(companyCode, accountCode))
            : undefined,
        });
        if (ctx.options.dryRun) {
          stat.upserted += 1;
          continue;
        }
        const existing = await ctx.prisma.cashTransaction.findFirst({
          where: { companyId, voucherNumber: voucher, date: data.date },
        });
        if (existing) {
          await ctx.prisma.cashTransaction.update({ where: { id: existing.id }, data });
        } else {
          await ctx.prisma.cashTransaction.create({ data });
        }
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('C', 'CashTrxHeader', row, e);
      }
    }
    logBatchProgress('C', 'CashTrxHeader', batchIndex, batchTotal, stat.upserted);
  }
}
