import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import { yearEndClosingService } from '../../operations/services/year-end-closing.service';
import type { JournalPostingContext } from './journal-posting.service';

export interface CreatePeriodData {
  code: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdatePeriodData extends Partial<CreatePeriodData> {
  isActive?: boolean;
  isClosed?: boolean;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number): Date {
  const next = startOfUtcDay(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dateLabel(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

export class PeriodService {
  async syncPeriodsFromFiscalYears(companyId: string) {
    const years = await prisma.fiscalYear.findMany({
      where: { companyId, isActive: true },
      orderBy: { startDate: 'asc' },
    });
    if (years.length === 0) return;

    const periods = await prisma.period.findMany({ where: { companyId } });
    for (const year of years) {
      const match = periods.find(
        (period) =>
          period.code === year.legacyYearId ||
          (dateLabel(period.startDate) === dateLabel(year.startDate) &&
            dateLabel(period.endDate) === dateLabel(year.endDate))
      );
      const closed = year.status === 'Close';
      if (!match) {
        const created = await prisma.period.create({
          data: {
            companyId,
            code: year.legacyYearId.slice(0, 50),
            name: year.arabicName?.trim() || `السنة المالية ${year.legacyYearId}`,
            startDate: year.startDate,
            endDate: year.endDate,
            isClosed: closed,
            isActive: true,
          },
        });
        periods.push(created);
      } else if (match.isClosed !== closed || match.isActive === false) {
        await prisma.period.update({
          where: { id: match.id },
          data: { isClosed: closed, isActive: true },
        });
        match.isClosed = closed;
        match.isActive = true;
      }
    }
  }

  async getLatestPeriod(companyId: string) {
    return prisma.period.findFirst({
      where: { companyId, isActive: true },
      orderBy: { endDate: 'desc' },
    });
  }

  async nextStartDate(companyId: string, exceptPeriodId?: string): Promise<Date | null> {
    const latest = await prisma.period.findFirst({
      where: {
        companyId,
        isActive: true,
        ...(exceptPeriodId ? { id: { not: exceptPeriodId } } : {}),
      },
      orderBy: { endDate: 'desc' },
    });
    return latest ? addUtcDays(latest.endDate, 1) : null;
  }

  async countOtherPeriods(companyId: string, exceptPeriodId?: string): Promise<number> {
    return prisma.period.count({
      where: {
        companyId,
        isActive: true,
        ...(exceptPeriodId ? { id: { not: exceptPeriodId } } : {}),
      },
    });
  }

  private async countMovements(companyId: string, startDate: Date, endDate: Date) {
    const date = { gte: startDate, lte: endDate };
    const [journals, invoices, cash] = await Promise.all([
      prisma.journalEntry.count({
        where: { companyId, date, deletedAt: null, isCancelled: false },
      }),
      prisma.invoice.count({
        where: { companyId, date, isCancelled: false },
      }),
      prisma.cashTransaction.count({
        where: { companyId, date, isCancelled: false },
      }),
    ]);
    return { journals, invoices, cash, total: journals + invoices + cash };
  }

  private async assertNoMovements(companyId: string, startDate: Date, endDate: Date, action: string) {
    const movements = await this.countMovements(companyId, startDate, endDate);
    if (movements.total === 0) return;
    const parts = [
      movements.journals > 0 ? `${movements.journals} قيد` : null,
      movements.invoices > 0 ? `${movements.invoices} فاتورة` : null,
      movements.cash > 0 ? `${movements.cash} حركة خزينة` : null,
    ].filter(Boolean);
    throw new AppError(
      422,
      `لا يمكن ${action} الفترة لأن عليها ${parts.join(' و')}. احذف أو ألغِ هذه الحركات أولاً.`
    );
  }

  private async resolveFiscalYearForPeriod(
    companyId: string,
    period: { code: string; name: string; startDate: Date; endDate: Date; isClosed: boolean }
  ) {
    const byCode = await prisma.fiscalYear.findFirst({
      where: { companyId, legacyYearId: period.code.slice(0, 20) },
    });
    if (byCode) {
      return prisma.fiscalYear.update({
        where: { id: byCode.id },
        data: {
          arabicName: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          isActive: true,
        },
      });
    }

    const byDates = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });
    if (byDates) {
      return prisma.fiscalYear.update({
        where: { id: byDates.id },
        data: { arabicName: period.name, isActive: true },
      });
    }

    return prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: period.code.slice(0, 20),
        arabicName: period.name,
        englishName: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.isClosed ? 'Close' : 'Open',
        isActive: true,
      },
    });
  }

  async createPeriod(companyId: string, data: CreatePeriodData) {
    if (data.startDate >= data.endDate) {
      throw new AppError(400, 'تاريخ البداية يجب أن يسبق تاريخ النهاية');
    }

    const otherCount = await this.countOtherPeriods(companyId);
    let startDate = startOfUtcDay(data.startDate);
    const endDate = startOfUtcDay(data.endDate);

    if (otherCount > 0) {
      const forced = await this.nextStartDate(companyId);
      if (forced) startDate = forced;
    }

    if (startDate >= endDate) {
      throw new AppError(
        400,
        `تاريخ النهاية يجب أن يكون بعد ${dateLabel(startDate)} (اليوم التالي لآخر سنة مالية).`
      );
    }

    const existingCode = await prisma.period.findFirst({
      where: { companyId, code: data.code },
    });
    if (existingCode) {
      throw new AppError(409, 'مسلسل الفترة مستخدم من قبل');
    }

    const period = await prisma.period.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        startDate,
        endDate,
        isClosed: false,
        isActive: true,
      },
    });

    await this.resolveFiscalYearForPeriod(companyId, period);
    logger.info({ companyId, periodId: period.id }, 'Period created');
    return period;
  }

  async getPeriodById(companyId: string, periodId: string) {
    const period = await prisma.period.findFirst({
      where: { id: periodId, companyId },
    });
    if (!period) {
      throw new AppError(404, 'الفترة غير موجودة');
    }
    return period;
  }

  async getPeriodByCode(companyId: string, code: string) {
    const period = await prisma.period.findFirst({
      where: { companyId, code },
    });
    if (!period) {
      throw new AppError(404, 'الفترة غير موجودة');
    }
    return period;
  }

  async getCurrentPeriod(companyId: string) {
    const today = new Date();
    const period = await prisma.period.findFirst({
      where: {
        companyId,
        isActive: true,
        isClosed: false,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new AppError(404, 'لا توجد فترة مفتوحة تغطي تاريخ اليوم');
    }
    return period;
  }

  async listPeriods(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      isClosed?: boolean;
    }
  ) {
    await this.syncPeriodsFromFiscalYears(companyId);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const search = options.search?.trim();

    const where: {
      companyId: string;
      isActive?: boolean;
      isClosed?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = {
      companyId,
      isActive: options.isActive ?? true,
    };

    if (options.isClosed !== undefined) {
      where.isClosed = options.isClosed;
    }

    if (search) {
      where.OR = [{ name: { contains: search } }, { code: { contains: search } }];
    }

    const [periods, total] = await Promise.all([
      prisma.period.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startDate: 'desc' }],
      }),
      prisma.period.count({ where }),
    ]);

    const nextStart = await this.nextStartDate(companyId);

    return {
      periods,
      nextStartDate: nextStart ? dateLabel(nextStart) : null,
      otherCount: total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updatePeriod(companyId: string, periodId: string, data: UpdatePeriodData) {
    const existing = await this.getPeriodById(companyId, periodId);
    await this.assertNoMovements(companyId, existing.startDate, existing.endDate, 'تعديل');

    const otherCount = await this.countOtherPeriods(companyId, periodId);
    let startDate = data.startDate ? startOfUtcDay(data.startDate) : existing.startDate;
    const endDate = data.endDate ? startOfUtcDay(data.endDate) : existing.endDate;

    if (otherCount > 0) {
      startDate = existing.startDate;
    }

    if (startDate >= endDate) {
      throw new AppError(400, 'تاريخ البداية يجب أن يسبق تاريخ النهاية');
    }

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.period.findFirst({
        where: { companyId, code: data.code, id: { not: periodId } },
      });
      if (clash) {
        throw new AppError(409, 'مسلسل الفترة مستخدم من قبل');
      }
    }

    const period = await prisma.period.update({
      where: { id: periodId },
      data: {
        ...(data.code !== undefined ? { code: data.code } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        startDate,
        endDate,
      },
    });

    await this.resolveFiscalYearForPeriod(companyId, period);
    logger.info({ companyId, periodId }, 'Period updated');
    return period;
  }

  async closePeriod(companyId: string, periodId: string, ctx: JournalPostingContext) {
    const period = await this.getPeriodById(companyId, periodId);
    if (period.isClosed) {
      throw new AppError(400, 'الفترة مغلقة بالفعل');
    }

    const year = await this.resolveFiscalYearForPeriod(companyId, period);
    const result = await yearEndClosingService.closeFiscalYear(
      { ...ctx, fiscalYearId: year.id },
      year.id
    );

    const updated = await prisma.period.update({
      where: { id: period.id },
      data: { isClosed: true },
    });

    logger.info({ companyId, periodId, closingJournalEntryId: result.closingJournalEntryId }, 'Period closed');
    return { ...updated, closingJournalEntryId: result.closingJournalEntryId };
  }

  async reopenPeriod(companyId: string, periodId: string, ctx: JournalPostingContext) {
    const period = await this.getPeriodById(companyId, periodId);
    if (!period.isClosed) {
      throw new AppError(400, 'الفترة ليست مغلقة');
    }

    const year = await this.resolveFiscalYearForPeriod(companyId, period);
    await yearEndClosingService.reopenFiscalYear({ ...ctx, fiscalYearId: year.id }, year.id);

    const updated = await prisma.period.update({
      where: { id: period.id },
      data: { isClosed: false },
    });

    logger.info({ companyId, periodId }, 'Period reopened');
    return updated;
  }

  async deletePeriod(companyId: string, periodId: string) {
    const period = await this.getPeriodById(companyId, periodId);
    await this.assertNoMovements(companyId, period.startDate, period.endDate, 'حذف');

    await prisma.period.delete({ where: { id: periodId } });

    const year = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        OR: [
          { legacyYearId: period.code.slice(0, 20) },
          { startDate: period.startDate, endDate: period.endDate },
        ],
      },
    });
    if (year) {
      const yearMovements = await this.countMovements(companyId, year.startDate, year.endDate);
      if (yearMovements.total === 0 && year.status !== 'Close') {
        await prisma.fiscalYear.update({
          where: { id: year.id },
          data: { isActive: false },
        });
      }
    }

    logger.info({ companyId, periodId }, 'Period deleted');
    return { success: true };
  }
}

export const periodService = new PeriodService();
