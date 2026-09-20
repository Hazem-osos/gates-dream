import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { invoiceM5Service } from '../../invoices/services/invoice-m5.service';
import type { CreateM5InvoiceInput } from '../../invoices/schemas/invoice-m5.schema';
import { bulkCreateMany } from '../../../shared/database/bulk-write';
import { emitDomainEvent } from '../../automation/events/automation-event-bus.service';

export interface PurchaseOrderLine {
  itemId: string;
  unitId?: string;
  baseUnitId?: string; // Base unit for conversion
  quantity: number;
  baseQuantity?: number; // Converted to base unit
  unitPrice?: number;
  total?: number;
  discountPercentage?: number;
  discountValue?: number;
  taxPercentage?: number;
  taxValue?: number;
  netTotal?: number; // After discount and tax
}

export interface CreatePurchaseOrderData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  /** Set only by automation. Unique per company when present. */
  automationIdempotencyKey?: string | null;
  orderNumber?: string;
  date: string;
  supplierId: string;
  warehouseId?: string;
  currencyId?: string;
  exchangeRate?: number;
  conditions?: string[]; // Order conditions (الشروط)
  expectedDeliveryDate?: string;
  lines: PurchaseOrderLine[];
}

export class PurchaseOrderService {
  /**
   * Calculate line totals with discounts and taxes
   */
  private calculateLineTotal(
    quantity: number,
    unitPrice: number,
    discountPercentage?: number,
    taxPercentage?: number
  ): {
    total: number;
    discountValue: number;
    taxValue: number;
    netTotal: number;
  } {
    const subtotal = quantity * unitPrice;
    const discountValue = discountPercentage
      ? (subtotal * discountPercentage) / 100
      : 0;
    const afterDiscount = subtotal - discountValue;
    const taxValue = taxPercentage ? (afterDiscount * taxPercentage) / 100 : 0;
    const netTotal = afterDiscount + taxValue;

    return {
      total: subtotal,
      discountValue,
      taxValue,
      netTotal,
    };
  }

  /**
   * Create purchase order entry
   */
  async createPurchaseOrder(companyId: string, data: CreatePurchaseOrderData) {
    try {
      // Validate supplier belongs to company
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, companyId },
      });

      if (!supplier) {
        throw new Error('Supplier not found or does not belong to company');
      }

      // Validate warehouse if provided
      if (data.warehouseId) {
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: data.warehouseId, companyId },
        });

        if (!warehouse) {
          throw new Error('Warehouse not found or does not belong to company');
        }
      }

      // Validate currency if provided
      if (data.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: data.currencyId, companyId },
        });

        if (!currency) {
          throw new Error('Currency not found or does not belong to company');
        }
      }

      // Validate all items belong to company
      const itemIds = data.lines.map((line) => line.itemId);
      const items = await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          companyId,
        },
      });

      if (items.length !== itemIds.length) {
        throw new Error('One or more items not found or do not belong to company');
      }

      // Use transaction to ensure atomicity
      const purchaseOrder = await prisma.$transaction(async (tx) => {
        // Calculate totals for each line and order
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        let netAmount = 0;

        for (const lineData of data.lines) {
          const unitPrice = lineData.unitPrice || 0;
          const { total, discountValue, taxValue, netTotal } = this.calculateLineTotal(
            lineData.quantity,
            unitPrice,
            lineData.discountPercentage,
            lineData.taxPercentage
          );

          totalAmount += total;
          totalDiscount += discountValue;
          totalTax += taxValue;
          netAmount += netTotal;
        }

        // Legacy `CreatePKNum` numbers purchase orders; the web app accepted an
        // optional client string and otherwise stored NULL.
        const orderNumber =
          data.orderNumber?.trim() ||
          (await documentSequenceService.nextNumberForFamilyInTx(tx, {
            companyId,
            branchId: data.branchId ?? null,
            fiscalYearId: null,
            docType: 'PK',
            legacySuffix: 'PK01',
            seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
              const rows = await tx.purchaseOrder.findMany({
                where: { companyId },
                select: { orderNumber: true },
              });
              return rows.map((r) => r.orderNumber);
            }),
            isAvailable: async (candidate) => {
              const taken = await tx.purchaseOrder.findFirst({
                where: { companyId, orderNumber: candidate },
                select: { id: true },
              });
              return !taken;
            },
          })) ||
          null;

        // Create purchase order record
        const record = await tx.purchaseOrder.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            automationIdempotencyKey: data.automationIdempotencyKey?.trim() || null,
            orderNumber,
            date: new Date(data.date),
            supplierId: data.supplierId,
            warehouseId: data.warehouseId || null,
            currencyId: data.currencyId || null,
            exchangeRate: data.exchangeRate || null,
            expectedDeliveryDate: data.expectedDeliveryDate
              ? new Date(data.expectedDeliveryDate)
              : null,
            totalAmount,
            totalDiscount,
            totalTax,
            netAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        if (data.conditions && data.conditions.length > 0) {
          await bulkCreateMany(
            (args) => tx.purchaseOrderCondition.createMany(args),
            data.conditions.map((condition) => ({
              purchaseOrderId: record.id,
              condition,
            }))
          );
        }

        const lineRows = data.lines.map((lineData) => {
          const unitPrice = lineData.unitPrice || 0;
          const { total, discountValue, taxValue, netTotal } = this.calculateLineTotal(
            lineData.quantity,
            unitPrice,
            lineData.discountPercentage,
            lineData.taxPercentage
          );
          const baseQty = lineData.baseQuantity || lineData.quantity;
          return {
            purchaseOrderId: record.id,
            itemId: lineData.itemId,
            unitId: lineData.unitId || null,
            baseUnitId: lineData.baseUnitId || null,
            quantity: lineData.quantity,
            baseQuantity: baseQty,
            unitPrice,
            total,
            discountPercentage: lineData.discountPercentage || null,
            discountValue,
            taxPercentage: lineData.taxPercentage || null,
            taxValue,
            netTotal,
          };
        });
        await bulkCreateMany((args) => tx.purchaseOrderLine.createMany(args), lineRows);
        const lines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: record.id },
        });

        return {
          ...record,
          lines,
          conditions: data.conditions || [],
        };
      });

      logger.info(
        {
          companyId,
          purchaseOrderId: purchaseOrder.id,
          supplierId: data.supplierId,
          linesCount: data.lines.length,
        },
        'Purchase order created'
      );

      void emitDomainEvent({
        companyId,
        eventType: 'purchase.order.created',
        data: {
          purchaseOrderId: purchaseOrder.id,
          orderNumber: purchaseOrder.orderNumber ?? null,
          supplierId: data.supplierId,
          warehouseId: data.warehouseId ?? null,
          totalAmount: Number(purchaseOrder.totalAmount),
          netAmount: Number(purchaseOrder.netAmount),
          createdByAutomation: Boolean(data.automationIdempotencyKey),
        },
      });

      return purchaseOrder;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating purchase order');
      throw error;
    }
  }

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
        include: {
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          currency: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
              exchangeRate: true,
            },
          },
          lines: {
            include: {
              item: {
                select: {
                  id: true,
                  serial: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              unit: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
              baseUnit: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
          conditions: true,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      return purchaseOrder;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error getting purchase order');
      throw error;
    }
  }

  /**
   * List purchase order entries
   */
  async listPurchaseOrders(
    companyId: string,
    options?: {
      branchId?: string;
      supplierId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
      skip?: number;
      take?: number;
    }
  ) {
    try {
      const where: any = {
        companyId,
      };

      if (options?.branchId) {
        where.branchId = options.branchId;
      }

      if (options?.supplierId) {
        where.supplierId = options.supplierId;
      }

      if (options?.warehouseId) {
        where.warehouseId = options.warehouseId;
      }

      if (options?.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options?.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options?.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      if (options?.fromDate || options?.toDate) {
        where.date = {};
        if (options.fromDate) {
          where.date.gte = new Date(options.fromDate);
        }
        if (options.toDate) {
          where.date.lte = new Date(options.toDate);
        }
      }

      const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
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
              take: 5, // Limit lines in list view
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.purchaseOrder.count({ where }),
      ]);

      return {
        data: orders,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing purchase orders');
      throw error;
    }
  }

  /**
   * Post purchase order (mark as posted)
   */
  async postPurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.isCancelled) {
        throw new Error('Cannot post cancelled purchase order');
      }

      if (purchaseOrder.isPosted) {
        throw new Error('Purchase order is already posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, purchaseOrder.date);

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isPosted: true,
          postedAt: new Date(),
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order posted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error posting purchase order');
      throw error;
    }
  }

  /**
   * Unpost purchase order
   */
  async unpostPurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (!purchaseOrder.isPosted) {
        throw new Error('Purchase order is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, purchaseOrder.date);

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isPosted: false,
          postedAt: null,
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order unposted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error unposting purchase order');
      throw error;
    }
  }

  /**
   * Approve purchase order
   */
  async approvePurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.isCancelled) {
        throw new Error('Cannot approve cancelled purchase order');
      }

      if (purchaseOrder.isApproved) {
        throw new Error('Purchase order is already approved');
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order approved');

      void emitDomainEvent({
        companyId,
        eventType: 'purchase.order.approved',
        data: {
          purchaseOrderId: updated.id,
          orderNumber: updated.orderNumber ?? null,
          supplierId: updated.supplierId,
          netAmount: Number(updated.netAmount),
        },
      });

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error approving purchase order');
      throw error;
    }
  }

  /**
   * Unapprove purchase order
   */
  async unapprovePurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (!purchaseOrder.isApproved) {
        throw new Error('Purchase order is not approved');
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isApproved: false,
          approvedAt: null,
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order unapproved');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error unapproving purchase order');
      throw error;
    }
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.isCancelled) {
        throw new Error('Purchase order is already cancelled');
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error cancelling purchase order');
      throw error;
    }
  }

  /**
   * Restore cancelled purchase order
   */
  async restorePurchaseOrder(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (!purchaseOrder.isCancelled) {
        throw new Error('Purchase order is not cancelled');
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, purchaseOrderId }, 'Purchase order restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error restoring purchase order');
      throw error;
    }
  }

  /**
   * Convert purchase order to purchase invoice
   * This creates a purchase invoice based on the purchase order
   */
  /**
   * Wave 3 fix: this used to hand-write `invoice`/`invoiceLine` rows directly
   * with several non-existent Prisma fields (`discountPercentage`,
   * `discountValue`, `taxPercentage`, `taxValue`, `netTotal` — the real
   * columns are `discountPercent`/`discountAmount`/`taxPercent`/`taxAmount`,
   * and there's no `netTotal` column at all) and omitted required ones
   * (`unitId`, `baseQuantity`, `lineOrder`), so it only "worked" under this
   * file's `@ts-nocheck` and would fail at the database the moment it ran.
   * It also bypassed the M5 invoice pipeline entirely — no tax engine, no
   * numbering, no GL. Rewritten to go through `invoiceM5Service.create` like
   * every other document-to-invoice conversion, plus an already-converted
   * guard (a second call previously silently created a second invoice and
   * overwrote `invoiceId`).
   */
  async convertToInvoice(companyId: string, purchaseOrderId: string) {
    try {
      const purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: {
          id: purchaseOrderId,
          companyId,
        },
        include: {
          lines: true,
          supplier: true,
          warehouse: true,
        },
      });

      if (!purchaseOrder) {
        throw new Error('Purchase order not found');
      }

      if (purchaseOrder.isCancelled) {
        throw new Error('Cannot convert cancelled purchase order');
      }

      if (!purchaseOrder.isApproved) {
        throw new Error('Purchase order must be approved before converting to invoice');
      }

      if (purchaseOrder.invoiceId) {
        throw new Error('Purchase order was already converted to an invoice');
      }

      const lines = purchaseOrder.lines.map((orderLine, i) => ({
        itemId: orderLine.itemId,
        unitId: orderLine.unitId ?? undefined,
        quantity: Number(orderLine.quantity),
        baseQuantity: Number(orderLine.baseQuantity ?? orderLine.quantity),
        price: Number(orderLine.unitPrice ?? 0),
        discountPercent: orderLine.discountPercentage != null ? Number(orderLine.discountPercentage) : undefined,
        discountAmount: orderLine.discountValue != null ? Number(orderLine.discountValue) : undefined,
        taxPercent: orderLine.taxPercentage != null ? Number(orderLine.taxPercentage) : undefined,
        taxAmount: orderLine.taxValue != null ? Number(orderLine.taxValue) : undefined,
        lineOrder: i + 1,
      }));

      const invoice = await invoiceM5Service.create(
        companyId,
        purchaseOrder.branchId ?? undefined,
        undefined,
        {
          invoiceKind: 'PURCHASE',
          date: new Date(),
          supplierId: purchaseOrder.supplierId,
          warehouseId: purchaseOrder.warehouseId ?? undefined,
          exchangeRate: purchaseOrder.exchangeRate != null ? Number(purchaseOrder.exchangeRate) : undefined,
          description: `فاتورة مشتريات من أمر شراء ${purchaseOrder.orderNumber ?? purchaseOrder.id}`,
          lines,
        } as CreateM5InvoiceInput,
      );

      await prisma.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { invoiceId: invoice!.id },
      });

      logger.info(
        { companyId, purchaseOrderId, invoiceId: invoice!.id },
        'Purchase order converted to invoice'
      );

      return invoice;
    } catch (error) {
      logger.error({ error, companyId, purchaseOrderId }, 'Error converting purchase order to invoice');
      throw error;
    }
  }
}

export const purchaseOrderService = new PurchaseOrderService();

