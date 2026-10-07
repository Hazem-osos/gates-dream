import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { closeCompensationEndDate } from '../hcm/compensation-assignment.domain';
import { rangesOverlap } from '../../utils/hr-effective-date.util';

export class PayrollCompensationComponentService {
  async listForEmployment(companyId: string, employmentId: string) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');
    const rows = await prisma.hcmCompensationComponentAssignment.findMany({
      where: { companyId, employmentId },
      include: { payComponent: { select: { code: true, arabicName: true } } },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      payComponentId: r.payComponentId,
      code: r.payComponent.code,
      name: r.payComponent.arabicName,
      amount: Number(r.amount),
      currencyCode: r.currencyCode,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      sourceType: r.sourceType,
    }));
  }

  async assignComponent(
    companyId: string,
    employmentId: string,
    data: {
      payComponentId: string;
      amount: number;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
      currencyCode?: string;
    }
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');
    const existing = await prisma.hcmCompensationComponentAssignment.findMany({
      where: { companyId, employmentId, payComponentId: data.payComponentId },
    });
    for (const row of existing) {
      if (
        rangesOverlap(
          row.effectiveFrom,
          row.effectiveTo,
          data.effectiveFrom,
          data.effectiveTo ?? null
        )
      ) {
        throw new AppError(422, 'Compensation assignment period overlaps an existing assignment');
      }
    }
    return prisma.hcmCompensationComponentAssignment.create({
      data: {
        companyId,
        employmentId,
        payComponentId: data.payComponentId,
        amount: data.amount,
        currencyCode: data.currencyCode ?? 'EGP',
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
      },
    });
  }

  async endAssignment(companyId: string, assignmentId: string, effectiveTo: Date) {
    const row = await prisma.hcmCompensationComponentAssignment.findFirst({
      where: { id: assignmentId, companyId },
    });
    if (!row) throw new AppError(404, 'Assignment not found');
    return prisma.hcmCompensationComponentAssignment.update({
      where: { id: assignmentId },
      data: { effectiveTo },
    });
  }

  async changeComponentAmount(
    companyId: string,
    employmentId: string,
    payComponentId: string,
    newAmount: number,
    effectiveFrom: Date
  ) {
    const existing = await prisma.hcmCompensationComponentAssignment.findMany({
      where: { companyId, employmentId, payComponentId },
      orderBy: { effectiveFrom: 'asc' },
    });
    const open = existing.find((r) => r.effectiveTo == null);
    if (open) {
      await prisma.hcmCompensationComponentAssignment.update({
        where: { id: open.id },
        data: { effectiveTo: closeCompensationEndDate(effectiveFrom) },
      });
    }
    return this.assignComponent(companyId, employmentId, {
      payComponentId,
      amount: newAmount,
      effectiveFrom,
    });
  }
}

export const payrollCompensationComponentService = new PayrollCompensationComponentService();
