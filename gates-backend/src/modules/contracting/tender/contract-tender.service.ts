import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export class ContractTenderService {
  async list(companyId: string) {
    return prisma.contractTender.findMany({
      where: { companyId },
      include: { customer: { select: { id: true, arabicName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(companyId: string, tenderId: string) {
    const tender = await prisma.contractTender.findFirst({
      where: { id: tenderId, companyId },
      include: {
        customer: true,
        boqItems: { orderBy: { sortOrder: 'asc' }, include: { rateAnalysisItems: true } },
        quotations: { orderBy: { revisionNumber: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' } } } },
        award: {
          include: {
            project: true,
            clientContract: true,
            quotation: { select: { quotationNumber: true, revisionNumber: true } },
          },
        },
      },
    });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    return tender;
  }

  async create(
    companyId: string,
    input: {
      customerId: string;
      nameAr: string;
      description?: string;
      currencyCode?: string;
      submissionDeadline?: Date;
      expectedStart?: Date;
      expectedEnd?: Date;
      location?: string;
      consultantName?: string;
      projectManagerName?: string;
      fundingSource?: string;
      delayPenaltyRate?: number;
      contractDurationDays?: number;
      createdBy?: string;
    }
  ) {
    const customer = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
    if (!customer) throw new AppError(404, 'العميل غير موجود');

    return prisma.$transaction(async (tx) => {
      const seq =
        (await tx.contractTender.count({ where: { companyId } })) + 1;
      const tenderNumber = `TND-${String(seq).padStart(6, '0')}`;
      return tx.contractTender.create({
        data: {
          id: randomUUID(),
          companyId,
          tenderNumber,
          sequenceNumber: seq,
          customerId: input.customerId,
          nameAr: input.nameAr,
          description: input.description ?? null,
          currencyCode: input.currencyCode ?? 'EGP',
          submissionDeadline: input.submissionDeadline ?? null,
          expectedStart: input.expectedStart ?? null,
          expectedEnd: input.expectedEnd ?? null,
          location: input.location ?? null,
          consultantName: input.consultantName ?? null,
          projectManagerName: input.projectManagerName ?? null,
          fundingSource: input.fundingSource ?? null,
          delayPenaltyRate: input.delayPenaltyRate ?? null,
          contractDurationDays: input.contractDurationDays ?? null,
          status: 'DRAFT',
          createdBy: input.createdBy ?? null,
        },
      });
    });
  }

  async update(
    companyId: string,
    tenderId: string,
    input: {
      nameAr?: string;
      description?: string | null;
      currencyCode?: string;
      submissionDeadline?: Date | null;
      expectedStart?: Date | null;
      expectedEnd?: Date | null;
      location?: string | null;
      consultantName?: string | null;
      projectManagerName?: string | null;
      fundingSource?: string | null;
      delayPenaltyRate?: number | null;
      contractDurationDays?: number | null;
      generalOverheadRate?: number | null;
      siteOverheadRate?: number | null;
      contingencyRiskRate?: number | null;
      profitMarginRate?: number | null;
      contractTaxesRate?: number | null;
    }
  ) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    if (['AWARDED', 'LOST', 'CANCELLED'].includes(tender.status)) {
      throw new AppError(422, 'لا يمكن تعديل العطاء في هذه الحالة');
    }
    return prisma.contractTender.update({
      where: { id: tenderId },
      data: {
        nameAr: input.nameAr ?? tender.nameAr,
        description: input.description !== undefined ? input.description : tender.description,
        currencyCode: input.currencyCode ?? tender.currencyCode,
        submissionDeadline:
          input.submissionDeadline !== undefined ? input.submissionDeadline : tender.submissionDeadline,
        expectedStart: input.expectedStart !== undefined ? input.expectedStart : tender.expectedStart,
        expectedEnd: input.expectedEnd !== undefined ? input.expectedEnd : tender.expectedEnd,
        location: input.location !== undefined ? input.location : tender.location,
        consultantName: input.consultantName !== undefined ? input.consultantName : tender.consultantName,
        projectManagerName:
          input.projectManagerName !== undefined ? input.projectManagerName : tender.projectManagerName,
        fundingSource: input.fundingSource !== undefined ? input.fundingSource : tender.fundingSource,
        delayPenaltyRate:
          input.delayPenaltyRate !== undefined ? input.delayPenaltyRate : tender.delayPenaltyRate,
        contractDurationDays:
          input.contractDurationDays !== undefined ? input.contractDurationDays : tender.contractDurationDays,
        generalOverheadRate:
          input.generalOverheadRate !== undefined && input.generalOverheadRate != null
            ? input.generalOverheadRate
            : tender.generalOverheadRate,
        siteOverheadRate:
          input.siteOverheadRate !== undefined && input.siteOverheadRate != null
            ? input.siteOverheadRate
            : tender.siteOverheadRate,
        contingencyRiskRate:
          input.contingencyRiskRate !== undefined && input.contingencyRiskRate != null
            ? input.contingencyRiskRate
            : tender.contingencyRiskRate,
        profitMarginRate:
          input.profitMarginRate !== undefined && input.profitMarginRate != null
            ? input.profitMarginRate
            : tender.profitMarginRate,
        contractTaxesRate:
          input.contractTaxesRate !== undefined && input.contractTaxesRate != null
            ? input.contractTaxesRate
            : tender.contractTaxesRate,
      },
    });
  }

  async markLost(
    companyId: string,
    tenderId: string,
    input: { lostReason?: string; competitorName?: string; lostNotes?: string }
  ) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    if (tender.status === 'AWARDED') throw new AppError(422, 'لا يمكن إغلاق عطاء مُرسى');
    return prisma.contractTender.update({
      where: { id: tenderId },
      data: {
        status: 'LOST',
        lostReason: input.lostReason ?? null,
        competitorName: input.competitorName ?? null,
        lostNotes: input.lostNotes ?? null,
      },
    });
  }

  async updateStatus(companyId: string, tenderId: string, status: string) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    return prisma.contractTender.update({
      where: { id: tenderId },
      data: { status: status as never },
    });
  }
}

export const contractTenderService = new ContractTenderService();
