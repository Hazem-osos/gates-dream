// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateDepartmentData {
  code?: string;
  arabicName: string;
  englishName?: string;
  managementId?: string;
}

export interface UpdateDepartmentData extends Partial<CreateDepartmentData> {
  isActive?: boolean;
}

export class DepartmentService {
  async createDepartment(companyId: string, data: CreateDepartmentData) {
    try {
      // If managementId is provided, verify it belongs to company
      if (data.managementId) {
        const management = await prisma.department.findFirst({
          where: { id: data.managementId, companyId },
        });

        if (!management) {
          throw new Error('Management department not found');
        }
      }

      const department = await prisma.department.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
          managementId: data.managementId,
        },
        include: {
          management: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, departmentId: department.id }, 'Department created');
      return department;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating department');
      throw error;
    }
  }

  async getDepartmentById(companyId: string, departmentId: string) {
    try {
      const department = await prisma.department.findFirst({
        where: {
          id: departmentId,
          companyId,

        },
        include: {
          management: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      return department;
    } catch (error) {
      logger.error({ error, companyId, departmentId }, 'Error getting department');
      throw error;
    }
  }

  async listDepartments(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      managementId?: string;
      isActive?: boolean;
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
        where.OR = [
          { arabicName: { contains: options.search } },
          { englishName: { contains: options.search } },
          { code: { contains: options.search } },
        ];
      }

      if (options.managementId) {
        where.managementId = options.managementId;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [departments, total] = await Promise.all([
        prisma.department.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            management: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.department.count({ where }),
      ]);

      return {
        departments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing departments');
      throw error;
    }
  }

  async updateDepartment(
    companyId: string,
    departmentId: string,
    data: UpdateDepartmentData
  ) {
    try {
      const existing = await prisma.department.findFirst({
        where: { id: departmentId, companyId },
      });

      if (!existing) {
        throw new Error('Department not found');
      }

      // If managementId is being updated, verify it belongs to company
      if (data.managementId && data.managementId !== existing.managementId) {
        const management = await prisma.department.findFirst({
          where: { id: data.managementId, companyId },
        });

        if (!management) {
          throw new Error('Management department not found');
        }

        // Prevent circular reference
        if (data.managementId === departmentId) {
          throw new Error('Department cannot be its own management');
        }
      }

      const department = await prisma.department.update({
        where: { id: departmentId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.managementId !== undefined && { managementId: data.managementId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          management: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, departmentId }, 'Department updated');
      return department;
    } catch (error) {
      logger.error(
        { error, companyId, departmentId, data },
        'Error updating department'
      );
      throw error;
    }
  }

  async deleteDepartment(companyId: string, departmentId: string) {
    try {
      const department = await prisma.department.findFirst({
        where: { id: departmentId, companyId },
      });

      if (!department) {
        throw new Error('Department not found');
      }

      await prisma.department.update({
        where: { id: departmentId },
        data: { isActive: false },
      });

      logger.info({ companyId, departmentId }, 'Department deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, departmentId }, 'Error deleting department');
      throw error;
    }
  }
}

export const departmentService = new DepartmentService();
