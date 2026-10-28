/**
 * After an import: bring the ledger caches in line with the GL.
 *
 * Historical journals are inserted directly (no posting service), so the caches the ERP
 * reads — account_period_balances, partner_running_balances and customer/supplier card
 * balances — would not include them. This reuses the ERP's own rebuild (from posted GL,
 * the source of truth) and its party-card heal; nothing here invents a balance.
 */
import type { PrismaClient } from '@prisma/client';
import { rebuildCompanyBalances } from '../../accounting/services/ledger-balance.service';
import { ensurePartyCardMatchesLedger } from '../../accounting/services/party-ledger-balance.service';
import type { MigrationContext } from '../migration-context';
import { money, money2 } from '../accounting/journal-money';

export async function refreshLedgerCachesAfterMigration(
  prisma: PrismaClient,
  jobId: string,
  companyId: string
): Promise<{ customersSynced: number; suppliersSynced: number }> {
  await prisma.$transaction((tx) => rebuildCompanyBalances(tx, companyId), {
    maxWait: 30_000,
    timeout: 15 * 60_000,
  });
  const maps = await prisma.migrationIdMap.findMany({
    where: { migrationJobId: jobId, sourceEntity: { in: ['Customer', 'Supplier'] } },
    select: { sourceEntity: true, targetId: true },
  });
  let customersSynced = 0;
  let suppliersSynced = 0;
  for (const m of maps) {
    const kind = m.sourceEntity === 'Customer' ? 'customer' : 'supplier';
    await ensurePartyCardMatchesLedger(companyId, m.targetId, kind);
    if (kind === 'customer') customersSynced += 1;
    else suppliersSynced += 1;
  }
  return { customersSynced, suppliersSynced };
}

export interface PartyBalanceReconcileResult {
  checkedParties: number;
  mismatchCount: number;
  sampleMismatches: Array<{ partyType: string; code: string; accountCode: string; legacyBalance: string; targetBalance: string }>;
}

/**
 * Each migrated party's balance (partner ledger, base currency) against the legacy GL
 * balance of the party's own account.
 */
export async function reconcilePartyBalances(ctx: MigrationContext): Promise<PartyBalanceReconcileResult> {
  const legacy = await ctx.source.querySql<{ a?: unknown; net?: unknown }>(
    `SELECT RTRIM(d.AccountNo) AS a,
            SUM(CAST(ISNULL(d.DebitValue,0) AS DECIMAL(19,4))*ISNULL(d.Change,1))
          - SUM(CAST(ISNULL(d.CreditValue,0) AS DECIMAL(19,4))*ISNULL(d.Change,1)) AS net
     FROM dbo.GLTrxDetail d
     JOIN dbo.GLTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
      AND h.YearID=d.YearID AND h.GlNum=d.GLNum
     WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'
     GROUP BY RTRIM(d.AccountNo)`,
    { cc: ctx.legacyCompanyCode }
  );
  const legacyNet = new Map(legacy.map((r) => [String(r.a ?? '').trim(), money(r.net ?? 0)]));

  const maps = await ctx.prisma.migrationIdMap.findMany({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: { in: ['Customer', 'Supplier'] } },
    select: { sourceEntity: true, targetId: true },
  });
  const customerIds = maps.filter((m) => m.sourceEntity === 'Customer').map((m) => m.targetId);
  const supplierIds = maps.filter((m) => m.sourceEntity === 'Supplier').map((m) => m.targetId);
  const [customers, suppliers, ledger] = await Promise.all([
    ctx.prisma.customer.findMany({
      where: { id: { in: customerIds }, companyId: ctx.targetCompanyId },
      select: { id: true, code: true, accountId: true },
    }),
    ctx.prisma.supplier.findMany({
      where: { id: { in: supplierIds }, companyId: ctx.targetCompanyId },
      select: { id: true, code: true, accountId: true },
    }),
    ctx.prisma.partnerRunningBalance.groupBy({
      by: ['partnerId'],
      where: { companyId: ctx.targetCompanyId, partnerId: { in: [...customerIds, ...supplierIds] } },
      _sum: { netBase: true },
    }),
  ]);
  const targetNet = new Map(ledger.map((r) => [r.partnerId, money(r._sum.netBase ?? 0)]));
  const accountIds = [...customers, ...suppliers].map((p) => p.accountId).filter((id): id is string => Boolean(id));
  const accounts = await ctx.prisma.account.findMany({
    where: { id: { in: accountIds }, companyId: ctx.targetCompanyId },
    select: { id: true, code: true },
  });
  const accountCode = new Map(accounts.map((a) => [a.id, a.code ?? '']));
  const codeOf = (p: { accountId: string | null }) => (p.accountId ? accountCode.get(p.accountId) ?? '' : '');

  // Accounts shared by several parties cannot be split per party: compare them in total.
  const owners = new Map<string, string[]>();
  for (const p of [...customers, ...suppliers]) {
    const acc = codeOf(p);
    if (acc) owners.set(acc, [...(owners.get(acc) ?? []), p.id]);
  }

  let mismatchCount = 0;
  const sampleMismatches: PartyBalanceReconcileResult['sampleMismatches'] = [];
  const parties = [
    ...customers.map((c) => ({ ...c, partyType: 'CUSTOMER' })),
    ...suppliers.map((s) => ({ ...s, partyType: 'SUPPLIER' })),
  ];
  for (const p of parties) {
    const acc = codeOf(p);
    if (!acc || (owners.get(acc)?.length ?? 0) !== 1) continue;
    const expected = legacyNet.get(acc) ?? money(0);
    const actual = targetNet.get(p.id) ?? money(0);
    if (expected.sub(actual).abs().gt(0.01)) {
      mismatchCount += 1;
      if (sampleMismatches.length < 20) {
        sampleMismatches.push({
          partyType: p.partyType,
          code: p.code ?? p.id,
          accountCode: acc,
          legacyBalance: money2(expected),
          targetBalance: money2(actual),
        });
      }
    }
  }
  return { checkedParties: parties.length, mismatchCount, sampleMismatches };
}
