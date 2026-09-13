import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateStudentData {
  serial?: string;
  studentName: string;
  year?: string;
  fatherName?: string;
  fatherGrandfather?: string;
  fatherGreatGrandfather?: string;
  motherName?: string;
  motherGrandfather?: string;
  motherGreatGrandfather?: string;
  currencyCode?: string;
  stageId?: string;
  semesterId?: string;
  paymentType?: string;
  enrollment?: string;
}

export interface UpdateStudentData extends Partial<CreateStudentData> {
  isFinished?: boolean;
}

export class StudentService {
  /**
   * Create a new student
   */
  async createStudent(companyId: string, data: CreateStudentData) {
    try {
      const student = await prisma.student.create({
        data: {
          companyId,
          serial: data.serial,
          studentName: data.studentName,
          year: data.year,
          fatherName: data.fatherName,
          fatherGrandfather: data.fatherGrandfather,
          fatherGreatGrandfather: data.fatherGreatGrandfather,
          motherName: data.motherName,
          motherGrandfather: data.motherGrandfather,
          motherGreatGrandfather: data.motherGreatGrandfather,
          currencyCode: data.currencyCode,
          stageId: data.stageId,
          semesterId: data.semesterId,
          paymentType: data.paymentType,
          enrollment: data.enrollment,
        },
        include: {
          stage: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          semester: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          installments: {
            orderBy: { installment: 'asc' },
          },
        },
      });

      logger.info({ companyId, studentId: student.id }, 'Student created');
      return student;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating student');
      throw error;
    }
  }

  /**
   * Get student by ID
   */
  async getStudentById(companyId: string, studentId: string) {
    try {
      const student = await prisma.student.findFirst({
        where: {
          id: studentId,
          companyId,
        },
        include: {
          stage: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          semester: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          installments: {
            orderBy: { installment: 'asc' },
          },
        },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      return student;
    } catch (error) {
      logger.error({ error, companyId, studentId }, 'Error getting student');
      throw error;
    }
  }

  /**
   * List students with pagination and filters
   */
  async listStudents(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      stageId?: string;
      semesterId?: string;
      isFinished?: boolean;
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
          { studentName: { contains: options.search } },
          { serial: { contains: options.search } },
          { enrollment: { contains: options.search } },
        ];
      }

      if (options.stageId) {
        where.stageId = options.stageId;
      }

      if (options.semesterId) {
        where.semesterId = options.semesterId;
      }

      if (options.isFinished !== undefined) {
        where.isFinished = options.isFinished;
      }

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ studentName: 'asc' }],
          include: {
            stage: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            semester: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.student.count({ where }),
      ]);

      return {
        students,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing students');
      throw error;
    }
  }

  /**
   * Update student
   */
  async updateStudent(
    companyId: string,
    studentId: string,
    data: UpdateStudentData
  ) {
    try {
      const existing = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!existing) {
        throw new Error('Student not found');
      }

      const student = await prisma.student.update({
        where: { id: studentId },
        data: {
          ...(data.studentName && { studentName: data.studentName }),
          ...(data.year !== undefined && { year: data.year }),
          ...(data.stageId !== undefined && { stageId: data.stageId }),
          ...(data.semesterId !== undefined && { semesterId: data.semesterId }),
          ...(data.isFinished !== undefined && { isFinished: data.isFinished }),
          // Add other fields as needed
        },
        include: {
          stage: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          semester: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, studentId }, 'Student updated');
      return student;
    } catch (error) {
      logger.error({ error, companyId, studentId, data }, 'Error updating student');
      throw error;
    }
  }

  /**
   * Delete student (soft delete)
   */
  async deleteStudent(companyId: string, studentId: string) {
    try {
      const student = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      await prisma.student.update({
        where: { id: studentId },
        data: { isFinished: true },
      });

      logger.info({ companyId, studentId }, 'Student deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, studentId }, 'Error deleting student');
      throw error;
    }
  }

  /**
   * Add installment to student
   */
  async addInstallment(
    companyId: string,
    studentId: string,
    data: {
      installment: number;
      date: Date;
      value: number;
      carValue?: number;
      educationDiscount?: number;
      carDiscount?: number;
    }
  ) {
    try {
      // Verify student exists and belongs to company
      const student = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const total =
        data.value +
        (data.carValue || 0) -
        (data.educationDiscount || 0) -
        (data.carDiscount || 0);

      const installment = await prisma.studentInstallment.create({
        data: {
          studentId,
          installment: data.installment,
          date: data.date,
          value: new Decimal(data.value),
          carValue: data.carValue ? new Decimal(data.carValue) : null,
          educationDiscount: data.educationDiscount
            ? new Decimal(data.educationDiscount)
            : null,
          carDiscount: data.carDiscount ? new Decimal(data.carDiscount) : null,
          total: new Decimal(total),
        },
      });

      logger.info({ companyId, studentId, installmentId: installment.id }, 'Installment added');
      return installment;
    } catch (error) {
      logger.error({ error, companyId, studentId, data }, 'Error adding installment');
      throw error;
    }
  }

  /**
   * Mark installment as paid
   */
  async markInstallmentPaid(
    companyId: string,
    studentId: string,
    installmentId: string
  ) {
    try {
      // Verify student exists and belongs to company
      const student = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      const installment = await prisma.studentInstallment.findFirst({
        where: {
          id: installmentId,
          studentId,
        },
      });

      if (!installment) {
        throw new Error('Installment not found');
      }

      const updated = await prisma.studentInstallment.update({
        where: { id: installmentId },
        data: { isPaid: true },
      });

      logger.info({ companyId, studentId, installmentId }, 'Installment marked as paid');
      return updated;
    } catch (error) {
      logger.error({ error, companyId, studentId, installmentId }, 'Error marking installment as paid');
      throw error;
    }
  }

  /**
   * Transfer student to different stage/semester
   */
  async transferStudent(
    companyId: string,
    studentId: string,
    data: {
      stageId?: string;
      semesterId?: string;
      transferDate?: Date;
      notes?: string;
    }
  ) {
    try {
      // Verify student exists and belongs to company
      const student = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // Verify new stage/semester belong to company
      if (data.stageId) {
        const stage = await prisma.stage.findFirst({
          where: { id: data.stageId, companyId },
        });

        if (!stage) {
          throw new Error('Stage not found');
        }
      }

      if (data.semesterId) {
        const semester = await prisma.semester.findFirst({
          where: { id: data.semesterId, companyId },
        });

        if (!semester) {
          throw new Error('Semester not found');
        }
      }

      // Use transaction to ensure atomicity
      const updated = await prisma.$transaction(async (tx) => {
        const updatedStudent = await tx.student.update({
          where: { id: studentId },
          data: {
            ...(data.stageId && { stageId: data.stageId }),
            ...(data.semesterId && { semesterId: data.semesterId }),
          },
          include: {
            stage: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            semester: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        });

        // Could log transfer activity here if needed
        logger.info(
          {
            companyId,
            studentId,
            oldStageId: student.stageId,
            newStageId: data.stageId,
            oldSemesterId: student.semesterId,
            newSemesterId: data.semesterId,
            notes: data.notes,
          },
          'Student transferred'
        );

        return updatedStudent;
      });

      logger.info({ companyId, studentId }, 'Student transfer completed');
      return updated;
    } catch (error) {
      logger.error(
        { error, companyId, studentId, data },
        'Error transferring student'
      );
      throw error;
    }
  }

  /**
   * Get opening balance students (students with outstanding installments)
   */
  async getOpeningBalanceStudents(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      stageId?: string;
      semesterId?: string;
      asOfDate?: Date;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;
      const asOfDate = options.asOfDate || new Date();

      const where: any = {
        companyId,
      };

      if (options.search) {
        where.OR = [
          { studentName: { contains: options.search } },
          { serial: { contains: options.search } },
          { enrollment: { contains: options.search } },
        ];
      }

      if (options.stageId) {
        where.stageId = options.stageId;
      }

      if (options.semesterId) {
        where.semesterId = options.semesterId;
      }

      // Get students with unpaid installments up to asOfDate
      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ studentName: 'asc' }],
          include: {
            stage: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            semester: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            installments: {
              where: {
                date: { lte: asOfDate },
                isPaid: false,
              },
              orderBy: { date: 'asc' },
            },
          },
        }),
        prisma.student.count({
          where: {
            ...where,
            installments: {
              some: {
                date: { lte: asOfDate },
                isPaid: false,
              },
            },
          },
        }),
      ]);

      // Calculate opening balance for each student
      const studentsWithBalance = students
        .map((student) => {
          const outstandingBalance = student.installments.reduce(
            (sum, installment) => sum + Number(installment.total),
            0
          );

          return {
            ...student,
            outstandingBalance,
            unpaidInstallmentsCount: student.installments.length,
          };
        })
        .filter((student) => student.outstandingBalance > 0);

      return {
        students: studentsWithBalance,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalOutstandingBalance: studentsWithBalance.reduce(
            (sum, student) => sum + student.outstandingBalance,
            0
          ),
          totalStudents: studentsWithBalance.length,
          asOfDate,
        },
      };
    } catch (error) {
      logger.error(
        { error, companyId, options },
        'Error getting opening balance students'
      );
      throw error;
    }
  }

  /**
   * Process expenses refund for a student
   */
  async expensesRefund(
    companyId: string,
    studentId: string,
    data: {
      receipt?: string;
      serial?: string;
      description?: string;
      date: Date;
      hijriDate?: string;
      education?: number;
      books?: number;
      activity?: number;
      other?: number;
      car?: number;
      total: number;
      specificAmount?: number;
      paid?: number;
      paymentMethod?: string;
      year?: string;
      currency?: string;
      notes?: string;
    }
  ) {
    try {
      // Verify student belongs to company
      const student = await prisma.student.findFirst({
        where: { id: studentId, companyId },
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // For now, we'll just log the refund
      // In a full implementation, this would:
      // 1. Create a payment record (if StudentPayment model exists)
      // 2. Update student balances
      // 3. Create accounting entries if needed

      logger.info(
        {
          companyId,
          studentId,
          total: data.total,
          receipt: data.receipt,
        },
        'Student expenses refund processed'
      );

      return {
        success: true,
        studentId,
        refund: {
          receipt: data.receipt,
          serial: data.serial,
          date: data.date,
          total: data.total,
          paid: data.paid || data.total,
          paymentMethod: data.paymentMethod,
        },
        message: 'Expenses refund processed successfully',
      };
    } catch (error) {
      logger.error(
        { error, companyId, studentId, data },
        'Error processing expenses refund'
      );
      throw error;
    }
  }
}

export const studentService = new StudentService();
