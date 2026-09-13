import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateProjectMeasurementDefinitionData {
  projectId: string;
  arabicName: string;
  englishName?: string;
  unit?: string;
  notes?: string;
}

export interface UpdateProjectMeasurementDefinitionData extends Partial<CreateProjectMeasurementDefinitionData> {}

export class ProjectMeasurementDefinitionService {
  async createDefinition(companyId: string, data: CreateProjectMeasurementDefinitionData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      const definition = await prisma.projectMeasurementDefinition.create({
        data: {
          projectId: data.projectId,
          arabicName: data.arabicName,
          englishName: data.englishName,
          unit: data.unit,
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
        },
      });

      logger.info({ companyId, definitionId: definition.id }, 'Project measurement definition created');
      return definition;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating project measurement definition');
      throw error;
    }
  }

  async listDefinitions(
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
          { englishName: { contains: options.search } },
          { unit: { contains: options.search } },
        ];
      }

      const [definitions, total] = await Promise.all([
        prisma.projectMeasurementDefinition.findMany({
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
          },
        }),
        prisma.projectMeasurementDefinition.count({ where }),
      ]);

      return {
        definitions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing project measurement definitions');
      throw error;
    }
  }

  async getDefinitionById(companyId: string, id: string) {
    try {
      const definition = await prisma.projectMeasurementDefinition.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
        },
      });

      if (!definition) {
        throw new Error('Project measurement definition not found');
      }

      return definition;
    } catch (error) {
      logger.error({ error, companyId, definitionId: id }, 'Error getting project measurement definition');
      throw error;
    }
  }

  async updateDefinition(companyId: string, id: string, data: UpdateProjectMeasurementDefinitionData) {
    try {
      const existing = await prisma.projectMeasurementDefinition.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Project measurement definition not found');
      }

      const definition = await prisma.projectMeasurementDefinition.update({
        where: { id },
        data: {
          arabicName: data.arabicName,
          englishName: data.englishName,
          unit: data.unit,
          notes: data.notes,
        },
        include: {
          project: true,
        },
      });

      logger.info({ companyId, definitionId: id }, 'Project measurement definition updated');
      return definition;
    } catch (error) {
      logger.error({ error, companyId, definitionId: id }, 'Error updating project measurement definition');
      throw error;
    }
  }

  async deleteDefinition(companyId: string, id: string) {
    try {
      const definition = await prisma.projectMeasurementDefinition.findFirst({
        where: { id, project: { companyId } },
      });

      if (!definition) {
        throw new Error('Project measurement definition not found');
      }

      await prisma.projectMeasurementDefinition.delete({
        where: { id },
      });

      logger.info({ companyId, definitionId: id }, 'Project measurement definition deleted');
    } catch (error) {
      logger.error({ error, companyId, definitionId: id }, 'Error deleting project measurement definition');
      throw error;
    }
  }
}

export const projectMeasurementDefinitionService = new ProjectMeasurementDefinitionService();

