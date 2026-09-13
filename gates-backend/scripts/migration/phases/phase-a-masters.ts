import type { MigrationContext } from '../types';
import { prismaDataTransformer } from '../PrismaDataTransformer';
import { legacyTrim } from '../utils/legacy-values';
import { logBatchProgress } from '../utils/migration-logger';

function track(ctx: MigrationContext, table: string) {
  let stat = ctx.stats.find((s) => s.table === table);
  if (!stat) {
    stat = { table, read: 0, upserted: 0, skipped: 0, failed: 0 };
    ctx.stats.push(stat);
  }
  return stat;
}

async function ensureDefaultUnit(ctx: MigrationContext, companyId: string, companyCode: string) {
  const key = ctx.cache.keyUnit(companyCode, 'PCS');
  if (ctx.cache.get(key)) return;
  if (ctx.options.dryRun) {
    ctx.cache.set(key, 'dry-run-unit');
    return;
  }
  const unit = await ctx.prisma.unit.upsert({
    where: { companyId_code: { companyId, code: 'PCS' } },
    update: {},
    create: { companyId, code: 'PCS', arabicName: 'Piece', englishName: 'Piece' },
  });
  ctx.cache.set(key, unit.id);
}

export async function runPhaseA(ctx: MigrationContext) {
  console.log('\n=== Phase A: Master data ===');

  for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
    'Company',
    ctx.options
  )) {
    const stat = track(ctx, 'Company');
    for (const row of batch) {
      stat.read += 1;
      try {
        const code = legacyTrim(row.CompanyCode);
        const data = prismaDataTransformer.transformCompany(row);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyCompany(code), `dry-${code}`);
          stat.upserted += 1;
          continue;
        }
        const existing = await ctx.prisma.company.findFirst({
          where: { legacyCompanyCode: code },
        });
        const company = existing
          ? await ctx.prisma.company.update({ where: { id: existing.id }, data })
          : await ctx.prisma.company.create({ data });
        ctx.cache.set(ctx.cache.keyCompany(code), company.id);
        await ensureDefaultUnit(ctx, company.id, code);
        stat.upserted += 1;
      } catch (e) {
        stat.failed += 1;
        ctx.logError('A', 'Company', row, e);
      }
    }
    logBatchProgress('A', 'Company', batchIndex, batchTotal, stat.upserted);
  }

  const masterTables: Array<{
    table: string;
    run: (row: Record<string, unknown>) => Promise<void>;
  }> = [
    {
      table: 'Branch',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchCode = legacyTrim(row.BranchCode);
        const data = prismaDataTransformer.transformBranch(row, companyId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyBranch(companyCode, branchCode), `dry-b-${branchCode}`);
          return;
        }
        const existing = await ctx.prisma.branch.findFirst({
          where: { companyId, legacyBranchCode: branchCode },
        });
        const branch = existing
          ? await ctx.prisma.branch.update({ where: { id: existing.id }, data })
          : await ctx.prisma.branch.create({ data });
        ctx.cache.set(ctx.cache.keyBranch(companyCode, branchCode), branch.id);
      },
    },
    {
      table: 'Year',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const yearCode = legacyTrim(row.YearCode ?? row.YearID);
        const data = prismaDataTransformer.transformFiscalYear(row, companyId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyYear(companyCode, yearCode), `dry-y-${yearCode}`);
          return;
        }
        const year = await ctx.prisma.fiscalYear.upsert({
          where: { companyId_legacyYearId: { companyId, legacyYearId: yearCode } },
          update: {
            arabicName: data.arabicName,
            englishName: data.englishName,
            startDate: data.startDate,
            endDate: data.endDate,
            status: data.status,
          },
          create: data,
        });
        ctx.cache.set(ctx.cache.keyYear(companyCode, yearCode), year.id);
      },
    },
    {
      table: 'Account',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const accountCode = legacyTrim(row.AccountCode);
        const data = prismaDataTransformer.transformAccount(row, companyId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyAccount(companyCode, accountCode), `dry-a-${accountCode}`);
          return;
        }
        const existing = await ctx.prisma.account.findFirst({
          where: { companyId, code: accountCode },
        });
        const account = existing
          ? await ctx.prisma.account.update({ where: { id: existing.id }, data })
          : await ctx.prisma.account.create({ data });
        ctx.cache.set(ctx.cache.keyAccount(companyCode, accountCode), account.id);
      },
    },
    {
      table: 'CostCenter',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const code = legacyTrim(row.CCenterCode ?? row.CostCenterCode);
        const data = prismaDataTransformer.transformCostCenter(row, companyId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyCostCenter(companyCode, code), `dry-cc-${code}`);
          return;
        }
        const cc = await ctx.prisma.costCenter.upsert({
          where: { companyId_code: { companyId, code } },
          update: { arabicName: data.arabicName, englishName: data.englishName },
          create: data,
        });
        ctx.cache.set(ctx.cache.keyCostCenter(companyCode, code), cc.id);
      },
    },
    {
      table: 'Customer',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const customerCode = legacyTrim(row.CustomerCode);
        const accountCode = legacyTrim(row.AccountCode);
        const mainAccountId = accountCode
          ? ctx.cache.get(ctx.cache.keyAccount(companyCode, accountCode))
          : undefined;
        const data = prismaDataTransformer.transformCustomer(row, companyId, mainAccountId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyCustomer(companyCode, customerCode), `dry-cust-${customerCode}`);
          return;
        }
        const existing = await ctx.prisma.customer.findFirst({
          where: { companyId, code: customerCode },
        });
        const customer = existing
          ? await ctx.prisma.customer.update({ where: { id: existing.id }, data })
          : await ctx.prisma.customer.create({ data });
        ctx.cache.set(ctx.cache.keyCustomer(companyCode, customerCode), customer.id);
      },
    },
    {
      table: 'Supplier',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const supplierCode = legacyTrim(row.SupplierCode);
        const accountCode = legacyTrim(row.AccountCode);
        const mainAccountId = accountCode
          ? ctx.cache.get(ctx.cache.keyAccount(companyCode, accountCode))
          : undefined;
        const data = prismaDataTransformer.transformSupplier(row, companyId, mainAccountId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keySupplier(companyCode, supplierCode), `dry-sup-${supplierCode}`);
          return;
        }
        const existing = await ctx.prisma.supplier.findFirst({
          where: { companyId, code: supplierCode },
        });
        const supplier = existing
          ? await ctx.prisma.supplier.update({ where: { id: existing.id }, data })
          : await ctx.prisma.supplier.create({ data });
        ctx.cache.set(ctx.cache.keySupplier(companyCode, supplierCode), supplier.id);
      },
    },
    {
      table: 'Store',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const branchCode = legacyTrim(row.BranchCode);
        const branchId = branchCode
          ? ctx.cache.get(ctx.cache.keyBranch(companyCode, branchCode))
          : undefined;
        const storeCode = legacyTrim(row.StoreCode);
        const data = prismaDataTransformer.transformWarehouse(row, companyId, branchId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyWarehouse(companyCode, storeCode), `dry-wh-${storeCode}`);
          return;
        }
        const existing = await ctx.prisma.warehouse.findFirst({
          where: { companyId, legacyStoreCode: storeCode },
        });
        const wh = existing
          ? await ctx.prisma.warehouse.update({ where: { id: existing.id }, data })
          : await ctx.prisma.warehouse.create({ data });
        ctx.cache.set(ctx.cache.keyWarehouse(companyCode, storeCode), wh.id);
      },
    },
    {
      table: 'Item',
      run: async (row) => {
        const companyCode = legacyTrim(row.CompanyCode);
        const companyId = ctx.cache.require(ctx.cache.keyCompany(companyCode), 'company');
        const itemCode = legacyTrim(row.ItemCode ?? row.Serial);
        const data = prismaDataTransformer.transformItem(row, companyId);
        if (ctx.options.dryRun) {
          ctx.cache.set(ctx.cache.keyItem(companyCode, itemCode), `dry-item-${itemCode}`);
          return;
        }
        const existing = await ctx.prisma.item.findFirst({
          where: { companyId, serial: itemCode },
        });
        const item = existing
          ? await ctx.prisma.item.update({ where: { id: existing.id }, data })
          : await ctx.prisma.item.create({ data });
        ctx.cache.set(ctx.cache.keyItem(companyCode, itemCode), item.id);
        const unitId = ctx.cache.require(ctx.cache.keyUnit(companyCode, 'PCS'), 'unit');
        await ctx.prisma.itemUnit.upsert({
          where: { itemId_unitId: { itemId: item.id, unitId } },
          update: { isBaseUnit: true },
          create: { itemId: item.id, unitId, conversionFactor: 1, isBaseUnit: true },
        });
      },
    },
  ];

  for (const { table, run } of masterTables) {
    for await (const { batch, batchIndex, batchTotal } of ctx.extractor.iterateBatches(
      table,
      ctx.options
    )) {
      const stat = track(ctx, table);
      for (const row of batch) {
        stat.read += 1;
        try {
          await run(row);
          stat.upserted += 1;
        } catch (e) {
          stat.failed += 1;
          ctx.logError('A', table, row, e);
        }
      }
      logBatchProgress('A', table, batchIndex, batchTotal, stat.upserted);
    }
  }
}
