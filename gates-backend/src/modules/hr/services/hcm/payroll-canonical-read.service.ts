import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';

/**
 * Read model for payslip/register views — sourced from posted PayrollRunItem.
 * MonthlySalary remains legacy storage; new UI should prefer this service.
 */
export class PayrollCanonicalReadService {
  async listPayslipsForPeriod(companyId: string, periodYear: number, periodMonth: number) {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId, periodYear, periodMonth, status: { in: ['POSTED', 'PAID'] } },
      include: {
        items: {
          include: {
            employee: {
              select: { id: true, arabicName: true, serial: true, employeeId: true },
            },
          },
        },
      },
    });
    if (!run) return { run: null, items: [] };
    return {
      run: {
        id: run.id,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        status: run.status,
        totalNet: run.totalNet,
      },
      items: run.items.map((item) => ({
        employeeId: item.employeeId,
        employee: item.employee,
        basicSalary: item.basicSalary,
        allowances: item.allowances,
        overtime: item.overtime,
        absenceDeduction: item.absenceDeduction,
        otherDeductions: item.otherDeductions,
        grossSalary: item.grossSalary,
        employeeInsurance: item.employeeInsurance,
        tax: item.tax,
        advanceDeduction: item.advanceDeduction,
        netSalary: item.netSalary,
        source: 'PayrollRunItem' as const,
      })),
    };
  }

  async employeePayslip(companyId: string, employeeId: string, periodYear: number, periodMonth: number) {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId, periodYear, periodMonth, status: { in: ['POSTED', 'PAID'] } },
    });
    if (!run) throw new AppError(404, 'No posted payroll for period');
    const item = await prisma.payrollRunItem.findFirst({
      where: { payrollRunId: run.id, employeeId },
    });
    if (!item) throw new AppError(404, 'Employee not on payroll run');
    return { run, item, source: 'PayrollRunItem' };
  }
}

export const payrollCanonicalReadService = new PayrollCanonicalReadService();
