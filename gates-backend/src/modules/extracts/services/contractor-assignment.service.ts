import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateContractorAssignmentData {
  projectId: string;
  contractorId: string;
  workItemId: string;
  assignmentDate?: Date;
  notes?: string;
}

export interface UpdateContractorAssignmentData extends Partial<CreateContractorAssignmentData> {}

export class ContractorAssignmentService {
  async createAssignment(companyId: string, data: CreateContractorAssignmentData) {
    try {
      // Verify project exists
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, companyId },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Verify contractor exists
      const contractor = await prisma.contractor.findFirst({
        where: { id: data.contractorId, companyId },
      });

      if (!contractor) {
        throw new Error('Contractor not found');
      }

      // Verify work item exists and belongs to project
      const workItem = await prisma.projectWorkItem.findFirst({
        where: { id: data.workItemId, projectId: data.projectId },
      });

      if (!workItem) {
        throw new Error('Project work item not found');
      }

      // Check if assignment already exists
      const existing = await prisma.contractorAssignment.findFirst({
        where: {
          projectId: data.projectId,
          contractorId: data.contractorId,
          workItemId: data.workItemId,
        },
      });

      if (existing) {
        throw new Error('Contractor assignment already exists for this work item');
      }

      const assignment = await prisma.contractorAssignment.create({
        data: {
          projectId: data.projectId,
          contractorId: data.contractorId,
          workItemId: data.workItemId,
          assignmentDate: data.assignmentDate || new Date(),
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
          contractor: {
            select: {
              id: true,
              arabicName: true,
              serial: true,
            },
          },
          workItem: {
            select: {
              id: true,
              arabicName: true,
              itemNumber: true,
            },
          },
        },
      });

      logger.info({ companyId, assignmentId: assignment.id }, 'Contractor assignment created');
      return assignment;
    } catch (error) {
      logger.error({ error, companyId }, 'Error creating contractor assignment');
      throw error;
    }
  }

  async listAssignments(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      projectId?: string;
      contractorId?: string;
      workItemId?: string;
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

      if (options.contractorId) {
        where.contractorId = options.contractorId;
      }

      if (options.workItemId) {
        where.workItemId = options.workItemId;
      }

      const [assignments, total] = await Promise.all([
        prisma.contractorAssignment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { assignmentDate: 'desc' },
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
            workItem: {
              select: {
                id: true,
                arabicName: true,
                itemNumber: true,
              },
            },
          },
        }),
        prisma.contractorAssignment.count({ where }),
      ]);

      return {
        assignments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId }, 'Error listing contractor assignments');
      throw error;
    }
  }

  async getAssignmentById(companyId: string, id: string) {
    try {
      const assignment = await prisma.contractorAssignment.findFirst({
        where: {
          id,
          project: { companyId },
        },
        include: {
          project: true,
          contractor: true,
          workItem: {
            include: {
              building: true,
            },
          },
        },
      });

      if (!assignment) {
        throw new Error('Contractor assignment not found');
      }

      return assignment;
    } catch (error) {
      logger.error({ error, companyId, assignmentId: id }, 'Error getting contractor assignment');
      throw error;
    }
  }

  async updateAssignment(companyId: string, id: string, data: UpdateContractorAssignmentData) {
    try {
      const existing = await prisma.contractorAssignment.findFirst({
        where: { id, project: { companyId } },
      });

      if (!existing) {
        throw new Error('Contractor assignment not found');
      }

      // Verify related entities if provided
      if (data.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: data.projectId, companyId },
        });
        if (!project) {
          throw new Error('Project not found');
        }
      }

      if (data.contractorId) {
        const contractor = await prisma.contractor.findFirst({
          where: { id: data.contractorId, companyId },
        });
        if (!contractor) {
          throw new Error('Contractor not found');
        }
      }

      if (data.workItemId && data.projectId) {
        const workItem = await prisma.projectWorkItem.findFirst({
          where: { id: data.workItemId, projectId: data.projectId },
        });
        if (!workItem) {
          throw new Error('Project work item not found');
        }
      }

      const updateData: any = {};
      if (data.projectId !== undefined) updateData.projectId = data.projectId;
      if (data.contractorId !== undefined) updateData.contractorId = data.contractorId;
      if (data.workItemId !== undefined) updateData.workItemId = data.workItemId;
      if (data.assignmentDate !== undefined) updateData.assignmentDate = data.assignmentDate;
      if (data.notes !== undefined) updateData.notes = data.notes;

      const assignment = await prisma.contractorAssignment.update({
        where: { id },
        data: updateData,
        include: {
          project: true,
          contractor: true,
          workItem: true,
        },
      });

      logger.info({ companyId, assignmentId: id }, 'Contractor assignment updated');
      return assignment;
    } catch (error) {
      logger.error({ error, companyId, assignmentId: id }, 'Error updating contractor assignment');
      throw error;
    }
  }

  async deleteAssignment(companyId: string, id: string) {
    try {
      const assignment = await prisma.contractorAssignment.findFirst({
        where: { id, project: { companyId } },
      });

      if (!assignment) {
        throw new Error('Contractor assignment not found');
      }

      await prisma.contractorAssignment.delete({
        where: { id },
      });

      logger.info({ companyId, assignmentId: id }, 'Contractor assignment deleted');
    } catch (error) {
      logger.error({ error, companyId, assignmentId: id }, 'Error deleting contractor assignment');
      throw error;
    }
  }
}

export const contractorAssignmentService = new ContractorAssignmentService();

