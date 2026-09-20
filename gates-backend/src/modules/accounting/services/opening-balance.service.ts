import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { toHijriDate } from '../../../shared/utils/hijri-date';

export const OPENING_BALANCE_ENTRY_TYPE = 'OPENING_BALANCE';

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
    const existing = await prisma.journalEntry.findFirst({
      where: {
        companyId,
        entryType: OPENING_BALANCE_ENTRY_TYPE,
        isPosted: true,
        isCancelled: false,
      },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, arabicName: true } },
            costCenter: { select: { id: true, code: true, arabicName: true } },
          },
          orderBy: { lineOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      openingDate: meta.openingDateIso,
      hijriDate: meta.hijriDate,
      fiscalYearName: meta.fiscalYearName,
      fiscalYearId: meta.fiscalYearId,
      fiscalYearStartDate: meta.fiscalYearStartDateIso,
      journalEntryId: existing?.id ?? null,
      lines: existing?.lines ?? [],
    };
  }
}

export const openingBalanceService = new OpeningBalanceService();
