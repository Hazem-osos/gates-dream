import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateProjectWorkItemData {
  projectId: string;
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

      const totalPrice = data.totalPrice || (data.unitPrice ? data.unitPrice * data.quantity : null);

      const workItem = await prisma.projectWorkItem.create({
        data: {
          projectId: data.projectId,
          buildingId: data.buildingId,
          itemNumber: data.itemNumber,
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
      if (data.totalPrice !== undefined) {
        updateData.totalPrice = data.totalPrice ? new Decimal(data.totalPrice) : null;
      } else if (data.unitPrice !== undefined && data.quantity !== undefined) {
        updateData.totalPrice = new Decimal(data.unitPrice * data.quantity);
      }
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

