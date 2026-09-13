import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  PERIOD_LOCKED_MESSAGE,
  NO_FISCAL_YEAR_FOR_DATE_MESSAGE,
  FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE,
  POSTING_LOCKED_BEFORE_DATE_MESSAGE,
} from '../../accounting/constants/ledger-integrity';

export type FiscalPeriodResolution =
  | { kind: 'open'; fiscalYearId: string; legacyYearId: string }
  | { kind: 'invalid' }
  | { kind: 'closed'; fiscalYearId: string; legacyYearId: string };

export class FiscalYearService {
  async resolveForDate(companyId: string, date: Date): Promise<FiscalPeriodResolution> {
    const year = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { startDate: 'desc' },
    });

    if (!year) {
      return { kind: 'invalid' };
    }

    if (year.status === 'Close') {
      return {
        kind: 'closed',
        fiscalYearId: year.id,
        legacyYearId: year.legacyYearId,
      };
    }

    return {
      kind: 'open',
      fiscalYearId: year.id,
      legacyYearId: year.legacyYearId,
    };
  }

  async assertOpenForDate(companyId: string, date: Date): Promise<string> {
    const resolution = await this.resolveForDate(companyId, date);
    if (resolution.kind === 'invalid') {
      throw new AppError(422, NO_FISCAL_YEAR_FOR_DATE_MESSAGE);
    }
    if (resolution.kind === 'closed') {
      throw new AppError(422, FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE);
    }
    await this.assertNotBeforeLockDate(companyId, date);
    await this.assertPeriodOpenForDate(companyId, date);
    return resolution.fiscalYearId;
  }

  /**
   * `CompanySettings.lockPostingBeforeDate` — a company-wide cutoff, distinct
   * from fiscal year/period closes above. Stored via the settings CRUD since
   * it was added but never enforced on any posting path.
   */
  async assertNotBeforeLockDate(companyId: string, date: Date): Promise<void> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: { lockPostingBeforeDate: true },
    });
    const raw = settings?.lockPostingBeforeDate;
    if (!raw) return;
    const lockDate = new Date(raw);
    if (Number.isNaN(lockDate.getTime())) return;
    if (date.getTime() < lockDate.getTime()) {
      throw new AppError(422, POSTING_LOCKED_BEFORE_DATE_MESSAGE);
    }
  }

  /**
   * M2 fix: `FiscalPeriod.isClosed` previously existed but was never
   * consulted by any posting path — monthly locks were purely cosmetic.
   * Every caller of `assertOpenForDate` now also enforces the period lock.
   * If the year has any periods defined, the document date must fall in
   * an open (not closed / not locked) covering period.
   *
   * Foundation fix: the standalone `Period` model (`accounting/create/periods`
   * page, `period.service.ts`/`period.routes.ts`) is a second, disconnected
   * period-closing concept with its own `isClosed` flag and *no* link to
   * `FiscalYear` — the only real "close a period" admin UI in the app was
   * writing to a table nothing ever read. Both are now checked here so
   * closing a period through either surface actually blocks posting.
   */
  async assertPeriodOpenForDate(companyId: string, date: Date): Promise<void> {
    const legacyPeriod = await prisma.period.findFirst({
      where: {
        companyId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { isClosed: true },
    });
    if (legacyPeriod?.isClosed) {
      throw new AppError(422, PERIOD_LOCKED_MESSAGE);
    }

    const year = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        isActive: true,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { id: true },
    });
    if (!year) return;

    const covering = await prisma.fiscalPeriod.findFirst({
      where: {
        companyId,
        fiscalYearId: year.id,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
    if (covering) {
      if (covering.isClosed) {
        throw new AppError(422, PERIOD_LOCKED_MESSAGE);
      }
      return;
    }

    const anyPeriod = await prisma.fiscalPeriod.findFirst({
      where: { companyId, fiscalYearId: year.id },
      select: { id: true },
    });
    if (anyPeriod) {
      throw new AppError(422, PERIOD_LOCKED_MESSAGE);
    }
  }

  async assertOpenById(companyId: string, fiscalYearId: string): Promise<void> {
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!year) {
      throw new AppError(404, 'Fiscal year not found');
    }
    if (year.status === 'Close') {
      // A closed *year* is legacy message 1124, not the monthly period lock —
      // this used to report the period message for a year-level rejection.
      throw new AppError(422, FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE);
    }
  }

  async getById(companyId: string, fiscalYearId: string) {
    const year = await prisma.fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId },
    });
    if (!year) {
      throw new AppError(404, 'Fiscal year not found');
    }
    return year;
  }

  /** Prefer open year covering today, then any open year, then any active year. */
  async resolveDefaultFiscalYearId(companyId: string): Promise<string | null> {
    const today = new Date();
    const coveringOpen = await prisma.fiscalYear.findFirst({
      where: {
        companyId,
        isActive: true,
        status: { not: 'Close' },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (coveringOpen) return coveringOpen.id;

    const openAny = await prisma.fiscalYear.findFirst({
      where: { companyId, isActive: true, status: { not: 'Close' } },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (openAny) return openAny.id;

    const anyActive = await prisma.fiscalYear.findFirst({
      where: { companyId, isActive: true },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    return anyActive?.id ?? null;
  }
}

export const fiscalYearService = new FiscalYearService();
