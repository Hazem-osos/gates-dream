import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateProjectBuildingData {
  projectId: string;
  groupNumber?: string;
  modelNumber?: string;
  unitNumber?: string;
  arabicName?: string;
  imageUrl?: string;
}

export interface UpdateProjectBuildingData extends Partial<CreateProjectBuildingData> {}

export class ProjectBuildingService {
  async createBuilding(companyId: string, data: CreateProjectBuildingData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const building = await prisma.projectBuilding.create({
        data: {
          projectId: data.projectId,
          groupNumber: data.groupNumber,
          modelNumber: data.modelNumber,
          unitNumber: data.unitNumber,
          arabicName: data.arabicName,
          imageUrl: data.imageUrl,
        },
        include: {
          project: {
            select: {
              id: true,
              arabicName: true,
              serial: true,
            },
          },
        },
      });

      logger.info({ companyId, buildingId: building.id }, 'Project building created');
      return building;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating project building');
      throw error;
    }
  }

  async listBuildings(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      projectId?: string;
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

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { unitNumber: { contains: options.search } },
          { modelNumber: { contains: options.search } },
          { groupNumber: { contains: options.search } },
        ];
      }

      const [buildings, total] = await Promise.all([
        prisma.projectBuilding.findMany({
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
            _count: {
              select: {
                workItems: true,
                extractItems: true,
              },
            },
          },
        }),
        prisma.projectBuilding.count({ where }),
      ]);

      return {
        buildings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing project buildings');
      throw error;
    }
  }

  async getBuildingById(companyId: string, id: string) {
    try {
      const building = await prisma.projectBuilding.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
          workItems: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!building) {
        throw new Error('Project building not found');
      }

      return building;
    } catch (error) {
      logger.error({ error, companyId, buildingId: id }, 'Error getting project building');
      throw error;
    }
  }

  async updateBuilding(companyId: string, id: string, data: UpdateProjectBuildingData) {
    try {
      const existing = await prisma.projectBuilding.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Project building not found');
      }

      const building = await prisma.projectBuilding.update({
        where: { id },
        data: {
          groupNumber: data.groupNumber,
          modelNumber: data.modelNumber,
          unitNumber: data.unitNumber,
          arabicName: data.arabicName,
          imageUrl: data.imageUrl,
        },
        include: {
          project: true,
        },
      });

      logger.info({ companyId, buildingId: id }, 'Project building updated');
      return building;
    } catch (error) {
      logger.error({ error, companyId, buildingId: id }, 'Error updating project building');
      throw error;
    }
  }

  async deleteBuilding(companyId: string, id: string) {
    try {
      const building = await prisma.projectBuilding.findFirst({
        where: { id, project: { companyId } },
      });

      if (!building) {
        throw new Error('Project building not found');
      }

      await prisma.projectBuilding.delete({
        where: { id },
      });

      logger.info({ companyId, buildingId: id }, 'Project building deleted');
    } catch (error) {
      logger.error({ error, companyId, buildingId: id }, 'Error deleting project building');
      throw error;
    }
  }
}

export const projectBuildingService = new ProjectBuildingService();

