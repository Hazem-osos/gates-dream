import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export interface BomLineInput {
  rawItemId: string;
  quantity: number;
  scrapPercentage?: number;
  lineOrder?: number;
}

export interface CreateBomInput {
  name: string;
  finishedItemId: string;
  baseQuantity?: number;
  standardLaborCost?: number;
  standardOverheadCost?: number;
  lines: BomLineInput[];
}

export class BomService {
  computeScaleFactor(baseQuantity: number, plannedQuantity: number): number {
    if (baseQuantity <= 0) throw new AppError(422, 'BOM base quantity must be positive');
    return plannedQuantity / baseQuantity;
  }

  computeLineRequirement(
    lineQty: number,
    scrapPercentage: number,
    scale: number
  ): number {
    return roundTo4(lineQty * scale * (1 + scrapPercentage / 100));
  }

  async create(companyId: string, input: CreateBomInput) {
    const finished = await prisma.item.findFirst({
      where: { id: input.finishedItemId, companyId },
    });
    if (!finished) throw new AppError(404, 'Finished item not found');
    if (input.lines.length === 0) throw new AppError(422, 'BOM requires at least one raw line');

    for (const line of input.lines) {
      const raw = await prisma.item.findFirst({
        where: { id: line.rawItemId, companyId },
      });
      if (!raw) throw new AppError(404, `Raw item ${line.rawItemId} not found`);
    }

    return prisma.billOfMaterials.create({
      data: {
        companyId,
        name: input.name,
        finishedItemId: input.finishedItemId,
        baseQuantity: new Decimal(input.baseQuantity ?? 1),
        standardLaborCost: new Decimal(input.standardLaborCost ?? 0),
        standardOverheadCost: new Decimal(input.standardOverheadCost ?? 0),
        lines: {
          create: input.lines.map((line, idx) => ({
            rawItemId: line.rawItemId,
            quantity: new Decimal(line.quantity),
            scrapPercentage: new Decimal(line.scrapPercentage ?? 0),
            lineOrder: line.lineOrder ?? idx + 1,
          })),
        },
      },
      include: { lines: true, finishedItem: { select: { id: true, arabicName: true } } },
    });
  }

  async getById(companyId: string, id: string) {
    const bom = await prisma.billOfMaterials.findFirst({
      where: { id, companyId, isActive: true },
      include: {
        // Raw item identity travels with the line so the operation screen can render a
        // requirements table without an extra lookup per line.
        lines: {
          orderBy: { lineOrder: 'asc' },
          include: { rawItem: { select: { id: true, arabicName: true, serial: true } } },
        },
        finishedItem: { select: { id: true, arabicName: true, serial: true } },
      },
    });
    if (!bom) throw new AppError(404, 'BOM not found');
    return bom;
  }

  async list(companyId: string) {
    return prisma.billOfMaterials.findMany({
      where: { companyId, isActive: true },
      include: {
        finishedItem: { select: { id: true, arabicName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async explodeRequirements(bomId: string, plannedQuantity: number) {
    const bom = await prisma.billOfMaterials.findUnique({
      where: { id: bomId },
      include: { lines: { orderBy: { lineOrder: 'asc' } } },
    });
    if (!bom) throw new AppError(404, 'BOM not found');

    const scale = this.computeScaleFactor(Number(bom.baseQuantity), plannedQuantity);
    return bom.lines.map((line) => ({
      rawItemId: line.rawItemId,
      quantity: this.computeLineRequirement(
        Number(line.quantity),
        Number(line.scrapPercentage),
        scale
      ),
    }));
  }
}

export const bomService = new BomService();
