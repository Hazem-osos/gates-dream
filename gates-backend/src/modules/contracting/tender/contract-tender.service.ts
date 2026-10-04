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
