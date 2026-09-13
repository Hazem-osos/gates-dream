import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { contractingProjectService } from './contracting-project.service';

export interface BoqItemInput {
  itemNumber: string;
  description: string;
  unit?: string;
  contractQuantity: number;
  unitPrice: number;
  lineOrder?: number;
}

export class ProjectBoqService {
  async list(companyId: string, projectId: string) {
    await contractingProjectService.getById(companyId, projectId);
    return prisma.projectBoqItem.findMany({
      where: { projectId },
      orderBy: [{ lineOrder: 'asc' }, { itemNumber: 'asc' }],
    });
  }

  async replaceAll(companyId: string, projectId: string, items: BoqItemInput[]) {
    await contractingProjectService.getById(companyId, projectId);
    if (items.length === 0) throw new AppError(422, 'BOQ requires at least one item');

    return prisma.$transaction(async (tx) => {
      await tx.projectBoqItem.deleteMany({ where: { projectId } });
      const created = [];
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        const qty = roundTo4(row.contractQuantity);
        const price = roundTo4(row.unitPrice);
        const total = roundTo4(qty * price);
        created.push(
          await tx.projectBoqItem.create({
            data: {
              projectId,
              itemNumber: row.itemNumber,
              description: row.description,
              unit: row.unit,
              contractQuantity: new Decimal(qty),
              unitPrice: new Decimal(price),
              totalPrice: new Decimal(total),
              lineOrder: row.lineOrder ?? i + 1,
            },
          })
        );
      }
      return created;
    });
  }

  async getPreviousQuantities(
    companyId: string,
    projectId: string,
    extractType: 'CLIENT' | 'SUBCONTRACTOR',
    partyId: string
  ): Promise<Record<string, number>> {
    const postedLines = await prisma.contractExtractLine.findMany({
      where: {
        extract: {
          companyId,
          projectId,
          extractType,
          partyId,
          status: 'POSTED',
        },
      },
      include: { extract: { select: { extractDate: true, postedAt: true } } },
      orderBy: { extract: { postedAt: 'desc' } },
    });

    const map: Record<string, number> = {};
    for (const line of postedLines) {
      if (map[line.boqItemId] == null) {
        map[line.boqItemId] = Number(line.cumulativeQuantity);
      }
    }
    return map;
  }

  async getPreviousExecutedAmount(
    companyId: string,
    projectId: string,
    extractType: 'CLIENT' | 'SUBCONTRACTOR',
    partyId: string
  ): Promise<number> {
    const agg = await prisma.contractExtract.aggregate({
      where: {
        companyId,
        projectId,
        extractType,
        partyId,
        status: 'POSTED',
      },
      _sum: { currentExecutedAmount: true },
    });
    return roundTo4(Number(agg._sum.currentExecutedAmount ?? 0));
  }
}

export const projectBoqService = new ProjectBoqService();
