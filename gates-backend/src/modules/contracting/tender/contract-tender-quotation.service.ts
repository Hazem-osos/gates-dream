import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money, rate } from '../utils/money-decimal';
import { contractTenderPricingService } from './contract-tender-pricing.service';
import { marginPercentFromSelling } from './contract-tender-pricing.util';

export class ContractTenderQuotationService {
  async createRevision(companyId: string, tenderId: string, userId?: string) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    if (['LOST', 'AWARDED', 'CANCELLED'].includes(tender.status)) {
      throw new AppError(422, 'لا يمكن إنشاء عرض في هذه الحالة');
    }

    const last = await prisma.contractQuotation.findFirst({
      where: { tenderId, companyId },
      orderBy: { revisionNumber: 'desc' },
    });
    const revisionNumber = (last?.revisionNumber ?? 0) + 1;
    const quotationNumber =
      last?.quotationNumber ??
      `QTN-${String((await prisma.contractQuotation.count({ where: { companyId } })) + 1).padStart(6, '0')}`;

    const summary = await contractTenderPricingService.getSummary(companyId, tenderId);

    return prisma.contractQuotation.create({
      data: {
        id: randomUUID(),
        companyId,
        tenderId,
        quotationNumber,
        revisionNumber,
        status: 'DRAFT',
        currencyCode: tender.currencyCode,
        subtotalSelling: money(summary.sellingValue),
        totalDirectCost: money(summary.directCost),
        expectedProfit: money(summary.directProfit),
        expectedMarginPercent:
          summary.directMarginPercent != null ? rate(summary.directMarginPercent) : null,
        grandTotal: money(summary.sellingValue),
        createdBy: userId ?? null,
      },
    });
  }

  async updateDraftLineRate(
    companyId: string,
    quotationId: string,
    tenderBoqItemId: string,
    sellingUnitRate: number
  ) {
    const q = await prisma.contractQuotation.findFirst({ where: { id: quotationId, companyId } });
    if (!q || q.status !== 'DRAFT') throw new AppError(422, 'مراجعة غير قابلة للتعديل');
    await contractTenderPricingService.setLinePricing(companyId, tenderBoqItemId, {
      pricingMethod: 'MANUAL_SELLING',
      sellingUnitRate,
    });
    const summary = await contractTenderPricingService.getSummary(companyId, q.tenderId);
    return prisma.contractQuotation.update({
      where: { id: quotationId },
      data: {
        subtotalSelling: money(summary.sellingValue),
        totalDirectCost: money(summary.directCost),
        expectedProfit: money(summary.directProfit),
        expectedMarginPercent:
          summary.directMarginPercent != null ? rate(summary.directMarginPercent) : null,
        grandTotal: money(summary.sellingValue - Number(q.discountAmount)),
      },
    });
  }

  async submit(companyId: string, quotationId: string) {
    const q = await prisma.contractQuotation.findFirst({
      where: { id: quotationId, companyId },
      include: { tender: { include: { boqItems: true } } },
    });
    if (!q) throw new AppError(404, 'عرض السعر غير موجود');
    if (q.status !== 'DRAFT') throw new AppError(422, 'تم إرسال هذا الإصدار مسبقاً');

    const summary = await contractTenderPricingService.getSummary(companyId, q.tenderId);

    return prisma.$transaction(async (tx) => {
      await tx.contractQuotationLine.deleteMany({ where: { quotationId } });
      for (const [i, item] of q.tender.boqItems.entries()) {
        const qty = Number(item.quantity);
        const sell = Number(item.sellingUnitRate);
        await tx.contractQuotationLine.create({
          data: {
            id: randomUUID(),
            companyId,
            quotationId,
            tenderBoqItemId: item.id,
            itemCodeSnapshot: item.itemCode,
            descriptionArSnapshot: item.descriptionAr,
            unitSnapshot: item.unit,
            quantitySnapshot: money(qty),
            directUnitCostSnapshot: money(item.directUnitCost),
            sellingUnitRateSnapshot: money(sell),
            lineAmountSnapshot: money(qty * sell),
            sortOrder: i + 1,
          },
        });
      }
      return tx.contractQuotation.update({
        where: { id: quotationId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
          subtotalSelling: money(summary.sellingValue),
          totalDirectCost: money(summary.directCost),
          expectedProfit: money(summary.expectedProfit),
          expectedMarginPercent:
            summary.expectedMarginPercent != null ? rate(summary.expectedMarginPercent) : null,
          grandTotal: money(summary.sellingValue - Number(q.discountAmount)),
        },
        include: { lines: true },
      });
    });
  }

  async accept(companyId: string, quotationId: string) {
    const q = await prisma.contractQuotation.findFirst({ where: { id: quotationId, companyId } });
    if (!q) throw new AppError(404, 'عرض السعر غير موجود');
    if (q.status !== 'SUBMITTED') throw new AppError(422, 'يجب إرسال العرض قبل القبول');

    await prisma.contractQuotation.updateMany({
      where: { tenderId: q.tenderId, companyId, status: 'ACCEPTED' },
      data: { status: 'REJECTED' },
    });

    return prisma.$transaction(async (tx) => {
      const accepted = await tx.contractQuotation.update({
        where: { id: quotationId },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      await tx.contractTender.update({
        where: { id: q.tenderId },
        data: { status: 'UNDER_NEGOTIATION' },
      });
      return accepted;
    });
  }

  async reject(companyId: string, quotationId: string) {
    const q = await prisma.contractQuotation.findFirst({ where: { id: quotationId, companyId } });
    if (!q) throw new AppError(404, 'عرض السعر غير موجود');
    if (!['SUBMITTED', 'DRAFT'].includes(q.status)) {
      throw new AppError(422, 'لا يمكن رفض هذا الإصدار');
    }
    return prisma.contractQuotation.update({
      where: { id: quotationId },
      data: { status: 'REJECTED' },
    });
  }

  async get(companyId: string, quotationId: string) {
    const q = await prisma.contractQuotation.findFirst({
      where: { id: quotationId, companyId },
      include: { lines: { orderBy: { sortOrder: 'asc' } }, tender: { include: { customer: true } } },
    });
    if (!q) throw new AppError(404, 'عرض السعر غير موجود');
    return q;
  }

  async updateDraft(
    companyId: string,
    quotationId: string,
    input: {
      discountAmount?: number;
      validUntil?: Date | null;
      paymentTerms?: string | null;
      deliveryTerms?: string | null;
      notes?: string | null;
    }
  ) {
    const q = await prisma.contractQuotation.findFirst({ where: { id: quotationId, companyId } });
    if (!q || q.status !== 'DRAFT') throw new AppError(422, 'مسودة العرض غير قابلة للتعديل');
    const summary = await contractTenderPricingService.getSummary(companyId, q.tenderId);
    const discount = input.discountAmount ?? Number(q.discountAmount);
    return prisma.contractQuotation.update({
      where: { id: quotationId },
      data: {
        discountAmount: money(discount),
        validUntil: input.validUntil !== undefined ? input.validUntil : q.validUntil,
        paymentTerms: input.paymentTerms !== undefined ? input.paymentTerms : q.paymentTerms,
        deliveryTerms: input.deliveryTerms !== undefined ? input.deliveryTerms : q.deliveryTerms,
        notes: input.notes !== undefined ? input.notes : q.notes,
        subtotalSelling: money(summary.sellingValue),
        totalDirectCost: money(summary.directCost),
        expectedProfit: money(summary.directProfit),
        expectedMarginPercent:
          summary.directMarginPercent != null ? rate(summary.directMarginPercent) : null,
        grandTotal: money(summary.sellingValue - discount),
      },
    });
  }

  async list(companyId: string, tenderId: string) {
    return prisma.contractQuotation.findMany({
      where: { companyId, tenderId },
      orderBy: { revisionNumber: 'asc' },
      include: { lines: true },
    });
  }
}

export const contractTenderQuotationService = new ContractTenderQuotationService();
