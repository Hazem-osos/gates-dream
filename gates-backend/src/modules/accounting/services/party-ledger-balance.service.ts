import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  applyPartnerCardBalancesFromLinesInTx,
  applyPostedJournalBalancesInTx,
  type PostedJournalLineDelta,
} from './ledger-balance.service';

export type PartyKind = 'CUSTOMER' | 'SUPPLIER' | 'SUBCONTRACTOR';

const DRIFT_EPS = 0.02;

/** Accounting balance from posted journal lines (`partner_running_balances`). */
export async function sumPartnerNetOriginal(
  db: Prisma.TransactionClient | typeof prisma,
  companyId: string,
  partnerId: string,
  partnerType: PartyKind
): Promise<number> {
  const rows = await db.partnerRunningBalance.findMany({
    where: { companyId, partnerId, partnerType },
    select: { netOriginal: true },
  });
  if (!rows.length) return 0;
  return roundTo4(rows.reduce((sum, row) => sum + Number(row.netOriginal), 0));
}

export async function loadJournalLineDeltas(
  db: Prisma.TransactionClient | typeof prisma,
  journalEntryId: string
): Promise<PostedJournalLineDelta[]> {
  const lines = await db.journalEntryLine.findMany({
    where: { journalEntryId },
    orderBy: { lineOrder: 'asc' },
  });
  return lines.map((line) => ({
    accountId: line.accountId,
    debit: line.debit,
    credit: line.credit,
    debitBase: line.debitBase,
    creditBase: line.creditBase,
    partnerId: line.partnerId,
    partnerType: line.partnerType,
  }));
}

export async function syncPartnerCardFromJournalInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  journalEntryId: string,
  invert?: boolean
): Promise<void> {
  const deltas = await loadJournalLineDeltas(tx, journalEntryId);
  await applyPartnerCardBalancesFromLinesInTx(tx, companyId, deltas, { invert });
}

/** Partner cards from `partnerId` lines; safe/bank/etc. from lines without a partner. */
export async function syncJournalPartnerAndTreasuryCardsInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  journalEntryId: string,
  options?: { invert?: boolean }
): Promise<void> {
  const entry = await tx.journalEntry.findFirst({
    where: { id: journalEntryId, companyId, deletedAt: null },
    select: { date: true, currencyCode: true },
  });
  if (!entry) return;
  const deltas = await loadJournalLineDeltas(tx, journalEntryId);
  if (!deltas.length) return;

  await applyPartnerCardBalancesFromLinesInTx(tx, companyId, deltas, {
    invert: options?.invert,
  });

  const treasuryLines = deltas.filter((line) => !line.partnerId);
  if (treasuryLines.length > 0) {
    await applyPostedJournalBalancesInTx(tx, {
      companyId,
      date: entry.date,
      currencyCode: entry.currencyCode || 'EGP',
      skipAccountPeriod: true,
      skipPartnerBalances: true,
      invert: options?.invert,
      lines: treasuryLines,
    });
  }
}

/**
 * Align `customer.balance` / `supplier.balance` with partner ledger when drifted
 * (legacy double-writes). Returns the ledger figure callers should display.
 */
export async function ensurePartyCardMatchesLedger(
  companyId: string,
  partnerId: string,
  partyType: 'customer' | 'supplier'
): Promise<{ balance: number; healed: boolean; previousCache: number }> {
  const partnerType: PartyKind = partyType === 'customer' ? 'CUSTOMER' : 'SUPPLIER';
  const ledgerBalance = await sumPartnerNetOriginal(prisma, companyId, partnerId, partnerType);

  if (partyType === 'customer') {
    const row = await prisma.customer.findFirst({
      where: { id: partnerId, companyId, deletedAt: null },
      select: { balance: true },
    });
    if (!row) return { balance: ledgerBalance, healed: false, previousCache: 0 };
    const previousCache = roundTo4(Number(row.balance));
    if (Math.abs(previousCache - ledgerBalance) > DRIFT_EPS) {
      await prisma.customer.update({
        where: { id: partnerId },
        data: { balance: ledgerBalance },
      });
      return { balance: ledgerBalance, healed: true, previousCache };
    }
    return { balance: ledgerBalance, healed: false, previousCache };
  }

  const row = await prisma.supplier.findFirst({
    where: { id: partnerId, companyId },
    select: { balance: true },
  });
  if (!row) return { balance: ledgerBalance, healed: false, previousCache: 0 };
  const previousCache = roundTo4(Number(row.balance));
  if (Math.abs(previousCache - ledgerBalance) > DRIFT_EPS) {
    await prisma.supplier.update({
      where: { id: partnerId },
      data: { balance: ledgerBalance },
    });
    return { balance: ledgerBalance, healed: true, previousCache };
  }
  return { balance: ledgerBalance, healed: false, previousCache };
}
