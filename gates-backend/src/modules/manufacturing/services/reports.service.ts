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
  bomId?: string;
  stage?: string;
  costCenterId?: string;
  showUnposted?: boolean;
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
    const { getProductionCostVarianceReport } = await import(
      './manufacturing-cost-variance-report.service'
    );
    return getProductionCostVarianceReport(filters, options);
  }

  /**
   * Get Manufacturing Movements Report
   * Shows all manufacturing-related inventory movements
   */
  async getManufacturingMovementsReport(
    filters: ManufacturingReportFilters,
    options: ManufacturingReportOptions = {}
  ): Promise<ManufacturingReportResult> {
    const { getProductionManufacturingMovementsReport } = await import(
      './manufacturing-movements-report.service'
    );
    return getProductionManufacturingMovementsReport(filters, options);
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
      const { getTheoreticalCapabilityReport } = await import(
        './theoretical-capability-report.service'
      );
      return getTheoreticalCapabilityReport(
        {
          companyId: filters.companyId,
          warehouseId: filters.warehouseId,
          itemId: filters.itemId,
        },
        { page: options.page, limit: options.limit }
      );
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating theoretical capability report');
      throw error;
    }
  }
}

export const manufacturingReportsService = new ManufacturingReportsService();
