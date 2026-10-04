// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface ManufacturingReportFilters {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  itemId?: string;
  warehouseId?: string;
  branchId?: string;
  [key: string]: any;
}

export interface ManufacturingReportOptions {
  page?: number;
  limit?: number;
  includeDetails?: boolean;
  includeSummary?: boolean;
}

export interface ManufacturingReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type BomStandard = {
  finishedItemId: string;
  baseQuantity: number;
  standardLaborCost: number;
  standardOverheadCost: number;
  /** Standard batch material cost (qty × scrap × averageCost of raw items). */
  materialBatchCost: number;
};

function num(value: unknown): number {
  return Number(value ?? 0) || 0;
}

export class ManufacturingReportsService {
  /**
   * Load active BOMs keyed by finishedItemId. When multiple BOMs exist for one
   * finished item, the most recently updated wins.
   */
  private async loadBomStandardsByFinishedItem(
    companyId: string
  ): Promise<Map<string, BomStandard>> {
    const boms = await prisma.billOfMaterials.findMany({
      where: { companyId, isActive: true },
      include: {
        lines: {
          include: {
            rawItem: { select: { id: true, averageCost: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const map = new Map<string, BomStandard>();
    for (const bom of boms) {
      if (map.has(bom.finishedItemId)) continue;
      const materialBatchCost = bom.lines.reduce((sum, line) => {
        const qty = num(line.quantity);
        const scrap = num(line.scrapPercentage);
        const unitCost = num(line.rawItem?.averageCost);
        return sum + qty * (1 + scrap / 100) * unitCost;
      }, 0);
      map.set(bom.finishedItemId, {
        finishedItemId: bom.finishedItemId,
        baseQuantity: num(bom.baseQuantity) || 1,
        standardLaborCost: num(bom.standardLaborCost),
        standardOverheadCost: num(bom.standardOverheadCost),
        materialBatchCost,
      });
    }
    return map;
  }

  /** Standard unit cost for one finished unit from BOM (materials + labor + OH). */
  private standardUnitCost(bom: BomStandard): number {
    const batch =
      bom.materialBatchCost + bom.standardLaborCost + bom.standardOverheadCost;
    return bom.baseQuantity > 0 ? batch / bom.baseQuantity : batch;
  }

  /**
   * Get Invoice Variance Report
   * Compares actual manufacturing invoices with expected/planned invoices
   */
  async getInvoiceVarianceReport(
    filters: ManufacturingReportFilters,
    options: ManufacturingReportOptions = {}
  ): Promise<ManufacturingReportResult> {
    try {
      const { companyId, fromDate, toDate, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const invoiceWhere: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        invoiceWhere.warehouseId = warehouseId;
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const bomByItem = await this.loadBomStandardsByFinishedItem(companyId);

      const varianceData = invoices.map((invoice) => {
        const actualAmount = Number(invoice.netAmount || 0);
        let expectedFromBom = 0;
        let hasBomLine = false;

        for (const line of invoice.lines) {
          if (itemId && line.itemId !== itemId) continue;
          const bom = bomByItem.get(line.itemId);
          if (!bom) continue;
          hasBomLine = true;
          expectedFromBom += this.standardUnitCost(bom) * num(line.quantity);
        }

        // No BOM for invoice lines → expected = actual (variance 0)
        const expectedAmount = hasBomLine ? expectedFromBom : actualAmount;
        const variance = actualAmount - expectedAmount;
        const variancePercent = expectedAmount > 0 ? (variance / expectedAmount) * 100 : 0;

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          actualAmount,
          expectedAmount,
          variance,
          variancePercent,
          status: Math.abs(variancePercent) < 5 ? 'within-tolerance' : variance > 0 ? 'over-budget' : 'under-budget',
          items: invoice.lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unitPrice: Number(line.unitPrice || 0),
            totalPrice: Number(line.totalPrice || 0),
          })),
        };
      });

      const skip = (page - 1) * limit;
      const paginatedData = varianceData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalInvoices: invoices.length,
          totalActual: varianceData.reduce((sum, v) => sum + v.actualAmount, 0),
          totalExpected: varianceData.reduce((sum, v) => sum + v.expectedAmount, 0),
          totalVariance: varianceData.reduce((sum, v) => sum + v.variance, 0),
          withinTolerance: varianceData.filter((v) => v.status === 'within-tolerance').length,
        },
        pagination: {
          page,
          limit,
          total: varianceData.length,
          totalPages: Math.ceil(varianceData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating invoice variance report');
      throw error;
    }
  }

  /**
   * Get Cost Variance Report
   * Compares actual manufacturing costs with standard/planned costs
   */
  async getCostVarianceReport(
    filters: ManufacturingReportFilters,
    options: ManufacturingReportOptions = {}
  ): Promise<ManufacturingReportResult> {
    try {
      const { companyId, fromDate, toDate, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const purchaseInvoices = await prisma.invoice.findMany({
        where: {
          companyId,
          invoiceType: 'purchase',
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
          isCancelled: false,
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: {
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      const assemblies = await prisma.assembly.findMany({
        where: {
          companyId,
          date: {
            gte: fromDate,
            lte: toDate,
          },
          isPosted: true,
          isCancelled: false,
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: {
          lines: {
            include: {
              assembledItem: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      const bomByItem = await this.loadBomStandardsByFinishedItem(companyId);

      const purchaseCostData = purchaseInvoices.map((operation) => {
        const actualCost = Number(operation.netAmount || 0);
        let standardFromBom = 0;
        let hasBomLine = false;

        for (const line of operation.lines) {
          if (itemId && line.itemId !== itemId) continue;
          const bom = bomByItem.get(line.itemId);
          if (!bom) continue;
          hasBomLine = true;
          standardFromBom += this.standardUnitCost(bom) * num(line.quantity);
        }

        const standardCost = hasBomLine ? standardFromBom : actualCost;
        const variance = actualCost - standardCost;
        const variancePercent = standardCost > 0 ? (variance / standardCost) * 100 : 0;

        return {
          operationId: operation.id,
          operationNumber: operation.invoiceNumber,
          date: operation.date,
          operationType: 'purchase',
          actualCost,
          standardCost,
          variance,
          variancePercent,
          status: Math.abs(variancePercent) < 8 ? 'within-tolerance' : variance > 0 ? 'over-cost' : 'under-cost',
          items: operation.lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unitCost: Number(line.unitPrice || 0),
            totalCost: Number(line.totalPrice || 0),
          })),
        };
      });

      const assemblyCostData = assemblies.map((operation) => {
        const actualCost = Number(operation.totalAmount || 0);
        let standardFromBom = 0;
        let hasBomLine = false;

        for (const line of operation.lines) {
          const finishedId = line.assembledItemId;
          if (itemId && finishedId !== itemId) continue;
          const bom = bomByItem.get(finishedId);
          if (!bom) continue;
          hasBomLine = true;
          standardFromBom += this.standardUnitCost(bom) * num(line.assembledQuantity);
        }

        const standardCost = hasBomLine ? standardFromBom : actualCost;
        const variance = actualCost - standardCost;
        const variancePercent = standardCost > 0 ? (variance / standardCost) * 100 : 0;

        return {
          operationId: operation.id,
          operationNumber: operation.serial,
          date: operation.date,
          operationType: 'assembly',
          actualCost,
          standardCost,
          variance,
          variancePercent,
          status: Math.abs(variancePercent) < 8 ? 'within-tolerance' : variance > 0 ? 'over-cost' : 'under-cost',
          items: operation.lines.map((line) => ({
            itemId: line.assembledItemId,
            itemName: line.assembledItem?.arabicName,
            quantity: Number(line.assembledQuantity || 0),
            unitCost: Number(line.assembledUnitPrice || 0),
            totalCost: Number(line.assembledTotal || 0),
          })),
        };
      });

      const costData = [...purchaseCostData, ...assemblyCostData];

      const skip = (page - 1) * limit;
      const paginatedData = costData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalOperations: costData.length,
          totalActualCost: costData.reduce((sum, c) => sum + c.actualCost, 0),
          totalStandardCost: costData.reduce((sum, c) => sum + c.standardCost, 0),
          totalVariance: costData.reduce((sum, c) => sum + c.variance, 0),
          withinTolerance: costData.filter((c) => c.status === 'within-tolerance').length,
        },
        pagination: {
          page,
          limit,
          total: costData.length,
          totalPages: Math.ceil(costData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cost variance report');
      throw error;
    }
  }

  /**
   * Get Manufacturing Movements Report
   * Shows all manufacturing-related inventory movements
   */
  async getManufacturingMovementsReport(
    filters: ManufacturingReportFilters,
    options: ManufacturingReportOptions = {}
  ): Promise<ManufacturingReportResult> {
    try {
      const { companyId, fromDate, toDate, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const dateFilter = {
        gte: fromDate,
        lte: toDate,
      };

      const [assemblies, disassemblies, receipts, issues] = await Promise.all([
        prisma.assembly.findMany({
          where: {
            companyId,
            date: dateFilter,
            isPosted: true,
            isCancelled: false,
            ...(warehouseId ? { warehouseId } : {}),
          },
          include: {
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.disassembly.findMany({
          where: {
            companyId,
            date: dateFilter,
            isPosted: true,
            isCancelled: false,
            ...(warehouseId ? { warehouseId } : {}),
          },
          include: {
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.receipt.findMany({
          where: {
            companyId,
            date: dateFilter,
            isPosted: true,
            isCancelled: false,
            ...(warehouseId ? { warehouseId } : {}),
          },
          include: {
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.issue.findMany({
          where: {
            companyId,
            date: dateFilter,
            isPosted: true,
            isCancelled: false,
            ...(warehouseId ? { warehouseId } : {}),
          },
          include: {
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      const movements = [
        ...assemblies.map((a) => ({
          movementId: a.id,
          movementNumber: (a as any).voucherNumber,
          date: a.date,
          type: 'assembly',
          description: a.description,
          items: a.lines.map((line: any) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unit: line.unit,
          })),
        })),
        ...disassemblies.map((d) => ({
          movementId: d.id,
          movementNumber: (d as any).voucherNumber,
          date: d.date,
          type: 'disassembly',
          description: d.description,
          items: d.lines.map((line: any) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unit: line.unit,
          })),
        })),
        ...receipts.map((r) => ({
          movementId: r.id,
          movementNumber: (r as any).voucherNumber,
          date: r.date,
          type: 'receipt',
          description: r.description,
          items: r.lines.map((line: any) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unit: line.unit,
          })),
        })),
        ...issues.map((i) => ({
          movementId: i.id,
          movementNumber: (i as any).voucherNumber,
          date: i.date,
          type: 'issue',
          description: i.description,
          items: i.lines.map((line: any) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unit: line.unit,
          })),
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime());

      const skip = (page - 1) * limit;
      const paginatedData = movements.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalMovements: movements.length,
          assemblies: movements.filter((m) => m.type === 'assembly').length,
          disassemblies: movements.filter((m) => m.type === 'disassembly').length,
          receipts: movements.filter((m) => m.type === 'receipt').length,
          issues: movements.filter((m) => m.type === 'issue').length,
        },
        pagination: {
          page,
          limit,
          total: movements.length,
          totalPages: Math.ceil(movements.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating manufacturing movements report');
      throw error;
    }
  }

  /**
   * Get Theoretical Capability Report
   * Shows production capacity and capability analysis
   */
  async getTheoreticalCapabilityReport(
    filters: ManufacturingReportFilters,
    options: ManufacturingReportOptions = {}
  ): Promise<ManufacturingReportResult> {
    try {
      const { companyId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      const assemblies = await prisma.assembly.findMany({
        where: {
          companyId,
          isPosted: true,
          isCancelled: false,
          ...(warehouseId ? { warehouseId } : {}),
        },
        include: {
          lines: {
            include: {
              assembledItem: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      const bomByItem = await this.loadBomStandardsByFinishedItem(companyId);

      const itemCapability = new Map<string, any>();

      assemblies.forEach((assembly) => {
        assembly.lines.forEach((line) => {
          const lineItemId = line.assembledItemId;
          if (!itemCapability.has(lineItemId)) {
            itemCapability.set(lineItemId, {
              itemId: lineItemId,
              itemName: line.assembledItem?.arabicName,
              itemCode: line.assembledItem?.serial,
              totalProduced: 0,
              productionCount: 0,
              averageProduction: 0,
              theoreticalCapacity: 0,
            });
          }

          const capability = itemCapability.get(lineItemId);
          capability.totalProduced += Number(line.assembledQuantity || 0);
          capability.productionCount += 1;
        });
      });

      // Also surface finished items that have a BOM but no assembly history yet
      const missingBomItemIds = [...bomByItem.keys()].filter((id) => !itemCapability.has(id));
      if (missingBomItemIds.length > 0) {
        const items = await prisma.item.findMany({
          where: { companyId, id: { in: missingBomItemIds } },
          select: { id: true, serial: true, arabicName: true },
        });
        for (const item of items) {
          const bom = bomByItem.get(item.id);
          itemCapability.set(item.id, {
            itemId: item.id,
            itemName: item.arabicName,
            itemCode: item.serial,
            totalProduced: 0,
            productionCount: 0,
            averageProduction: 0,
            theoreticalCapacity: bom?.baseQuantity ?? 0,
          });
        }
      }

      const capabilityData = Array.from(itemCapability.values()).map((cap) => {
        cap.averageProduction =
          cap.productionCount > 0 ? cap.totalProduced / cap.productionCount : 0;
        const bom = bomByItem.get(cap.itemId);
        // BOM base quantity = theoretical capacity; otherwise actual average (variance 0)
        cap.theoreticalCapacity = bom ? bom.baseQuantity : cap.averageProduction;
        cap.utilizationPercent =
          cap.theoreticalCapacity > 0
            ? (cap.averageProduction / cap.theoreticalCapacity) * 100
            : 0;
        return cap;
      });

      const skip = (page - 1) * limit;
      const paginatedData = capabilityData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalItems: capabilityData.length,
          totalProduced: capabilityData.reduce((sum, c) => sum + c.totalProduced, 0),
          averageUtilization: capabilityData.length > 0
            ? capabilityData.reduce((sum, c) => sum + c.utilizationPercent, 0) / capabilityData.length
            : 0,
        },
        pagination: {
          page,
          limit,
          total: capabilityData.length,
          totalPages: Math.ceil(capabilityData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating theoretical capability report');
      throw error;
    }
  }
}

export const manufacturingReportsService = new ManufacturingReportsService();
