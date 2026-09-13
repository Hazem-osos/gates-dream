import prisma from '../../../shared/database/prisma';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type AgingBucketKey =
  | 'current_0_30'
  | 'days_31_60'
  | 'days_61_90'
  | 'days_91_120'
  | 'days_120_plus';

const BUCKET_LABELS: Record<AgingBucketKey, string> = {
  current_0_30: 'Current (0-30 days)',
  days_31_60: '31-60 days',
  days_61_90: '61-90 days',
  days_91_120: '91-120 days',
  days_120_plus: '120+ days (ديون متعثرة)',
};

function bucketForDays(days: number): AgingBucketKey {
  if (days <= 30) return 'current_0_30';
  if (days <= 60) return 'days_31_60';
  if (days <= 90) return 'days_61_90';
  if (days <= 120) return 'days_91_120';
  return 'days_120_plus';
}

export type AgedOpenItemsParams = {
  companyId: string;
  asOfDate: Date;
  branchId?: string;
  customerId?: string;
  supplierId?: string;
};

async function loadOpenInvoices(
  companyId: string,
  invoiceKinds: string[],
  params: AgedOpenItemsParams
) {
  return prisma.invoice.findMany({
    where: {
      companyId,
      isPosted: true,
      isCancelled: false,
      remainingAmount: { gt: 0 },
      invoiceKind: { in: invoiceKinds },
      ...(params.branchId ? { branchId: params.branchId } : {}),
      ...(params.customerId ? { customerId: params.customerId } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    },
    orderBy: [{ date: 'asc' }],
    include: {
      customer: { select: { id: true, code: true, arabicName: true } },
      supplier: { select: { id: true, code: true, arabicName: true } },
    },
  });
}

/**
 * H6 fix (part 2): the aged report must tie out to the actual GL control
 * account, otherwise it is just a restatement of `invoice.remainingAmount`
 * with no independent check. Resolves the AR/AP control account(s) the same
 * way scripts/recon/gl-reconciliation.ts does — the company-wide code plus
 * every party's own sub-account, since postings can land on either.
 */
async function resolveControlAccountBalance(
  companyId: string,
  side: 'AR' | 'AP',
  asOfDate: Date
): Promise<{ balance: number; resolved: boolean }> {
  const systemCode = side === 'AR' ? SYSTEM_GL_CODES.ar : SYSTEM_GL_CODES.ap;
  const defKeys =
    side === 'AR'
      ? ['arAccount', 'customerAccount', 'salesDebtorAccount']
      : ['apAccount', 'supplierAccount', 'purchaseCreditorAccount'];

  const [byCode, settings] = await Promise.all([
    prisma.account.findMany({ where: { companyId, code: systemCode }, select: { id: true } }),
    prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    }),
  ]);

  const defs = (settings?.accountDefinitions ?? {}) as Record<string, string | undefined>;
  const defCodesOrIds = defKeys.map((k) => defs[k]).filter((v): v is string => !!v);
  const byDef = defCodesOrIds.length
    ? await prisma.account.findMany({
        where: { companyId, OR: [{ id: { in: defCodesOrIds } }, { code: { in: defCodesOrIds } }] },
        select: { id: true },
      })
    : [];

  const partyRows =
    side === 'AR'
      ? await prisma.customer.findMany({
          where: { companyId },
          select: { mainAccountId: true, accountId: true },
        })
      : await prisma.supplier.findMany({
          where: { companyId },
          select: { mainAccountId: true, accountId: true },
        });

  const accountIds = new Set<string>([
    ...byCode.map((a) => a.id),
    ...byDef.map((a) => a.id),
    ...partyRows.map((p) => p.mainAccountId).filter((x): x is string => !!x),
    ...partyRows.map((p) => p.accountId).filter((x): x is string => !!x),
  ]);

  if (accountIds.size === 0) {
    return { balance: 0, resolved: false };
  }

  const agg = await prisma.journalEntryLine.aggregate({
    where: {
      accountId: { in: [...accountIds] },
      journalEntry: {
        companyId,
        isPosted: true,
        isCancelled: false,
        deletedAt: null,
        date: { lte: asOfDate },
      },
    },
    _sum: { debitBase: true, creditBase: true },
  });
  const net = Number(agg._sum.debitBase ?? 0) - Number(agg._sum.creditBase ?? 0);
  // AP control accounts carry a credit-normal (liability) balance; flip
  // sign so both sides report a positive "amount owed" figure.
  return { balance: side === 'AR' ? net : -net, resolved: true };
}

function buildAgedReport(
  invoices: Awaited<ReturnType<typeof loadOpenInvoices>>,
  asOfDate: Date
) {
  const emptyBuckets = (): Record<AgingBucketKey, number> => ({
    current_0_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_91_120: 0,
    days_120_plus: 0,
  });

  const lines = invoices.map((inv) => {
    // H6 fix: age from the due date (falling back to the invoice date for
    // rows created before dueDate existed), not the invoice date — aging
    // buckets are meaningless for credit terms otherwise.
    const dueDate = inv.dueDate ?? inv.date;
    const days = Math.max(
      0,
      Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const bucket = bucketForDays(days);
    const remaining = Number(inv.remainingAmount);
    const fxRate = Number(inv.exchangeRate ?? 1) || 1;
    const remainingBase = roundTo4(remaining * fxRate);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      date: inv.date,
      dueDate,
      daysOutstanding: days,
      bucket,
      bucketLabel: BUCKET_LABELS[bucket],
      remainingAmount: remaining,
      remainingAmountBase: remainingBase,
      exchangeRate: fxRate,
      netAmount: Number(inv.netAmount),
      paidAmount: Number(inv.paidAmount),
      paymentStatus: inv.paymentStatus,
      currencyCode: inv.currencyCode,
      customer: inv.customer,
      supplier: inv.supplier,
    };
  });

  const bucketTotals = emptyBuckets();
  let grandTotal = 0;
  for (const line of lines) {
    bucketTotals[line.bucket] += line.remainingAmountBase;
    grandTotal += line.remainingAmountBase;
  }

  const byParty = new Map<
    string,
    {
      partyId: string;
      partyCode: string | null;
      partyName: string;
      buckets: Record<AgingBucketKey, number>;
      total: number;
      invoices: typeof lines;
    }
  >();

  for (const line of lines) {
    const inv = invoices.find((i) => i.id === line.invoiceId)!;
    const party = inv.customer ?? inv.supplier;
    const partyId = party?.id ?? 'unknown';
    const entry =
      byParty.get(partyId) ??
      {
        partyId,
        partyCode: party?.code ?? null,
        partyName: party?.arabicName ?? '—',
        buckets: emptyBuckets(),
        total: 0,
        invoices: [],
      };
    entry.buckets[line.bucket] += line.remainingAmountBase;
    entry.total += line.remainingAmountBase;
    entry.invoices.push(line);
    byParty.set(partyId, entry);
  }

  return {
    asOfDate,
    bucketLabels: BUCKET_LABELS,
    bucketTotals,
    grandTotal,
    lines,
    parties: [...byParty.values()].sort((a, b) => b.total - a.total),
  };
}

export class AgedOpenItemsService {
  async getAgedReceivables(params: AgedOpenItemsParams) {
    const invoices = await loadOpenInvoices(params.companyId, ['SALE', 'PURCHASE_RETURN'], params);
    const report = buildAgedReport(invoices, params.asOfDate);
    return this.attachControlAccountTieOut(report, params, 'AR');
  }

  async getAgedPayables(params: AgedOpenItemsParams) {
    const invoices = await loadOpenInvoices(params.companyId, ['PURCHASE', 'SALE_RETURN'], params);
    const report = buildAgedReport(invoices, params.asOfDate);
    return this.attachControlAccountTieOut(report, params, 'AP');
  }

  /**
   * H6 fix (part 2): attach the GL control-account tie-out so this report
   * is a real check against the ledger, not just a restatement of
   * `invoice.remainingAmount`. Only meaningful for the whole-company
   * report — a branch/party filter narrows the invoice set below what the
   * control account balance represents, so the tie-out is skipped rather
   * than raising a misleading variance.
   */
  private async attachControlAccountTieOut(
    report: Awaited<ReturnType<typeof buildAgedReport>>,
    params: AgedOpenItemsParams,
    side: 'AR' | 'AP'
  ) {
    const isFiltered = !!(params.branchId || params.customerId || params.supplierId);
    if (isFiltered) {
      return {
        ...report,
        controlAccountTieOut: {
          resolved: false,
          skippedReason: 'Filtered report cannot be tied to the whole-company control account',
          controlAccountBalance: null,
          agedReportTotal: roundTo4(report.grandTotal),
          variance: null,
          reconciled: null,
        },
      };
    }

    const { balance, resolved } = await resolveControlAccountBalance(
      params.companyId,
      side,
      params.asOfDate
    );
    const variance = resolved ? roundTo4(balance - report.grandTotal) : null;
    return {
      ...report,
      controlAccountTieOut: {
        resolved,
        controlAccountBalance: resolved ? roundTo4(balance) : null,
        agedReportTotal: roundTo4(report.grandTotal),
        variance,
        reconciled: variance !== null ? Math.abs(variance) < 0.01 : null,
      },
    };
  }
}

export const agedOpenItemsService = new AgedOpenItemsService();
