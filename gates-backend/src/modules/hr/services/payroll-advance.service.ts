import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export interface CreatePayrollAdvanceInput {
  employeeId: string;
  date: Date;
  amount: number;
  installmentAmount?: number;
  notes?: string;
}

export class PayrollAdvanceService {
  async create(companyId: string, input: CreatePayrollAdvanceInput) {
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, companyId, isActive: true },
    });
    if (!employee) throw new AppError(404, 'Employee not found');
    if (input.amount <= 0) throw new AppError(422, 'Advance amount must be positive');

    const installment = input.installmentAmount ?? input.amount;

    return prisma.employeeAdvance.create({
      data: {
        employeeId: input.employeeId,
        date: input.date,
        value: new Decimal(input.amount),
        remainingAmount: new Decimal(input.amount),
        monthlyInstallment: new Decimal(installment),
        isSettled: false,
        notes: input.notes,
        isActive: true,
      },
    });
  }

  async listOpen(companyId: string, employeeId?: string) {
    const employees = await prisma.employee.findMany({
      where: { companyId },
      select: { id: true },
    });
    const ids = employees.map((e) => e.id);
    return prisma.employeeAdvance.findMany({
      where: {
        employeeId: employeeId ? employeeId : { in: ids },
        isActive: true,
        isSettled: false,
      },
      include: {
        employee: { select: { id: true, arabicName: true, serial: true } },
      },
      orderBy: { date: 'desc' },
    });
  }
}

export const payrollAdvanceService = new PayrollAdvanceService();
