import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';
import { documentSequenceService } from '../../platform/services/document-sequence.service';

export const OPENING_BALANCE_ENTRY_TYPE = 'OPENING_BALANCE';

/** Inventory opening documents. They are not the company opening journal. */
const INVENTORY_OPENING_SOURCES = ['OB', 'OPEN'] as const;

export const OPENING_JOURNAL_EXISTS_MESSAGE =
  'يوجد قيد افتتاحي بالفعل. عدّل نفس القيد بدل إنشاء قيد جديد.';
export const OPENING_JOURNAL_CANCELLED_MESSAGE =
  'يوجد قيد افتتاحي ملغي. استرجعه أو عدّل نفس القيد بدل إنشاء قيد جديد.';

export function isCompanyOpeningEntry(row: {
  entryType?: string | null;
  sourceType?: string | null;
}): boolean {
  if (String(row.entryType ?? '').trim().toUpperCase() !== OPENING_BALANCE_ENTRY_TYPE) return false;
  const source = String(row.sourceType ?? '').trim().toUpperCase();
  return !INVENTORY_OPENING_SOURCES.includes(source as (typeof INVENTORY_OPENING_SOURCES)[number]);
}

/** Unbalanced save is allowed only for an opening-balance draft. */
export function isOpeningBalanceDraft(row: {
  saveAsDraft?: boolean | null;
  entryType?: string | null;
}): boolean {
  return row.saveAsDraft === true && String(row.entryType ?? '').trim().toUpperCase() === OPENING_BALANCE_ENTRY_TYPE;
}

/** Opening stock and the company opening journal are dated the day before the year. */
export function allowsOpeningDocumentDate(row: {
  entryType?: string | null;
  sourceType?: string | null;
}): boolean {
  const entryType = String(row.entryType ?? '').trim().toUpperCase();
  if (entryType === OPENING_BALANCE_ENTRY_TYPE || entryType === 'OPENING_STOCK') return true;
  const source = String(row.sourceType ?? '').trim().toUpperCase();
  return INVENTORY_OPENING_SOURCES.includes(source as (typeof INVENTORY_OPENING_SOURCES)[number]);
}

export function openingJournalSlotKey(companyId: string): string {
  return `${companyId}|OPENING_BALANCE`;
}

/** Company-wide opening journal serial — not the daily GL (`docType: GL`) sequence. */
export const OPENING_JOURNAL_DOC_TYPE = 'OPENING_BALANCE';

export function formatOpeningJournalNumber(value: number): string {
  return String(value).padStart(8, '0');
}

function parseOpeningJournalSerial(raw: string | null | undefined): number {
  const digits = String(raw ?? '').trim();
  if (!/^\d+$/.test(digits)) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

async function maxExistingOpeningJournalSerial(
  companyId: string,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const db = tx ?? prisma;
  const rows = await db.journalEntry.findMany({
    where: companyOpeningJournalWhere(companyId),
    select: { legacyGlNum: true, voucherNumber: true },
  });
  let max = 0;
  for (const row of rows) {
    max = Math.max(
      max,
      parseOpeningJournalSerial(row.legacyGlNum),
      parseOpeningJournalSerial(row.voucherNumber)
    );
  }
  return max;
}

export async function peekNextOpeningJournalNumber(companyId: string): Promise<string> {
  const seq = await prisma.documentSequence.findFirst({
    where: {
      companyId,
      branchId: null,
      fiscalYearId: null,
      docType: OPENING_JOURNAL_DOC_TYPE,
    },
    select: { lastNumber: true, padding: true },
  });
  const padding = seq?.padding ?? 8;
  const existingMax = await maxExistingOpeningJournalSerial(companyId);
  const next = seq ? Math.max(Number(seq.lastNumber) + 1, existingMax + 1, 1) : Math.max(existingMax + 1, 1);
  return String(next).padStart(padding, '0');
}

export async function nextOpeningJournalNumberInTx(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  return documentSequenceService.nextNumberInTx(tx, {
    companyId,
    branchId: null,
    fiscalYearId: null,
    docType: OPENING_JOURNAL_DOC_TYPE,
    scope: 'C',
    startNumber: 1,
    padding: 8,
    seedFromExisting: () => maxExistingOpeningJournalSerial(companyId, tx),
    isAvailable: async (candidate) => {
      const clash = await tx.journalEntry.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ voucherNumber: candidate }, { legacyGlNum: candidate }],
        },
        select: { id: true },
      });
      return !clash;
    },
  });
}

export const OPENING_JOURNAL_UNPOST_FIRST_MESSAGE =
  'فك ترحيل قيد الرصيد الافتتاحي أولاً ثم عدّل الشيك.';

/** Opening cheques live inside the company opening journal, not their own issue entry. */
export async function companyOpeningJournalIsPosted(companyId: string): Promise<boolean> {
  const row = await prisma.journalEntry.findFirst({
    where: {
      ...companyOpeningJournalWhere(companyId),
      isCancelled: false,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: { isPosted: true, postingStatus: true },
  });
  return Boolean(row && (row.isPosted || row.postingStatus === 'Post'));
}

export function companyOpeningJournalWhere(
  companyId: string,
  exceptId?: string
): Prisma.JournalEntryWhereInput {
  return {
    companyId,
    entryType: OPENING_BALANCE_ENTRY_TYPE,
    OR: [{ sourceType: null }, { sourceType: { notIn: [...INVENTORY_OPENING_SOURCES] } }],
    ...(exceptId ? { id: { not: exceptId } } : {}),
  };
}

/**
 * One company opening journal. The company row lock closes the gap between
 * the check and the insert when two saves run together.
 */
export async function assertSingleOpeningJournal(
  tx: Prisma.TransactionClient,
  companyId: string,
  exceptId?: string
) {
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
  const other = await tx.journalEntry.findFirst({
    where: companyOpeningJournalWhere(companyId, exceptId),
    select: { id: true, isCancelled: true },
  });
  if (!other) return;
  throw new AppError(
    409,
    other.isCancelled ? OPENING_JOURNAL_CANCELLED_MESSAGE : OPENING_JOURNAL_EXISTS_MESSAGE
  );
}

export type OpeningBalanceMeta = {
  openingDate: Date;
  openingDateIso: string;
  hijriDate: string;
  fiscalYearName: string;
  fiscalYearId: string;
  fiscalYearStartDateIso: string;
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calendarUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function dayBeforeIso(isoDate: string): string {
  const date = calendarUtc(isoDate);
  date.setUTCDate(date.getUTCDate() - 1);
  return toIsoDate(date);
}

export class OpeningBalanceService {
  async resolveOpeningDate(companyId: string): Promise<OpeningBalanceMeta> {
    const fiscalYear =
      (await prisma.fiscalYear.findFirst({
        where: { companyId, isActive: true },
        orderBy: { startDate: 'asc' },
      })) ??
      (await prisma.fiscalYear.findFirst({
        where: { companyId },
        orderBy: { startDate: 'asc' },
      }));

    if (!fiscalYear) {
      throw new AppError(
        400,
        'يجب تعريف السنة المالية أولاً لتحديد تاريخ الرصيد الافتتاحي.'
      );
    }

    const fiscalYearStartDateIso = toIsoDate(fiscalYear.startDate);
    const openingDateIso = dayBeforeIso(fiscalYearStartDateIso);
    const openingDate = calendarUtc(openingDateIso);

    return {
      openingDate,
      openingDateIso,
      hijriDate: toHijriDate(openingDateIso),
      fiscalYearName:
        fiscalYear.arabicName || fiscalYear.englishName || fiscalYear.legacyYearId,
      fiscalYearId: fiscalYear.id,
      fiscalYearStartDateIso,
    };
  }

  async applyLockedDate<T extends { entryType?: string; date?: Date; hijriDate?: string }>(
    companyId: string,
    data: T,
    existingEntryType?: string | null
  ): Promise<T> {
    const entryType = data.entryType ?? existingEntryType;
    if (entryType !== OPENING_BALANCE_ENTRY_TYPE) return data;

    const meta = await this.resolveOpeningDate(companyId);
    return {
      ...data,
      date: meta.openingDate,
      hijriDate: meta.hijriDate,
    };
  }

  async getOpeningBalance(companyId: string) {
    const meta = await this.resolveOpeningDate(companyId);
    const include = {
      lines: {
        include: {
          account: { select: { id: true, code: true, arabicName: true } },
          costCenter: { select: { id: true, code: true, arabicName: true } },
        },
        orderBy: { lineOrder: 'asc' as const },
      },
    };
    const activeWhere = {
      ...companyOpeningJournalWhere(companyId),
      isCancelled: false,
    };
    const existing =
      (await prisma.journalEntry.findFirst({
        where: activeWhere,
        include,
        orderBy: { createdAt: 'desc' },
      })) ??
      (await prisma.journalEntry.findFirst({
        where: companyOpeningJournalWhere(companyId),
        include,
        orderBy: { createdAt: 'desc' },
      }));

    const nextEntryNumber = await peekNextOpeningJournalNumber(companyId);

    return {
      openingDate: meta.openingDateIso,
      hijriDate: meta.hijriDate,
      fiscalYearName: meta.fiscalYearName,
      fiscalYearId: meta.fiscalYearId,
      fiscalYearStartDate: meta.fiscalYearStartDateIso,
      journalEntryId: existing?.id ?? null,
      isPosted: Boolean(existing && !existing.isCancelled && (existing.isPosted || existing.postingStatus === 'Post')),
      isCancelled: existing?.isCancelled ?? false,
      nextEntryNumber,
      lines: existing?.lines ?? [],
    };
  }
}

export const openingBalanceService = new OpeningBalanceService();
