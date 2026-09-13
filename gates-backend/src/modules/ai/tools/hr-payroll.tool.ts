import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { OWNER_ROLES } from './ai-tool-access';
import { BaseAiTool } from './base-ai-tool';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
});

type Params = z.infer<typeof paramsSchema>;

export class HrPayrollTool extends BaseAiTool<Params> {
  readonly name = 'hr_payroll_tool';
  readonly description =
    'Owner-only payroll summary: monthly expense, advances/loans deducted, headcount by department.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'payroll:view';
  readonly allowedRoles = OWNER_ROLES;

  protected async run(params: Params, context: SecurityContext) {
    const now = new Date();
    const month = params.month ?? now.getMonth() + 1;
    const year = params.year ?? now.getFullYear();

    const [run, employees, advances] = await Promise.all([
      prisma.payrollRun.findFirst({
        where: { companyId: context.companyId, periodMonth: month, periodYear: year },
        include: {
          items: {
            include: {
              employee: { select: { department: { select: { arabicName: true } } } },
            },
          },
        },
      }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        where: { companyId: context.companyId, isActive: true },
        _count: { _all: true },
      }),
      prisma.employeeAdvance.aggregate({
        where: {
          isActive: true,
          employee: { companyId: context.companyId },
          date: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
        _sum: { value: true },
      }),
    ]);

    const departmentIds = employees
      .map((row) => row.departmentId)
      .filter((id): id is string => Boolean(id));
    const departments = departmentIds.length
      ? await prisma.department.findMany({
          where: { id: { in: departmentIds } },
          select: { id: true, arabicName: true },
        })
      : [];
    const deptName = new Map(departments.map((row) => [row.id, row.arabicName]));

    const headcount = employees.map((row) => ({
      department: row.departmentId ? deptName.get(row.departmentId) ?? 'بدون قسم' : 'بدون قسم',
      count: row._count._all,
    }));

    if (run) {
      return {
        month,
        year,
        status: run.status,
        totalPayrollExpense: Number(run.totalGross),
        totalNet: Number(run.totalNet),
        totalAdvancesDeducted: Number(run.totalAdvanceDeduction),
        periodAdvancesIssued: Number(advances._sum.value ?? 0),
        headcountTotal: headcount.reduce((sum, row) => sum + row.count, 0),
        departmentDistribution: headcount,
      };
    }

    const salaries = await prisma.monthlySalary.aggregate({
      where: {
        companyId: context.companyId,
        periodMonth: String(month),
        periodYear: String(year),
        isActive: true,
      },
      _sum: { netSalary: true, basicSalary: true, advances: true },
      _count: { _all: true },
    });

    return {
      month,
      year,
      status: salaries._count._all ? 'MONTHLY_SALARY' : 'NO_PAYROLL_RUN',
      totalPayrollExpense: Number(salaries._sum.basicSalary ?? 0),
      totalNet: Number(salaries._sum.netSalary ?? 0),
      totalAdvancesDeducted: Number(salaries._sum.advances ?? 0),
      periodAdvancesIssued: Number(advances._sum.value ?? 0),
      headcountTotal: headcount.reduce((sum, row) => sum + row.count, 0),
      departmentDistribution: headcount,
    };
  }
}
