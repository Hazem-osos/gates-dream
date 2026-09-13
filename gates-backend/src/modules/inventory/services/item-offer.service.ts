// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export type OfferHowType = 'additional-quantity' | 'discount-percentage' | 'invoice-value';
export type OfferType = 'purchases' | 'sales';
export type OfferSourceType = 'input-units' | 'suppliers' | 'customers' | 'all';

export interface CreateItemOfferData {
  companyId: string;
  branchId?: string;
  nameAr?: string;
  description?: string;
  serial?: string;
  how: OfferHowType;
  type: OfferType;
  source: OfferSourceType;
  fromItemId?: string;
  quantity: number;
  percentage?: number;
  offerQuantity?: number;
  toItemId?: string;
  invoiceValue?: number;
  supplierId?: string;
  unitId?: string;
  applyToAllParties?: boolean;
  applyToAllPatterns?: boolean;
  targetPartyIds?: string[];
  targetPatternIds?: string[];
  fromDate: string;
  toDate: string;
  fromDateHijri?: string;
  toDateHijri?: string;
  isActive?: boolean;
}

export class ItemOfferService {
  /**
   * Create item offer entry
   */
  async createItemOffer(companyId: string, data: CreateItemOfferData) {
    try {
      if (data.fromItemId) {
        const fromItem = await prisma.item.findFirst({
          where: { id: data.fromItemId, companyId },
        });
        if (!fromItem) {
          throw new Error('From item not found or does not belong to company');
        }
      } else if (data.how !== 'invoice-value') {
        throw new Error('From item is required for this offer type');
      }

      if (data.toItemId && data.how === 'additional-quantity') {
        const toItem = await prisma.item.findFirst({
          where: { id: data.toItemId, companyId },
        });
        if (!toItem) {
          throw new Error('Gift item not found or does not belong to company');
        }
      }

      if (data.supplierId) {
        const supplier = await prisma.supplier.findFirst({
          where: { id: data.supplierId, companyId },
        });
        if (!supplier) {
          throw new Error('Supplier not found or does not belong to company');
        }
      }

      // Validate date range
      const fromDate = new Date(data.fromDate);
      const toDate = new Date(data.toDate);

      if (fromDate > toDate) {
        throw new Error('From date must be before or equal to to date');
      }

      // Create item offer record
      const offer = await prisma.itemOffer.create({
        data: {
          companyId,
          branchId: data.branchId || null,
          nameAr: data.nameAr || null,
          description: data.description || null,
          serial: data.serial || null,
          how: data.how,
          type: data.type,
          source: data.source,
          fromItemId: data.fromItemId || null,
          quantity: data.quantity,
          percentage: data.percentage || null,
          offerQuantity: data.offerQuantity || null,
          toItemId: data.toItemId || null,
          invoiceValue: data.invoiceValue || null,
          supplierId: data.supplierId || null,
          unitId: data.unitId || null,
          applyToAllParties: data.applyToAllParties ?? true,
          applyToAllPatterns: data.applyToAllPatterns ?? true,
          targetPartyIds: data.targetPartyIds ?? [],
          targetPatternIds: data.targetPatternIds ?? [],
          fromDate,
          fromDateHijri: data.fromDateHijri || null,
          toDate,
          toDateHijri: data.toDateHijri || null,
          isActive: data.isActive ?? true,
        },
        include: {
          fromItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          toItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          sourceSupplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          sourceUnit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info(
        {
          companyId,
          offerId: offer.id,
          fromItemId: data.fromItemId,
          how: data.how,
          type: data.type,
        },
        'Item offer created'
      );

      return offer;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating item offer');
      throw error;
    }
  }

  /**
   * Get item offer by ID
   */
  async getItemOfferById(companyId: string, offerId: string) {
    try {
      const offer = await prisma.itemOffer.findFirst({
        where: {
          id: offerId,
          companyId,
        },
        include: {
          fromItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          toItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          sourceSupplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          sourceUnit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      if (!offer) {
        throw new Error('Item offer not found');
      }

      return offer;
    } catch (error) {
      logger.error({ error, companyId, offerId }, 'Error getting item offer');
      throw error;
    }
  }

  /**
   * List item offer entries
   */
  async listItemOffers(
    companyId: string,
    options?: {
      branchId?: string;
      how?: OfferHowType;
      type?: OfferType;
      source?: OfferSourceType;
      fromItemId?: string;
      isActive?: boolean;
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

      if (options?.how) {
        where.how = options.how;
      }

      if (options?.type) {
        where.type = options.type;
      }

      if (options?.source) {
        where.source = options.source;
      }

      if (options?.fromItemId) {
        where.fromItemId = options.fromItemId;
      }

      if (options?.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options?.fromDate || options?.toDate) {
        where.fromDate = {};
        if (options.fromDate) {
          where.fromDate.lte = new Date(options.fromDate);
        }
        if (options.toDate) {
          where.toDate = {};
          where.toDate.gte = new Date(options.toDate);
        }
      }

      const [offers, total] = await Promise.all([
        prisma.itemOffer.findMany({
          where,
          include: {
            fromItem: {
              select: {
                id: true,
                code: true,
                serial: true,
                arabicName: true,
              },
            },
            toItem: {
              select: {
                id: true,
                code: true,
                serial: true,
                arabicName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: options?.skip || 0,
          take: options?.take || 50,
        }),
        prisma.itemOffer.count({ where }),
      ]);

      return {
        data: offers,
        total,
        skip: options?.skip || 0,
        take: options?.take || 50,
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing item offers');
      throw error;
    }
  }

  /**
   * Update item offer
   */
  async updateItemOffer(
    companyId: string,
    offerId: string,
    data: Partial<CreateItemOfferData>
  ) {
    try {
      // Verify offer exists and belongs to company
      const existingOffer = await prisma.itemOffer.findFirst({
        where: {
          id: offerId,
          companyId,
        },
      });

      if (!existingOffer) {
        throw new Error('Item offer not found');
      }

      // Validate to item if provided (for additional-quantity type)
      if (data.toItemId && data.how === 'additional-quantity') {
        const toItem = await prisma.item.findFirst({
          where: { id: data.toItemId, companyId },
        });

        if (!toItem) {
          throw new Error('To item not found or does not belong to company');
        }
      }

      // Validate supplier if source is suppliers
      if (data.source === 'suppliers' && data.supplierId) {
        const supplier = await prisma.supplier.findFirst({
          where: { id: data.supplierId, companyId },
        });

        if (!supplier) {
          throw new Error('Supplier not found or does not belong to company');
        }
      }

      // Validate unit if source is input-units
      if (data.source === 'input-units' && data.unitId) {
        const unit = await prisma.unit.findFirst({
          where: { id: data.unitId, companyId },
        });

        if (!unit) {
          throw new Error('Unit not found or does not belong to company');
        }
      }

      // Build update data
      const updateData: any = {};

      if (data.nameAr !== undefined) {
        updateData.nameAr = data.nameAr;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.serial !== undefined) {
        updateData.serial = data.serial;
      }

      if (data.how !== undefined) {
        updateData.how = data.how;
      }

      if (data.type !== undefined) {
        updateData.type = data.type;
      }

      if (data.source !== undefined) {
        updateData.source = data.source;
      }

      if (data.fromItemId !== undefined) {
        updateData.fromItemId = data.fromItemId;
      }

      if (data.quantity !== undefined) {
        updateData.quantity = data.quantity;
      }

      if (data.percentage !== undefined) {
        updateData.percentage = data.percentage;
      }

      if (data.offerQuantity !== undefined) {
        updateData.offerQuantity = data.offerQuantity;
      }

      if (data.toItemId !== undefined) {
        updateData.toItemId = data.toItemId;
      }

      if (data.invoiceValue !== undefined) {
        updateData.invoiceValue = data.invoiceValue;
      }

      if (data.supplierId !== undefined) {
        updateData.supplierId = data.supplierId;
      }

      if (data.unitId !== undefined) {
        updateData.unitId = data.unitId;
      }

      if (data.applyToAllParties !== undefined) {
        updateData.applyToAllParties = data.applyToAllParties;
      }

      if (data.applyToAllPatterns !== undefined) {
        updateData.applyToAllPatterns = data.applyToAllPatterns;
      }

      if (data.targetPartyIds !== undefined) {
        updateData.targetPartyIds = data.targetPartyIds;
      }

      if (data.targetPatternIds !== undefined) {
        updateData.targetPatternIds = data.targetPatternIds;
      }

      if (data.fromDate !== undefined) {
        updateData.fromDate = new Date(data.fromDate);
      }

      if (data.fromDateHijri !== undefined) {
        updateData.fromDateHijri = data.fromDateHijri;
      }

      if (data.toDate !== undefined) {
        updateData.toDate = new Date(data.toDate);
      }

      if (data.toDateHijri !== undefined) {
        updateData.toDateHijri = data.toDateHijri;
      }

      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      // Validate date range if both dates are being updated
      if (updateData.fromDate && updateData.toDate) {
        if (updateData.fromDate > updateData.toDate) {
          throw new Error('From date must be before or equal to to date');
        }
      } else if (updateData.fromDate && existingOffer.toDate) {
        if (updateData.fromDate > existingOffer.toDate) {
          throw new Error('From date must be before or equal to to date');
        }
      } else if (updateData.toDate && existingOffer.fromDate) {
        if (existingOffer.fromDate > updateData.toDate) {
          throw new Error('From date must be before or equal to to date');
        }
      }

      const updated = await prisma.itemOffer.update({
        where: { id: offerId },
        data: updateData,
        include: {
          fromItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          toItem: {
            select: {
              id: true,
              code: true,
              serial: true,
              arabicName: true,
              englishName: true,
            },
          },
          sourceSupplier: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          sourceUnit: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, offerId }, 'Item offer updated');

      return updated;
    } catch (error) {
      logger.error({ error, companyId, offerId, data }, 'Error updating item offer');
      throw error;
    }
  }

  /**
   * Delete item offer
   */
  async deleteItemOffer(companyId: string, offerId: string) {
    try {
      // Verify offer exists and belongs to company
      const offer = await prisma.itemOffer.findFirst({
        where: {
          id: offerId,
          companyId,
        },
      });

      if (!offer) {
        throw new Error('Item offer not found');
      }

      await prisma.itemOffer.delete({
        where: { id: offerId },
      });

      logger.info({ companyId, offerId }, 'Item offer deleted');

      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, offerId }, 'Error deleting item offer');
      throw error;
    }
  }

  /**
   * Get applicable offers for an invoice line
   * This is used during invoice creation to check if any offers apply
   */
  async getApplicableOffers(
    companyId: string,
    itemId: string,
    quantity: number,
    invoiceType: 'purchases' | 'sales',
    supplierId?: string,
    unitId?: string,
    invoiceValue?: number,
    date?: Date,
    partyId?: string,
    patternId?: string
  ) {
    try {
      const currentDate = date || new Date();

      const andFilters: any[] = [
        { OR: [{ fromItemId: itemId }, { fromItemId: null, how: 'invoice-value' }] },
      ];
      if (invoiceValue !== undefined) {
        andFilters.push({
          OR: [
            { how: { not: 'invoice-value' } },
            { how: 'invoice-value', invoiceValue: { lte: invoiceValue } },
          ],
        });
      }

      const where: any = {
        companyId,
        type: invoiceType,
        isActive: true,
        fromDate: { lte: currentDate },
        toDate: { gte: currentDate },
        quantity: { lte: quantity },
        AND: andFilters,
      };

      const offers = await prisma.itemOffer.findMany({
        where,
        include: {
          fromItem: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          toItem: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
        orderBy: { quantity: 'desc' },
      });

      return offers.filter((offer) => {
        const parties = Array.isArray(offer.targetPartyIds) ? offer.targetPartyIds : [];
        const patterns = Array.isArray(offer.targetPatternIds) ? offer.targetPatternIds : [];
        const partyOk =
          offer.applyToAllParties ||
          !partyId ||
          parties.includes(partyId) ||
          (supplierId ? parties.includes(supplierId) : false);
        const patternOk = offer.applyToAllPatterns || !patternId || patterns.includes(patternId);
        const unitOk = !unitId || offer.applyToAllPatterns || offer.unitId === unitId;
        return partyOk && patternOk && unitOk;
      });
    } catch (error) {
      logger.error(
        { error, companyId, itemId, quantity, invoiceType },
        'Error getting applicable offers'
      );
      throw error;
    }
  }
}

export const itemOfferService = new ItemOfferService();

