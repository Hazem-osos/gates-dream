import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';

export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const dmy = v.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmy) {
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export type FiscalYearSyncInput = {
  id?: string;
  name?: string;
  startDate: string;
  endDate: string;
};

export async function upsertCompanyFiscalYear(
  companyId: string,
  input: FiscalYearSyncInput,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const startDate = parseFlexibleDate(input.startDate);
  const endDate = parseFlexibleDate(input.endDate);
  if (!startDate || !endDate) {
    throw new Error('تاريخ بداية أو نهاية السنة المالية غير صالح');
  }
  if (startDate >= endDate) {
    throw new Error('تاريخ بداية السنة المالية يجب أن يسبق تاريخ النهاية');
  }

  const year = startDate.getUTCFullYear();
  const legacyYearId = String(year);
  const name = input.name?.trim() || `السنة المالية ${year}`;

  let fiscalYear =
    (input.id
      ? await db.fiscalYear.findFirst({
          where: { id: input.id, companyId },
        })
      : null) ??
    (await db.fiscalYear.findFirst({
      where: { companyId, legacyYearId },
    })) ??
    (await db.fiscalYear.findFirst({
      where: { companyId, isActive: true },
      orderBy: { startDate: 'desc' },
    }));

  if (!fiscalYear) {
    fiscalYear = await db.fiscalYear.create({
      data: {
        companyId,
        legacyYearId,
        arabicName: name,
        englishName: name,
        startDate,
        endDate,
        status: 'Open',
        isActive: true,
      },
    });
  } else {
    fiscalYear = await db.fiscalYear.update({
      where: { id: fiscalYear.id },
      data: {
        arabicName: name,
        englishName: name,
        startDate,
        endDate,
        status: fiscalYear.status || 'Open',
        isActive: true,
      },
    });
  }

  await db.companySettings.upsert({
    where: { companyId },
    create: {
      companyId,
      fiscalYearStart: toIsoDateOnly(startDate),
      fiscalYearEnd: toIsoDateOnly(endDate),
    },
    update: {
      fiscalYearStart: toIsoDateOnly(startDate),
      fiscalYearEnd: toIsoDateOnly(endDate),
    },
  });

  return fiscalYear;
}
