import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';

export class PayrollPayComponentService {
  async updateComponent(
    companyId: string,
    componentId: string,
    data: {
      arabicName?: string;
      englishName?: string | null;
      taxableClass?: string;
      insurableClass?: string;
      isRecurring?: boolean;
      showOnPayslip?: boolean;
      priority?: number;
      isActive?: boolean;
    }
  ) {
    const row = await prisma.hcmPayComponent.findFirst({
      where: { id: componentId, companyId },
    });
    if (!row) throw new AppError(404, 'Pay component not found');
    const usedInPayroll = await prisma.hcmPayrollItemComponent.findFirst({
      where: { componentCode: row.code, payrollRunItem: { payrollRun: { companyId } } },
    });
    if (data.isActive === false && usedInPayroll) {
      throw new AppError(422, 'Cannot deactivate component referenced by historical payroll');
    }
    return prisma.hcmPayComponent.update({
      where: { id: componentId },
      data,
    });
  }

  async createComponent(
    companyId: string,
    data: {
      code: string;
      arabicName: string;
      englishName?: string | null;
      componentType: string;
      taxableClass?: string;
      insurableClass?: string;
      priority?: number;
      isRecurring?: boolean;
      showOnPayslip?: boolean;
    }
  ) {
    const code = data.code.toUpperCase();
    const dup = await prisma.hcmPayComponent.findFirst({
      where: { companyId, code },
    });
    if (dup) throw new AppError(409, 'Duplicate component code');
    return prisma.hcmPayComponent.create({
      data: {
        companyId,
        code,
        arabicName: data.arabicName,
        englishName: data.englishName,
        componentType: data.componentType,
        taxableClass: data.taxableClass ?? 'TAXABLE',
        insurableClass: data.insurableClass ?? 'INSURABLE',
        priority: data.priority ?? 100,
        isRecurring: data.isRecurring ?? true,
        showOnPayslip: data.showOnPayslip ?? true,
      },
    });
  }
}

export const payrollPayComponentService = new PayrollPayComponentService();
