import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export interface ManufacturingPlanLineInput {
  lineNo: number;
  lineDate: string;
  bomId: string;
  stage?: string;
  quantity: number;
  warehouseId?: string;
  costCenter?: string;
}

export interface UpsertManufacturingPlanInput {
  planNumber: string;
  description?: string;
  headerBomId?: string;
  headerStage?: string;
  fromWarehouseId?: string;
  costCenter?: string;
  lines: ManufacturingPlanLineInput[];
}

export class ManufacturingPlanService {
  async list(companyId: string, limit = 100) {
    return prisma.manufacturingPlan.findMany({
      where: { companyId },
      include: {
        lines: { orderBy: { lineNo: 'asc' }, take: 1 },
        _count: { select: { lines: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async getById(companyId: string, id: string) {
    const plan = await prisma.manufacturingPlan.findFirst({
      where: { id, companyId },
      include: {
        lines: { orderBy: { lineNo: 'asc' }, include: { bom: { select: { id: true, name: true } } } },
      },
    });
    if (!plan) throw new AppError(404, 'Manufacturing plan not found');
    return plan;
  }

  private async assertLines(companyId: string, lines: ManufacturingPlanLineInput[]) {
    if (lines.length === 0) throw new AppError(422, 'Plan requires at least one line');
    for (const line of lines) {
      if (line.quantity <= 0) throw new AppError(422, `Line ${line.lineNo}: quantity must be positive`);
      const bom = await prisma.billOfMaterials.findFirst({
        where: { id: line.bomId, companyId },
        select: { id: true },
      });
      if (!bom) throw new AppError(404, `BOM not found for line ${line.lineNo}`);
    }
  }

  async create(companyId: string, input: UpsertManufacturingPlanInput) {
    const planNumber = input.planNumber.trim();
    if (!planNumber) throw new AppError(422, 'Plan number is required');
    await this.assertLines(companyId, input.lines);

    const existing = await prisma.manufacturingPlan.findFirst({
      where: { companyId, planNumber },
      select: { id: true },
    });
    if (existing) throw new AppError(409, 'Plan number already exists');

    return prisma.manufacturingPlan.create({
      data: {
        companyId,
        planNumber,
        description: input.description?.trim() || null,
        headerBomId: input.headerBomId || null,
        headerStage: input.headerStage?.trim() || null,
        fromWarehouseId: input.fromWarehouseId || null,
        costCenter: input.costCenter?.trim() || null,
        lines: {
          create: input.lines.map((line) => ({
            lineNo: line.lineNo,
            lineDate: new Date(line.lineDate),
            bomId: line.bomId,
            stage: line.stage?.trim() || null,
            quantity: new Decimal(line.quantity),
            warehouseId: line.warehouseId || null,
            costCenter: line.costCenter?.trim() || null,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' }, include: { bom: { select: { id: true, name: true } } } },
      },
    });
  }

  async update(companyId: string, id: string, input: UpsertManufacturingPlanInput) {
    const plan = await this.getById(companyId, id);
    const planNumber = input.planNumber.trim();
    if (!planNumber) throw new AppError(422, 'Plan number is required');
    await this.assertLines(companyId, input.lines);

    if (planNumber !== plan.planNumber) {
      const clash = await prisma.manufacturingPlan.findFirst({
        where: { companyId, planNumber, NOT: { id } },
        select: { id: true },
      });
      if (clash) throw new AppError(409, 'Plan number already exists');
    }

    return prisma.$transaction(async (tx) => {
      await tx.manufacturingPlanLine.deleteMany({ where: { planId: id } });
      return tx.manufacturingPlan.update({
        where: { id },
        data: {
          planNumber,
          description: input.description?.trim() || null,
          headerBomId: input.headerBomId || null,
          headerStage: input.headerStage?.trim() || null,
          fromWarehouseId: input.fromWarehouseId || null,
          costCenter: input.costCenter?.trim() || null,
          lines: {
            create: input.lines.map((line) => ({
              lineNo: line.lineNo,
              lineDate: new Date(line.lineDate),
              bomId: line.bomId,
              stage: line.stage?.trim() || null,
              quantity: new Decimal(line.quantity),
              warehouseId: line.warehouseId || null,
              costCenter: line.costCenter?.trim() || null,
            })),
          },
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' }, include: { bom: { select: { id: true, name: true } } } },
        },
      });
    });
  }

  async delete(companyId: string, id: string) {
    const plan = await prisma.manufacturingPlan.findFirst({ where: { id, companyId }, select: { id: true } });
    if (!plan) throw new AppError(404, 'Manufacturing plan not found');
    await prisma.manufacturingPlan.delete({ where: { id } });
    return { id };
  }
}

export const manufacturingPlanService = new ManufacturingPlanService();
