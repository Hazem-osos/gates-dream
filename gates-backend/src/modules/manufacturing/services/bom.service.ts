import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { sumOutputCostPercents } from '../utils/bom-cost-distribution';

export interface BomLineInput {
  rawItemId: string;
  quantity: number;
  scrapPercentage?: number;
  lineOrder?: number;
  lineDescription?: string;
  warehouseId?: string;
  manufacturedItemId?: string;
}

export type BomFormMetadata = {
  distributeCostByUnits?: boolean;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  standardExecutionTime?: number;
  stage?: string;
  description?: string;
  costCenterId?: string;
  costCenter?: string;
  outputLines?: Array<{
    itemId: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    costPercent?: number;
    description?: string;
    warehouseId?: string;
  }>;
  additionalCosts?: Array<{
    accountId?: string;
    accountLabel?: string;
    value?: number;
    valuePercent?: number;
    description?: string;
    costCenter?: string;
    manufacturedItemId?: string;
  }>;
};

export interface CreateBomInput {
  name: string;
  finishedItemId: string;
  baseQuantity?: number;
  standardLaborCost?: number;
  standardOverheadCost?: number;
  formMetadata?: BomFormMetadata;
  lines: BomLineInput[];
}

export type UpdateBomInput = CreateBomInput;

export class BomService {
  computeScaleFactor(baseQuantity: number, plannedQuantity: number): number {
    if (baseQuantity <= 0) throw new AppError(422, 'BOM base quantity must be positive');
    return plannedQuantity / baseQuantity;
  }

  private assertOutputCostPercents(formMetadata?: BomFormMetadata) {
    if (formMetadata?.distributeCostByUnits) return;
    const outputs = (formMetadata?.outputLines ?? []).filter((o) => o.itemId?.trim());
    if (outputs.length <= 1) return;
    const sum = sumOutputCostPercents(
      outputs.map((o) => ({
        quantity: Number(o.quantity) || 0,
        costPercent: Number(o.costPercent) || 0,
      }))
    );
    if (sum <= 0) {
      throw new AppError(422, 'حدد نسب التكلفة للأصناف الناتجة');
    }
    if (Math.abs(sum - 100) > 0.01) {
      throw new AppError(422, `مجموع نسب التكلفة يجب أن يساوي 100 (الحالي ${sum})`);
    }
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

    this.assertOutputCostPercents(input.formMetadata);

    return prisma.billOfMaterials.create({
      data: {
        companyId,
        name: input.name,
        finishedItemId: input.finishedItemId,
        baseQuantity: new Decimal(input.baseQuantity ?? 1),
        standardLaborCost: new Decimal(input.standardLaborCost ?? 0),
        standardOverheadCost: new Decimal(input.standardOverheadCost ?? 0),
        formMetadata: input.formMetadata ?? undefined,
        lines: {
          create: input.lines.map((line, idx) => ({
            rawItemId: line.rawItemId,
            quantity: new Decimal(line.quantity),
            scrapPercentage: new Decimal(line.scrapPercentage ?? 0),
            lineOrder: line.lineOrder ?? idx + 1,
            lineDescription: line.lineDescription?.trim() || null,
            warehouseId: line.warehouseId || null,
            manufacturedItemId: line.manufacturedItemId || null,
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
        finishedItem: { select: { id: true, arabicName: true, serial: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Replace BOM header + lines (editable regardless of linked production orders). */
  async update(companyId: string, id: string, input: UpdateBomInput) {
    const existing = await prisma.billOfMaterials.findFirst({
      where: { id, companyId, isActive: true },
    });
    if (!existing) throw new AppError(404, 'BOM not found');
    if (!input.finishedItemId) throw new AppError(422, 'Finished item is required');
    if (!input.lines?.length) throw new AppError(422, 'BOM requires at least one raw line');

    const finished = await prisma.item.findFirst({
      where: { id: input.finishedItemId, companyId },
    });
    if (!finished) throw new AppError(404, 'Finished item not found');

    for (const line of input.lines) {
      const raw = await prisma.item.findFirst({
        where: { id: line.rawItemId, companyId },
      });
      if (!raw) throw new AppError(404, `Raw item ${line.rawItemId} not found`);
    }

    this.assertOutputCostPercents(input.formMetadata);

    return prisma.$transaction(async (tx) => {
      await tx.bomLine.deleteMany({ where: { bomId: id } });
      return tx.billOfMaterials.update({
        where: { id },
        data: {
          name: input.name,
          finishedItemId: input.finishedItemId,
          baseQuantity: new Decimal(input.baseQuantity ?? 1),
          standardLaborCost: new Decimal(input.standardLaborCost ?? 0),
          standardOverheadCost: new Decimal(input.standardOverheadCost ?? 0),
          formMetadata: input.formMetadata ?? undefined,
          lines: {
            create: input.lines.map((line, idx) => ({
              rawItemId: line.rawItemId,
              quantity: new Decimal(line.quantity),
              scrapPercentage: new Decimal(line.scrapPercentage ?? 0),
              lineOrder: line.lineOrder ?? idx + 1,
              lineDescription: line.lineDescription?.trim() || null,
              warehouseId: line.warehouseId || null,
              manufacturedItemId: line.manufacturedItemId || null,
            })),
          },
        },
        include: {
          lines: {
            orderBy: { lineOrder: 'asc' },
            include: { rawItem: { select: { id: true, arabicName: true, serial: true } } },
          },
          finishedItem: { select: { id: true, arabicName: true, serial: true } },
        },
      });
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
