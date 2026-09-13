import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateSemesterData {
  code?: string;
  arabicName: string;
  englishName?: string;
}

export interface UpdateSemesterData extends Partial<CreateSemesterData> {
  isActive?: boolean;
}

export class SemesterService {
  async createSemester(companyId: string, data: CreateSemesterData) {
    try {
      const semester = await prisma.semester.create({
        data: {
          companyId,
          code: data.code,
          arabicName: data.arabicName,
          englishName: data.englishName,
        },
      });

      logger.info({ companyId, semesterId: semester.id }, 'Semester created');
      return semester;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating semester');
      throw error;
    }
  }

  async getSemesterById(companyId: string, semesterId: string) {
    try {
      const semester = await prisma.semester.findFirst({
        where: {
          id: semesterId,
          companyId,

        },
      });

      if (!semester) {
        throw new Error('Semester not found');
      }

      return semester;
    } catch (error) {
      logger.error({ error, companyId, semesterId }, 'Error getting semester');
      throw error;
    }
  }

  async listSemesters(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
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

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      const [semesters, total] = await Promise.all([
        prisma.semester.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
        }),
        prisma.semester.count({ where }),
      ]);

      return {
        semesters,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing semesters');
      throw error;
    }
  }

  async updateSemester(
    companyId: string,
    semesterId: string,
    data: UpdateSemesterData
  ) {
    try {
      const existing = await prisma.semester.findFirst({
        where: { id: semesterId, companyId },
      });

      if (!existing) {
        throw new Error('Semester not found');
      }

      const semester = await prisma.semester.update({
        where: { id: semesterId },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.arabicName && { arabicName: data.arabicName }),
          ...(data.englishName !== undefined && { englishName: data.englishName }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info({ companyId, semesterId }, 'Semester updated');
      return semester;
    } catch (error) {
      logger.error(
        { error, companyId, semesterId, data },
        'Error updating semester'
      );
      throw error;
    }
  }

  async deleteSemester(companyId: string, semesterId: string) {
    try {
      const semester = await prisma.semester.findFirst({
        where: { id: semesterId, companyId },
      });

      if (!semester) {
        throw new Error('Semester not found');
      }

      await prisma.semester.update({
        where: { id: semesterId },
        data: { isActive: false },
      });

      logger.info({ companyId, semesterId }, 'Semester deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, semesterId }, 'Error deleting semester');
      throw error;
    }
  }
}

export const semesterService = new SemesterService();
