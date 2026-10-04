import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';

const EPS = 0.02;
/** Material drift that requires an operator to review the cache vs GL. */
export const PARTY_DRIFT_THRESHOLD = 1;

export interface PartyBalanceVariance {
  partyType: 'customer' | 'supplier';
  partyId: string;
  partyName: string;
  accountId: string | null;
  currencyCode: string | null;
  /** Original cached `Customer.balance` / `Supplier.balance` (party currency). */
  cachedBalanceOriginal: number;
  /** Cached figure converted to company base currency for the GL tie-out. */
  cachedBalance: number;
  /** `partner_running_balances` net in party currency (كشف الحساب). */
  ledgerBalanceOriginal: number;
  /** Same partner ledger in company base currency. */
  ledgerBalance: number;
  variance: number;
  isReconciled: boolean;
}

export interface PartyBalanceReconciliationResult {
  companyId: string;
  baseCurrency: string;
  generatedAt: string;
  totalCachedBalance: number;
  totalLedgerBalance: number;
  totalVariance: number;
  isReconciled: boolean;
  requiresReconciliation: boolean;
  mismatched: PartyBalanceVariance[];
  checkedCount: number;
  mismatchedCount: number;
}

async function companyBaseCurrency(companyId: string): Promise<string> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  return (settings?.defaultCurrency || 'EGP').toUpperCase();
}

async function latestFxRate(companyId: string, currencyCode: string): Promise<number> {
  const row = await prisma.exchangeRateHistory.findFirst({
    where: { companyId, currencyCode },
    orderBy: { recordedAt: 'desc' },
    select: { rate: true },
  });
  const rate = Number(row?.rate ?? 1);
  return Number.isFinite(rate) && rate > 0 ? rate : 1;
}

async function partnerRunningTotalsById(
  companyId: string,
  partnerType: 'CUSTOMER' | 'SUPPLIER'
): Promise<Map<string, { netOriginal: number; netBase: number }>> {
  const rows = await prisma.partnerRunningBalance.groupBy({
    by: ['partnerId'],
    where: { companyId, partnerType },
    _sum: { netOriginal: true, netBase: true },
  });
  return new Map(
    rows.map((row) => [
      row.partnerId,
      {
        netOriginal: roundTo4(Number(row._sum.netOriginal ?? 0)),
        netBase: roundTo4(Number(row._sum.netBase ?? 0)),
      },
    ])
  );
}

/**
 * H7 — `Customer.balance` / `Supplier.balance` are write-side caches updated
 * ad-hoc by every settlement/cheque/invoice-posting call site. Foreign-currency
 * parties store that cache in document currency while the GL is always in
 * company base (`debitBase` / `creditBase`). This diagnostic compares both
 * sides in base currency so a USD customer cannot flag a false drift against
 * an EGP control account.
 */
export class PartyBalanceReconciliationService {
  private async ledgerDebitCredit(
    companyId: string,
    accountId: string
  ): Promise<{ debit: number; credit: number }> {
    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        journalEntry: { companyId, isPosted: true, isCancelled: false, deletedAt: null },
      },
      _sum: { debitBase: true, creditBase: true },
    });
    return {
      debit: roundTo4(Number(agg._sum.debitBase ?? 0)),
      credit: roundTo4(Number(agg._sum.creditBase ?? 0)),
    };
  }

  private async cachedBalanceInBase(params: {
    companyId: string;
    baseCurrency: string;
    currencyCode: string | null | undefined;
    cachedOriginal: number;
    runningBase?: number;
  }): Promise<number> {
    const partyCurrency = (params.currencyCode || params.baseCurrency).toUpperCase();
    if (partyCurrency === params.baseCurrency) {
      return roundTo4(params.cachedOriginal);
    }
    if (params.runningBase != null) {
      return roundTo4(params.runningBase);
    }
    const rate = await latestFxRate(params.companyId, partyCurrency);
    return roundTo4(params.cachedOriginal * rate);
  }

  async reconcileCustomers(companyId: string, customerId?: string): Promise<PartyBalanceVariance[]> {
    const [baseCurrency, running, customers] = await Promise.all([
      companyBaseCurrency(companyId),
      partnerRunningTotalsById(companyId, 'CUSTOMER'),
      prisma.customer.findMany({
        where: { companyId, ...(customerId ? { id: customerId } : {}) },
        select: {
          id: true,
          arabicName: true,
          englishName: true,
          mainAccountId: true,
          accountId: true,
          balance: true,
          currencyCode: true,
        },
      }),
    ]);

    const results: PartyBalanceVariance[] = [];
    for (const customer of customers) {
      const accountId = customer.mainAccountId ?? customer.accountId;
      const cachedBalanceOriginal = roundTo4(Number(customer.balance));
      const runningRow = running.get(customer.id);
      const ledgerBalanceOriginal = runningRow?.netOriginal ?? 0;
      const ledgerBalanceBase = runningRow?.netBase ?? 0;
      const cachedBalance = await this.cachedBalanceInBase({
        companyId,
        baseCurrency,
        currencyCode: customer.currencyCode,
        cachedOriginal: cachedBalanceOriginal,
        runningBase: ledgerBalanceBase,
      });
      const partyCurrency = (customer.currencyCode || baseCurrency).toUpperCase();
      const variance =
        partyCurrency === baseCurrency
          ? roundTo4(cachedBalanceOriginal - ledgerBalanceOriginal)
          : roundTo4(cachedBalance - ledgerBalanceBase);
      const ledgerBalance =
        partyCurrency === baseCurrency ? ledgerBalanceOriginal : ledgerBalanceBase;
      results.push({
        partyType: 'customer',
        partyId: customer.id,
        partyName: customer.arabicName || customer.englishName || customer.id,
        accountId,
        currencyCode: customer.currencyCode ?? null,
        cachedBalanceOriginal,
        cachedBalance,
        ledgerBalanceOriginal,
        ledgerBalance,
        variance,
        isReconciled: Math.abs(variance) <= EPS,
      });
    }
    return results;
  }

  async reconcileSuppliers(companyId: string, supplierId?: string): Promise<PartyBalanceVariance[]> {
    const [baseCurrency, running, suppliers] = await Promise.all([
      companyBaseCurrency(companyId),
      partnerRunningTotalsById(companyId, 'SUPPLIER'),
      prisma.supplier.findMany({
        where: { companyId, ...(supplierId ? { id: supplierId } : {}) },
        select: {
          id: true,
          arabicName: true,
          englishName: true,
          mainAccountId: true,
          accountId: true,
          balance: true,
          currencyCode: true,
        },
      }),
    ]);

    const results: PartyBalanceVariance[] = [];
    for (const supplier of suppliers) {
      const accountId = supplier.mainAccountId ?? supplier.accountId;
      const cachedBalanceOriginal = roundTo4(Number(supplier.balance));
      const runningRow = running.get(supplier.id);
      const ledgerBalanceOriginal = runningRow?.netOriginal ?? 0;
      const ledgerBalanceBase = runningRow?.netBase ?? 0;
      const cachedBalance = await this.cachedBalanceInBase({
        companyId,
        baseCurrency,
        currencyCode: supplier.currencyCode,
        cachedOriginal: cachedBalanceOriginal,
        runningBase: ledgerBalanceBase,
      });
      const partyCurrency = (supplier.currencyCode || baseCurrency).toUpperCase();
      const variance =
        partyCurrency === baseCurrency
          ? roundTo4(cachedBalanceOriginal - ledgerBalanceOriginal)
          : roundTo4(cachedBalance - ledgerBalanceBase);
      const ledgerBalance =
        partyCurrency === baseCurrency ? ledgerBalanceOriginal : ledgerBalanceBase;
      results.push({
        partyType: 'supplier',
        partyId: supplier.id,
        partyName: supplier.arabicName || supplier.englishName || supplier.id,
        accountId,
        currencyCode: supplier.currencyCode ?? null,
        cachedBalanceOriginal,
        cachedBalance,
        ledgerBalanceOriginal,
        ledgerBalance,
        variance,
        isReconciled: Math.abs(variance) <= EPS,
      });
    }
    return results;
  }

  async getReconciliation(companyId: string): Promise<PartyBalanceReconciliationResult> {
    const [baseCurrency, customers, suppliers] = await Promise.all([
      companyBaseCurrency(companyId),
      this.reconcileCustomers(companyId),
      this.reconcileSuppliers(companyId),
    ]);
    const all = [...customers, ...suppliers];
    const mismatched = all.filter((r) => !r.isReconciled).sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    const material = mismatched.filter((r) => Math.abs(r.variance) > PARTY_DRIFT_THRESHOLD);

    const totalCachedBalance = roundTo4(all.reduce((s, r) => s + r.cachedBalance, 0));
    const totalLedgerBalance = roundTo4(all.reduce((s, r) => s + r.ledgerBalance, 0));
    const totalVariance = roundTo4(totalCachedBalance - totalLedgerBalance);

    return {
      companyId,
      baseCurrency,
      generatedAt: new Date().toISOString(),
      totalCachedBalance,
      totalLedgerBalance,
      totalVariance,
      isReconciled: mismatched.length === 0,
      requiresReconciliation: material.length > 0,
      mismatched: mismatched.slice(0, 500),
      checkedCount: all.length,
      mismatchedCount: mismatched.length,
    };
  }

  async detectAnomalies(companyId: string): Promise<PartyBalanceReconciliationResult> {
    return this.getReconciliation(companyId);
  }

  async resyncCache(
    companyId: string,
    filter?: { partyType?: 'customer' | 'supplier'; partyId?: string }
  ): Promise<{ updated: number; items: PartyBalanceVariance[] }> {
    const customers = filter?.partyType === 'supplier' ? [] : await this.reconcileCustomers(companyId, filter?.partyId);
    const suppliers = filter?.partyType === 'customer' ? [] : await this.reconcileSuppliers(companyId, filter?.partyId);
    const toFix = [...customers, ...suppliers].filter((r) => !r.isReconciled);

    for (const item of toFix) {
      if (item.partyType === 'customer') {
        await prisma.customer.update({
          where: { id: item.partyId },
          data: { balance: item.ledgerBalanceOriginal },
        });
      } else {
        await prisma.supplier.update({
          where: { id: item.partyId },
          data: { balance: item.ledgerBalanceOriginal },
        });
      }
    }

    return { updated: toFix.length, items: toFix };
  }
}

export const partyBalanceReconciliationService = new PartyBalanceReconciliationService();
