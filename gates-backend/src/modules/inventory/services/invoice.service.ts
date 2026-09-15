// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import type { InvoicePostingContext } from '../../invoices/types/invoice-posting.types';
import { invoicePostingOrchestrator } from '../../invoices/services/invoice-posting-orchestrator';
import { resolveDefaultInvoicePostingContext } from '../../invoices/services/invoice-posting-context';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import {
  invoiceKindFromLegacyType,
  invoiceSequenceDocType,
  resolveInvoiceModule,
  shouldAutoPostOnSave,
} from '../../invoices/services/invoice-document-type';
import { applyFullTextIds, findFullTextIds } from '../../../shared/database/fulltext-search';
import { assertUpdateCount } from '../../../shared/concurrency/optimistic-lock';
import { journalPostingService } from '../../accounting/services/journal-posting.service';

export interface InvoiceLineData {
  itemId: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  price: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent?: number;
  taxAmount?: number;
  lineOrder: number;
}

export interface CreateInvoiceData {
  invoiceNumber?: string;
  invoiceType: 'sales' | 'purchase' | 'return';
  newModuleId?: string;
  moduleCode?: string;
  date: Date;
  hijriDate?: string;
  description?: string;
  currencyCode: string;
  customerId?: string;
  supplierId?: string;
  warehouseId?: string;
  costCenterId?: string;
  representativeId?: string;
  paymentMethod?: string;
  sellerId?: string;
  isSalesTaxInvoice?: boolean;
  allowReturn?: boolean;
  returnDays?: number;
  record?: string | null;
  conditions?: string[];
  lines: InvoiceLineData[];
}

export interface UpdateInvoiceData {
  invoiceNumber?: string;
  date?: Date;
  hijriDate?: string;
  description?: string;
  currencyCode?: string;
  customerId?: string;
  supplierId?: string;
  warehouseId?: string;
  costCenterId?: string;
  representativeId?: string;
  paymentMethod?: string;
  sellerId?: string;
  isSalesTaxInvoice?: boolean;
  allowReturn?: boolean;
  returnDays?: number;
  record?: string | null;
  conditions?: string[];
  lines?: InvoiceLineData[];
  expectedVersion?: number;
}

export class InvoiceService {
  /**
   * Calculate invoice totals from lines
   */
  private calculateTotals(lines: InvoiceLineData[]): {
    totalAmount: number;
    discountAmount: number;
    taxAmount: number;
    netAmount: number;
  } {
    let totalAmount = 0;
    let discountAmount = 0;
    let taxAmount = 0;

    for (const line of lines) {
      const lineTotal = line.quantity * line.price;
      const lineDiscount =
        line.discountAmount ||
        (line.discountPercent ? (lineTotal * line.discountPercent) / 100 : 0);
      const lineAfterDiscount = lineTotal - lineDiscount;
      const lineTax =
        line.taxAmount ||
        (line.taxPercent ? (lineAfterDiscount * line.taxPercent) / 100 : 0);

      totalAmount += lineTotal;
      discountAmount += lineDiscount;
      taxAmount += lineTax;
    }

    const netAmount = totalAmount - discountAmount + taxAmount;

    return {
      totalAmount,
      discountAmount,
      taxAmount,
      netAmount,
    };
  }

  /**
   * Validate invoice data
   */
  private validateInvoice(data: CreateInvoiceData | UpdateInvoiceData): void {
    if (data.lines && data.lines.length === 0) {
      throw new Error('Invoice must have at least 1 line item');
    }

    if (data.lines) {
      for (const line of data.lines) {
        if (line.quantity <= 0) {
          throw new Error('Line quantity must be greater than 0');
        }
        if (line.price < 0) {
          throw new Error('Line price cannot be negative');
        }
        if (line.baseQuantity <= 0) {
          throw new Error('Base quantity must be greater than 0');
        }
      }
    }

    // Validate invoice type requirements
    if ('invoiceType' in data) {
      if (data.invoiceType === 'sales' && !data.customerId) {
        throw new Error('Sales invoice requires a customer');
      }
      if (data.invoiceType === 'purchase' && !data.supplierId) {
        throw new Error('Purchase invoice requires a supplier');
      }
      if (!data.warehouseId) {
        throw new Error('Invoice requires a warehouse');
      }
    }
  }

  /**
   * Create a new invoice with lines
   */
  async createInvoice(companyId: string, data: CreateInvoiceData) {
    try {
      // Validate invoice data
      this.validateInvoice(data);

      // Legacy `GetPeriod` runs on save, so a draft cannot be dated into a
      // closed period/year or before the posting-lock cutoff.
      await fiscalYearService.assertOpenForDate(companyId, data.date);

      // Calculate totals
      const totals = this.calculateTotals(data.lines);
      const kind = invoiceKindFromLegacyType(data.invoiceType);
      const module = await resolveInvoiceModule(companyId, kind, {
        newModuleId: data.newModuleId,
        moduleCode: data.moduleCode,
      });

      // Use transaction to ensure atomicity
      const invoice = await prisma.$transaction(async (tx) => {
        // Same `CreateInvoiceNum` allocation the M5 create path uses — this
        // older screen previously stored whatever number the client sent, or
        // NULL, so two creators of the same entity numbered differently.
        const invoiceNumber =
          data.invoiceNumber?.trim() ||
          (await documentSequenceService.nextNumberForFamilyInTx(tx, {
            companyId,
            branchId: null,
            fiscalYearId: null,
            docType: invoiceSequenceDocType(kind),
            legacySuffix: module.moduleCode,
            seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
              const rows = await tx.invoice.findMany({
                where: { companyId, invoiceType: data.invoiceType },
                select: { invoiceNumber: true },
              });
              return rows.map((r) => r.invoiceNumber);
            }),
            isAvailable: async (candidate) => {
              const taken = await tx.invoice.findFirst({
                where: { companyId, invoiceNumber: candidate },
                select: { id: true },
              });
              return !taken;
            },
          }));
        if (!invoiceNumber) {
          throw new Error('رقم الفاتورة مطلوب — الترقيم يدوي لهذا النوع من المستندات');
        }

        // Create invoice
        const inv = await tx.invoice.create({
          data: {
            companyId,
            invoiceNumber,
            invoiceType: data.invoiceType,
            invoiceKind: kind,
            moduleCode: module.moduleCode,
            newModuleId: module.newModuleId,
            date: data.date,
            hijriDate: data.hijriDate,
            description: data.description,
            currencyCode: data.currencyCode,
            customerId: data.customerId,
            supplierId: data.supplierId,
            warehouseId: data.warehouseId,
            costCenterId: data.costCenterId,
            representativeId: data.representativeId,
            paymentMethod: data.paymentMethod,
            sellerId: data.sellerId,
            isSalesTaxInvoice: data.isSalesTaxInvoice || false,
            allowReturn: data.allowReturn || false,
            returnDays: data.returnDays,
            record: data.record,
            totalAmount: new Decimal(totals.totalAmount),
            discountAmount: new Decimal(totals.discountAmount),
            taxAmount: new Decimal(totals.taxAmount),
            netAmount: new Decimal(totals.netAmount),
            paidAmount: new Decimal(0),
            remainingAmount: new Decimal(totals.netAmount),
            isPosted: false,
            isApproved: false,
            isCancelled: false,
          },
        });

        // Create invoice lines
        await tx.invoiceLine.createMany({
          data: data.lines.map((line) => {
            const lineTotal = line.quantity * line.price;
            const lineDiscount =
              line.discountAmount ||
              (line.discountPercent
                ? (lineTotal * line.discountPercent) / 100
                : 0);
            const lineAfterDiscount = lineTotal - lineDiscount;
            const lineTax =
              line.taxAmount ||
              (line.taxPercent
                ? (lineAfterDiscount * line.taxPercent) / 100
                : 0);

            return {
              invoiceId: inv.id,
              itemId: line.itemId,
              unitId: line.unitId,
              quantity: new Decimal(line.quantity),
              baseQuantity: new Decimal(line.baseQuantity),
              price: new Decimal(line.price),
              total: new Decimal(lineTotal),
              discountPercent: line.discountPercent
                ? new Decimal(line.discountPercent)
                : null,
              discountAmount: line.discountAmount
                ? new Decimal(line.discountAmount)
                : lineDiscount > 0
                  ? new Decimal(lineDiscount)
                  : null,
              taxPercent: line.taxPercent
                ? new Decimal(line.taxPercent)
                : null,
              taxAmount: line.taxAmount
                ? new Decimal(line.taxAmount)
                : lineTax > 0
                  ? new Decimal(lineTax)
                  : null,
              lineOrder: line.lineOrder,
            };
          }),
        });

        // Create conditions if provided
        if (data.conditions && data.conditions.length > 0) {
          await tx.invoiceCondition.createMany({
            data: data.conditions.map((condition) => ({
              invoiceId: inv.id,
              condition: condition,
            })),
          });
        }

        // Fetch with relations
        return tx.invoice.findUnique({
          where: { id: inv.id },
          include: {
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
              orderBy: { lineOrder: 'asc' },
            },
          },
        });
      });

      logger.info({ companyId, invoiceId: invoice!.id }, 'Invoice created');

      if (invoice && (await shouldAutoPostOnSave(companyId, module.moduleCode))) {
        const ctx = await resolveDefaultInvoicePostingContext(companyId);
        await invoicePostingOrchestrator.post(ctx, invoice.id);
        return this.getInvoiceById(companyId, invoice.id);
      }

      return invoice;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating invoice');
      throw error;
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(companyId: string, invoiceId: string) {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          companyId,
        },
        include: {
          customer: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              balance: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              balance: true,
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
            },
            orderBy: { lineOrder: 'asc' },
          },
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      return invoice;
    } catch (error) {
      logger.error({ error, companyId, invoiceId }, 'Error getting invoice');
      throw error;
    }
  }

  /**
   * List invoices with pagination and filters
   */
  async listInvoices(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      invoiceType?: string;
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
      supplierId?: string;
      warehouseId?: string;
      isPosted?: boolean;
      isApproved?: boolean;
      isCancelled?: boolean;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
      };

      if (options.search) {
        const ftIds = await findFullTextIds('invoices', companyId, options.search);
        const scoped = applyFullTextIds(where, ftIds);
        if (scoped === 'empty') {
          return {
            invoices: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          };
        }
      }

      if (options.invoiceType) {
        where.invoiceType = options.invoiceType;
      }

      if (options.startDate || options.endDate) {
        where.date = {};
        if (options.startDate) where.date.gte = options.startDate;
        if (options.endDate) where.date.lte = options.endDate;
      }

      if (options.customerId) {
        where.customerId = options.customerId;
      }

      if (options.supplierId) {
        where.supplierId = options.supplierId;
      }

      if (options.warehouseId) {
        where.warehouseId = options.warehouseId;
      }

      if (options.isPosted !== undefined) {
        where.isPosted = options.isPosted;
      }

      if (options.isApproved !== undefined) {
        where.isApproved = options.isApproved;
      }

      if (options.isCancelled !== undefined) {
        where.isCancelled = options.isCancelled;
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          include: {
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
                    arabicName: true,
                  },
                },
              },
              orderBy: { lineOrder: 'asc' },
              take: 5, // Limit lines for listing
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        invoices,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing invoices');
      throw error;
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(
    companyId: string,
    invoiceId: string,
    data: UpdateInvoiceData
  ) {
    try {
      const existing = await prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
        include: { lines: true },
      });

      if (!existing) {
        throw new Error('Invoice not found');
      }

      if (existing.isPosted) {
        throw new Error('Cannot update a posted invoice');
      }

      if (existing.isCancelled) {
        throw new Error('Cannot update a cancelled invoice');
      }

      // Neither the stored date nor a new one may sit in a locked period.
      await fiscalYearService.assertOpenForDate(companyId, existing.date);
      if (data.date) {
        await fiscalYearService.assertOpenForDate(companyId, data.date);
      }

      // Validate invoice data if lines are being updated
      if (data.lines) {
        this.validateInvoice(data);
      }

      // Use transaction to ensure atomicity
      const invoice = await prisma.$transaction(async (tx) => {
        // Calculate totals if lines are being updated
        let totals = {
          totalAmount: Number(existing.totalAmount),
          discountAmount: Number(existing.discountAmount),
          taxAmount: Number(existing.taxAmount),
          netAmount: Number(existing.netAmount),
        };

        if (data.lines) {
          totals = this.calculateTotals(data.lines);
        }

        // Update invoice
        const updateData: any = {};
        if (data.invoiceNumber !== undefined)
          updateData.invoiceNumber = data.invoiceNumber;
        if (data.date !== undefined) updateData.date = data.date;
        if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
        if (data.description !== undefined)
          updateData.description = data.description;
        if (data.currencyCode !== undefined)
          updateData.currencyCode = data.currencyCode;
        if (data.customerId !== undefined) updateData.customerId = data.customerId;
        if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
        if (data.warehouseId !== undefined)
          updateData.warehouseId = data.warehouseId;
        if (data.costCenterId !== undefined)
          updateData.costCenterId = data.costCenterId;
        if (data.representativeId !== undefined)
          updateData.representativeId = data.representativeId;
        if (data.paymentMethod !== undefined)
          updateData.paymentMethod = data.paymentMethod;
        if (data.sellerId !== undefined) updateData.sellerId = data.sellerId;
        if (data.isSalesTaxInvoice !== undefined)
          updateData.isSalesTaxInvoice = data.isSalesTaxInvoice;
        if (data.allowReturn !== undefined)
          updateData.allowReturn = data.allowReturn;
        if (data.returnDays !== undefined)
          updateData.returnDays = data.returnDays;

        // Update totals if lines changed
        if (data.lines) {
          updateData.totalAmount = new Decimal(totals.totalAmount);
          updateData.discountAmount = new Decimal(totals.discountAmount);
          updateData.taxAmount = new Decimal(totals.taxAmount);
          updateData.netAmount = new Decimal(totals.netAmount);
          updateData.remainingAmount = new Decimal(
            totals.netAmount - Number(existing.paidAmount)
          );
        }

        const updateResult = await tx.invoice.updateMany({
          where: {
            id: invoiceId,
            companyId,
            version: data.expectedVersion ?? existing.version,
          },
          data: {
            ...updateData,
            version: { increment: 1 },
          },
        });
        assertUpdateCount(updateResult.count);

        // If lines are being updated, delete old lines and create new ones
        if (data.lines) {
          await tx.invoiceLine.deleteMany({
            where: { invoiceId },
          });

          await tx.invoiceLine.createMany({
            data: data.lines.map((line) => {
              const lineTotal = line.quantity * line.price;
              const lineDiscount =
                line.discountAmount ||
                (line.discountPercent
                  ? (lineTotal * line.discountPercent) / 100
                  : 0);
              const lineAfterDiscount = lineTotal - lineDiscount;
              const lineTax =
                line.taxAmount ||
                (line.taxPercent
                  ? (lineAfterDiscount * line.taxPercent) / 100
                  : 0);

              return {
                invoiceId,
                itemId: line.itemId,
                unitId: line.unitId,
                quantity: new Decimal(line.quantity),
                baseQuantity: new Decimal(line.baseQuantity),
                price: new Decimal(line.price),
                total: new Decimal(lineTotal),
                discountPercent: line.discountPercent
                  ? new Decimal(line.discountPercent)
                  : null,
                discountAmount: line.discountAmount
                  ? new Decimal(line.discountAmount)
                  : lineDiscount > 0
                    ? new Decimal(lineDiscount)
                    : null,
                taxPercent: line.taxPercent
                  ? new Decimal(line.taxPercent)
                  : null,
                taxAmount: line.taxAmount
                  ? new Decimal(line.taxAmount)
                  : lineTax > 0
                    ? new Decimal(lineTax)
                    : null,
                lineOrder: line.lineOrder,
              };
            }),
          });
        }

        // Fetch with relations
        return tx.invoice.findUnique({
          where: { id: invoiceId },
          include: {
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
              orderBy: { lineOrder: 'asc' },
            },
          },
        });
      });

      logger.info({ companyId, invoiceId }, 'Invoice updated');
      return invoice;
    } catch (error) {
      logger.error(
        { error, companyId, invoiceId, data },
        'Error updating invoice'
      );
      throw error;
    }
  }

  /**
   * Post invoice — delegates to InvoicePostingOrchestrator (single source of truth).
   */
  async postInvoice(
    companyId: string,
    invoiceId: string,
    postingCtx?: InvoicePostingContext
  ) {
    try {
      const ctx =
        postingCtx ?? (await resolveDefaultInvoicePostingContext(companyId));
      const result = await invoicePostingOrchestrator.post(ctx, invoiceId);
      logger.info({ companyId, invoiceId }, 'Invoice posted via orchestrator');
      return result.invoice;
    } catch (error) {
      logger.error({ error, companyId, invoiceId }, 'Error posting invoice');
      throw error;
    }
  }

  /**
   * Unpost invoice — delegates to InvoicePostingOrchestrator.
   */
  async unpostInvoice(
    companyId: string,
    invoiceId: string,
    postingCtx?: InvoicePostingContext
  ) {
    try {
      const ctx =
        postingCtx ?? (await resolveDefaultInvoicePostingContext(companyId));
      const invoice = await invoicePostingOrchestrator.unpost(ctx, invoiceId);
      logger.info({ companyId, invoiceId }, 'Invoice unposted via orchestrator');
      return invoice;
    } catch (error) {
      logger.error({ error, companyId, invoiceId }, 'Error unposting invoice');
      throw error;
    }
  }

  /**
   * Approve invoice
   */
  async approveInvoice(companyId: string, invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.isApproved) {
      throw new Error('Invoice is already approved');
    }

    if (invoice.isCancelled) {
      throw new Error('Cannot approve a cancelled invoice');
    }

    if (!invoice.isPosted) {
      throw new Error('Invoice must be posted before approval');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { isApproved: true },
    });

    logger.info({ companyId, invoiceId }, 'Invoice approved');
    return updated;
  } catch (error) {
    logger.error({ error, companyId, invoiceId }, 'Error approving invoice');
    throw error;
  }
}

/**
 * Unapprove invoice
 */
async unapproveInvoice(companyId: string, invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.isApproved) {
      throw new Error('Invoice is not approved');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { isApproved: false },
    });

    logger.info({ companyId, invoiceId }, 'Invoice unapproved');
    return updated;
  } catch (error) {
    logger.error({ error, companyId, invoiceId }, 'Error unapproving invoice');
    throw error;
  }
}

/**
 * Cancel invoice
 */
async cancelInvoice(companyId: string, invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.isCancelled) {
      throw new Error('Invoice is already cancelled');
    }

    if (invoice.isPosted) {
      throw new Error(
        'Cannot cancel a posted invoice. Unpost it first, or create a return invoice.'
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [invoice.journalEntryId, invoice.costJournalEntryId],
        'cancel',
        undefined,
        { sourceId: invoice.id, sourceNumber: invoice.invoiceNumber ?? undefined }
      );
      return tx.invoice.update({
        where: { id: invoiceId },
        data: { isCancelled: true },
      });
    });

    logger.info({ companyId, invoiceId }, 'Invoice cancelled');
    return updated;
  } catch (error) {
    logger.error({ error, companyId, invoiceId }, 'Error cancelling invoice');
    throw error;
  }
}

/**
 * Restore invoice (undo cancel)
 */
async restoreInvoice(companyId: string, invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.isCancelled) {
      throw new Error('Invoice is not cancelled');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { isCancelled: false },
    });

    logger.info({ companyId, invoiceId }, 'Invoice restored');
    return updated;
  } catch (error) {
    logger.error({ error, companyId, invoiceId }, 'Error restoring invoice');
    throw error;
  }
}

/**
 * Collect payment for invoice
 */
async collectPayment(
  companyId: string,
  invoiceId: string,
  paymentAmount: number
) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (!invoice.isPosted) {
      throw new Error('Invoice must be posted before collecting payment');
    }

    if (invoice.isCancelled) {
      throw new Error('Cannot collect payment for a cancelled invoice');
    }

    const currentPaid = Number(invoice.paidAmount);
    const netAmount = Number(invoice.netAmount);
    const newPaid = currentPaid + paymentAmount;

    if (newPaid > netAmount) {
      throw new Error(
        `Payment amount (${paymentAmount}) exceeds invoice net amount (${netAmount})`
      );
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: new Decimal(newPaid),
        remainingAmount: new Decimal(netAmount - newPaid),
      },
    });

    logger.info(
      { companyId, invoiceId, paymentAmount, newPaid },
      'Payment collected for invoice'
    );
    return updated;
  } catch (error) {
    logger.error(
      { error, companyId, invoiceId, paymentAmount },
      'Error collecting payment'
    );
    throw error;
  }
}

/**
 * Delete invoice (soft delete - cancel if not posted)
 */
async deleteInvoice(companyId: string, invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.isPosted) {
      throw new Error('Cannot delete a posted invoice');
    }

    await prisma.$transaction(async (tx) => {
      await journalPostingService.cascadeSourceJournalInTx(
        tx,
        companyId,
        [invoice.journalEntryId, invoice.costJournalEntryId],
        'cancel',
        undefined,
        { sourceId: invoice.id, sourceNumber: invoice.invoiceNumber ?? undefined }
      );
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { isCancelled: true },
      });
    });

    logger.info({ companyId, invoiceId }, 'Invoice deleted');
    return { success: true };
  } catch (error) {
    logger.error({ error, companyId, invoiceId }, 'Error deleting invoice');
    throw error;
  }
  }
}

export const invoiceService = new InvoiceService();
