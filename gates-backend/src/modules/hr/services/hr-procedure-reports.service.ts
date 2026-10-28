import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

/** Report key (URL segment) → employee procedure types it lists. */
export const PROCEDURE_REPORT_TYPES: Record<string, string[]> = {
  penalties: ['penalty'],
  rewards: ['reward'],
  warnings: ['warning'],
  promotions: ['promotion'],
  transfer: ['transfer'],
  suspensions: ['suspension'],
  termination: ['termination'],
  secondment: ['secondment'],
  courses: ['training'],
  recommendations: ['other'],
  'housing-allowance': ['housing_allowance'],
};

type ReportFilters = {
  companyId: string;
  fromDate: Date;
  toDate: Date;
  employeeId?: string;
  employee?: string;
  limit?: number;
};

function employeeWhere(companyId: string, filters: ReportFilters): Prisma.EmployeeWhereInput {
  const text = filters.employee?.trim();
  return {
    companyId,
    ...(filters.employeeId ? { id: filters.employeeId } : {}),
    ...(text
      ? {
          OR: [
            { arabicName: { contains: text } },
            { englishName: { contains: text } },
            { employeeId: { contains: text } },
            { serial: { contains: text } },
          ],
        }
      : {}),
  };
}

const money = (v: unknown) => (v == null ? 0 : Math.round(Number(v) * 100) / 100);

export class HrProcedureReportsService {
  async procedures(kind: string, filters: ReportFilters) {
    const types = PROCEDURE_REPORT_TYPES[kind];
    if (!types) throw new AppError(404, 'تقرير غير معروف');
    const rows = await prisma.employeeProcedure.findMany({
      where: {
        procedureType: { in: types },
        date: { gte: filters.fromDate, lte: filters.toDate },
        employee: employeeWhere(filters.companyId, filters),
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(filters.limit ?? 1000, 1000),
      include: { employee: { select: { arabicName: true, employeeId: true, serial: true } } },
    });
    const data = rows.map((r) => ({
      date: r.date,
      employeeCode: r.employee.employeeId ?? r.employee.serial ?? '',
      employeeName: r.employee.arabicName,
      serial: r.serial ?? '',
      amount: money(r.amount),
      unit: r.unit ?? '',
      reason: r.reason ?? '',
      description: r.description ?? '',
    }));
    return {
      data,
      summary: { count: data.length, totalAmount: money(data.reduce((s, r) => s + r.amount, 0)) },
    };
  }

  async loans(filters: ReportFilters) {
    const rows = await prisma.employeeAdvance.findMany({
      where: {
        isActive: true,
        date: { gte: filters.fromDate, lte: filters.toDate },
        employee: employeeWhere(filters.companyId, filters),
      },
      orderBy: [{ date: 'asc' }],
      take: Math.min(filters.limit ?? 1000, 1000),
      include: { employee: { select: { arabicName: true, employeeId: true, serial: true } } },
    });
    const data = rows.map((r) => ({
      date: r.date,
      employeeCode: r.employee.employeeId ?? r.employee.serial ?? '',
      employeeName: r.employee.arabicName,
      serial: r.serial ?? '',
      amount: money(r.value),
      monthlyInstallment: money(r.monthlyInstallment),
      remainingAmount: money(r.remainingAmount ?? (r.isSettled ? 0 : r.value)),
      status: r.isSettled ? 'مسددة' : 'قائمة',
      notes: r.notes ?? '',
    }));
    return {
      data,
      summary: {
        count: data.length,
        totalAmount: money(data.reduce((s, r) => s + r.amount, 0)),
        totalRemaining: money(data.reduce((s, r) => s + r.remainingAmount, 0)),
      },
    };
  }
}

export const hrProcedureReportsService = new HrProcedureReportsService();
