import { randomUUID } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { rateAnalysisCalculationService } from '../technical-office/services/rate-analysis-calculation.service';
import { money, rate } from '../utils/money-decimal';

export class ContractTenderAwardService {
  async award(
    companyId: string,
    tenderId: string,
    quotationId: string,
    input?: { idempotencyKey?: string; awardedBy?: string; projectCode?: string }
  ) {
    if (input?.idempotencyKey) {
      const existing = await prisma.contractTenderAward.findFirst({
        where: { companyId, idempotencyKey: input.idempotencyKey },
        include: { project: true, clientContract: true },
      });
      if (existing) return { award: existing, project: existing.project, clientContract: existing.clientContract };
    }

    const existingAward = await prisma.contractTenderAward.findFirst({ where: { tenderId, companyId } });
    if (existingAward) {
      if (input?.idempotencyKey && existingAward.idempotencyKey === input.idempotencyKey) {
        const full = await prisma.contractTenderAward.findUnique({
          where: { id: existingAward.id },
          include: { project: true, clientContract: true },
        });
        return { award: full!, project: full!.project, clientContract: full!.clientContract };
      }
      throw new AppError(409, 'تمت الترسية مسبقاً');
    }

    const tender = await prisma.contractTender.findFirst({
      where: { id: tenderId, companyId },
      include: { customer: true },
    });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    if (tender.status === 'LOST') throw new AppError(422, 'عطاء خاسر');
    if (tender.status === 'CANCELLED') throw new AppError(422, 'عطاء ملغى');

    const quotation = await prisma.contractQuotation.findFirst({
      where: { id: quotationId, companyId, tenderId },
      include: { lines: { include: { tenderBoqItem: { include: { rateAnalysisItems: true } } } } },
    });
    if (!quotation) throw new AppError(404, 'عرض السعر غير موجود');
    if (quotation.status !== 'ACCEPTED') throw new AppError(422, 'يجب قبول عرض السعر قبل الترسية');
    if (!quotation.lines.length) throw new AppError(422, 'عرض السعر بلا بنود — أرسل الإصدار أولاً');

    const contractValue = money(Number(quotation.subtotalSelling) - Number(quotation.discountAmount)).toNumber();
    const projectCode =
      input?.projectCode ??
      `PRJ-${tender.tenderNumber.replace(/^TND-/, '')}`;
    const contractNumber = `CNT-${tender.tenderNumber.replace(/^TND-/, '')}`;

    return prisma.$transaction(async (tx) => {
      const project = await tx.contractingProject.create({
        data: {
          companyId,
          projectCode,
          projectName: tender.nameAr,
          customerId: tender.customerId,
          contractValue: money(contractValue),
          sourceTenderId: tenderId,
          status: 'ACTIVE',
        },
      });

      const clientContract = await tx.clientContract.create({
        data: {
          companyId,
          projectId: project.id,
          contractNumber,
          clientCustomerId: tender.customerId,
          contractDate: new Date(),
          totalContractValue: money(contractValue),
          sourceTenderId: tenderId,
          sourceQuotationId: quotationId,
          status: 'ACTIVE',
        },
      });

      for (const ql of quotation.lines) {
        const snap = ql;
        const tenderItem = ql.tenderBoqItem;
        const boq = await tx.projectBOQItem.create({
          data: {
            companyId,
            projectId: project.id,
            itemCode: snap.itemCodeSnapshot,
            descriptionAr: snap.descriptionArSnapshot,
            unit: snap.unitSnapshot,
            contractQuantity: snap.quantitySnapshot,
            directCostEstimated: snap.directUnitCostSnapshot,
            unitSellingPrice: snap.sellingUnitRateSnapshot,
            totalSellingPrice: snap.lineAmountSnapshot,
            origin: 'BASE_CONTRACT',
            status: 'APPROVED_IN_CONTRACT',
            sourceTenderBoqItemId: ql.tenderBoqItemId,
            sourceQuotationLineId: ql.id,
          },
        });

        if (tenderItem.rateAnalysisItems.length) {
          const computed = rateAnalysisCalculationService.calculateDirectUnitCost(
            boq.id,
            tenderItem.rateAnalysisItems.map((r) => ({
              costElementType: r.costElementType,
              resourceCode: r.resourceCode,
              descriptionAr: r.descriptionAr,
              descriptionEn: null,
              unit: r.unit,
              consumptionQuotaPerUnit: Number(r.consumptionQuotaPerUnit),
              unitCost: Number(r.unitCost),
              wasteFactorRate: Number(r.wasteFactorRate),
              notes: r.notes,
            }))
          );
          await tx.bOQRateAnalysisItem.createMany({
            data: tenderItem.rateAnalysisItems.map((r, index) => ({
              companyId,
              projectBOQItemId: boq.id,
              costElementType: r.costElementType,
              resourceCode: r.resourceCode,
              descriptionAr: r.descriptionAr,
              unit: r.unit,
              consumptionQuotaPerUnit: r.consumptionQuotaPerUnit,
              unitCost: r.unitCost,
              wasteFactorRate: r.wasteFactorRate,
              totalCostPerUnit: computed.elements[index].elementCost,
              notes: r.notes,
            })),
          });
          await tx.bOQMarkupStructure.create({
            data: {
              companyId,
              projectBOQItemId: boq.id,
              generalOverheadRate: tender.generalOverheadRate,
              siteOverheadRate: tender.siteOverheadRate,
              contingencyRiskRate: tender.contingencyRiskRate,
              profitMarginRate: tenderItem.markupRate,
              contractTaxesRate: rate(0),
            },
          });
        }
      }

      const award = await tx.contractTenderAward.create({
        data: {
          id: randomUUID(),
          companyId,
          tenderId,
          quotationId,
          clientContractId: clientContract.id,
          projectId: project.id,
          idempotencyKey: input?.idempotencyKey ?? null,
          awardedBy: input?.awardedBy ?? null,
        },
      });

      await tx.contractTender.update({
        where: { id: tenderId },
        data: { status: 'AWARDED' },
      });

      return { award, project, clientContract };
    });
  }
}

export const contractTenderAwardService = new ContractTenderAwardService();
