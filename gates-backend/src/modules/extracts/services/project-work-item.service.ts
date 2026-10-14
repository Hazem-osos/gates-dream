import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  assertAcyclicParent,
  orphanChildIdsForParentCode,
  parentCodeFromItemCode,
} from '../../contracting/utils/boq-hierarchy.util';
import { computeWorkItemTotal } from '../utils/extract-statement.util';

export interface CreateProjectWorkItemData {
  projectId: string;
  parentId?: string | null;
  isExecutable?: boolean;
  buildingId?: string;
  itemNumber: string;
  itemGroupCode?: string;
  itemGroupName?: string;
  arabicName: string;
  englishName?: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  notes?: string;
}

export interface UpdateProjectWorkItemData extends Partial<CreateProjectWorkItemData> {}

export class ProjectWorkItemService {
  async createWorkItem(companyId: string, data: CreateProjectWorkItemData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Verify building exists if provided
      if (data.buildingId) {
        const building = await prisma.projectBuilding.findFirst({
          where: { id: data.buildingId, projectId: data.projectId },
        });

        if (!building) {
          throw new Error('Project building not found');
        }
      }

      const duplicate = await prisma.projectWorkItem.findFirst({
        where: { projectId: data.projectId, itemNumber: data.itemNumber.trim() },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError(409, `Work item ${data.itemNumber} already exists on this project`);
      }

      const siblings = await prisma.projectWorkItem.findMany({
        where: { projectId: data.projectId },
        select: { id: true, parentId: true, itemNumber: true },
      });
      let parentId = data.parentId ?? null;
      if (!parentId) {
        const inferred = parentCodeFromItemCode(data.itemNumber);
        if (inferred) {
          parentId = siblings.find((row) => row.itemNumber === inferred)?.id ?? null;
        }
      }
      if (parentId) {
        const parent = siblings.find((row) => row.id === parentId);
        if (!parent) throw new AppError(404, 'Parent work item not found on this project');
        try {
          assertAcyclicParent([...siblings, { id: 'new', parentId }], 'new', parentId);
        } catch {
          throw new AppError(400, 'Work item parent would create a cycle');
        }
      }

      const totalPrice = computeWorkItemTotal(data.quantity, data.unitPrice);

      const workItem = await prisma.$transaction(async (tx) => {
        if (parentId) {
          await tx.projectWorkItem.update({
            where: { id: parentId },
            data: { isExecutable: false },
          });
        }
        const created = await tx.projectWorkItem.create({
        data: {
          projectId: data.projectId,
          parentId,
          isExecutable: data.isExecutable ?? true,
          buildingId: data.buildingId,
          itemNumber: data.itemNumber.trim(),
          itemGroupCode: data.itemGroupCode,
          itemGroupName: data.itemGroupName,
          arabicName: data.arabicName,
          englishName: data.englishName,
          quantity: new Decimal(data.quantity),
          unit: data.unit,
          unitPrice: data.unitPrice ? new Decimal(data.unitPrice) : null,
          totalPrice: totalPrice ? new Decimal(totalPrice) : null,
          notes: data.notes,
        },
        include: {
          project: {
            select: {
              id: true,
              arabicName: true,
              serial: true,
            },
          },
          building: {
            select: {
              id: true,
              arabicName: true,
              unitNumber: true,
            },
          },
        },
      });
        const orphanIds = orphanChildIdsForParentCode(
          siblings.map((row) => ({ id: row.id, itemCode: row.itemNumber, parentId: row.parentId })),
          created.itemNumber,
          created.id
        );
        if (orphanIds.length) {
          await tx.projectWorkItem.updateMany({
            where: { id: { in: orphanIds }, projectId: data.projectId },
            data: { parentId: created.id },
          });
          return tx.projectWorkItem.update({
            where: { id: created.id },
            data: { isExecutable: false },
            include: {
              project: {
                select: {
                  id: true,
                  arabicName: true,
                  serial: true,
                },
              },
              building: {
                select: {
                  id: true,
                  arabicName: true,
                  unitNumber: true,
                },
              },
            },
          });
        }
        return created;
      });

      logger.info({ companyId, workItemId: workItem.id }, 'Project work item created');
      return workItem;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating project work item');
      throw error;
    }
  }

  async listWorkItems(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      projectId?: string;
      buildingId?: string;
      search?: string;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        project: { companyId },
      };

      if (options.projectId) {
        where.projectId = options.projectId;
      }

      if (options.buildingId) {
        where.buildingId = options.buildingId;
      }

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { itemNumber: { contains: options.search } },
          { itemGroupCode: { contains: options.search } },
          { itemGroupName: { contains: options.search } },
        ];
      }

      const [workItems, total] = await Promise.all([
        prisma.projectWorkItem.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'asc' },
          include: {
            project: {
              select: {
                id: true,
                arabicName: true,
                serial: true,
              },
            },
            building: {
              select: {
                id: true,
                arabicName: true,
                unitNumber: true,
              },
            },
            _count: {
              select: {
                contractorAssignments: true,
                extractItems: true,
                children: true,
              },
            },
          },
        }),
        prisma.projectWorkItem.count({ where }),
      ]);

      return {
        workItems,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing project work items');
      throw error;
    }
  }

  async getWorkItemById(companyId: string, id: string) {
    try {
      const workItem = await prisma.projectWorkItem.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
          building: true,
          contractorAssignments: {
            include: {
              contractor: true,
            },
          },
        },
      });

      if (!workItem) {
        throw new Error('Project work item not found');
      }

      return workItem;
    } catch (error) {
      logger.error({ error, companyId, workItemId: id }, 'Error getting project work item');
      throw error;
    }
  }

  async updateWorkItem(companyId: string, id: string, data: UpdateProjectWorkItemData) {
    try {
      const existing = await prisma.projectWorkItem.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Project work item not found');
      }

      if (data.itemNumber !== undefined && data.itemNumber.trim() !== existing.itemNumber) {
        const duplicate = await prisma.projectWorkItem.findFirst({
          where: {
            projectId: existing.projectId,
            itemNumber: data.itemNumber.trim(),
            id: { not: id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new AppError(409, `Work item ${data.itemNumber} already exists on this project`);
        }
      }

      // Verify building exists if provided
      if (data.buildingId && data.projectId) {
        const building = await prisma.projectBuilding.findFirst({
          where: { id: data.buildingId, projectId: data.projectId },
        });

        if (!building) {
          throw new Error('Project building not found');
        }
      }

      const updateData: any = {};
      if (data.buildingId !== undefined) updateData.buildingId = data.buildingId;
      if (data.itemNumber !== undefined) updateData.itemNumber = data.itemNumber;
      if (data.itemGroupCode !== undefined) updateData.itemGroupCode = data.itemGroupCode;
      if (data.itemGroupName !== undefined) updateData.itemGroupName = data.itemGroupName;
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined) updateData.englishName = data.englishName;
      if (data.quantity !== undefined) updateData.quantity = new Decimal(data.quantity);
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice ? new Decimal(data.unitPrice) : null;
      const nextQty = data.quantity !== undefined ? data.quantity : Number(existing.quantity);
      const nextPrice =
        data.unitPrice !== undefined
          ? data.unitPrice
          : existing.unitPrice != null
            ? Number(existing.unitPrice)
            : null;
      const computedTotal = computeWorkItemTotal(nextQty, nextPrice);
      updateData.totalPrice = computedTotal != null ? new Decimal(computedTotal) : null;
      if (data.parentId !== undefined) {
        const siblings = await prisma.projectWorkItem.findMany({
          where: { projectId: existing.projectId },
          select: { id: true, parentId: true },
        });
        try {
          assertAcyclicParent(siblings, id, data.parentId);
        } catch {
          throw new AppError(400, 'Work item parent would create a cycle');
        }
        updateData.parentId = data.parentId;
        if (data.parentId) {
          await prisma.projectWorkItem.update({
            where: { id: data.parentId },
            data: { isExecutable: false },
          });
        }
      }
      if (data.isExecutable !== undefined) updateData.isExecutable = data.isExecutable;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const workItem = await prisma.projectWorkItem.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
          building: true,
        },
      });

      logger.info({ companyId, workItemId: id }, 'Project work item updated');
      return workItem;
    } catch (error) {
      logger.error({ error, companyId, workItemId: id }, 'Error updating project work item');
      throw error;
    }
  }

  async deleteWorkItem(companyId: string, id: string) {
    try {
      const workItem = await prisma.projectWorkItem.findFirst({
        where: { id, project: { companyId } },
      });

      if (!workItem) {
        throw new Error('Project work item not found');
      }

      const child = await prisma.projectWorkItem.findFirst({
        where: { parentId: id },
        select: { id: true },
      });
      if (child) {
        throw new AppError(409, 'Cannot delete a header work item that still has children');
      }

      await prisma.projectWorkItem.delete({
        where: { id },
      });

      logger.info({ companyId, workItemId: id }, 'Project work item deleted');
    } catch (error) {
      logger.error({ error, companyId, workItemId: id }, 'Error deleting project work item');
      throw error;
    }
  }
}

export const projectWorkItemService = new ProjectWorkItemService();

