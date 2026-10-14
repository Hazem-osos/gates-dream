import { randomUUID } from 'node:crypto';
import type { BOQItemUnit } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { money } from '../utils/money-decimal';
import { isTenderHeaderKind } from './contract-tender-pricing.util';
import { contractTenderPricingService } from './contract-tender-pricing.service';

export class ContractTenderBoqService {
  async upsertLine(
    companyId: string,
    tenderId: string,
    input: {
      lineId?: string;
      itemCode: string;
      descriptionAr: string;
      unit: BOQItemUnit;
      quantity: number;
      sectionName?: string;
      kind?: string;
      isExecutable?: boolean;
      notes?: string;
      sortOrder?: number;
    }
  ) {
    const tender = await prisma.contractTender.findFirst({ where: { id: tenderId, companyId } });
    if (!tender) throw new AppError(404, 'العطاء غير موجود');
    if (['AWARDED', 'LOST', 'CANCELLED'].includes(tender.status)) {
      throw new AppError(422, 'لا يمكن تعديل BOQ في هذه الحالة');
    }
    const isExecutable =
      input.isExecutable ?? (input.kind ? !isTenderHeaderKind(input.kind) : true);
    if (isExecutable && input.quantity <= 0) throw new AppError(422, 'الكمية يجب أن تكون أكبر من صفر');

    if (input.lineId) {
      await prisma.contractTenderBoqItem.update({
        where: { id: input.lineId },
        data: {
          itemCode: input.itemCode,
          descriptionAr: input.descriptionAr,
          unit: input.unit,
          quantity: money(Math.max(0, input.quantity)),
          sectionName: input.sectionName ?? null,
          kind: input.kind ?? null,
          isExecutable,
          notes: input.notes ?? null,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      return contractTenderPricingService.recalcBoqLine(companyId, input.lineId);
    }

    const created = await prisma.contractTenderBoqItem.create({
      data: {
        id: randomUUID(),
        companyId,
        tenderId,
        itemCode: input.itemCode,
        descriptionAr: input.descriptionAr,
        unit: input.unit,
        quantity: money(Math.max(0, input.quantity)),
        sectionName: input.sectionName ?? null,
        kind: input.kind ?? null,
        isExecutable,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 0,
        markupRate: tender.defaultMarkupRate,
      },
    });
    return contractTenderPricingService.recalcBoqLine(companyId, created.id);
  }

  async deleteLine(companyId: string, lineId: string) {
    const line = await prisma.contractTenderBoqItem.findFirst({
      where: { id: lineId, companyId },
      include: { tender: true },
    });
    if (!line) throw new AppError(404, 'البند غير موجود');
    if (['AWARDED', 'LOST'].includes(line.tender.status)) throw new AppError(422, 'محمي');
    await prisma.contractTenderRateAnalysisItem.deleteMany({ where: { tenderBoqItemId: lineId } });
    await prisma.contractTenderBoqItem.delete({ where: { id: lineId } });
    return { deleted: true };
  }

  async importLines(
    companyId: string,
    tenderId: string,
    rows: Array<{
      itemCode: string;
      descriptionAr: string;
      unit: BOQItemUnit;
      quantity: number;
      sectionName?: string;
      notes?: string;
    }>
  ) {
    const out = [];
    for (const [i, row] of rows.entries()) {
      out.push(
        await this.upsertLine(companyId, tenderId, {
          ...row,
          sortOrder: i + 1,
        })
      );
    }
    return out;
  }

  async addFromCatalog(companyId: string, tenderId: string, catalogIds: string[]) {
    if (!catalogIds.length) throw new AppError(422, 'اختر بنداً واحداً على الأقل من الدليل');
    const catalog = await prisma.contractingWorkItemCatalog.findMany({
      where: { companyId, id: { in: catalogIds }, isActive: true },
    });
    if (!catalog.length) throw new AppError(404, 'لم يُعثر على بنود الدليل');

    const existing = await prisma.contractTenderBoqItem.findMany({
      where: { companyId, tenderId },
      select: { itemCode: true, sortOrder: true },
    });
    const existingCodes = new Set(existing.map((r) => r.itemCode));
    let sortOrder = existing.reduce((max, r) => Math.max(max, r.sortOrder), 0);

    const out = [];
    for (const row of catalog) {
      if (existingCodes.has(row.itemCode)) continue;
      sortOrder += 1;
      out.push(
        await this.upsertLine(companyId, tenderId, {
          itemCode: row.itemCode,
          descriptionAr: row.descriptionAr,
          unit: row.unit,
          quantity: 1,
          sectionName: row.groupName ?? undefined,
          kind: row.kind,
          isExecutable: !isTenderHeaderKind(row.kind),
          notes: row.notes ?? undefined,
          sortOrder,
        })
      );
    }
    return out;
  }
}

export const contractTenderBoqService = new ContractTenderBoqService();
