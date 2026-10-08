import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  companyOpeningJournalWhere,
  OPENING_BALANCE_ENTRY_TYPE,
} from '../../accounting/services/opening-balance.service';
import type { OpeningInventoryGlSlice } from './opening-stock-gl-slices';

export function openingStockJournalLineTag(openingStockId: string): string {
  return `@OBSTOCK:${openingStockId}@`;
}

async function nextJournalLineOrder(
  tx: Prisma.TransactionClient,
  journalEntryId: string
): Promise<number> {
  const agg = await tx.journalEntryLine.aggregate({
    where: { journalEntryId },
    _max: { lineOrder: true, lineNumber: true },
  });
  return Math.max(agg._max.lineOrder ?? 0, agg._max.lineNumber ?? 0) + 1;
}

/** Drop auto-generated opening-stock legs from the company opening journal draft. */
export async function removeOpeningStockFromOpeningJournalInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  openingStockId: string
): Promise<void> {
  const journal = await tx.journalEntry.findFirst({
    where: { ...companyOpeningJournalWhere(companyId), isCancelled: false },
    select: { id: true, isPosted: true },
  });
  if (!journal || journal.isPosted) return;
  const tag = openingStockJournalLineTag(openingStockId);
  await tx.journalEntryLine.deleteMany({
    where: {
      journalEntryId: journal.id,
      OR: [{ descriptionAr: { startsWith: tag } }, { description: { startsWith: tag } }],
    },
  });
}

/**
 * Append inventory debits (+ balancing credit) to the company opening journal draft.
 * Account balances move only when that journal is posted — not here.
 */
export async function syncOpeningStockIntoOpeningJournalInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  params: {
    openingStockId: string;
    glSlices: OpeningInventoryGlSlice[];
    creditAccountId: string;
  }
): Promise<string | null> {
  const totalValue = roundTo4(params.glSlices.reduce((s, slice) => s + slice.value, 0));
  if (totalValue <= 0) return null;

  const journal = await tx.journalEntry.findFirst({
    where: { ...companyOpeningJournalWhere(companyId), isCancelled: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true, isPosted: true },
  });

  if (!journal) {
    throw new AppError(
      422,
      'أنشئ قيد الرصيد الافتتاحي (مسودة) من المحاسبة أولاً، ثم رحّل بضاعة أول المدة لتضاف بنود المخزون إليه.'
    );
  }
  if (journal.isPosted) {
    throw new AppError(
      422,
      'قيد الرصيد الافتتاحي مرحّل. فك ترحيله أولاً ثم عدّل أو رحّل بضاعة أول المدة.'
    );
  }

  const tag = openingStockJournalLineTag(params.openingStockId);
  await tx.journalEntryLine.deleteMany({
    where: {
      journalEntryId: journal.id,
      OR: [{ descriptionAr: { startsWith: tag } }, { description: { startsWith: tag } }],
    },
  });

  const aggregatedByAccount = new Map<string, number>();
  for (const slice of params.glSlices) {
    if (slice.value === 0) continue;
    aggregatedByAccount.set(
      slice.accountId,
      roundTo4((aggregatedByAccount.get(slice.accountId) ?? 0) + slice.value)
    );
  }

  let lineOrder = await nextJournalLineOrder(tx, journal.id);
  const rows: Prisma.JournalEntryLineCreateManyInput[] = [];

  for (const [accountId, value] of aggregatedByAccount) {
    if (value === 0) continue;
    rows.push({
      journalEntryId: journal.id,
      lineNumber: lineOrder,
      lineOrder,
      accountId,
      debit: new Decimal(value),
      credit: new Decimal(0),
      debitBase: new Decimal(value),
      creditBase: new Decimal(0),
      exchangeRate: new Decimal(1),
      description: 'بضاعة أول المدة — مخزون',
      descriptionAr: `${tag}|DR`,
    });
    lineOrder += 1;
  }

  rows.push({
    journalEntryId: journal.id,
    lineNumber: lineOrder,
    lineOrder,
    accountId: params.creditAccountId,
    debit: new Decimal(0),
    credit: new Decimal(totalValue),
    debitBase: new Decimal(0),
    creditBase: new Decimal(totalValue),
    exchangeRate: new Decimal(1),
    description: 'بضاعة أول المدة — طرف مقابل (يُعاد توزيعه في القيد الافتتاحي)',
    descriptionAr: `${tag}|CR`,
  });

  await tx.journalEntryLine.createMany({ data: rows });
  await tx.journalEntry.update({
    where: { id: journal.id },
    data: { isBalanced: false },
  });

  return journal.id;
}

export async function findCompanyOpeningJournalId(companyId: string): Promise<string | null> {
  const row = await prisma.journalEntry.findFirst({
    where: { ...companyOpeningJournalWhere(companyId), isCancelled: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return row?.id ?? null;
}

export { OPENING_BALANCE_ENTRY_TYPE };
