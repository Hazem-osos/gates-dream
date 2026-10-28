import { describe, expect, it, jest } from '@jest/globals';
import type { Prisma } from '@prisma/client';
import { rebuildCompanyBalances } from '../../modules/accounting/services/ledger-balance.service';

/**
 * MySQL returns YEAR()/MONTH() as BigInt through $queryRaw. The period sort used to subtract
 * them and throw "Cannot convert a BigInt value to a number", which broke the trial balance's
 * cache rebuild for any company with posted journals and an empty summary table.
 */
describe('rebuildCompanyBalances — BigInt period keys from MySQL', () => {
  function fakeTx(periodRows: unknown[]) {
    const queue: unknown[][] = [periodRows, []]; // period rows, then partner rows
    const executeRaw = jest.fn(async (..._args: unknown[]) => 1);
    const tx = {
      accountPeriodBalance: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      partnerRunningBalance: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      $queryRaw: jest.fn(async () => queue.shift() ?? []),
      $executeRaw: executeRaw,
    };
    return { tx: tx as unknown as Prisma.TransactionClient, executeRaw };
  }

  const row = (accountId: string, year: bigint, month: bigint, debit: number) => ({
    accountId,
    fiscalYear: year,
    periodMonth: month,
    debitTotal: debit,
    creditTotal: 0,
    currencyCode: 'EGP',
    lastEntryDate: new Date(Date.UTC(Number(year), Number(month) - 1, 15)),
  });

  it('rebuilds without throwing when several periods share an account', async () => {
    const { tx, executeRaw } = fakeTx([
      row('acc-1', 2026n, 3n, 30),
      row('acc-1', 2025n, 12n, 10),
      row('acc-1', 2026n, 1n, 20),
      row('acc-2', 2026n, 1n, 5),
    ]);
    await expect(rebuildCompanyBalances(tx, 'company-1')).resolves.toBeUndefined();
    expect(executeRaw).toHaveBeenCalledTimes(4);
  });

  it('applies periods in account, year, month order (lock order is deterministic)', async () => {
    const { tx, executeRaw } = fakeTx([
      row('acc-1', 2026n, 3n, 30),
      row('acc-1', 2025n, 12n, 10),
      row('acc-1', 2026n, 1n, 20),
    ]);
    await rebuildCompanyBalances(tx, 'company-1');
    const periods = executeRaw.mock.calls.map((call) => {
      const values = call.slice(1);
      const year = values.find((v) => v === 2025 || v === 2026);
      const month = values.find((v, i) => typeof v === 'number' && i > values.indexOf(year) && v >= 1 && v <= 12);
      return `${year}-${month}`;
    });
    expect(periods).toEqual(['2025-12', '2026-1', '2026-3']);
  });
});
