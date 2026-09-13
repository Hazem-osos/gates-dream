import { AppError } from '../../../shared/middleware/error-handler';
import prisma from '../../../shared/database/prisma';
import { bomService } from '../../manufacturing/services/bom.service';

export type BomExplosionComponent = {
  itemId: string;
  itemCode: string;
  itemNameAr: string;
  unit: { id: string; name: string } | null;
  availableQuantity: number;
  requiredQuantity: number;
  unitCost: number;
  totalCost: number;
};

export class ItemBomExplosionService {
  async explode(
    companyId: string,
    finishedItemId: string,
    quantity: number,
    warehouseId?: string
  ): Promise<{
    finishedItemId: string;
    bomId: string;
    bomName: string;
    baseQuantity: number;
    quantity: number;
    components: BomExplosionComponent[];
  }> {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(400, 'Assembly quantity must be a positive number');
    }

    const finished = await prisma.item.findFirst({
      where: { id: finishedItemId, companyId },
      select: { id: true },
    });
    if (!finished) throw new AppError(404, 'Item not found');

    const bom = await prisma.billOfMaterials.findFirst({
      where: { companyId, finishedItemId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        lines: {
          orderBy: { lineOrder: 'asc' },
          include: {
            rawItem: {
              select: {
                id: true,
                serial: true,
                barcode: true,
                arabicName: true,
                averageCost: true,
                units: {
                  include: { unit: { select: { id: true, arabicName: true, englishName: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!bom || bom.lines.length === 0) {
      throw new AppError(422, 'لا توجد شجرة مكونات نشطة لهذا الصنف');
    }

    const scale = bomService.computeScaleFactor(Number(bom.baseQuantity), quantity);
    const rawIds = bom.lines.map((line) => line.rawItemId);

    const [balances, quantities] = await Promise.all([
      warehouseId
        ? prisma.itemWarehouseBalance.findMany({
            where: { companyId, warehouseId, itemId: { in: rawIds } },
          })
        : Promise.resolve([]),
      warehouseId
        ? prisma.itemQuantity.findMany({
            where: { warehouseId, itemId: { in: rawIds } },
          })
        : Promise.resolve([]),
    ]);

    const availableByItem = new Map<string, number>();
    const costByItem = new Map<string, number>();
    for (const row of balances) {
      availableByItem.set(row.itemId, Number(row.quantityOnHand) || 0);
      costByItem.set(row.itemId, Number(row.averageCost) || 0);
    }
    for (const row of quantities) {
      if (!availableByItem.has(row.itemId)) {
        availableByItem.set(
          row.itemId,
          (availableByItem.get(row.itemId) || 0) + (Number(row.quantity) || 0)
        );
      }
    }

    const components = bom.lines.map((line) => {
      const requiredQuantity = bomService.computeLineRequirement(
        Number(line.quantity),
        Number(line.scrapPercentage),
        scale
      );
      const baseUnit =
        line.rawItem.units.find((u) => u.isBaseUnit) ?? line.rawItem.units[0] ?? null;
      const unitCost =
        costByItem.get(line.rawItemId) || Number(line.rawItem.averageCost) || 0;
      return {
        itemId: line.rawItem.id,
        itemCode: line.rawItem.serial || line.rawItem.barcode || '',
        itemNameAr: line.rawItem.arabicName,
        unit: baseUnit
          ? {
              id: baseUnit.unitId || baseUnit.unit.id,
              name: baseUnit.unit.arabicName || baseUnit.unit.englishName || '',
            }
          : null,
        availableQuantity: availableByItem.get(line.rawItemId) || 0,
        requiredQuantity,
        unitCost,
        totalCost: requiredQuantity * unitCost,
      };
    });

    return {
      finishedItemId,
      bomId: bom.id,
      bomName: bom.name,
      baseQuantity: Number(bom.baseQuantity),
      quantity,
      components,
    };
  }

  /**
   * Reverse BOM explode: resulting component qtys + parent MAC allocated
   * across outputs by each component's standard/average cost.
   * `warehouseId` = destination (component on-hand);
   * `sourceWarehouseId` = source (parent moving-average cost).
   */
  async explodeForDisassembly(
    companyId: string,
    finishedItemId: string,
    quantity: number,
    warehouseId?: string,
    sourceWarehouseId?: string
  ) {
    const base = await this.explode(companyId, finishedItemId, quantity, warehouseId);
    const parent = await prisma.item.findFirst({
      where: { id: finishedItemId, companyId },
      select: { averageCost: true },
    });
    let parentItemUnitCost = Number(parent?.averageCost) || 0;
    if (sourceWarehouseId) {
      const bal = await prisma.itemWarehouseBalance.findFirst({
        where: { companyId, warehouseId: sourceWarehouseId, itemId: finishedItemId },
      });
      if (bal && Number(bal.averageCost) > 0) {
        parentItemUnitCost = Number(bal.averageCost);
      }
    }

    const parentItemDisassemblyTotalCost = parentItemUnitCost * quantity;
    const weights = base.components.map(
      (comp) => (Number(comp.unitCost) || 0) * (Number(comp.requiredQuantity) || 0)
    );
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    let allocated = 0;
    const components = base.components.map((comp, index) => {
      const isLast = index === base.components.length - 1;
      const share = isLast
        ? parentItemDisassemblyTotalCost - allocated
        : weightSum > 0
          ? (parentItemDisassemblyTotalCost * weights[index]) / weightSum
          : parentItemDisassemblyTotalCost / Math.max(base.components.length, 1);
      allocated += share;
      const resultingQuantity = Number(comp.requiredQuantity) || 0;
      const unitCost = resultingQuantity > 0 ? share / resultingQuantity : 0;
      return {
        ...comp,
        resultingQuantity,
        unitCost,
        totalCost: share,
      };
    });

    return {
      ...base,
      parentItemUnitCost,
      parentItemDisassemblyTotalCost,
      components,
    };
  }
}

export const itemBomExplosionService = new ItemBomExplosionService();
