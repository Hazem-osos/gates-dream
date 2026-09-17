import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';

type FundRow = { glAccountId?: string | null; balance?: unknown };

/**
 * Posted cash-box / bank GL net (debit − credit). Opening and daily journals
 * that hit the treasury account must show on سند قبض / سند صرف.
 */
export async function postedCashNetsByAccountIds(
  companyId: string,
  accountIds: Array<string | null | undefined>
): Promise<Map<string, number>> {
  const ids = [...new Set(accountIds.filter((id): id is string => Boolean(id)))];
  const nets = new Map<string, number>();
  if (ids.length === 0) return nets;

  const rows = await prisma.$queryRaw<Array<{ accountId: string; net: Prisma.Decimal | number | string }>>(
    Prisma.sql`
      SELECT jel.accountId AS accountId,
             COALESCE(SUM(jel.debitBase - jel.creditBase), 0) AS net
      FROM journal_entry_lines jel
      INNER JOIN journal_entries je ON je.id = jel.journalEntryId
      WHERE je.companyId = ${companyId}
        AND jel.accountId IN (${Prisma.join(ids)})
        AND je.isPosted = true
        AND je.isCancelled = false
        AND je.deletedAt IS NULL
      GROUP BY jel.accountId
    `
  );

  for (const row of rows) {
    nets.set(row.accountId, Number(row.net));
  }
  return nets;
}

export async function overlayFundBalancesFromLedger<T extends FundRow>(
  companyId: string,
  rows: T[]
): Promise<Array<T & { balance: number }>> {
  const leafIds = rows.map((row) => row.glAccountId).filter((id): id is string => Boolean(id));
  const accounts = leafIds.length
    ? await prisma.account.findMany({
        where: { companyId, id: { in: leafIds }, deletedAt: null },
        select: { id: true, parentId: true },
      })
    : [];
  const parentByLeaf = new Map(accounts.map((row) => [row.id, row.parentId]));
  const parentIds = accounts.map((row) => row.parentId).filter((id): id is string => Boolean(id));
  const nets = await postedCashNetsByAccountIds(companyId, [...leafIds, ...parentIds]);

  const safesUnderParent = new Map<string, number>();
  for (const row of rows) {
    const parentId = row.glAccountId ? parentByLeaf.get(row.glAccountId) : null;
    if (!parentId) continue;
    safesUnderParent.set(parentId, (safesUnderParent.get(parentId) ?? 0) + 1);
  }

  return rows.map((row) => {
    const leafId = row.glAccountId;
    if (!leafId) {
      return { ...row, balance: Number(row.balance ?? 0) };
    }
    const leafNet = nets.get(leafId) ?? 0;
    if (Math.abs(leafNet) > 0.0001) {
      return { ...row, balance: leafNet };
    }
    const parentId = parentByLeaf.get(leafId);
    if (parentId && (safesUnderParent.get(parentId) ?? 0) === 1) {
      const parentNet = nets.get(parentId) ?? 0;
      if (Math.abs(parentNet) > 0.0001) {
        return { ...row, balance: parentNet };
      }
    }
    return { ...row, balance: leafNet };
  });
}

export async function overlayFundBalanceFromLedger<T extends FundRow>(
  companyId: string,
  row: T
): Promise<T & { balance: number }> {
  const [overlaid] = await overlayFundBalancesFromLedger(companyId, [row]);
  return overlaid;
}
