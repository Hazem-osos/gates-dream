import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly, isDateInEffectiveRange, rangesOverlap } from '../../utils/hr-effective-date.util';

export type ContractLookup = {
  id: string;
  contractStartDate: Date;
  contractEndDate: Date | null;
  contractStatus: string | null;
  isActive: boolean;
};

export class HcmContractLifecycleService {
  async contractAtDate(employmentId: string, day: Date): Promise<ContractLookup | null> {
    const contracts = await prisma.employeeContract.findMany({
      where: { employmentId },
      orderBy: { contractStartDate: 'asc' },
    });
    const d = toDateOnly(day);
    const matches = contracts.filter((c) =>
      isDateInEffectiveRange(d, c.contractStartDate, c.contractEndDate)
    );
    if (matches.length === 0) return null;
    return matches[matches.length - 1] as ContractLookup;
  }

  private assertNoOverlap(
    existing: Array<{ contractStartDate: Date; contractEndDate: Date | null; id: string }>,
    from: Date,
    to: Date | null,
    excludeId?: string
  ) {
    for (const row of existing) {
      if (excludeId && row.id === excludeId) continue;
      if (rangesOverlap(row.contractStartDate, row.contractEndDate, from, to)) {
        throw new AppError(422, 'Contract period overlaps an existing contract');
      }
    }
  }

  async createContract(
    companyId: string,
    employmentId: string,
    input: {
      contractStartDate: Date;
      contractEndDate?: Date | null;
      basicSalary?: number;
      departmentId?: string;
      jobTitleId?: string;
    }
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: employmentId, companyId },
      include: { employee: true },
    });
    if (!employment) throw new AppError(404, 'Employment not found');

    const from = toDateOnly(input.contractStartDate);
    const to = input.contractEndDate ? toDateOnly(input.contractEndDate) : null;
    const existing = await prisma.employeeContract.findMany({ where: { employmentId } });
    this.assertNoOverlap(existing, from, to);

    return prisma.employeeContract.create({
      data: {
        employeeId: employment.employeeId,
        employmentId,
        contractStartDate: from,
        contractEndDate: to,
        basicSalary: input.basicSalary,
        departmentId: input.departmentId,
        jobTitleId: input.jobTitleId,
        contractStatus: 'ACTIVE',
        isActive: true,
      },
    });
  }

  async renewContract(
    companyId: string,
    priorContractId: string,
    input: { contractStartDate: Date; contractEndDate?: Date | null; basicSalary?: number }
  ) {
    const prior = await prisma.employeeContract.findFirst({
      where: { id: priorContractId },
      include: { employment: true },
    });
    if (!prior?.employment || prior.employment.companyId !== companyId) {
      throw new AppError(404, 'Contract not found');
    }

    return prisma.$transaction(async (tx) => {
      await tx.employeeContract.update({
        where: { id: priorContractId },
        data: { isActive: false, contractStatus: 'SUPERSEDED' },
      });
      const from = toDateOnly(input.contractStartDate);
      const to = input.contractEndDate ? toDateOnly(input.contractEndDate) : null;
      return tx.employeeContract.create({
        data: {
          employeeId: prior.employeeId,
          employmentId: prior.employmentId!,
          previousContractId: priorContractId,
          contractStartDate: from,
          contractEndDate: to,
          basicSalary: input.basicSalary ?? prior.basicSalary,
          contractStatus: 'ACTIVE',
          isActive: true,
        },
      });
    });
  }

  async amendContract(companyId: string, contractId: string, patch: { basicSalary?: number }) {
    const c = await prisma.employeeContract.findFirst({
      where: { id: contractId },
      include: { employment: true },
    });
    if (!c?.employment || c.employment.companyId !== companyId) {
      throw new AppError(404, 'Contract not found');
    }
    return prisma.employeeContract.update({
      where: { id: contractId },
      data: { basicSalary: patch.basicSalary },
    });
  }

  async expireContract(companyId: string, contractId: string, effectiveDate: Date) {
    const c = await prisma.employeeContract.findFirst({
      where: { id: contractId },
      include: { employment: true },
    });
    if (!c?.employment || c.employment.companyId !== companyId) {
      throw new AppError(404, 'Contract not found');
    }
    const end = toDateOnly(effectiveDate);
    return prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        contractEndDate: end,
        contractStatus: 'EXPIRED',
        isActive: false,
      },
    });
  }

  async terminateContract(companyId: string, contractId: string, effectiveDate: Date) {
    const c = await prisma.employeeContract.findFirst({
      where: { id: contractId },
      include: { employment: true },
    });
    if (!c?.employment || c.employment.companyId !== companyId) {
      throw new AppError(404, 'Contract not found');
    }
    const end = toDateOnly(effectiveDate);
    return prisma.employeeContract.update({
      where: { id: contractId },
      data: {
        contractEndDate: end,
        contractStatus: 'TERMINATED',
        isActive: false,
      },
    });
  }
}

export const hcmContractLifecycleService = new HcmContractLifecycleService();
