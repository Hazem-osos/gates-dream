// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceM5Service } from '../../invoices/services/invoice-m5.service';
import { conversionStatus, remainingSourceBaseQty } from '../../invoices/services/invoice-line-source.service';

export interface PriceQuoteLine {
  itemId: string;
  unitId: string;
  baseUnitId?: string; // Base unit for conversion
  quantity: number;
  baseQuantity: number; // Converted to base unit
  unitPrice: number;
  total: number;
  discountPercentage?: number;
  discountValue?: number;
  taxPercentage?: number;
  taxValue?: number;
  netTotal: number; // After discount and tax
}

export interface CreatePriceQuoteData {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  quoteNumber?: string;
  date: string;
  customerId: string;
  warehouseId?: string;
  currencyId?: string;
  exchangeRate?: number;
  paymentMethod?: 'cash' | 'credit';
  isSalesTaxInvoice?: boolean;
  delegateId?: string;
  costCenterId?: string;
  conditions?: string[]; // Quote conditions (الشروط)
  validUntil?: string; // Quote expiration date
  lines: PriceQuoteLine[];
}

export class PriceQuoteService {
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
   * Create price quote entry
   */
  async createPriceQuote(companyId: string, data: CreatePriceQuoteData) {
    try {
      // Validate customer belongs to company
      const customer = await prisma.customer.findFirst({
        where: { id: data.customerId, companyId },
      });

      if (!customer) {
        throw new Error('العميل غير موجود أو لا يتبع الشركة');
      }

      // Validate warehouse if provided
      if (data.warehouseId) {
        const warehouse = await prisma.warehouse.findFirst({
          where: { id: data.warehouseId, companyId },
        });

        if (!warehouse) {
          throw new Error('المخزن غير موجود أو لا يتبع الشركة');
        }
      }

      // Validate currency if provided
      if (data.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: data.currencyId, companyId },
        });

        if (!currency) {
          throw new Error('العملة غير موجودة أو لا تتبع الشركة');
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
        throw new Error('أحد الأصناف غير موجود أو لا يتبع الشركة');
      }

      // Use transaction to ensure atomicity
      const priceQuote = await prisma.$transaction(async (tx) => {
        // Calculate totals for each line and quote
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

        const quoteNumber =
          data.quoteNumber?.trim() ||
          (await documentSequenceService.nextNumberForFamilyInTx(tx, {
            companyId,
            branchId: data.branchId ?? null,
            fiscalYearId: null,
            docType: 'QUOTE',
            legacySuffix: 'QT01',
            seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
              const rows = await tx.priceQuote.findMany({
                where: { companyId },
                select: { quoteNumber: true },
              });
              return rows.map((r) => r.quoteNumber);
            }),
            isAvailable: async (candidate) => {
              const taken = await tx.priceQuote.findFirst({
                where: { companyId, quoteNumber: candidate },
                select: { id: true },
              });
              return !taken;
            },
          })) ||
          null;

        // Create price quote record
        const record = await tx.priceQuote.create({
          data: {
            companyId,
            branchId: data.branchId || null,
            description: data.description || null,
            serial: data.serial || null,
            quoteNumber,
            date: new Date(data.date),
            customerId: data.customerId,
            warehouseId: data.warehouseId || null,
            currencyId: data.currencyId || null,
            exchangeRate: data.exchangeRate || null,
            paymentMethod: data.paymentMethod || 'credit',
            isSalesTaxInvoice: data.isSalesTaxInvoice || false,
            delegateId: data.delegateId || null,
            costCenterId: data.costCenterId || null,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            totalAmount,
            totalDiscount,
            totalTax,
            netAmount,
            isPosted: false,
            isApproved: false,
            isCancelled: false,
            isConverted: false,
          },
        });

        // Create quote conditions if provided
        if (data.conditions && data.conditions.length > 0) {
          for (const condition of data.conditions) {
            await tx.priceQuoteCondition.create({
              data: {
                priceQuoteId: record.id,
                condition: condition,
              },
            });
          }
        }

        // Create price quote lines
        const lines = [];
        for (const lineData of data.lines) {
          const { total, discountValue, taxValue, netTotal } = this.calculateLineTotal(
            lineData.quantity,
            lineData.unitPrice,
            lineData.discountPercentage,
            lineData.taxPercentage
          );

          const baseQty = lineData.baseQuantity || lineData.quantity;

          const line = await tx.priceQuoteLine.create({
            data: {
              priceQuoteId: record.id,
              itemId: lineData.itemId,
              unitId: lineData.unitId,
              baseUnitId: lineData.baseUnitId || null,
              quantity: lineData.quantity,
              baseQuantity: baseQty,
              unitPrice: lineData.unitPrice,
              total,
              discountPercentage: lineData.discountPercentage || null,
              discountValue: discountValue || 0,
              taxPercentage: lineData.taxPercentage || null,
              taxValue: taxValue || 0,
              netTotal,
            },
          });
          lines.push(line);
        }

        return {
          ...record,
          lines,
          conditions: data.conditions || [],
        };
      });

      logger.info(
        {
          companyId,
          priceQuoteId: priceQuote.id,
          customerId: data.customerId,
          linesCount: data.lines.length,
        },
        'Price quote created'
      );

      return priceQuote;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating price quote');
      throw error;
    }
  }

  /**
   * Replace header, lines, and conditions of an unposted quote.
   */
  async updatePriceQuote(companyId: string, priceQuoteId: string, data: CreatePriceQuoteData) {
    const existing = await prisma.priceQuote.findFirst({
      where: { id: priceQuoteId, companyId },
    });
    if (!existing) throw new Error('عرض السعر غير موجود');
    if (existing.isPosted) throw new Error('لا يمكن تعديل عرض سعر مرحّل');
    if (existing.isConverted) throw new Error('لا يمكن تعديل عرض سعر تم تحويله');
    if (existing.isCancelled) throw new Error('لا يمكن تعديل عرض سعر ملغى');

    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, companyId },
    });
    if (!customer) throw new Error('العميل غير موجود');

    const itemIds = data.lines.map((line) => line.itemId);
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds }, companyId },
    });
    if (items.length !== itemIds.length) throw new Error('أحد الأصناف غير موجود');

    return prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let netAmount = 0;
      for (const lineData of data.lines) {
        const parts = this.calculateLineTotal(
          lineData.quantity,
          lineData.unitPrice,
          lineData.discountPercentage,
          lineData.taxPercentage
        );
        totalAmount += parts.total;
        totalDiscount += parts.discountValue || 0;
        totalTax += parts.taxValue || 0;
        netAmount += parts.netTotal;
      }

      await tx.priceQuoteLine.deleteMany({ where: { priceQuoteId } });
      await tx.priceQuoteCondition.deleteMany({ where: { priceQuoteId } });

      const record = await tx.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          description: data.description || null,
          date: new Date(data.date),
          customerId: data.customerId,
          warehouseId: data.warehouseId || null,
          currencyId: data.currencyId || null,
          exchangeRate: data.exchangeRate || null,
          paymentMethod: data.paymentMethod || 'credit',
          isSalesTaxInvoice: data.isSalesTaxInvoice || false,
          delegateId: data.delegateId || null,
          costCenterId: data.costCenterId || null,
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          totalAmount,
          totalDiscount,
          totalTax,
          netAmount,
        },
      });

      if (data.conditions && data.conditions.length > 0) {
        for (const condition of data.conditions) {
          await tx.priceQuoteCondition.create({
            data: { priceQuoteId, condition },
          });
        }
      }

      const lines = [];
      for (const lineData of data.lines) {
        const parts = this.calculateLineTotal(
          lineData.quantity,
          lineData.unitPrice,
          lineData.discountPercentage,
          lineData.taxPercentage
        );
        const line = await tx.priceQuoteLine.create({
          data: {
            priceQuoteId,
            itemId: lineData.itemId,
            unitId: lineData.unitId,
            baseUnitId: lineData.baseUnitId || null,
            quantity: lineData.quantity,
            baseQuantity: lineData.baseQuantity || lineData.quantity,
            unitPrice: lineData.unitPrice,
            total: parts.total,
            discountPercentage: lineData.discountPercentage || null,
            discountValue: parts.discountValue || 0,
            taxPercentage: lineData.taxPercentage || null,
            taxValue: parts.taxValue || 0,
            netTotal: parts.netTotal,
          },
        });
        lines.push(line);
      }

      return { ...record, lines, conditions: data.conditions || [] };
    });
  }

  /**
   * Get price quote by ID
   */
  async getPriceQuoteById(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
        include: {
          customer: {
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
          delegate: {
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

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      return priceQuote;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error getting price quote');
      throw error;
    }
  }

  /**
   * List price quote entries
   */
  async listPriceQuotes(
    companyId: string,
    options?: {
      branchId?: string;
      customerId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
      isConverted?: boolean;
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

      if (options?.customerId) {
        where.customerId = options.customerId;
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

      if (options?.isConverted !== undefined) {
        where.isConverted = options.isConverted;
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

      const [quotes, total] = await Promise.all([
        prisma.priceQuote.findMany({
          where,
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
        prisma.priceQuote.count({ where }),
      ]);

      return {
        data: quotes,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing price quotes');
      throw error;
    }
  }

  /**
   * Post price quote (mark as posted)
   */
  async postPriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (priceQuote.isCancelled) {
        throw new Error('Cannot post cancelled price quote');
      }

      if (priceQuote.isPosted) {
        throw new Error('Price quote is already posted');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isPosted: true,
          postedAt: new Date(),
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote posted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error posting price quote');
      throw error;
    }
  }

  /**
   * Unpost price quote
   */
  async unpostPriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (!priceQuote.isPosted) {
        throw new Error('Price quote is not posted');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isPosted: false,
          postedAt: null,
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote unposted');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error unposting price quote');
      throw error;
    }
  }

  /**
   * Approve price quote
   */
  async approvePriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (purchaseOrder.isCancelled) {
        throw new Error('Cannot approve cancelled price quote');
      }

      if (priceQuote.isApproved) {
        throw new Error('Price quote is already approved');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isApproved: true,
          approvedAt: new Date(),
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote approved');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error approving price quote');
      throw error;
    }
  }

  /**
   * Unapprove price quote
   */
  async unapprovePriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (!priceQuote.isApproved) {
        throw new Error('Price quote is not approved');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isApproved: false,
          approvedAt: null,
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote unapproved');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error unapproving price quote');
      throw error;
    }
  }

  /**
   * Cancel price quote
   */
  async cancelPriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (priceQuote.isCancelled) {
        throw new Error('Price quote is already cancelled');
      }

      if (priceQuote.isConverted) {
        throw new Error('Cannot cancel converted price quote');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote cancelled');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error cancelling price quote');
      throw error;
    }
  }

  /**
   * Restore cancelled price quote
   */
  async restorePriceQuote(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
      });

      if (!priceQuote) {
        throw new Error('Price quote not found');
      }

      if (!priceQuote.isCancelled) {
        throw new Error('Price quote is not cancelled');
      }

      const updated = await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          isCancelled: false,
          cancelledAt: null,
        },
      });

      logger.info({ companyId, priceQuoteId }, 'Price quote restored');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error restoring price quote');
      throw error;
    }
  }

  /**
   * Convert price quote to sales invoice
   * This creates a sales invoice based on the price quote
   */
  async convertToInvoice(companyId: string, priceQuoteId: string) {
    try {
      const priceQuote = await prisma.priceQuote.findFirst({
        where: {
          id: priceQuoteId,
          companyId,
        },
        include: {
          lines: true,
          customer: true,
          warehouse: true,
        },
      });

      if (!priceQuote) {
        throw new AppError(404, 'عرض السعر غير موجود');
      }

      if (priceQuote.isCancelled) {
        throw new AppError(422, 'لا يمكن تحويل عرض سعر ملغي');
      }

      if (!priceQuote.warehouseId) {
        throw new AppError(422, 'حدد مخزن عرض السعر قبل التحويل');
      }

      const lines = [];
      let orderedTotal = 0;
      let usedTotal = 0;
      for (const quoteLine of priceQuote.lines) {
        const ordered = Number(quoteLine.baseQuantity ?? quoteLine.quantity);
        const remaining = await remainingSourceBaseQty(prisma, companyId, 'PRICE_QUOTE', quoteLine.id, ordered);
        orderedTotal += ordered;
        usedTotal += ordered - remaining;
        if (remaining <= 0) continue;
        const displayQty = Number(quoteLine.quantity);
        const ratio = ordered > 0 ? displayQty / ordered : 1;
        lines.push({
          itemId: quoteLine.itemId,
          unitId: quoteLine.unitId ?? undefined,
          quantity: remaining * ratio,
          baseQuantity: remaining,
          price: Number(quoteLine.unitPrice ?? 0),
          discountPercent: quoteLine.discountPercentage != null ? Number(quoteLine.discountPercentage) : undefined,
          discountAmount: quoteLine.discountValue != null ? Number(quoteLine.discountValue) : undefined,
          taxPercent: quoteLine.taxPercentage != null ? Number(quoteLine.taxPercentage) : undefined,
          taxAmount: quoteLine.taxValue != null ? Number(quoteLine.taxValue) : undefined,
          lineOrder: lines.length + 1,
          sourceKind: 'PRICE_QUOTE',
          sourceLineId: quoteLine.id,
        });
      }
      if (!lines.length) {
        throw new AppError(422, 'عرض السعر مكتمل ولا توجد كمية متبقية للتحويل');
      }

      let currencyCode = 'EGP';
      if (priceQuote.currencyId) {
        const currency = await prisma.currency.findFirst({
          where: { id: priceQuote.currencyId },
          select: { code: true },
        });
        currencyCode = currency?.code || 'EGP';
      }

      const invoice = await invoiceM5Service.create(
        companyId,
        priceQuote.branchId ?? undefined,
        undefined,
        {
          invoiceKind: 'SALE',
          date: new Date(),
          customerId: priceQuote.customerId,
          warehouseId: priceQuote.warehouseId,
          currencyCode,
          exchangeRate: 1,
          representativeId: priceQuote.delegateId || undefined,
          costCenterId: priceQuote.costCenterId || undefined,
          paymentMethod: priceQuote.paymentMethod || undefined,
          isSalesTaxInvoice: priceQuote.isSalesTaxInvoice || false,
          description: `فاتورة من عرض سعر ${priceQuote.serial || priceQuote.id}`,
          lines,
        },
      );

      const convertedNow = lines.reduce((sum, line) => sum + line.baseQuantity, 0);
      const status = conversionStatus(orderedTotal, usedTotal + convertedNow);
      await prisma.priceQuote.update({
        where: { id: priceQuoteId },
        data: {
          invoiceId: invoice.id,
          isConverted: status === 'مكتمل',
          convertedAt: new Date(),
        },
      });

      logger.info({ companyId, priceQuoteId, invoiceId: invoice.id, status }, 'Price quote converted to invoice');

      return { ...invoice, conversionStatus: status };
      return invoice;
    } catch (error) {
      logger.error({ error, companyId, priceQuoteId }, 'Error converting price quote to invoice');
      throw error;
    }
  }
}

export const priceQuoteService = new PriceQuoteService();

