// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateProjectData {
  serial?: string;
  arabicName: string;
  englishName?: string;
  totalValue?: number;
  advancePaymentPercentage?: number;
  advancePaymentValue?: number;
  latePenaltyPercentage?: number;
  latePenaltyPerDays?: string;
  businessAffairsPercentage?: number;
  facilitiesDeductionPercentage?: number;
  facilitiesDeductionMax?: number;
  otherAdditions?: Array<{ name: string; value: number }>;
  otherDeductions?: Array<{ name: string; value: number }>;
  notes?: string;
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  isActive?: boolean;
}

export class ProjectService {
  /**
   * Create a new project
   */
  async createProject(companyId: string, data: CreateProjectData) {
    try {
      const project = await prisma.project.create({
        data: {
          companyId,
          serial: data.serial,
          arabicName: data.arabicName,
          englishName: data.englishName,
          totalValue: data.totalValue ? new Decimal(data.totalValue) : null,
          advancePaymentPercentage: data.advancePaymentPercentage
            ? new Decimal(data.advancePaymentPercentage)
            : null,
          advancePaymentValue: data.advancePaymentValue
            ? new Decimal(data.advancePaymentValue)
            : null,
          latePenaltyPercentage: data.latePenaltyPercentage
            ? new Decimal(data.latePenaltyPercentage)
            : null,
          latePenaltyPerDays: data.latePenaltyPerDays || 'يوم',
          businessAffairsPercentage: data.businessAffairsPercentage
            ? new Decimal(data.businessAffairsPercentage)
            : null,
          facilitiesDeductionPercentage: data.facilitiesDeductionPercentage
            ? new Decimal(data.facilitiesDeductionPercentage)
            : null,
          facilitiesDeductionMax: data.facilitiesDeductionMax
            ? new Decimal(data.facilitiesDeductionMax)
            : null,
          otherAdditions: data.otherAdditions || null,
          otherDeductions: data.otherDeductions || null,
          notes: data.notes,
        },
        include: {
          buildings: true,
          workItems: true,
          _count: {
            select: {
              extracts: true,
              contractorAssignments: true,
            },
          },
        },
      });

      logger.info({ companyId, projectId: project.id }, 'Project created');
      return project;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating project');
      throw error;
    }
  }

  /**
   * List projects with pagination
   */
  async listProjects(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
    } = {}
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
      };

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.search) {
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { serial: { contains: options.search } },
        ];
      }

      const [projects, total] = await Promise.all([
        prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                buildings: true,
                workItems: true,
                extracts: true,
              },
            },
          },
        }),
        prisma.project.count({ where }),
      ]);

      return {
        projects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing projects');
      throw error;
    }
  }

  /**
   * Get project by ID
   */
  async getProjectById(companyId: string, id: string) {
    try {
      const project = await prisma.project.findFirst({
        where: {
          id,
          companyId,
        },
        include: {
          buildings: {
            orderBy: { createdAt: 'asc' },
          },
          workItems: {
            include: {
              building: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          extracts: {
            include: {
              contractor: true,
            },
            orderBy: { extractDate: 'desc' },
            take: 10,
          },
          contractorAssignments: {
            include: {
              contractor: true,
              workItem: true,
            },
          },
          _count: {
            select: {
              buildings: true,
              workItems: true,
              extracts: true,
              contractorAssignments: true,
            },
          },
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      return project;
    } catch (error) {
      logger.error({ error, companyId, projectId: id }, 'Error getting project');
      throw error;
    }
  }

  /**
   * Update project
   */
  async updateProject(
    companyId: string,
    id: string,
    data: UpdateProjectData
  ) {
    try {
      const existingProject = await prisma.project.findFirst({
        where: { id, companyId },
      });

      if (!existingProject) {
        throw new Error('Project not found');
      }

      const updateData: any = {};

      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined) updateData.englishName = data.englishName;
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.totalValue !== undefined)
        updateData.totalValue = data.totalValue ? new Decimal(data.totalValue) : null;
      if (data.advancePaymentPercentage !== undefined)
        updateData.advancePaymentPercentage = data.advancePaymentPercentage
          ? new Decimal(data.advancePaymentPercentage)
          : null;
      if (data.advancePaymentValue !== undefined)
        updateData.advancePaymentValue = data.advancePaymentValue
          ? new Decimal(data.advancePaymentValue)
          : null;
      if (data.latePenaltyPercentage !== undefined)
        updateData.latePenaltyPercentage = data.latePenaltyPercentage
          ? new Decimal(data.latePenaltyPercentage)
          : null;
      if (data.latePenaltyPerDays !== undefined)
        updateData.latePenaltyPerDays = data.latePenaltyPerDays;
      if (data.businessAffairsPercentage !== undefined)
        updateData.businessAffairsPercentage = data.businessAffairsPercentage
          ? new Decimal(data.businessAffairsPercentage)
          : null;
      if (data.facilitiesDeductionPercentage !== undefined)
        updateData.facilitiesDeductionPercentage = data.facilitiesDeductionPercentage
          ? new Decimal(data.facilitiesDeductionPercentage)
          : null;
      if (data.facilitiesDeductionMax !== undefined)
        updateData.facilitiesDeductionMax = data.facilitiesDeductionMax
          ? new Decimal(data.facilitiesDeductionMax)
          : null;
      if (data.otherAdditions !== undefined) updateData.otherAdditions = data.otherAdditions;
      if (data.otherDeductions !== undefined) updateData.otherDeductions = data.otherDeductions;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const project = await prisma.project.update({
        where: { id },
        data: updateData,
        include: {
          buildings: true,
          workItems: true,
          _count: {
            select: {
              extracts: true,
              contractorAssignments: true,
            },
          },
        },
      });

      logger.info({ companyId, projectId: id }, 'Project updated');
      return project;
    } catch (error) {
      logger.error({ error, companyId, projectId: id }, 'Error updating project');
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(companyId: string, id: string) {
    try {
      const project = await prisma.project.findFirst({
        where: { id, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      await prisma.project.delete({
        where: { id },
      });

      logger.info({ companyId, projectId: id }, 'Project deleted');
    } catch (error) {
      logger.error({ error, companyId, projectId: id }, 'Error deleting project');
      throw error;
    }
  }
}

export const projectService = new ProjectService();

