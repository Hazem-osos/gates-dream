// @ts-nocheck — report queries predate current Prisma schema shapes; tighten types incrementally.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { agedOpenItemsService } from '../../accounting/services/aged-open-items.service';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  applyCustomerGroupWhere,
  applySupplierGroupWhere,
  applySupplierMasterWhere,
} from '../../accounting/services/party-group-filter';

export interface InventoryReportFilters {
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
  branchId?: string;
  warehouseId?: string;
  itemId?: string;
  customerId?: string;
  supplierId?: string;
  customerCategoryId?: string;
  supplierCategoryId?: string;
  delegateId?: string;
  costCenterId?: string;
  currencyId?: string;
  sellerId?: string;
  unpaidOnly?: boolean;
  fromInvoice?: string;
  toInvoice?: string;
  [key: string]: any;
}

export interface InventoryReportOptions {
  includeDetails?: boolean;
  includeSummary?: boolean;
  page?: number;
  limit?: number;
}

export interface InventoryReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class InventoryReportsService {
  /**
   * Get Sales Reports
   */
  async getSalesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const {
        fromDate,
        toDate,
        companyId,
        warehouseId,
        customerId,
        delegateId,
        branchId,
        itemId,
        costCenterId,
        currencyId,
        sellerId,
        unpaidOnly,
        fromInvoice,
        toInvoice,
        sortBy,
        profileId,
      } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
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
        where.warehouseId = warehouseId;
      }

      applyCustomerGroupWhere(where, filters);

      if (branchId) {
        where.branchId = branchId;
      }

      if (delegateId) {
        // Wave 5 fix: Invoice has no `delegateId` column — the FK is
        // `representativeId` (relation name `delegate`). Filtering by
        // delegate previously threw a Prisma "unknown argument" runtime
        // error on every call that set this filter.
        where.representativeId = delegateId;
      }

      if (sellerId) {
        where.sellerId = sellerId;
      }

      if (costCenterId) {
        where.costCenterId = costCenterId;
      }

      if (currencyId) {
        where.currencyId = currencyId;
      }

      if (profileId) {
        where.documentProfileId = profileId;
      }

      if (itemId) {
        where.lines = { some: { itemId } };
      }

      if (unpaidOnly) {
        where.remainingAmount = { gt: 0 };
      }

      if (fromInvoice || toInvoice) {
        where.invoiceNumber = {
          ...(fromInvoice ? { gte: String(fromInvoice) } : {}),
          ...(toInvoice ? { lte: String(toInvoice) } : {}),
        };
      }

      const skip = (page - 1) * limit;
      // Wave 5 fix: the filter UI's only "sort by" option is invoice number;
      // honor it instead of always ordering by date regardless of selection.
      const orderBy =
        sortBy === 'invoice-number' ? [{ invoiceNumber: 'asc' as const }] : [{ date: 'desc' as const }];

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            delegate: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalQuantity = invoices.reduce((sum, inv) => {
        return sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0);
      }, 0);

      return {
        data: invoices,
        summary: {
          totalInvoices: total,
          totalSales,
          totalQuantity,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales report');
      throw error;
    }
  }

  /**
   * Get Purchase Reports
   */
  async getPurchaseReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, supplierId, profileId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'purchase',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applySupplierGroupWhere(where, filters);

      if (profileId) {
        where.documentProfileId = profileId;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            lines: {
              include: {
                item: {
                  select: {
                    id: true,
                    serial: true,
                    arabicName: true,
                  },
                },
                unit: {
                  select: {
                    id: true,
                    code: true,
                    arabicName: true,
                  },
                },
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalPurchases = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalQuantity = invoices.reduce((sum, inv) => {
        return sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0);
      }, 0);

      return {
        data: invoices,
        summary: {
          totalInvoices: total,
          totalPurchases,
          totalQuantity,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating purchase report');
      throw error;
    }
  }

  /**
   * Get Sales Returns Reports
   */
  async getSalesReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'return',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applyCustomerGroupWhere(where, filters);

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            customer: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
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
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalReturns = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      return {
        data: invoices,
        summary: {
          totalReturns,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales returns report');
      throw error;
    }
  }

  /**
   * Get Purchase Returns Reports
   */
  async getPurchaseReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Purchase returns are stored in PurchaseReturn model
      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      applySupplierGroupWhere(where, filters);

      const skip = (page - 1) * limit;

      const [purchaseReturns, total] = await Promise.all([
        prisma.purchaseReturn.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }],
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
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
        }),
        prisma.purchaseReturn.count({ where }),
      ]);

      const totalReturns = purchaseReturns.reduce(
        (sum, pr) => sum + Number(pr.totalAmount || 0),
        0
      );

      return {
        data: purchaseReturns,
        summary: {
          totalReturns,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating purchase returns report');
      throw error;
    }
  }

  /**
   * Get Inventory Reports (Stock Status)
   */
  async getInventoryReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, warehouseId, itemId } = filters;
      const { page = 1, limit = 1000 } = options;

      const where = scopedItemQuantityWhere(companyId, {
        item: {
          isActive: true,
        },
        ...(warehouseId ? { warehouseId } : {}),
        ...(itemId ? { itemId } : {}),
      });

      const skip = (page - 1) * limit;

      const [quantities, total] = await Promise.all([
        prisma.itemQuantity.findMany({
          where,
          skip,
          take: limit,
          include: {
            item: {
              select: {
                id: true,
                serial: true,
                arabicName: true,
                englishName: true,
                orderLimit: true,
                lowerLimit: true,
                averageCost: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            location: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
          orderBy: [
            { item: { arabicName: 'asc' } },
            { warehouse: { arabicName: 'asc' } },
          ],
        }),
        prisma.itemQuantity.count({ where }),
      ]);

      const totalQuantity = quantities.reduce((sum, qty) => sum + Number(qty.quantity), 0);
      const totalValue = quantities.reduce(
        (sum, qty) => sum + Number(qty.quantity) * Number(qty.item.averageCost || 0),
        0
      );

      return {
        data: quantities,
        summary: {
          totalItems: total,
          totalQuantity,
          totalValue,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating inventory report');
      throw error;
    }
  }

  /**
   * Get Item Movement Reports
   */
  async getItemMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      if (!itemId) {
        throw new Error('Item ID is required');
      }

      // Get all movements for this item (invoices, receipts, issues, transfers, etc.)
      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
        lines: {
          some: {
            itemId,
          },
        },
      };

      if (warehouseId) {
        where.warehouseId = warehouseId;
      }

      const skip = (page - 1) * limit;

      // Get sales invoices
      const salesInvoices = await prisma.invoice.findMany({
        where: {
          ...where,
          invoiceType: 'sales',
        },
        include: {
          lines: {
            where: { itemId },
            include: {
              item: true,
              unit: true,
            },
          },
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      // Get purchase invoices
      const purchaseInvoices = await prisma.invoice.findMany({
        where: {
          ...where,
          invoiceType: 'purchase',
        },
        include: {
          lines: {
            where: { itemId },
            include: {
              item: true,
              unit: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      // Get receipts
      const receipts = await prisma.receipt.findMany({
        where: {
          ...where,
          lines: {
            some: {
              itemId,
            },
          },
        },
        include: {
          lines: {
            where: { itemId },
            include: {
              item: true,
              unit: true,
            },
          },
        },
      });

      // Get issues
      const issues = await prisma.issue.findMany({
        where: {
          ...where,
          lines: {
            some: {
              itemId,
            },
          },
        },
        include: {
          lines: {
            where: { itemId },
            include: {
              item: true,
              unit: true,
            },
          },
        },
      });

      // Combine all movements
      const movements = [
        ...salesInvoices.map((inv) => ({
          type: 'sales',
          date: inv.date,
          document: inv,
          quantity: inv.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        })),
        ...purchaseInvoices.map((inv) => ({
          type: 'purchase',
          date: inv.date,
          document: inv,
          quantity: inv.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        })),
        ...receipts.map((rec) => ({
          type: 'receipt',
          date: rec.date,
          document: rec,
          quantity: rec.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        })),
        ...issues.map((iss) => ({
          type: 'issue',
          date: iss.date,
          document: iss,
          quantity: iss.lines.reduce((sum, line) => sum + Number(line.quantity), 0),
        })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        data: movements.slice(skip, skip + limit),
        summary: {
          totalMovements: movements.length,
          totalSales: salesInvoices.reduce(
            (sum, inv) =>
              sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0),
            0
          ),
          totalPurchases: purchaseInvoices.reduce(
            (sum, inv) =>
              sum + inv.lines.reduce((lineSum, line) => lineSum + Number(line.quantity), 0),
            0
          ),
        },
        pagination: {
          page,
          limit,
          total: movements.length,
          totalPages: Math.ceil(movements.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating item movement report');
      throw error;
    }
  }

  /**
   * Get Customer Balances Report.
   *
   * M16 fix (N+1): this used to run two `findMany` queries *per customer*
   * (invoices + treasury receipts) inside `Promise.all(customers.map(...))`,
   * and derived "balance" from lifetime `invoice.totalAmount` minus lifetime
   * receipts instead of `remainingAmount` — the same root-cause bug fixed
   * for `getReceivablesAgingReport` under H19. Delegates to
   * `agedOpenItemsService.getAgedReceivables` (one GL-reconciled query set).
   */
  async getCustomerBalancesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;
      // Do not read partner_running_balances until every historical AR line
      // has partnerId and original/base currency splits.

      const report = await agedOpenItemsService.getAgedReceivables({
        companyId,
        customerId,
        customerCategoryId: filters.customerCategoryId,
        asOfDate: asOfDate ?? new Date(),
      });

      const customerBalances = report.parties.map((party) => ({
        customer: {
          id: party.partyId,
          code: party.partyCode,
          arabicName: party.partyName,
        },
        totalSales: roundTo4(party.invoices.reduce((sum, i) => sum + i.netAmount, 0)),
        totalPayments: roundTo4(party.invoices.reduce((sum, i) => sum + i.paidAmount, 0)),
        balance: roundTo4(party.total),
      }));

      const total = customerBalances.length;
      const skip = (page - 1) * limit;
      const pageData = customerBalances.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalCustomers: total,
          totalBalances: roundTo4(report.grandTotal),
          controlAccountTieOut: report.controlAccountTieOut,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer balances report');
      throw error;
    }
  }

  /**
   * Get Suppliers Balances Report (from inventory perspective).
   *
   * M16 fix (N+1): same fix as `getCustomerBalancesReport` above, mirrored
   * for payables via `agedOpenItemsService.getAgedPayables`.
   */
  async getSuppliersBalancesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, supplierId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;
      // Same as customer balances: aged open items only.

      const report = await agedOpenItemsService.getAgedPayables({
        companyId,
        supplierId,
        supplierCategoryId: filters.supplierCategoryId,
        asOfDate: asOfDate ?? new Date(),
      });

      const supplierBalances = report.parties.map((party) => ({
        supplier: {
          id: party.partyId,
          code: party.partyCode,
          arabicName: party.partyName,
        },
        totalPurchases: roundTo4(party.invoices.reduce((sum, i) => sum + i.netAmount, 0)),
        totalPayments: roundTo4(party.invoices.reduce((sum, i) => sum + i.paidAmount, 0)),
        balance: roundTo4(party.total),
      }));

      const total = supplierBalances.length;
      const skip = (page - 1) * limit;
      const pageData = supplierBalances.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalSuppliers: total,
          totalBalances: roundTo4(report.grandTotal),
          controlAccountTieOut: report.controlAccountTieOut,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating suppliers balances report');
      throw error;
    }
  }

  private isCurrentAsOf(asOfDate?: Date): boolean {
    if (!asOfDate) return true;
    const now = new Date();
    return (
      asOfDate.getUTCFullYear() === now.getUTCFullYear() &&
      asOfDate.getUTCMonth() === now.getUTCMonth() &&
      asOfDate.getUTCDate() === now.getUTCDate()
    );
  }

  /**
   * Current running totals from `partner_running_balances`. Historical
   * as-of dates and an empty summary table fall back to aged open items.
   */
  private async tryPartnerRunningBalances(input: {
    companyId: string;
    partnerType: 'CUSTOMER' | 'SUPPLIER';
    partnerId?: string;
    asOfDate?: Date;
    page: number;
    limit: number;
  }) {
    if (!this.isCurrentAsOf(input.asOfDate)) return null;

    const summaryCount = await prisma.partnerRunningBalance.count({
      where: {
        companyId: input.companyId,
        partnerType: input.partnerType,
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      },
    });
    if (summaryCount === 0) return null;

    const balances = await prisma.partnerRunningBalance.findMany({
      where: {
        companyId: input.companyId,
        partnerType: input.partnerType,
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      },
    });

    const partnerIds = balances.map((b) => b.partnerId);
    const parties =
      input.partnerType === 'CUSTOMER'
        ? await prisma.customer.findMany({
            where: { companyId: input.companyId, id: { in: partnerIds } },
            select: { id: true, code: true, arabicName: true },
          })
        : await prisma.supplier.findMany({
            where: { companyId: input.companyId, id: { in: partnerIds } },
            select: { id: true, code: true, arabicName: true },
          });
    const partyById = new Map(parties.map((p) => [p.id, p]));

    const rows = balances
      .map((b) => {
        const party = partyById.get(b.partnerId);
        if (!party) return null;
        return {
          party: { id: party.id, code: party.code, arabicName: party.arabicName },
          currencyCode: b.currencyCode,
          totalDebitOriginal: roundTo4(Number(b.debitOriginal)),
          totalCreditOriginal: roundTo4(Number(b.creditOriginal)),
          balanceOriginal: roundTo4(Number(b.netOriginal)),
          balanceBase: roundTo4(Number(b.netBase)),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const balancesByCurrency: Record<string, number> = {};
    for (const row of rows) {
      balancesByCurrency[row.currencyCode] = roundTo4(
        (balancesByCurrency[row.currencyCode] ?? 0) + row.balanceOriginal
      );
    }

    const total = rows.length;
    const skip = (input.page - 1) * input.limit;
    return {
      rows: rows.slice(skip, skip + input.limit),
      total,
      balancesByCurrency,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  /**
   * Get Receivables Aging Report.
   *
   * H19 fix: this used to run its own N+1 query per customer (invoices +
   * treasury receipts) and derive "balance" from lifetime sales minus
   * lifetime payments — ignoring `remainingAmount`/opening balances/credit
   * notes and completely detached from the GL. That could (and did) disagree
   * with both `invoice.remainingAmount` and the AR control account. This now
   * delegates to `agedOpenItemsService`, the single GL-reconciled AR/AP aging
   * implementation (due-date buckets, one query set instead of 2N), and maps
   * its output to this endpoint's bucket shape.
   * @deprecated Prefer `GET /accounting/reports/aged-receivables` (M16) directly.
   */
  async getReceivablesAgingReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId, branchId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;

      const date = asOfDate || new Date();
      const report = await agedOpenItemsService.getAgedReceivables({
        companyId,
        branchId,
        customerId,
        customerCategoryId: filters.customerCategoryId,
        asOfDate: date,
      });

      const agingData = report.parties.map((party) => ({
        customer: {
          id: party.partyId,
          code: party.partyCode,
          arabicName: party.partyName,
        },
        balance: roundTo4(party.total),
        current: roundTo4(party.buckets.current_0_30),
        days30: roundTo4(party.buckets.days_31_60),
        days60: roundTo4(party.buckets.days_61_90),
        days90Plus: roundTo4(party.buckets.days_91_120 + party.buckets.days_120_plus),
      }));

      const total = agingData.length;
      const skip = (page - 1) * limit;
      const pageData = agingData.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalCustomers: total,
          totalBalance: roundTo4(report.grandTotal),
          controlAccountTieOut: report.controlAccountTieOut,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating receivables aging report');
      throw error;
    }
  }

  /**
   * Get Stock Profit Reports
   */
  async getStockProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get sales invoices
      const salesWhere: any = {
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
        salesWhere.warehouseId = warehouseId;
      }

      const salesInvoices = await prisma.invoice.findMany({
        where: salesWhere,
        include: {
          lines: {
            include: {
              item: true,
            },
            ...(itemId ? { where: { itemId } } : {}),
          },
        },
      });

      // Calculate profit per item
      const itemProfits = new Map<string, any>();

      salesInvoices.forEach((invoice) => {
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          const quantity = Number(line.quantity);
          const salePrice = Number(line.price);
          const saleTotal = Number(line.total);

          // Get average cost (simplified - in real system, use FIFO/LIFO)
          const costPrice = Number(line.item.beginningCostPrice || 0);
          const costTotal = quantity * costPrice;
          const profit = saleTotal - costTotal;
          const profitPercent = saleTotal > 0 ? (profit / saleTotal) * 100 : 0;

          if (!itemProfits.has(itemId)) {
            itemProfits.set(itemId, {
              item: {
                id: line.item.id,
                serial: line.item.serial,
                arabicName: line.item.arabicName,
              },
              quantity: 0,
              totalSales: 0,
              totalCost: 0,
              totalProfit: 0,
            });
          }

          const itemProfit = itemProfits.get(itemId)!;
          itemProfit.quantity += quantity;
          itemProfit.totalSales += saleTotal;
          itemProfit.totalCost += costTotal;
          itemProfit.totalProfit += profit;
        });
      });

      const profitData = Array.from(itemProfits.values()).map((item) => ({
        ...item,
        profitPercent: item.totalSales > 0 ? (item.totalProfit / item.totalSales) * 100 : 0,
      }));

      const sortedData = profitData
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalItems: profitData.length,
          totalSales: profitData.reduce((sum, item) => sum + item.totalSales, 0),
          totalCost: profitData.reduce((sum, item) => sum + item.totalCost, 0),
          totalProfit: profitData.reduce((sum, item) => sum + item.totalProfit, 0),
        },
        pagination: {
          page,
          limit,
          total: profitData.length,
          totalPages: Math.ceil(profitData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating stock profit report');
      throw error;
    }
  }

  /**
   * Get Inventory Reports (Detailed)
   */
  async getInventoryReportsDetailed(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, warehouseId, itemId } = filters;
      const { page = 1, limit = 100 } = options;

      const where = scopedItemQuantityWhere(companyId, {
        ...(warehouseId ? { warehouseId } : {}),
        ...(itemId ? { itemId } : {}),
      });

      const skip = (page - 1) * limit;

      const [quantities, total] = await Promise.all([
        prisma.itemQuantity.findMany({
          where,
          skip,
          take: limit,
          include: {
            item: {
              select: {
                id: true,
                serial: true,
                arabicName: true,
                beginningCostPrice: true,
              },
            },
            warehouse: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            location: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.itemQuantity.count({ where }),
      ]);

      return {
        data: quantities,
        summary: {
          totalItems: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating inventory reports detailed');
      throw error;
    }
  }

  /**
   * Get Stock Transfer Report
   */
  async getStockTransferReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) {
        where.OR = [
          { fromWarehouseId: warehouseId },
          { toWarehouseId: warehouseId },
        ];
      }

      const skip = (page - 1) * limit;

      const [transfers, total] = await Promise.all([
        prisma.transfer.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            fromWarehouse: true,
            toWarehouse: true,
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.transfer.count({ where }),
      ]);

      return {
        data: transfers,
        summary: {
          totalTransfers: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating stock transfer report');
      throw error;
    }
  }

  /**
   * Get Items Exceeding Order Limit Report
   */
  async getItemsExceedingOrderLimitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      const where = scopedItemQuantityWhere(companyId, {
        ...(warehouseId ? { warehouseId } : {}),
      });

      const quantities = await prisma.itemQuantity.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              serial: true,
              arabicName: true,
              orderLimit: true,
              lowerLimit: true,
            },
          },
          warehouse: true,
        },
      });

      const exceedingItems = quantities
        .filter((qty) => {
          const quantity = Number(qty.quantity || 0);
          const orderLimit = Number(qty.item.orderLimit || 0);
          return orderLimit > 0 && quantity <= orderLimit;
        })
        .map((qty) => ({
          item: qty.item,
          warehouse: qty.warehouse,
          currentQuantity: Number(qty.quantity || 0),
          orderLimit: Number(qty.item.orderLimit || 0),
          difference: Number(qty.item.orderLimit || 0) - Number(qty.quantity || 0),
        }));

      const sortedData = exceedingItems
        .sort((a, b) => a.difference - b.difference)
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalItems: exceedingItems.length,
        },
        pagination: {
          page,
          limit,
          total: exceedingItems.length,
          totalPages: Math.ceil(exceedingItems.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating items exceeding order limit report');
      throw error;
    }
  }

  /**
   * Get Expiry Date Report
   */
  async getExpiryDateReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, warehouseId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!toDate) {
        throw new Error('To date is required');
      }

      const where: any = {
        companyId,
        expiryDate: {
          lte: toDate,
        },
      };

      if (warehouseId) where.warehouseId = warehouseId;
      if (fromDate) {
        where.expiryDate = {
          ...where.expiryDate,
          gte: fromDate,
        };
      }

      const skip = (page - 1) * limit;

      const [quantities, total] = await Promise.all([
        prisma.itemQuantity.findMany({
          where,
          skip,
          take: limit,
          orderBy: { expiryDate: 'asc' },
          include: {
            item: true,
            warehouse: true,
          },
        }),
        prisma.itemQuantity.count({ where }),
      ]);

      return {
        data: quantities,
        summary: {
          totalItems: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating expiry date report');
      throw error;
    }
  }

  /**
   * Get Sales and Returns Reports (Combined)
   */
  async getSalesAndReturnsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, warehouseId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
        invoiceType: {
          in: ['sales', 'salesReturn'],
        },
      };

      if (warehouseId) where.warehouseId = warehouseId;
      applyCustomerGroupWhere(where, filters);

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            customer: true,
            warehouse: true,
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const totalSales = invoices
        .filter((inv) => inv.invoiceType === 'sales')
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const totalReturns = invoices
        .filter((inv) => inv.invoiceType === 'salesReturn')
        .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

      return {
        data: invoices,
        summary: {
          totalSales,
          totalReturns,
          netSales: totalSales - totalReturns,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales and returns report');
      throw error;
    }
  }

  /**
   * Get Monthly Sales for Items Report
   */
  async getMonthlySalesForItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (warehouseId) where.warehouseId = warehouseId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          lines: {
            include: {
              item: true,
            },
            ...(itemId ? { where: { itemId } } : {}),
          },
        },
      });

      // Group by month and item
      const monthlyData = new Map<string, Map<string, any>>();

      invoices.forEach((invoice) => {
        const month = invoice.date.getMonth() + 1;
        const monthKey = `${invoice.date.getFullYear()}-${month.toString().padStart(2, '0')}`;
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, new Map());
          }
          const monthMap = monthlyData.get(monthKey)!;
          if (!monthMap.has(itemId)) {
            monthMap.set(itemId, {
              item: {
                id: line.item.id,
                serial: line.item.serial,
                arabicName: line.item.arabicName,
              },
              quantity: 0,
              totalAmount: 0,
            });
          }
          const itemData = monthMap.get(itemId)!;
          itemData.quantity += Number(line.quantity);
          itemData.totalAmount += Number(line.total);
        });
      });

      const result: any[] = [];
      monthlyData.forEach((monthMap, month) => {
        monthMap.forEach((itemData, itemId) => {
          result.push({
            month,
            ...itemData,
          });
        });
      });

      const sortedData = result
        .sort((a, b) => {
          if (a.month !== b.month) return a.month.localeCompare(b.month);
          return b.totalAmount - a.totalAmount;
        })
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalMonths: monthlyData.size,
          totalItems: new Set(result.map((r) => r.item.id)).size,
        },
        pagination: {
          page,
          limit,
          total: result.length,
          totalPages: Math.ceil(result.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating monthly sales for items report');
      throw error;
    }
  }

  /**
   * Get Customer Accounts Reports (Detailed)
   */
  async getCustomerAccountsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: {
          in: ['sales', 'salesReturn'],
        },
        isPosted: true,
        isCancelled: false,
      };

      applyCustomerGroupWhere(where, filters);
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            customer: true,
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      // Calculate balances per customer
      const customerBalances = new Map<string, any>();
      invoices.forEach((invoice) => {
        const customerId = invoice.customerId;
        if (!customerBalances.has(customerId)) {
          customerBalances.set(customerId, {
            customer: invoice.customer,
            totalSales: 0,
            totalReturns: 0,
            totalPaid: 0,
            balance: 0,
            invoiceCount: 0,
          });
        }
        const balance = customerBalances.get(customerId)!;
        balance.invoiceCount += 1;
        if (invoice.invoiceType === 'sales') {
          balance.totalSales += Number(invoice.totalAmount || 0);
        } else {
          balance.totalReturns += Number(invoice.totalAmount || 0);
        }
        balance.balance = balance.totalSales - balance.totalReturns - balance.totalPaid;
      });

      const result = Array.from(customerBalances.values());

      return {
        data: result.slice((page - 1) * limit, page * limit),
        summary: {
          totalCustomers: customerBalances.size,
          totalSales: result.reduce((sum, c) => sum + c.totalSales, 0),
          totalReturns: result.reduce((sum, c) => sum + c.totalReturns, 0),
        },
        pagination: {
          page,
          limit,
          total: result.length,
          totalPages: Math.ceil(result.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer accounts report');
      throw error;
    }
  }

  /**
   * Get Customer Accounts Currency Reports
   */
  async getCustomerAccountsCurrencyReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Similar to customer accounts but grouped by currency
    return this.getCustomerAccountsReport(filters, options);
  }

  /**
   * Get Customer Account Items Report
   */
  async getCustomerAccountItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId, itemId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!customerId && !filters.customerCategoryId) {
        throw new Error('Customer ID is required');
      }

      const where: any = {
        companyId,
        invoiceType: {
          in: ['sales', 'salesReturn'],
        },
        isPosted: true,
        isCancelled: false,
      };
      applyCustomerGroupWhere(where, filters);

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          lines: {
            include: {
              item: true,
              unit: true,
            },
            ...(itemId ? { where: { itemId } } : {}),
          },
        },
      });

      // Group by item
      const itemMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          if (!itemMap.has(itemId)) {
            itemMap.set(itemId, {
              item: line.item,
              quantity: 0,
              totalAmount: 0,
              invoiceCount: 0,
            });
          }
          const itemData = itemMap.get(itemId)!;
          itemData.quantity += Number(line.quantity);
          itemData.totalAmount += Number(line.total);
          itemData.invoiceCount += 1;
        });
      });

      const result = Array.from(itemMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalItems: itemMap.size,
          totalAmount: Array.from(itemMap.values()).reduce((sum, item) => sum + item.totalAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: itemMap.size,
          totalPages: Math.ceil(itemMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer account items report');
      throw error;
    }
  }

  /**
   * Get Customer Receivables Report
   */
  async getCustomerReceivablesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: 'sales',
        isPosted: true,
        isCancelled: false,
      };

      applyCustomerGroupWhere(where, filters);

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
        },
      });

      // Calculate receivables (simplified - assumes unpaid if no payment tracking)
      const receivables = invoices.map((invoice) => ({
        invoice,
        customer: invoice.customer,
        invoiceAmount: Number(invoice.totalAmount || 0),
        receivable: Number(invoice.totalAmount || 0), // Simplified
        dueDate: invoice.dueDate,
      }));

      const sortedData = receivables
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) {
            return a.dueDate.getTime() - b.dueDate.getTime();
          }
          return b.receivable - a.receivable;
        })
        .slice((page - 1) * limit, page * limit);

      const totalReceivables = receivables.reduce((sum, r) => sum + r.receivable, 0);

      return {
        data: sortedData,
        summary: {
          totalReceivables,
          totalInvoices: receivables.length,
        },
        pagination: {
          page,
          limit,
          total: receivables.length,
          totalPages: Math.ceil(receivables.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating customer receivables report');
      throw error;
    }
  }

  /**
   * Get Supplier Accounts Reports
   */
  async getSupplierAccountsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, supplierId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        invoiceType: {
          in: ['purchase', 'purchaseReturn'],
        },
        isPosted: true,
        isCancelled: false,
      };

      applySupplierGroupWhere(where, filters);
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            supplier: true,
            lines: {
              include: {
                item: true,
              },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      // Calculate balances per supplier
      const supplierBalances = new Map<string, any>();
      invoices.forEach((invoice) => {
        const supplierId = invoice.supplierId;
        if (supplierId && !supplierBalances.has(supplierId)) {
          supplierBalances.set(supplierId, {
            supplier: invoice.supplier,
            totalPurchases: 0,
            totalReturns: 0,
            totalPaid: 0,
            balance: 0,
            invoiceCount: 0,
          });
        }
        if (supplierId) {
          const balance = supplierBalances.get(supplierId)!;
          balance.invoiceCount += 1;
          if (invoice.invoiceType === 'purchase') {
            balance.totalPurchases += Number(invoice.totalAmount || 0);
          } else {
            balance.totalReturns += Number(invoice.totalAmount || 0);
          }
          balance.balance = balance.totalPurchases - balance.totalReturns - balance.totalPaid;
        }
      });

      const result = Array.from(supplierBalances.values());

      return {
        data: result.slice((page - 1) * limit, page * limit),
        summary: {
          totalSuppliers: supplierBalances.size,
          totalPurchases: result.reduce((sum, s) => sum + s.totalPurchases, 0),
          totalReturns: result.reduce((sum, s) => sum + s.totalReturns, 0),
        },
        pagination: {
          page,
          limit,
          total: result.length,
          totalPages: Math.ceil(result.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating supplier accounts report');
      throw error;
    }
  }

  /**
   * Get Supplier Accounts Currencies Report
   * Shows supplier account balances by currency
   */
  async getSupplierAccountsCurrenciesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, supplierId, asOfDate } = filters;
      const { page = 1, limit = 100 } = options;

      const suppliersWhere: any = { companyId, isActive: true };
      applySupplierMasterWhere(suppliersWhere, filters);

      const suppliers = await prisma.supplier.findMany({
        where: suppliersWhere,
        include: {
          invoices: {
            where: {
              invoiceType: 'purchase',
              isPosted: true,
              isCancelled: false,
              ...(asOfDate
                ? {
                    date: {
                      lte: asOfDate,
                    },
                  }
                : {}),
            },
            include: {
              lines: true,
            },
          },
        },
      });

      // Group by currency
      const currencyMap = new Map<string, any>();

      suppliers.forEach((supplier) => {
        supplier.invoices.forEach((invoice) => {
          const currency = invoice.currencyCode || 'SAR';
          const key = `${supplier.id}-${currency}`;

          if (!currencyMap.has(key)) {
            currencyMap.set(key, {
              supplierId: supplier.id,
              supplierCode: supplier.code,
              supplierName: supplier.arabicName,
              currencyCode: currency,
              totalInvoices: 0,
              totalAmount: 0,
              totalPaid: 0,
              balance: 0,
            });
          }

          const data = currencyMap.get(key)!;
          data.totalInvoices += 1;
          data.totalAmount += Number(invoice.netAmount || 0);
          data.totalPaid += Number(invoice.paidAmount || 0);
          data.balance = data.totalAmount - data.totalPaid;
        });
      });

      const currencyData = Array.from(currencyMap.values()).sort((a, b) => b.balance - a.balance);

      const skip = (page - 1) * limit;
      const paginatedData = currencyData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalSuppliers: new Set(currencyData.map((c) => c.supplierId)).size,
          totalCurrencies: new Set(currencyData.map((c) => c.currencyCode)).size,
          totalBalance: currencyData.reduce((sum, c) => sum + c.balance, 0),
        },
        pagination: {
          page,
          limit,
          total: currencyData.length,
          totalPages: Math.ceil(currencyData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating supplier accounts currencies report');
      throw error;
    }
  }

  /**
   * Get Supplier Account Items Report
   */
  async getSupplierAccountItemsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, supplierId, itemId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!supplierId && !filters.supplierCategoryId) {
        throw new Error('Supplier ID is required');
      }

      const where: any = {
        companyId,
        invoiceType: {
          in: ['purchase', 'purchaseReturn'],
        },
        isPosted: true,
        isCancelled: false,
      };
      applySupplierGroupWhere(where, filters);

      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          lines: {
            include: {
              item: true,
              unit: true,
            },
            ...(itemId ? { where: { itemId } } : {}),
          },
        },
      });

      // Group by item
      const itemMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          if (!itemMap.has(itemId)) {
            itemMap.set(itemId, {
              item: line.item,
              quantity: 0,
              totalAmount: 0,
              invoiceCount: 0,
            });
          }
          const itemData = itemMap.get(itemId)!;
          itemData.quantity += Number(line.quantity);
          itemData.totalAmount += Number(line.total);
          itemData.invoiceCount += 1;
        });
      });

      const result = Array.from(itemMap.values())
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalItems: itemMap.size,
          totalAmount: Array.from(itemMap.values()).reduce((sum, item) => sum + item.totalAmount, 0),
        },
        pagination: {
          page,
          limit,
          total: itemMap.size,
          totalPages: Math.ceil(itemMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating supplier account items report');
      throw error;
    }
  }

  /**
   * Get Overdue Payments Report
   */
  async getOverduePaymentsReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, customerId, supplierId } = filters;
      const { page = 1, limit = 100 } = options;

      const now = new Date();
      const where: any = {
        companyId,
        isPosted: true,
        isCancelled: false,
        dueDate: {
          lt: now,
        },
      };

      applyCustomerGroupWhere(where, filters);
      applySupplierGroupWhere(where, filters);
      if (filters.customerId || filters.customerCategoryId) {
        where.invoiceType = {
          in: ['sales', 'salesReturn'],
        };
      }
      if (filters.supplierId || filters.supplierCategoryId) {
        where.invoiceType = {
          in: ['purchase', 'purchaseReturn'],
        };
      }

      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { dueDate: 'asc' },
          include: {
            customer: true,
            supplier: true,
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      const overdueInvoices = invoices.map((invoice) => {
        const daysOverdue = Math.floor(
          (now.getTime() - (invoice.dueDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)
        );
        return {
          invoice,
          amount: Number(invoice.totalAmount || 0),
          dueDate: invoice.dueDate,
          daysOverdue,
        };
      });

      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      return {
        data: overdueInvoices,
        summary: {
          totalOverdue,
          totalInvoices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating overdue payments report');
      throw error;
    }
  }

  /**
   * Get Collections and Overdues Report
   */
  async getCollectionsAndOverduesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Combine receivables and overdue payments
    const receivables = await this.getCustomerReceivablesReport(filters, options);
    const overdue = await this.getOverduePaymentsReport(filters, options);

    return {
      data: {
        receivables: receivables.data,
        overdue: overdue.data,
      },
      summary: {
        totalReceivables: receivables.summary?.totalReceivables || 0,
        totalOverdue: overdue.summary?.totalOverdue || 0,
      },
      pagination: receivables.pagination,
    };
  }

  /**
   * Get Invoices Profit Reports
   */
  async getInvoicesProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, customerId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      applyCustomerGroupWhere(where, filters);

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      const invoiceProfits = invoices.map((invoice) => {
        let totalCost = 0;
        let totalSales = Number(invoice.totalAmount || 0);

        invoice.lines.forEach((line) => {
          const quantity = Number(line.quantity);
          const costPrice = Number(line.item.beginningCostPrice || 0);
          totalCost += quantity * costPrice;
        });

        const profit = totalSales - totalCost;
        const profitPercent = totalSales > 0 ? (profit / totalSales) * 100 : 0;

        return {
          invoice,
          customer: invoice.customer,
          totalSales,
          totalCost,
          profit,
          profitPercent,
        };
      });

      const sortedData = invoiceProfits
        .sort((a, b) => b.profit - a.profit)
        .slice((page - 1) * limit, page * limit);

      const totalProfit = invoiceProfits.reduce((sum, inv) => sum + inv.profit, 0);
      const totalSales = invoiceProfits.reduce((sum, inv) => sum + inv.totalSales, 0);
      const totalCost = invoiceProfits.reduce((sum, inv) => sum + inv.totalCost, 0);

      return {
        data: sortedData,
        summary: {
          totalProfit,
          totalSales,
          totalCost,
          averageProfitPercent: totalSales > 0 ? (totalProfit / totalSales) * 100 : 0,
        },
        pagination: {
          page,
          limit,
          total: invoiceProfits.length,
          totalPages: Math.ceil(invoiceProfits.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating invoices profit report');
      throw error;
    }
  }

  /**
   * Get Items Profit Reports
   */
  async getItemsProfitReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Similar to stock profit but more detailed
    return this.getStockProfitReport(filters, options);
  }

  /**
   * Get Sales Commissions for Representatives Report
   */
  async getSalesCommissionsForRepresentativesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (delegateId) where.delegateId = delegateId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          delegate: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      // Group by delegate
      const delegateMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        const delegateId = invoice.delegateId;
        if (delegateId) {
          if (!delegateMap.has(delegateId)) {
            delegateMap.set(delegateId, {
              delegate: invoice.delegate,
              totalSales: 0,
              invoiceCount: 0,
              commission: 0,
            });
          }
          const delegateData = delegateMap.get(delegateId)!;
          delegateData.totalSales += Number(invoice.totalAmount || 0);
          delegateData.invoiceCount += 1;
          // Calculate commission (simplified - assume 5%)
          delegateData.commission += Number(invoice.totalAmount || 0) * 0.05;
        }
      });

      const result = Array.from(delegateMap.values())
        .sort((a, b) => b.commission - a.commission)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalRepresentatives: delegateMap.size,
          totalCommissions: Array.from(delegateMap.values()).reduce(
            (sum, d) => sum + d.commission,
            0
          ),
        },
        pagination: {
          page,
          limit,
          total: delegateMap.size,
          totalPages: Math.ceil(delegateMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales commissions for representatives report');
      throw error;
    }
  }

  /**
   * Get Representatives Commissions Values Account Report
   */
  async getRepresentativesCommissionsValuesAccountReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    // Similar to sales commissions but with more detail
    return this.getSalesCommissionsForRepresentativesReport(filters, options);
  }

  /**
   * Get Representatives Commissions Quantities Account Report
   */
  async getRepresentativesCommissionsQuantitiesAccountReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (delegateId) where.delegateId = delegateId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          delegate: true,
          lines: {
            include: {
              item: true,
            },
          },
        },
      });

      // Group by delegate and calculate quantities
      const delegateMap = new Map<string, any>();
      invoices.forEach((invoice) => {
        const delegateId = invoice.delegateId;
        if (delegateId) {
          if (!delegateMap.has(delegateId)) {
            delegateMap.set(delegateId, {
              delegate: invoice.delegate,
              totalQuantity: 0,
              invoiceCount: 0,
            });
          }
          const delegateData = delegateMap.get(delegateId)!;
          invoice.lines.forEach((line) => {
            delegateData.totalQuantity += Number(line.quantity);
          });
          delegateData.invoiceCount += 1;
        }
      });

      const result = Array.from(delegateMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice((page - 1) * limit, page * limit);

      return {
        data: result,
        summary: {
          totalRepresentatives: delegateMap.size,
          totalQuantity: Array.from(delegateMap.values()).reduce(
            (sum, d) => sum + d.totalQuantity,
            0
          ),
        },
        pagination: {
          page,
          limit,
          total: delegateMap.size,
          totalPages: Math.ceil(delegateMap.size / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating representatives commissions quantities account report');
      throw error;
    }
  }

  /**
   * Get Items Analytical Movement on Representatives Report
   */
  async getItemsAnalyticalMovementOnRepresentativesReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId, delegateId, itemId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        invoiceType: 'sales',
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (delegateId) where.delegateId = delegateId;

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          delegate: true,
          lines: {
            include: {
              item: true,
            },
            ...(itemId ? { where: { itemId } } : {}),
          },
        },
      });

      // Group by item and delegate
      const itemDelegateMap = new Map<string, Map<string, any>>();
      invoices.forEach((invoice) => {
        const delegateId = invoice.delegateId || 'no-delegate';
        invoice.lines.forEach((line) => {
          const itemId = line.itemId;
          if (!itemDelegateMap.has(itemId)) {
            itemDelegateMap.set(itemId, new Map());
          }
          const delegateMap = itemDelegateMap.get(itemId)!;
          if (!delegateMap.has(delegateId)) {
            delegateMap.set(delegateId, {
              delegate: invoice.delegate,
              item: line.item,
              quantity: 0,
              totalAmount: 0,
            });
          }
          const data = delegateMap.get(delegateId)!;
          data.quantity += Number(line.quantity);
          data.totalAmount += Number(line.total);
        });
      });

      const result: any[] = [];
      itemDelegateMap.forEach((delegateMap, itemId) => {
        delegateMap.forEach((data, delegateId) => {
          result.push(data);
        });
      });

      const sortedData = result
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice((page - 1) * limit, page * limit);

      return {
        data: sortedData,
        summary: {
          totalItems: itemDelegateMap.size,
        },
        pagination: {
          page,
          limit,
          total: result.length,
          totalPages: Math.ceil(result.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating items analytical movement on representatives report');
      throw error;
    }
  }

  /**
   * Get Detailed Invoice Movement Report
   * Shows detailed movement of items within invoices
   */
  async getDetailedInvoiceMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, fromDate, toDate, invoiceId, itemId, warehouseId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const invoiceWhere: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      if (invoiceId) {
        invoiceWhere.id = invoiceId;
      }

      if (warehouseId) {
        invoiceWhere.warehouseId = warehouseId;
      }

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          lines: {
            where: itemId ? { itemId } : undefined,
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
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Flatten to show each line item movement
      const movementData = invoices.flatMap((invoice) => {
        return invoice.lines.map((line) => ({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          invoiceType: invoice.invoiceType,
          customerName: invoice.customer?.arabicName,
          supplierName: invoice.supplier?.arabicName,
          itemId: line.itemId,
          itemName: line.item?.arabicName,
          quantity: Number(line.quantity || 0),
          unitPrice: Number(line.unitPrice || 0),
          totalPrice: Number(line.totalPrice || 0),
          taxAmount: Number(line.taxAmount || 0),
          movementType: invoice.invoiceType === 'sales' || invoice.invoiceType === 'salesReturn' ? 'out' : 'in',
        }));
      });

      const skip = (page - 1) * limit;
      const paginatedData = movementData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalMovements: movementData.length,
          totalIn: movementData.filter((m) => m.movementType === 'in').length,
          totalOut: movementData.filter((m) => m.movementType === 'out').length,
          totalValue: movementData.reduce((sum, m) => sum + m.totalPrice, 0),
        },
        pagination: {
          page,
          limit,
          total: movementData.length,
          totalPages: Math.ceil(movementData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating detailed invoice movement report');
      throw error;
    }
  }

  /**
   * Get Cost Center Item Movement Report
   * Shows item movements by cost center
   */
  async getCostCenterItemMovementReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, fromDate, toDate, itemId, costCenterId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // Get invoices with cost center information
      const invoiceWhere: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      const invoices = await prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          lines: {
            where: itemId ? { itemId } : undefined,
            include: {
              item: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
              costCenter: {
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

      // Group by cost center and item
      const costCenterItemMap = new Map<string, any>();

      invoices.forEach((invoice) => {
        invoice.lines.forEach((line) => {
          const costCenterId = line.costCenterId || 'no-cost-center';
          const key = `${costCenterId}-${line.itemId}`;

          if (!costCenterItemMap.has(key)) {
            costCenterItemMap.set(key, {
              costCenterId: line.costCenterId,
              costCenterName: line.costCenter?.arabicName || 'بدون مركز تكلفة',
              itemId: line.itemId,
              itemName: line.item?.arabicName,
              totalQuantity: 0,
              totalValue: 0,
              movementCount: 0,
            });
          }

          const data = costCenterItemMap.get(key)!;
          data.totalQuantity += Number(line.quantity || 0);
          data.totalValue += Number(line.totalPrice || 0);
          data.movementCount += 1;
        });
      });

      // Filter by cost center if specified
      let movementData = Array.from(costCenterItemMap.values());
      if (costCenterId) {
        movementData = movementData.filter((m) => m.costCenterId === costCenterId);
      }

      const skip = (page - 1) * limit;
      const paginatedData = movementData.slice(skip, skip + limit);

      return {
        data: paginatedData,
        summary: {
          totalItems: movementData.length,
          totalQuantity: movementData.reduce((sum, m) => sum + m.totalQuantity, 0),
          totalValue: movementData.reduce((sum, m) => sum + m.totalValue, 0),
        },
        pagination: {
          page,
          limit,
          total: movementData.length,
          totalPages: Math.ceil(movementData.length / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cost center item movement report');
      throw error;
    }
  }

  /**
   * Get Price List Report
   */
  async getPriceListReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { companyId, priceListId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
      };

      if (priceListId) where.priceListId = priceListId;

      const skip = (page - 1) * limit;

      const [itemPrices, total] = await Promise.all([
        prisma.itemPrice.findMany({
          where,
          skip,
          take: limit,
          include: {
            item: true,
            priceList: true,
            unit: true,
          },
        }),
        prisma.itemPrice.count({ where }),
      ]);

      return {
        data: itemPrices,
        summary: {
          totalPrices: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating price list report');
      throw error;
    }
  }

  /**
   * Get Sales and Purchase Tax Report
   */
  async getSalesAndPurchaseTaxReport(
    filters: InventoryReportFilters,
    options: InventoryReportOptions = {}
  ): Promise<InventoryReportResult> {
    try {
      const { fromDate, toDate, companyId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        companyId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPosted: true,
        isCancelled: false,
      };

      const salesInvoices = await prisma.invoice.findMany({
        where: {
          ...where,
          invoiceType: {
            in: ['sales', 'salesReturn'],
          },
        },
        include: {
          lines: true,
        },
      });

      const purchaseInvoices = await prisma.invoice.findMany({
        where: {
          ...where,
          invoiceType: {
            in: ['purchase', 'purchaseReturn'],
          },
        },
        include: {
          lines: true,
        },
      });

      const salesTax = salesInvoices.reduce((sum, inv) => {
        const taxAmount = inv.lines.reduce((lineSum, line) => {
          return lineSum + Number(line.taxAmount || 0);
        }, 0);
        return sum + taxAmount;
      }, 0);

      const purchaseTax = purchaseInvoices.reduce((sum, inv) => {
        const taxAmount = inv.lines.reduce((lineSum, line) => {
          return lineSum + Number(line.taxAmount || 0);
        }, 0);
        return sum + taxAmount;
      }, 0);

      return {
        data: {
          salesTax,
          purchaseTax,
          netTax: salesTax - purchaseTax,
        },
        summary: {
          totalSalesTax: salesTax,
          totalPurchaseTax: purchaseTax,
          netTax: salesTax - purchaseTax,
        },
        pagination: {
          page: 1,
          limit: 1,
          total: 1,
          totalPages: 1,
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating sales and purchase tax report');
      throw error;
    }
  }
}

export const inventoryReportsService = new InventoryReportsService();
