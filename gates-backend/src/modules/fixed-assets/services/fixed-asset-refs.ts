/**
 * Shared checks for the fixed-assets module. Every foreign id a client sends
 * (accounts, branch, cost center, employee, supplier, customer) is verified
 * against the caller's company before use — the fixed-asset tables hold these
 * as plain ids, so this is the tenant boundary for them.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { monthEndDate, monthKey } from '../domain/depreciation';

type Db = Prisma.TransactionClient | typeof prisma;

export const FIXED_ASSET_JOURNAL_SOURCE = 'DEPRECIATION';

export function num(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return roundTo4(Number(value));
}

export async function companyCurrency(db: Db, companyId: string): Promise<string> {
  const settings = await db.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  return settings?.defaultCurrency?.trim() || 'EGP';
}

/** Accounts must exist in this company, be active and be posting (leaf) accounts. */
export async function assertPostingAccounts(
  db: Db,
  companyId: string,
  ids: Array<string | null | undefined>
): Promise<void> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return;
  const rows = await db.account.findMany({
    where: { id: { in: wanted }, companyId, deletedAt: null },
    select: { id: true, code: true, arabicName: true, accountKind: true, isActive: true },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of wanted) {
    const row = byId.get(id);
    if (!row) throw new AppError(422, 'أحد الحسابات المختارة غير موجود في هذه الشركة');
    if (row.accountKind !== 'POSTING') {
      throw new AppError(422, `الحساب ${row.code} - ${row.arabicName} حساب رئيسي، اختر حساب حركة`);
    }
    if (!row.isActive) {
      throw new AppError(422, `الحساب ${row.code} - ${row.arabicName} موقوف`);
    }
  }
}

export async function assertCompanyRefs(
  db: Db,
  companyId: string,
  refs: {
    branchId?: string | null;
    costCenterId?: string | null;
    custodianEmployeeId?: string | null;
    supplierId?: string | null;
    customerId?: string | null;
  }
): Promise<void> {
  const checks: Array<Promise<void>> = [];
  if (refs.branchId) {
    checks.push(
      db.branch
        .findFirst({ where: { id: refs.branchId, companyId, deletedAt: null }, select: { id: true } })
        .then((row) => {
          if (!row) throw new AppError(422, 'الفرع غير موجود');
        })
    );
  }
  if (refs.costCenterId) {
    checks.push(
      db.costCenter
        .findFirst({ where: { id: refs.costCenterId, companyId }, select: { id: true } })
        .then((row) => {
          if (!row) throw new AppError(422, 'مركز التكلفة غير موجود');
        })
    );
  }
  if (refs.custodianEmployeeId) {
    checks.push(
      db.employee
        .findFirst({ where: { id: refs.custodianEmployeeId, companyId }, select: { id: true } })
        .then((row) => {
          if (!row) throw new AppError(422, 'الموظف صاحب العهدة غير موجود');
        })
    );
  }
  if (refs.supplierId) {
    checks.push(
      db.supplier
        .findFirst({ where: { id: refs.supplierId, companyId }, select: { id: true } })
        .then((row) => {
          if (!row) throw new AppError(422, 'المورد غير موجود');
        })
    );
  }
  if (refs.customerId) {
    checks.push(
      db.customer
        .findFirst({ where: { id: refs.customerId, companyId, deletedAt: null }, select: { id: true } })
        .then((row) => {
          if (!row) throw new AppError(422, 'العميل غير موجود');
        })
    );
  }
  await Promise.all(checks);
}

/** Row-lock assets in a stable order (prevents deadlocks between runs and disposals). */
export async function lockAssetsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  assetIds: string[]
): Promise<void> {
  const ids = [...new Set(assetIds)].sort();
  if (ids.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    await tx.$queryRaw`
      SELECT id FROM fixed_assets
      WHERE companyId = ${companyId} AND id IN (${Prisma.join(chunk)})
      ORDER BY id
      FOR UPDATE`;
  }
}

/**
 * Accumulated depreciation at the start of the calendar year of `fromMonth`,
 * for declining balance. = current accumulated − posted lines earlier this year.
 */
export async function accumulatedAtYearStart(
  db: Db,
  asset: { id: string; accumulatedDepreciation: Prisma.Decimal | number },
  fromMonth: number
): Promise<number> {
  const accumulated = num(asset.accumulatedDepreciation);
  const yearFirstMonth = Math.floor(fromMonth / 12) * 12;
  if (fromMonth <= yearFirstMonth) return accumulated;
  const agg = await db.fixedAssetDepreciationLine.aggregate({
    where: {
      assetId: asset.id,
      run: { status: 'POSTED' },
      periodMonth: { gte: monthEndDate(yearFirstMonth), lte: monthEndDate(fromMonth - 1) },
    },
    _sum: { amount: true },
  });
  return roundTo4(accumulated - num(agg._sum.amount));
}

/** Next month to depreciate for an asset. */
export function nextDepreciationMonth(
  depreciatedThrough: Date | null | undefined,
  firstMonth: number
): number {
  if (!depreciatedThrough) return firstMonth;
  return Math.max(firstMonth, monthKey(depreciatedThrough) + 1);
}

/** Attach account code/name to preview journal lines so the screen can show them. */
export async function describeJournalLines<T extends { accountId: string }>(
  db: Db,
  companyId: string,
  lines: T[]
): Promise<Array<T & { accountCode: string; accountName: string }>> {
  const ids = [...new Set(lines.map((l) => l.accountId))];
  const accounts = ids.length
    ? await db.account.findMany({
        where: { companyId, id: { in: ids } },
        select: { id: true, code: true, arabicName: true },
      })
    : [];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  return lines.map((line) => ({
    ...line,
    accountCode: byId.get(line.accountId)?.code ?? '',
    accountName: byId.get(line.accountId)?.arabicName ?? '',
  }));
}

export function isoDay(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
