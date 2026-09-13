import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';

export interface CreateExtractData {
  projectId: string;
  contractorId?: string;
  extractNumber?: string;
  extractDate: Date;
  statementType?: 'partial' | 'final';
  statement?: string;
  extractType?: 'contractor' | 'owner' | 'self-execution';
  items: Array<{
    workItemId?: string;
    buildingId?: string;
    unitNumber?: string;
    modelNumber?: string;
    groupCode?: string;
    groupName?: string;
    itemNumber?: string;
    itemName: string;
    quantity: number;
    unit?: string;
    unitPrice?: number;
    totalPrice?: number;
    notes?: string;
  }>;
  notes?: string;
}

export class ExtractService {
  async createExtract(companyId: string, data: CreateExtractData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Calculate totals
      const totalValue = data.items.reduce(
        (sum, item) => sum + (item.totalPrice || item.unitPrice || 0) * item.quantity,
        0
      );

      const extract = await prisma.extract.create({
        data: {
          projectId: data.projectId,
          contractorId: data.contractorId,
          extractNumber: data.extractNumber,
          extractDate: data.extractDate,
          statementType: data.statementType || 'partial',
          statement: data.statement,
          extractType: data.extractType || 'contractor',
          totalValue: new Decimal(totalValue),
          notes: data.notes,
          items: {
            create: data.items.map((item) => ({
              workItemId: item.workItemId,
              buildingId: item.buildingId,
              unitNumber: item.unitNumber,
              modelNumber: item.modelNumber,
              groupCode: item.groupCode,
              groupName: item.groupName,
              itemNumber: item.itemNumber,
              itemName: item.itemName,
              quantity: new Decimal(item.quantity),
              unit: item.unit,
              unitPrice: item.unitPrice ? new Decimal(item.unitPrice) : null,
              totalPrice: item.totalPrice
                ? new Decimal(item.totalPrice)
                : item.unitPrice
                ? new Decimal(item.unitPrice * item.quantity)
                : null,
              notes: item.notes,
            })),
          },
        },
        include: {
          project: true,
          contractor: true,
          items: {
            include: {
              workItem: true,
              building: true,
            },
          },
        },
      });

      logger.info({ companyId, extractId: extract.id }, 'Extract created');
      return extract;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating extract');
      throw error;
    }
  }

  async listExtracts(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      projectId?: string;
      contractorId?: string;
      extractType?: string;
      statementType?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        project: { companyId },
      };

      if (options.projectId) where.projectId = options.projectId;
      if (options.contractorId) where.contractorId = options.contractorId;
      if (options.extractType) where.extractType = options.extractType;
      if (options.statementType) where.statementType = options.statementType;
      if (options.fromDate || options.toDate) {
        where.extractDate = {};
        if (options.fromDate) where.extractDate.gte = options.fromDate;
        if (options.toDate) where.extractDate.lte = options.toDate;
      }

      const [extracts, total] = await Promise.all([
        prisma.extract.findMany({
          where,
          skip,
          take: limit,
          orderBy: { extractDate: 'desc' },
          include: {
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            contractor: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            _count: {
              select: {
                items: true,
                payments: true,
              },
            },
          },
        }),
        prisma.extract.count({ where }),
      ]);

      return {
        extracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing extracts');
      throw error;
    }
  }

  async getExtractById(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
          contractor: true,
          items: {
            include: {
              workItem: true,
              building: true,
            },
          },
          payments: {
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      return extract;
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error getting extract');
      throw error;
    }
  }

  async updateExtract(companyId: string, id: string, data: Partial<CreateExtractData>) {
    try {
      const existing = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Extract not found');
      }

      // Wave 2 fix: `isPosted` previously did nothing at all — a "posted"
      // extract could still be freely edited or deleted. This module has no
      // GL integration (see postExtract), so `isPosted` is a workflow lock
      // only, not an accounting post — but it must actually lock the record.
      if (existing.isPosted) {
        throw new Error('Cannot update a posted extract. Unpost it first.');
      }
      if (existing.isCancelled) {
        throw new Error('Cannot update a cancelled extract.');
      }

      const updateData: any = {};

      if (data.extractDate) updateData.extractDate = data.extractDate;
      if (data.statementType) updateData.statementType = data.statementType;
      if (data.statement !== undefined) updateData.statement = data.statement;
      if (data.extractType) updateData.extractType = data.extractType;
      if (data.notes !== undefined) updateData.notes = data.notes;

      if (data.items) {
        // Delete existing items and create new ones
        await prisma.extractItem.deleteMany({
          where: { extractId: id },
        });

        updateData.items = {
          create: data.items.map((item) => ({
            workItemId: item.workItemId,
            buildingId: item.buildingId,
            unitNumber: item.unitNumber,
            modelNumber: item.modelNumber,
            groupCode: item.groupCode,
            groupName: item.groupName,
            itemNumber: item.itemNumber,
            itemName: item.itemName,
            quantity: new Decimal(item.quantity),
            unit: item.unit,
            unitPrice: item.unitPrice ? new Decimal(item.unitPrice) : null,
            totalPrice: item.totalPrice
              ? new Decimal(item.totalPrice)
              : item.unitPrice
              ? new Decimal(item.unitPrice * item.quantity)
              : null,
            notes: item.notes,
          })),
        };

        // Recalculate total
        const totalValue = data.items.reduce(
          (sum, item) => sum + (item.totalPrice || item.unitPrice || 0) * item.quantity,
          0
        );
        updateData.totalValue = new Decimal(totalValue);
      }

      const extract = await prisma.extract.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
          contractor: true,
          items: {
            include: {
              workItem: true,
              building: true,
            },
          },
        },
      });

      logger.info({ companyId, extractId: id }, 'Extract updated');
      return extract;
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error updating extract');
      throw error;
    }
  }

  async deleteExtract(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      if (extract.isPosted) {
        throw new Error('Cannot delete a posted extract. Unpost it first.');
      }

      await prisma.extract.delete({
        where: { id },
      });

      logger.info({ companyId, extractId: id }, 'Extract deleted');
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error deleting extract');
      throw error;
    }
  }

  /**
   * Marks the extract's quantities/statement as confirmed and locks it against
   * further edits. This module has no GL integration anywhere (creating an
   * `ExtractPayment` doesn't post a journal entry either), so — per the Wave 2
   * "real journal entry or no isPosted flag" rule — `isPosted` here is a pure
   * workflow lock, never an accounting post. It must not be read as evidence
   * that anything hit the ledger.
   */
  async postExtract(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      if (extract.isCancelled) {
        throw new Error('Cannot post a cancelled extract');
      }

      if (extract.isPosted) {
        throw new Error('Extract is already posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, extract.extractDate);

      const updated = await prisma.extract.update({
        where: { id },
        data: { isPosted: true },
      });

      logger.info({ companyId, extractId: id }, 'Extract posted (workflow lock, no GL effect)');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error posting extract');
      throw error;
    }
  }

  /** Reverses the workflow lock set by postExtract. */
  async unpostExtract(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      if (!extract.isPosted) {
        throw new Error('Extract is not posted');
      }

      await fiscalYearService.assertOpenForDate(companyId, extract.extractDate);

      const updated = await prisma.extract.update({
        where: { id },
        data: { isPosted: false },
      });

      logger.info({ companyId, extractId: id }, 'Extract unposted');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error unposting extract');
      throw error;
    }
  }

  async cancelExtract(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      if (extract.isPosted) {
        throw new Error('Cannot cancel a posted extract. Unpost it first.');
      }

      const updated = await prisma.extract.update({
        where: { id },
        data: { isCancelled: true, isPosted: false },
      });

      logger.info({ companyId, extractId: id }, 'Extract cancelled');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, extractId: id }, 'Error cancelling extract');
      throw error;
    }
  }
}

export const extractService = new ExtractService();

