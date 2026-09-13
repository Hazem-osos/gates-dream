import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  ContractingProjectNotFoundError,
  SubcontractNotFoundError,
  SubcontractorNotFoundError,
} from '../errors/subcontract-domain.errors';
import type {
  BulkUpsertBoqInput,
  CreateSitePenaltyInput,
  CreateSubcontractInput,
  CreateSubcontractorInput,
} from '../schemas/subcontract.validation';
import { money, rate, toDecimal } from '../utils/money-decimal';

export class SubcontractCommandService {
  async createSubcontract(companyId: string, dto: CreateSubcontractInput) {
    const [subcontractor, project] = await Promise.all([
      prisma.subcontractor.findFirst({ where: { id: dto.subcontractorId, companyId }, select: { id: true } }),
      prisma.contractingProject.findFirst({ where: { id: dto.projectId, companyId }, select: { id: true } }),
    ]);
    if (!subcontractor) throw new SubcontractorNotFoundError(companyId, dto.subcontractorId);
    if (!project) throw new ContractingProjectNotFoundError(companyId, dto.projectId);

    const subcontractNumber =
      dto.subcontractNumber ?? (await this.nextSubcontractNumber(companyId));

    return prisma.subcontract.create({
      data: {
        companyId,
        subcontractNumber,
        subcontractorId: dto.subcontractorId,
        projectId: dto.projectId,
        contractDate: dto.contractDate,
        totalContractValue: money(dto.totalContractValue),
        status: 'ACTIVE',
        advancePaymentTotal: money(dto.advancePaymentTotal ?? 0),
        advancePaymentRecoveryRate: rate(dto.advancePaymentRecoveryRate ?? 0.1),
        retentionRate: rate(dto.retentionRate ?? 0.05),
        taxWithholdingRate: rate(dto.taxWithholdingRate ?? 0.01),
        socialInsuranceRate: rate(dto.socialInsuranceRate ?? 0),
        standardScrapToleranceRate: rate(dto.standardScrapToleranceRate ?? 0.05),
        contractAdminOverheadRate: rate(dto.contractAdminOverheadRate ?? 0.15),
        earlyPaymentDiscountRate: rate(dto.earlyPaymentDiscountRate ?? 0.03),
        maxAllowedVariationOrderRate: rate(dto.maxAllowedVariationOrderRate ?? 0.2),
      },
      include: this.detailInclude(),
    });
  }

  async listSubcontracts(companyId: string) {
    return prisma.subcontract.findMany({
      where: { companyId },
      include: {
        subcontractor: true,
        project: { select: { id: true, projectCode: true, projectName: true, status: true } },
        invoices: { select: { id: true, status: true, netPayableAmount: true, grossCurrentAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSubcontractors(companyId: string) {
    return prisma.subcontractor.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { nameAr: 'asc' },
    });
  }

  async createSubcontractor(companyId: string, dto: CreateSubcontractorInput) {
    return prisma.subcontractor.create({
      data: {
        companyId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn ?? null,
        taxRegistrationNumber: dto.taxRegistrationNumber ?? null,
        commercialRegister: dto.commercialRegister ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        status: 'ACTIVE',
      },
    });
  }

  async getSubcontract(companyId: string, subcontractId: string) {
    const row = await prisma.subcontract.findFirst({
      where: { id: subcontractId, companyId },
      include: this.detailInclude(),
    });
    if (!row) throw new SubcontractNotFoundError(companyId, subcontractId);

    const boqProgress = row.boqItems.map((item) => {
      const contractQty = money(item.contractQuantity);
      const executed = money(item.cumulativeExecutedQty);
      const completion = contractQty.gt(0) ? executed.div(contractQty).mul(100) : toDecimal(0);
      return {
        ...item,
        completionPercentage: money(completion),
      };
    });

    return { ...row, boqItems: boqProgress };
  }

  async upsertBoqItems(companyId: string, subcontractId: string, dto: BulkUpsertBoqInput) {
    const subcontract = await prisma.subcontract.findFirst({
      where: { id: subcontractId, companyId },
    });
    if (!subcontract) throw new SubcontractNotFoundError(companyId, subcontractId);

    const variation = rate(subcontract.maxAllowedVariationOrderRate);

    return prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const qty = money(item.contractQuantity);
        const unitPrice = money(item.unitPrice);
        const totalPrice = money(qty.mul(unitPrice));
        const maxAllowedQuantity = item.maxAllowedQuantity
          ? money(item.maxAllowedQuantity)
          : money(qty.mul(toDecimal(1).plus(variation)));

        await tx.subcontractBOQItem.upsert({
          where: { subcontractId_itemCode: { subcontractId, itemCode: item.itemCode } },
          create: {
            subcontractId,
            itemCode: item.itemCode,
            descriptionAr: item.descriptionAr,
            descriptionEn: item.descriptionEn ?? null,
            unit: item.unit,
            contractQuantity: qty,
            unitPrice,
            totalPrice,
            maxAllowedQuantity,
          },
          update: {
            descriptionAr: item.descriptionAr,
            descriptionEn: item.descriptionEn ?? null,
            unit: item.unit,
            contractQuantity: qty,
            unitPrice,
            totalPrice,
            maxAllowedQuantity,
          },
        });
      }

      return tx.subcontract.findFirstOrThrow({
        where: { id: subcontractId, companyId },
        include: this.detailInclude(),
      });
    });
  }

  async createSitePenalty(companyId: string, subcontractId: string, dto: CreateSitePenaltyInput) {
    const subcontract = await prisma.subcontract.findFirst({
      where: { id: subcontractId, companyId },
      select: { id: true },
    });
    if (!subcontract) throw new SubcontractNotFoundError(companyId, subcontractId);

    return prisma.sitePenaltyAndSnag.create({
      data: {
        subcontractId,
        penaltyType: dto.penaltyType,
        amount: money(dto.amount),
        incidentDate: dto.incidentDate,
        description: dto.description,
        consultantReportRef: dto.consultantReportRef ?? null,
        status: dto.approveForDeduction ? 'APPROVED_FOR_DEDUCTION' : 'PENDING',
      },
    });
  }

  private async nextSubcontractNumber(companyId: string): Promise<string> {
    const count = await prisma.subcontract.count({ where: { companyId } });
    return `SC-${String(count + 1).padStart(5, '0')}`;
  }

  private detailInclude(): Prisma.SubcontractInclude {
    return {
      subcontractor: true,
      project: { select: { id: true, projectCode: true, projectName: true, status: true } },
      boqItems: { orderBy: { itemCode: 'asc' } },
      invoices: { orderBy: { sequenceNumber: 'asc' }, include: { items: true } },
      sitePenalties: { orderBy: { incidentDate: 'desc' } },
      materialReconciliations: { orderBy: { createdAt: 'desc' } },
      directExecutionCharges: { orderBy: { createdAt: 'desc' } },
    };
  }
}

export const subcontractCommandService = new SubcontractCommandService();
