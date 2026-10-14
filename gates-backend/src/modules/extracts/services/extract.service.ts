import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  aggregatePreviousWorkItemQuantities,
  attachRemainingQuantity,
  computeExtractLines,
  type ExtractLineInput,
  type WorkItemForExtract,
} from '../utils/extract-statement.util';

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
  async previewExtract(companyId: string, data: CreateExtractData) {
    const computed = await this.computeStatement(companyId, data, null);
    return {
      previousWorkTotal: computed.previousWorkTotal,
      previousExtractCount: computed.previousExtractCount,
      totalValue: computed.totalValue,
      items: computed.lines,
    };
  }

  async createExtract(companyId: string, data: CreateExtractData) {
    try {
      const computed = await this.computeStatement(companyId, data, null);

      const extract = await prisma.$transaction(async (tx) => {
        await this.assertUniqueExtractNumber(
          tx,
          data.projectId,
          data.extractNumber,
          null
        );
        return tx.extract.create({
          data: {
            projectId: data.projectId,
            contractorId: data.contractorId,
            extractNumber: data.extractNumber,
            extractDate: data.extractDate,
            statementType: data.statementType || 'partial',
            statement: data.statement,
            extractType: data.extractType || 'contractor',
            totalValue: new Decimal(computed.totalValue),
            previousWorkTotal: new Decimal(computed.previousWorkTotal),
            previousExtractCount: computed.previousExtractCount,
            notes: data.notes,
            items: {
              create: computed.lines.map((item) => ({
                workItemId: item.workItemId,
                buildingId: item.buildingId,
                unitNumber: item.unitNumber,
                modelNumber: item.modelNumber,
                groupCode: item.groupCode,
                groupName: item.groupName,
                itemNumber: item.itemNumber,
                itemName: item.itemName,
                quantity: new Decimal(item.currentQuantity),
                previousQuantity: new Decimal(item.previousQuantity),
                cumulativeQuantity: new Decimal(item.cumulativeQuantity),
                unit: item.unit,
                unitPrice: item.unitPrice != null ? new Decimal(item.unitPrice) : null,
                totalPrice: item.totalPrice != null ? new Decimal(item.totalPrice) : null,
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
      });

      logger.info({ companyId, extractId: extract.id }, 'Extract created');
      return { ...extract, items: attachRemainingQuantity(extract.items) };
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating extract');
      this.rethrow(error);
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

      return { ...extract, items: attachRemainingQuantity(extract.items) };
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
      // extract could still be freely edited or deleted. Legacy post no longer
      // flips this flag (see postExtract); keep the lock for any historical rows.
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
        const computed = await this.computeStatement(
          companyId,
          {
            ...data,
            projectId: existing.projectId,
            extractDate: data.extractDate ?? existing.extractDate,
            extractType:
              data.extractType ??
              (existing.extractType as CreateExtractData['extractType']),
            contractorId: data.contractorId ?? existing.contractorId ?? undefined,
            items: data.items as CreateExtractData['items'],
          },
          id
        );
        updateData.items = {
          deleteMany: {},
          create: computed.lines.map((item) => ({
            workItemId: item.workItemId,
            buildingId: item.buildingId,
            unitNumber: item.unitNumber,
            modelNumber: item.modelNumber,
            groupCode: item.groupCode,
            groupName: item.groupName,
            itemNumber: item.itemNumber,
            itemName: item.itemName,
            quantity: new Decimal(item.currentQuantity),
            previousQuantity: new Decimal(item.previousQuantity),
            cumulativeQuantity: new Decimal(item.cumulativeQuantity),
            unit: item.unit,
            unitPrice: item.unitPrice != null ? new Decimal(item.unitPrice) : null,
            totalPrice: item.totalPrice != null ? new Decimal(item.totalPrice) : null,
            notes: item.notes,
          })),
        };
        updateData.totalValue = new Decimal(computed.totalValue);
        updateData.previousWorkTotal = new Decimal(computed.previousWorkTotal);
        updateData.previousExtractCount = computed.previousExtractCount;
      }

      if (data.extractNumber !== undefined) {
        await this.assertUniqueExtractNumber(
          prisma,
          existing.projectId,
          data.extractNumber,
          id
        );
        updateData.extractNumber = data.extractNumber;
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
      return { ...extract, items: attachRemainingQuantity(extract.items) };
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
   * Legacy `/extracts` has no journal posting. Real GL lives on contracting
   * extracts (`/contracting/extracts`). Never flip `isPosted` here — that would
   * tell users a document posted when nothing hit the ledger.
   */
  async postExtract(_companyId: string, _id: string): Promise<never> {
    throw new AppError(400, 'المستخلص يُرحّل من شاشة المقاولات');
  }

  /**
   * Clears a historical workflow lock only. There is no GL reverse — legacy
   * post never wrote a journal. Prefer contracting extracts for real posting.
   */
  async unpostExtract(companyId: string, id: string) {
    try {
      const extract = await prisma.extract.findFirst({
        where: { id, project: { companyId } },
      });

      if (!extract) {
        throw new Error('Extract not found');
      }

      if (!extract.isPosted) {
        throw new AppError(400, 'المستخلص يُرحّل من شاشة المقاولات');
      }

      const updated = await prisma.extract.update({
        where: { id },
        data: { isPosted: false },
      });

      logger.info(
        { companyId, extractId: id },
        'Legacy extract unlock (no GL reverse; post path removed)'
      );
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

  private async computeStatement(
    companyId: string,
    data: CreateExtractData,
    excludeExtractId: string | null
  ) {
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, companyId },
    });
    if (!project) throw new AppError(404, 'Project not found');

    const workRows = await prisma.projectWorkItem.findMany({
      where: { projectId: data.projectId },
      select: {
        id: true,
        parentId: true,
        isExecutable: true,
        itemNumber: true,
        arabicName: true,
        quantity: true,
        unit: true,
        unitPrice: true,
      },
    });
    const workItems: WorkItemForExtract[] = workRows.map((row) => ({
      id: row.id,
      parentId: row.parentId,
      isExecutable: row.isExecutable,
      itemNumber: row.itemNumber,
      arabicName: row.arabicName,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitPrice: row.unitPrice != null ? Number(row.unitPrice) : null,
    }));

    const extractType = data.extractType || 'contractor';
    const priorWhere = {
      projectId: data.projectId,
      // Cancelled extracts never occupy remaining quantity. Unposted drafts do,
      // so two overlapping drafts cannot both consume the same remaining BOQ qty.
      isCancelled: false,
      extractType,
      ...(extractType === 'contractor'
        ? { contractorId: data.contractorId ?? null }
        : {}),
      ...(excludeExtractId ? { id: { not: excludeExtractId } } : {}),
    };

    const priorExtracts = await prisma.extract.findMany({
      where: priorWhere,
      select: {
        id: true,
        totalValue: true,
        items: { select: { workItemId: true, quantity: true } },
      },
    });

    const previousQuantityByWorkItemId = aggregatePreviousWorkItemQuantities(
      priorExtracts.map((extract) => ({
        isCancelled: false,
        items: extract.items.map((item) => ({
          workItemId: item.workItemId,
          quantity: Number(item.quantity),
        })),
      }))
    );
    let previousWorkTotal = 0;
    for (const extract of priorExtracts) {
      previousWorkTotal += Number(extract.totalValue ?? 0);
    }

    const lines: ExtractLineInput[] = data.items.map((item) => ({
      workItemId: item.workItemId,
      buildingId: item.buildingId,
      unitNumber: item.unitNumber,
      modelNumber: item.modelNumber,
      groupCode: item.groupCode,
      groupName: item.groupName,
      itemNumber: item.itemNumber,
      itemName: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      notes: item.notes,
    }));

    try {
      const computed = computeExtractLines({
        lines,
        workItems,
        previousQuantityByWorkItemId,
      });
      return {
        ...computed,
        previousWorkTotal,
        previousExtractCount: priorExtracts.length,
      };
    } catch (error) {
      this.rethrow(error);
    }
  }

  private async assertUniqueExtractNumber(
    db: Pick<typeof prisma, 'extract'> | typeof prisma,
    projectId: string,
    extractNumber: string | undefined,
    excludeId: string | null
  ) {
    const serial = extractNumber?.trim();
    if (!serial) return;
    const existing = await (db as typeof prisma).extract.findFirst({
      where: {
        projectId,
        extractNumber: serial,
        isCancelled: false,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, `Extract number ${serial} already exists on this project`);
    }
  }

  private rethrow(error: unknown): never {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : '';
    if (message === 'EXTRACT_ITEMS_REQUIRED') {
      throw new AppError(422, 'At least one extract item is required');
    }
    if (message === 'EXTRACT_NON_FINITE_AMOUNT') {
      throw new AppError(400, 'Quantities and unit prices must be finite numbers');
    }
    if (message === 'EXTRACT_NEGATIVE_QUANTITY' || message === 'EXTRACT_NEGATIVE_PRICE') {
      throw new AppError(400, 'Quantities and unit prices cannot be negative');
    }
    if (message === 'EXTRACT_WORK_ITEM_NOT_FOUND') {
      throw new AppError(404, 'Work item not found on this project');
    }
    if (message.startsWith('EXTRACT_DUPLICATE_WORK_ITEM:')) {
      throw new AppError(400, 'Duplicate work item on this extract');
    }
    if (message.startsWith('EXTRACT_HEADER_NOT_CERTIFIABLE:')) {
      const code = message.split(':')[1];
      throw new AppError(422, `Cannot certify header work item ${code}; certify leaf items only`);
    }
    if (message.startsWith('EXTRACT_QTY_EXCEEDS_BOQ:')) {
      const [, code, cum, contract] = message.split(':');
      throw new AppError(
        422,
        `Work item ${code} cumulative quantity (${cum}) exceeds BOQ quantity (${contract})`
      );
    }
    throw error;
  }
}

export const extractService = new ExtractService();

