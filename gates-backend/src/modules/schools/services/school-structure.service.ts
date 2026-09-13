import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export class SchoolStructureService {
  async createAcademicYear(
    companyId: string,
    input: {
      yearCode: string;
      name: string;
      startDate?: Date;
      endDate?: Date;
      terms?: Array<{
        termCode: string;
        termName: string;
        startDate?: Date;
        endDate?: Date;
        sortOrder?: number;
      }>;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const year = await tx.schoolAcademicYear.create({
        data: {
          companyId,
          yearCode: input.yearCode,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
        },
      });
      if (input.terms?.length) {
        for (const t of input.terms) {
          await tx.schoolAcademicTerm.create({
            data: {
              academicYearId: year.id,
              termCode: t.termCode,
              termName: t.termName,
              startDate: t.startDate,
              endDate: t.endDate,
              sortOrder: t.sortOrder ?? 1,
            },
          });
        }
      }
      return tx.schoolAcademicYear.findUnique({
        where: { id: year.id },
        include: { terms: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  async createGrade(
    companyId: string,
    input: {
      stageName: string;
      gradeName: string;
      gradeCode: string;
      defaultTuitionFee: number;
      costCenterId?: string;
    }
  ) {
    return prisma.academicGrade.create({
      data: {
        companyId,
        stageName: input.stageName,
        gradeName: input.gradeName,
        gradeCode: input.gradeCode,
        defaultTuitionFee: new Decimal(input.defaultTuitionFee),
        costCenterId: input.costCenterId,
      },
    });
  }

  async getGrade(companyId: string, gradeId: string) {
    const row = await prisma.academicGrade.findFirst({
      where: { id: gradeId, companyId },
    });
    if (!row) throw new AppError(404, 'Academic grade not found');
    return row;
  }

  async createBusRoute(
    companyId: string,
    input: { routeCode: string; name: string; annualFee?: number }
  ) {
    return prisma.schoolBusRoute.create({
      data: {
        companyId,
        routeCode: input.routeCode,
        name: input.name,
        annualFee: new Decimal(input.annualFee ?? 0),
      },
    });
  }

  async getAcademicYear(companyId: string, academicYearId: string) {
    const row = await prisma.schoolAcademicYear.findFirst({
      where: { id: academicYearId, companyId },
      include: { terms: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new AppError(404, 'Academic year not found');
    return row;
  }
}

export const schoolStructureService = new SchoolStructureService();
