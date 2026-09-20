// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import { logger } from '../../../shared/logger';
import { stockMovementService } from './stock-movement.service';

export interface PurchaseReturnLine {
  itemId: string;
  unitId: string;
  locationId?: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  total: number;
  discountPercentage?: number;
  discountValue?: number;
  taxPercentage?: number;
  taxValue?: number;
  netTotal: number;
  originalInvoiceLineId?: string; // Reference to original purchase invoice line
}

export interface CreatePurchaseReturnData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  returnNumber?: string;
  date: string;
  originalInvoiceId?: string; // Reference to original purchase invoice
  supplierId: string;
  warehouseId: string;
  currencyId?: string;
  exchangeRate?: number;
  paymentMethod?: 'cash' | 'credit';
  costCenterId?: string;
  delegateId?: string;
  lines: PurchaseReturnLine[];
}

export class PurchaseReturnService {
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
   * Create purchase return entry
   */
  async createPurchaseReturn(companyId: string, data: CreatePurchaseReturnData) {
    try {
      // Validate supplier belongs to company
      const supplier = await prisma.supplier.findFirst({
        where: { id: data.supplierId, companyId },
      });

      if (!supplier) {
        throw new Error('Supplier not found or does not belong to company');
      }

      // Validate warehouse belongs to company
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });

      if (!warehouse) {
        throw new Error('Warehouse not found or does not belong to company');
      }

      // Validate original invoice if provided
      if (data.originalInvoiceId) {
        const originalInvoice = await prisma.invoice.findFirst({
          where: {
            id: data.originalInvoiceId,
            companyId,
            invoiceType: 'purchase',
          },
        });

        if (!originalInvoice) {
          throw new Error(
            'Original purchase invoice not found or does not belong to company'
          );
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

      // Get current quantities to validate returns
      const itemQuantities = await prisma.itemQuantity.findMany({
        where: scopedItemQuantityWhere(companyId, {
          itemId: { in: itemIds },
          warehouseId: data.warehouseId,
        }),
      });

      // Use transaction to ensure atomicity
      const purchaseReturn = await prisma.$transaction(async (tx) => {
        // Validate quantities for returns
        for (const line of data.lines) {
          const existingQuantity = itemQuantities.find(
            (iq) =>
              iq.itemId === line.itemId &&
              iq.warehouseId === data.warehouseId &&
              (iq.locationId || null) === (line.locationId || null)
          );

          const availableQty = existingQuantity ? Number(existingQuantity.quantity) : 0;

          if (availableQty < line.quantity) {
            throw new Error(
              `Insufficient quantity for return on item ${line.itemId}. Available: ${availableQty}, Required: ${line.quantity}`
            );
          }
        }

        // Calculate totals for each line and return
        let totalAmount = 0;
        let totalDiscount = 0;
        let totalTax = 0;
        let netAmount = 0;

        for (const lineData of data.lines) {
          const { total, discountValue, taxValue, netTotal } = this.calculateLineTotal(
            lineData.quantity,
            lineData.unitPrice,
            lineData.discountPercentage,
            lineData.taxPercentage
          );

          totalAmount += total;
          totalDiscount += discountValue || 0;
          totalTax += taxValue || 0;
          netAmount += netTotal;
        }

        // Create purchase return record
        const record = await tx.purchaseReturn.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            returnNumber: data.returnNumber || null,
            date: new Date(data.date),
            originalInvoiceId: data.originalInvoiceId || null,
            supplierId: data.supplierId,
            warehouseId: data.warehouseId,
            currencyId: data.currencyId || null,
            exchangeRate: data.exchangeRate || null,
            paymentMethod: data.paymentMethod || 'credit',
            costCenterId: data.costCenterId || null,
            delegateId: data.delegateId || null,
            totalAmount,
            totalDiscount,
            totalTax,
            netAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create purchase return lines
        const lines = [];
        for (const lineData of data.lines) {
          const { total, discountValue, taxValue, netTotal } = this.calculateLineTotal(
            lineData.quantity,
            lineData.unitPrice,
            lineData.discountPercentage,
            lineData.taxPercentage
          );

          const line = await tx.purchaseReturnLine.create({
            data: {
              purchaseReturnId: record.id,
              itemId: lineData.itemId,
              unitId: lineData.unitId,
              locationId: lineData.locationId || null,
              quantity: lineData.quantity,
              baseQuantity: lineData.baseQuantity,
              unitPrice: lineData.unitPrice,
              total,
              discountPercentage: lineData.discountPercentage || null,
              discountValue: discountValue || 0,
              taxPercentage: lineData.taxPercentage || null,
              taxValue: taxValue || 0,
              netTotal,
              originalInvoiceLineId: lineData.originalInvoiceLineId || null,
            },
          });
          lines.push(line);
        }

        return {
          ...record,
          lines,
        };
      });

      logger.info(
        {
          companyId,
          purchaseReturnId: purchaseReturn.id,
          supplierId: data.supplierId,
          linesCount: data.lines.length,
        },
        'Purchase return created'
      );

      return purchaseReturn;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating purchase return');
      throw error;
    }
  }

  /**
   * Get purchase return by ID
   */
  async getPurchaseReturnById(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
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
          originalInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              date: true,
            },
          },
          costCenter: {
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
                  code: true,
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
              location: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                  englishName: true,
                },
              },
            },
          },
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      return purchaseReturn;
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error getting purchase return');
      throw error;
    }
  }

  /**
   * List purchase return entries
   */
  async listPurchaseReturns(
    companyId: string,
    options?: {
      branchId?: string;
      supplierId?: string;
      warehouseId?: string;
      originalInvoiceId?: string;
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

      if (options?.originalInvoiceId) {
        where.originalInvoiceId = options.originalInvoiceId;
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

      const [returns, total] = await Promise.all([
        prisma.purchaseReturn.findMany({
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
                    code: true,
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
        prisma.purchaseReturn.count({ where }),
      ]);

      return {
        data: returns,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing purchase returns');
      throw error;
    }
  }

  /**
   * Post purchase return (apply inventory and supplier balance changes)
   */
  async postPurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
        include: {
          lines: true,
          supplier: true,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (purchaseReturn.isCancelled) {
        throw new Error('Cannot post cancelled purchase return');
      }

      if (purchaseReturn.isPosted) {
        throw new Error('Purchase return is already posted');
      }

      // H1 fix: route the quantity mutation through stockMovementService
      // (row lock + InventoryMovement audit row + negative-stock guard)
      // instead of an unlocked read-modify-write on item_quantities.
      const sourceType = 'PRT';
      const sourceNumber = purchaseReturn.serial ?? purchaseReturn.id.slice(0, 8);
      const sourceYearId = String(new Date(purchaseReturn.date).getFullYear());

      // Use transaction to update quantities and supplier balance atomically
      await prisma.$transaction(async (tx) => {
        // Decrease quantities for each line (reverse of purchase)
        for (const line of purchaseReturn.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: purchaseReturn.branchId ?? undefined,
            warehouseId: purchaseReturn.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            // H2 fix: use baseQuantity (stock-unit) not display-unit quantity
            quantityDelta: -Number(line.baseQuantity),
            unitCost: Number(line.unitPrice),
            movementType: sourceType,
            sourceType,
            sourceNumber,
            sourceYearId,
            documentDate: purchaseReturn.date,
          });
        }

        // Decrease supplier balance (reverse of purchase invoice)
        await tx.supplier.update({
          where: { id: purchaseReturn.supplierId },
          data: {
            balance: {
              decrement: purchaseReturn.netAmount,
            },
          },
        });

        // Mark purchase return as posted
        await tx.purchaseReturn.update({
          where: { id: purchaseReturnId },
          data: {
            isPosted: true,
            postedAt: new Date(),
          },
        });
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return posted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error posting purchase return');
      throw error;
    }
  }

  /**
   * Unpost purchase return (reverse inventory and supplier balance changes)
   */
  async unpostPurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
        include: {
          lines: true,
          supplier: true,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (!purchaseReturn.isPosted) {
        throw new Error('Purchase return is not posted');
      }

      const sourceType = 'PRT';
      const sourceNumber = purchaseReturn.serial ?? purchaseReturn.id.slice(0, 8);
      const sourceYearId = String(new Date(purchaseReturn.date).getFullYear());

      // Use transaction to reverse adjustments atomically
      await prisma.$transaction(async (tx) => {
        // Increase quantities back for each line
        for (const line of purchaseReturn.lines) {
          await stockMovementService.postMovementInTx(tx, {
            companyId,
            branchId: purchaseReturn.branchId ?? undefined,
            warehouseId: purchaseReturn.warehouseId,
            itemId: line.itemId,
            locationId: line.locationId ?? null,
            quantityDelta: Number(line.quantity),
            movementType: `${sourceType}-UNPOST`,
            sourceType: `${sourceType}-UNPOST`,
            sourceNumber,
            sourceYearId,
            documentDate: purchaseReturn.date,
          });
        }

        // Increase supplier balance back
        await tx.supplier.update({
          where: { id: purchaseReturn.supplierId },
          data: {
            balance: {
              increment: purchaseReturn.netAmount,
            },
          },
        });

        // Mark purchase return as unposted
        await tx.purchaseReturn.update({
          where: { id: purchaseReturnId },
          data: {
            isPosted: false,
            postedAt: null,
          },
        });
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return unposted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error unposting purchase return');
      throw error;
    }
  }

  /**
   * Approve purchase return
   */
  async approvePurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (purchaseReturn.isCancelled) {
        throw new Error('Cannot approve cancelled purchase return');
      }

      if (purchaseReturn.isApproved) {
        throw new Error('Purchase return is already approved');
      }

      const updated = await prisma.purchaseReturn.update({
        where: { id: purchaseReturnId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return approved');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error approving purchase return');
      throw error;
    }
  }

  /**
   * Unapprove purchase return
   */
  async unapprovePurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (!purchaseReturn.isApproved) {
        throw new Error('Purchase return is not approved');
      }

      const updated = await prisma.purchaseReturn.update({
        where: { id: purchaseReturnId },
        data: {
          isApproved: false,
          approvedAt: null,
        },
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return unapproved');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error unapproving purchase return');
      throw error;
    }
  }

  /**
   * Cancel purchase return
   */
  async cancelPurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (purchaseReturn.isCancelled) {
        throw new Error('Purchase return is already cancelled');
      }

      if (purchaseReturn.isPosted) {
        throw new Error('Cannot cancel posted purchase return. Unpost it first.');
      }

      const updated = await prisma.purchaseReturn.update({
        where: { id: purchaseReturnId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error cancelling purchase return');
      throw error;
    }
  }

  /**
   * Restore cancelled purchase return
   */
  async restorePurchaseReturn(companyId: string, purchaseReturnId: string) {
    try {
      const purchaseReturn = await prisma.purchaseReturn.findFirst({
        where: {
          id: purchaseReturnId,
          companyId,
        },
      });

      if (!purchaseReturn) {
        throw new Error('Purchase return not found');
      }

      if (!purchaseReturn.isCancelled) {
        throw new Error('Purchase return is not cancelled');
      }

      const updated = await prisma.purchaseReturn.update({
        where: { id: purchaseReturnId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, purchaseReturnId }, 'Purchase return restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, purchaseReturnId }, 'Error restoring purchase return');
      throw error;
    }
  }
}

export const purchaseReturnService = new PurchaseReturnService();

