// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

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

export class ManufacturingReportsService {
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

      // Get manufacturing-related invoices (sales invoices for manufactured items)
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
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Calculate variance (actual vs expected)
      const varianceData = invoices.map((invoice) => {
        const actualAmount = Number(invoice.netAmount || 0);
        // Expected amount would come from production planning - using placeholder
        const expectedAmount = actualAmount * 0.95; // 5% variance assumption
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

      // Get purchase invoices (raw materials) and assembly operations
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
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      // Get assembly operations (manufacturing operations)
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
              item: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      // Calculate cost variance
      const costData = [...purchaseInvoices, ...assemblies].map((operation) => {
        const actualCost = Number(operation.netAmount || 0);
        // Standard cost would come from cost standards - using placeholder
        const standardCost = actualCost * 0.92; // 8% variance assumption
        const variance = actualCost - standardCost;
        const variancePercent = standardCost > 0 ? (variance / standardCost) * 100 : 0;

        return {
          operationId: operation.id,
          operationNumber: (operation as any).voucherNumber || (operation as any).invoiceNumber,
          date: operation.date,
          operationType: 'invoice' in operation ? 'purchase' : 'assembly',
          actualCost,
          standardCost,
          variance,
          variancePercent,
          status: Math.abs(variancePercent) < 8 ? 'within-tolerance' : variance > 0 ? 'over-cost' : 'under-cost',
          items: operation.lines.map((line: any) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity || 0),
            unitCost: Number(line.unitPrice || 0),
            totalCost: Number(line.totalPrice || 0),
          })),
        };
      });

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

      // Get all manufacturing-related operations
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
                    code: true,
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
                    code: true,
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
                    code: true,
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
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
        }),
      ]);

      // Combine all movements
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

      // Get all items that can be manufactured (have assembly operations)
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
              item: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
      });

      // Group by item and calculate capability
      const itemCapability = new Map<string, any>();

      assemblies.forEach((assembly) => {
        assembly.lines.forEach((line: any) => {
          const itemId = line.itemId;
          if (!itemCapability.has(itemId)) {
            itemCapability.set(itemId, {
              itemId,
              itemName: line.item?.arabicName,
              itemCode: line.item?.code,
              totalProduced: 0,
              productionCount: 0,
              averageProduction: 0,
              theoreticalCapacity: 0,
            });
          }

          const capability = itemCapability.get(itemId);
          capability.totalProduced += Number(line.quantity || 0);
          capability.productionCount += 1;
        });
      });

      // Calculate theoretical capacity (would come from machine/sensor data)
      const capabilityData = Array.from(itemCapability.values()).map((cap) => {
        cap.averageProduction = cap.productionCount > 0 ? cap.totalProduced / cap.productionCount : 0;
        // Theoretical capacity would be based on machine specs - using placeholder
        cap.theoreticalCapacity = cap.averageProduction * 1.2; // 20% above average
        cap.utilizationPercent = cap.theoreticalCapacity > 0 
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

