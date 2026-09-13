import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { schoolStructureService } from './school-structure.service';

export class StudentEnrollmentService {
  async enroll(
    companyId: string,
    input: {
      studentCode: string;
      fullName: string;
      guardianCustomerId: string;
      gradeId: string;
      academicYearId: string;
      busRouteId?: string;
    }
  ) {
    await schoolStructureService.getGrade(companyId, input.gradeId);
    await schoolStructureService.getAcademicYear(companyId, input.academicYearId);

    if (input.busRouteId) {
      const route = await prisma.schoolBusRoute.findFirst({
        where: { id: input.busRouteId, companyId },
      });
      if (!route) throw new AppError(404, 'Bus route not found');
    }

    const guardian = await prisma.customer.findFirst({
      where: { id: input.guardianCustomerId, companyId },
    });
    if (!guardian) throw new AppError(404, 'Guardian customer not found');

    return prisma.schoolStudent.create({
      data: {
        companyId,
        studentCode: input.studentCode,
        fullName: input.fullName,
        guardianCustomerId: input.guardianCustomerId,
        gradeId: input.gradeId,
        academicYearId: input.academicYearId,
        busRouteId: input.busRouteId,
        status: 'ENROLLED',
      },
      include: { grade: true, academicYear: true, busRoute: true },
    });
  }

  async getStudent(companyId: string, studentId: string) {
    const row = await prisma.schoolStudent.findFirst({
      where: { id: studentId, companyId },
      include: {
        grade: true,
        academicYear: { include: { terms: true } },
        guardian: true,
        busRoute: true,
      },
    });
    if (!row) throw new AppError(404, 'Student not found');
    return row;
  }

  async list(companyId: string, limit = 200) {
    return prisma.schoolStudent.findMany({
      where: { companyId },
      include: {
        grade: { select: { id: true, gradeName: true, gradeCode: true } },
        academicYear: { select: { id: true, yearCode: true, name: true } },
      },
      orderBy: { studentCode: 'asc' },
      take: Math.min(limit, 500),
    });
  }
}

export const studentEnrollmentService = new StudentEnrollmentService();
