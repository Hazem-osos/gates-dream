import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export interface CreateContractingProjectInput {
  projectCode: string;
  projectName: string;
  customerId?: string;
  contractValue: number;
  advancePaymentBalance?: number;
  advanceDeductionPercent?: number;
  retentionPercent?: number;
  costCenterId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface CreateSubcontractInput {
  subcontractorId: string;
  subcontractValue: number;
  advancePaymentBalance?: number;
  advanceRecoveryPercent?: number;
  retentionPercent?: number;
  scopeOfWork?: string;
}

export class ContractingProjectService {
  async create(companyId: string, input: CreateContractingProjectInput) {
    if (input.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: input.customerId, companyId },
      });
      if (!customer) throw new AppError(404, 'Customer not found');
    }

    const advanceAmt = input.advancePaymentBalance ?? 0;

    return prisma.contractingProject.create({
      data: {
        companyId,
        projectCode: input.projectCode,
        projectName: input.projectName,
        customerId: input.customerId,
        contractValue: new Decimal(input.contractValue),
        advancePaymentAmount: new Decimal(advanceAmt),
        advancePaymentBalance: new Decimal(advanceAmt),
        advanceDeductionPercent: new Decimal(input.advanceDeductionPercent ?? 0),
        retentionPercent: new Decimal(input.retentionPercent ?? 0),
        costCenterId: input.costCenterId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'ACTIVE',
      },
    });
  }

  async getById(companyId: string, id: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id, companyId },
      include: {
        subcontracts: { include: { subcontractor: true } },
        customer: { select: { id: true, arabicName: true } },
        costCenter: { select: { id: true, code: true, arabicName: true } },
      },
    });
    if (!project) throw new AppError(404, 'Contracting project not found');
    return project;
  }

  async list(companyId: string, limit = 200) {
    return prisma.contractingProject.findMany({
      where: { companyId },
      include: {
        customer: { select: { id: true, arabicName: true, code: true } },
        _count: { select: { subcontracts: true } },
      },
      orderBy: { projectCode: 'asc' },
      take: Math.min(limit, 500),
    });
  }

  async addSubcontract(companyId: string, projectId: string, input: CreateSubcontractInput) {
    await this.getById(companyId, projectId);
    const contractor = await prisma.contractor.findFirst({
      where: { id: input.subcontractorId, companyId },
    });
    if (!contractor) throw new AppError(404, 'Subcontractor not found');

    return prisma.projectSubcontract.create({
      data: {
        projectId,
        subcontractorId: input.subcontractorId,
        subcontractValue: new Decimal(input.subcontractValue),
        advancePaymentBalance: new Decimal(input.advancePaymentBalance ?? 0),
        advanceRecoveryPercent: new Decimal(input.advanceRecoveryPercent ?? 0),
        retentionPercent: new Decimal(input.retentionPercent ?? 0),
        scopeOfWork: input.scopeOfWork,
      },
    });
  }
}

export const contractingProjectService = new ContractingProjectService();
