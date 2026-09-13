// @ts-nocheck — strict cleanup pending; tracked for incremental typing.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface SchoolsReportFilters {
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
  branchId?: string;
  stageId?: string;
  semesterId?: string;
  studentId?: string;
  [key: string]: any;
}

export interface SchoolsReportOptions {
  includeDetails?: boolean;
  includeSummary?: boolean;
  page?: number;
  limit?: number;
}

export interface SchoolsReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Wave 6 fix: ten of these report methods had no real query behind them —
 * each just returned `{ data: [], summary: {} }` regardless of filters. A
 * user running "Activity Dues" or "Sibling Discounts" got a 200 with an
 * empty report and no way to tell "nothing matched" apart from "this report
 * was never built". The corresponding routes now catch this and return 501
 * instead of a silent, indistinguishable-from-empty 200.
 */
export class ReportNotImplementedError extends Error {
  constructor(reportName: string) {
    super(`Report "${reportName}" is not implemented — the underlying data model does not exist yet`);
    this.name = 'ReportNotImplementedError';
  }
}

export class SchoolsReportsService {
  /**
   * Get Student Report
   */
  async getStudentReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, studentId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        isActive: true,
        deletedAt: null,
      };

      if (stageId) {
        where.stageId = stageId;
      }

      if (semesterId) {
        where.semesterId = semesterId;
      }

      if (studentId) {
        where.id = studentId;
      }

      const skip = (page - 1) * limit;

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
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
        data: students,
        summary: {
          totalStudents: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating student report');
      throw error;
    }
  }

  /**
   * Get Payment Report (based on paid installments)
   */
  async getPaymentReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { fromDate, toDate, companyId, studentId, stageId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        student: {
          companyId,
          isActive: true,
          deletedAt: null,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
        isPaid: true,
      };

      if (studentId) {
        where.studentId = studentId;
      }

      if (stageId) {
        where.student = {
          ...where.student,
          stageId,
        };
      }

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'asc' }],
          include: {
            student: {
              select: {
                id: true,
                serial: true,
                studentName: true,
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
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const summary = {
        totalPayments: total,
        totalAmount: installments.reduce(
          (sum, inst) => sum + Number(inst.total),
          0
        ),
        totalEducation: installments.reduce(
          (sum, inst) => sum + Number(inst.value),
          0
        ),
        totalCar: installments.reduce(
          (sum, inst) => sum + Number(inst.carValue || 0),
          0
        ),
      };

      return {
        data: installments,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating payment report');
      throw error;
    }
  }

  /**
   * Get Detailed Payments Report
   */
  async getDetailedPaymentsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { fromDate, toDate, companyId, studentId, stageId, semesterId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        student: {
          companyId,
          isActive: true,
          deletedAt: null,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
      };

      if (studentId) {
        where.studentId = studentId;
      }

      if (stageId) {
        where.student = {
          ...where.student,
          stageId,
        };
      }

      if (semesterId) {
        where.student = {
          ...where.student,
          semesterId,
        };
      }

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ student: { studentName: 'asc' } }, { installment: 'asc' }],
          include: {
            student: {
              select: {
                id: true,
                serial: true,
                studentName: true,
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
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const summary = {
        totalInstallments: total,
        totalAmount: installments.reduce((sum, inst) => sum + Number(inst.total), 0),
        totalEducation: installments.reduce((sum, inst) => sum + Number(inst.value), 0),
        totalCar: installments.reduce((sum, inst) => sum + Number(inst.carValue || 0), 0),
        totalPaid: installments.filter((inst) => inst.isPaid).length,
        totalUnpaid: installments.filter((inst) => !inst.isPaid).length,
      };

      return {
        data: installments,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating detailed payments report');
      throw error;
    }
  }

  /**
   * Get Analytical Education Payments Report
   */
  async getAnalyticalEducationPaymentsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { fromDate, toDate, companyId, stageId, semesterId } = filters;
      const { page = 1, limit = 1000 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        student: {
          companyId,
          isActive: true,
          deletedAt: null,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
      };

      if (stageId) {
        where.student = {
          ...where.student,
          stageId,
        };
      }

      if (semesterId) {
        where.student = {
          ...where.student,
          semesterId,
        };
      }

      const installments = await prisma.studentInstallment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              serial: true,
              studentName: true,
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
          },
        },
        orderBy: [{ student: { stage: { arabicName: 'asc' } } }, { student: { studentName: 'asc' } }],
      });

      // Group by stage
      const groupedByStage = installments.reduce((acc: any, inst: any) => {
        const stageName = inst.student.stage?.arabicName || 'غير محدد';
        if (!acc[stageName]) {
          acc[stageName] = {
            stage: inst.student.stage,
            students: new Map(),
            totalEducation: 0,
            totalCar: 0,
            totalDiscount: 0,
            totalAmount: 0,
          };
        }

        const studentId = inst.student.id;
        if (!acc[stageName].students.has(studentId)) {
          acc[stageName].students.set(studentId, {
            student: inst.student,
            installments: [],
            totalEducation: 0,
            totalCar: 0,
            totalDiscount: 0,
            totalAmount: 0,
          });
        }

        const studentData = acc[stageName].students.get(studentId);
        studentData.installments.push(inst);
        studentData.totalEducation += Number(inst.value || 0);
        studentData.totalCar += Number(inst.carValue || 0);
        studentData.totalDiscount += Number(inst.educationDiscount || 0) + Number(inst.carDiscount || 0);
        studentData.totalAmount += Number(inst.total || 0);

        acc[stageName].totalEducation += Number(inst.value || 0);
        acc[stageName].totalCar += Number(inst.carValue || 0);
        acc[stageName].totalDiscount += Number(inst.educationDiscount || 0) + Number(inst.carDiscount || 0);
        acc[stageName].totalAmount += Number(inst.total || 0);

        return acc;
      }, {});

      const allData = Object.values(groupedByStage).map((stageData: any) => ({
        ...stageData,
        students: Array.from(stageData.students.values()),
      }));

      // M16 fix (Item 35): `page`/`limit` were destructured from `options`
      // but never applied — every call returned every stage group (each
      // holding every matching student/installment) regardless of paging
      // params. Paginate the top-level stage groups; `summary` still totals
      // the full (unpaginated) installment set.
      const total = allData.length;
      const skip = (page - 1) * limit;
      const data = allData.slice(skip, skip + limit);

      return {
        data,
        summary: {
          totalStages: total,
          totalStudents: installments.reduce((sum, inst) => {
            const studentIds = new Set();
            installments.forEach((i) => studentIds.add(i.student.id));
            return studentIds.size;
          }, 0),
          totalAmount: installments.reduce((sum, inst) => sum + Number(inst.total || 0), 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating analytical education payments report');
      throw error;
    }
  }

  /**
   * Get Analytical Activity Payments Report
   */
  async getAnalyticalActivityPaymentsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    // Similar to education payments but focused on activity-related payments
    // For now, return same structure as education payments
    return this.getAnalyticalEducationPaymentsReport(filters, options);
  }

  /**
   * Get Analytical Car Payments Report
   */
  async getAnalyticalCarPaymentsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { fromDate, toDate, companyId, stageId, semesterId } = filters;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        student: {
          companyId,
          isActive: true,
          deletedAt: null,
        },
        date: {
          gte: fromDate,
          lte: toDate,
        },
        carValue: {
          gt: 0,
        },
      };

      if (stageId) {
        where.student = {
          ...where.student,
          stageId,
        };
      }

      if (semesterId) {
        where.student = {
          ...where.student,
          semesterId,
        };
      }

      const installments = await prisma.studentInstallment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              serial: true,
              studentName: true,
              stage: {
                select: {
                  id: true,
                  code: true,
                  arabicName: true,
                },
              },
            },
          },
        },
        orderBy: [{ student: { stage: { arabicName: 'asc' } } }, { student: { studentName: 'asc' } }],
      });

      // Group by stage
      const groupedByStage = installments.reduce((acc: any, inst: any) => {
        const stageName = inst.student.stage?.arabicName || 'غير محدد';
        if (!acc[stageName]) {
          acc[stageName] = {
            stage: inst.student.stage,
            totalCar: 0,
            totalCarDiscount: 0,
            totalCarAmount: 0,
            count: 0,
          };
        }

        acc[stageName].totalCar += Number(inst.carValue || 0);
        acc[stageName].totalCarDiscount += Number(inst.carDiscount || 0);
        acc[stageName].totalCarAmount += Number(inst.carValue || 0) - Number(inst.carDiscount || 0);
        acc[stageName].count += 1;

        return acc;
      }, {});

      const data = Object.values(groupedByStage);

      return {
        data,
        summary: {
          totalStages: data.length,
          totalCarAmount: installments.reduce((sum, inst) => sum + Number(inst.carValue || 0), 0),
          totalCarDiscount: installments.reduce((sum, inst) => sum + Number(inst.carDiscount || 0), 0),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating analytical car payments report');
      throw error;
    }
  }

  /**
   * Get Analytical Books Payments Report
   */
  async getAnalyticalBooksPaymentsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    // Similar structure to other analytical reports
    return this.getAnalyticalEducationPaymentsReport(filters, options);
  }

  /**
   * Get Consolidated Education Dues Report
   */
  async getConsolidatedEducationDuesReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, asOfDate } = filters;
      const { page = 1, limit = 1000 } = options;

      const where: any = {
        companyId,
        isActive: true,
        deletedAt: null,
      };

      if (stageId) {
        where.stageId = stageId;
      }

      if (semesterId) {
        where.semesterId = semesterId;
      }

      const students = await prisma.student.findMany({
        where,
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
            ...(asOfDate
              ? {
                  where: {
                    date: { lte: asOfDate },
                  },
                }
              : {}),
            orderBy: { installment: 'asc' },
          },
        },
        orderBy: [{ stage: { arabicName: 'asc' } }, { studentName: 'asc' }],
      });

      const consolidatedData = students.map((student) => {
        const totalDue = student.installments.reduce((sum, inst) => sum + Number(inst.total || 0), 0);
        const totalPaid = student.installments
          .filter((inst) => inst.isPaid)
          .reduce((sum, inst) => sum + Number(inst.total || 0), 0);
        const totalUnpaid = totalDue - totalPaid;

        return {
          student: {
            id: student.id,
            serial: student.serial,
            studentName: student.studentName,
            stage: student.stage,
            semester: student.semester,
          },
          totalInstallments: student.installments.length,
          paidInstallments: student.installments.filter((inst) => inst.isPaid).length,
          unpaidInstallments: student.installments.filter((inst) => !inst.isPaid).length,
          totalDue,
          totalPaid,
          totalUnpaid,
        };
      });

      // M16 fix (Item 35): pagination metadata was present but `data` was
      // never sliced by `page`/`limit` — every page returned every student.
      const total = consolidatedData.length;
      const skip = (page - 1) * limit;
      const pageData = consolidatedData.slice(skip, skip + limit);

      return {
        data: pageData,
        summary: {
          totalStudents: total,
          totalDue: consolidatedData.reduce((sum, item) => sum + item.totalDue, 0),
          totalPaid: consolidatedData.reduce((sum, item) => sum + item.totalPaid, 0),
          totalUnpaid: consolidatedData.reduce((sum, item) => sum + item.totalUnpaid, 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating consolidated education dues report');
      throw error;
    }
  }

  /**
   * Get Installment Payment Reports
   */
  async getInstallmentPaymentReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    // Similar to detailed payments but focused on installments
    return this.getDetailedPaymentsReport(filters, options);
  }

  /**
   * Get Academic Discount Report
   */
  async getAcademicDiscountReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        student: { companyId },
        educationDiscount: { gt: 0 },
      };

      if (stageId) where.student = { ...where.student, stageId };
      if (semesterId) where.student = { ...where.student, semesterId };
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            student: {
              include: {
                stage: true,
                semester: true,
              },
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const totalDiscount = installments.reduce(
        (sum, inst) => sum + Number(inst.educationDiscount || 0),
        0
      );

      return {
        data: installments,
        summary: {
          totalDiscount,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating academic discount report');
      throw error;
    }
  }

  /**
   * Get Bus Discount Report
   */
  async getBusDiscountReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        student: { companyId },
        carDiscount: { gt: 0 },
      };

      if (stageId) where.student = { ...where.student, stageId };
      if (semesterId) where.student = { ...where.student, semesterId };
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            student: {
              include: {
                stage: true,
                semester: true,
              },
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const totalDiscount = installments.reduce(
        (sum, inst) => sum + Number(inst.carDiscount || 0),
        0
      );

      return {
        data: installments,
        summary: {
          totalDiscount,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating bus discount report');
      throw error;
    }
  }

  /**
   * Get Discounts Report (All discounts)
   */
  async getDiscountsReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        student: { companyId },
        OR: [
          { educationDiscount: { gt: 0 } },
          { carDiscount: { gt: 0 } },
        ],
      };

      if (stageId) where.student = { ...where.student, stageId };
      if (semesterId) where.student = { ...where.student, semesterId };
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            student: {
              include: {
                stage: true,
                semester: true,
              },
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const totalEducationDiscount = installments.reduce(
        (sum, inst) => sum + Number(inst.educationDiscount || 0),
        0
      );
      const totalCarDiscount = installments.reduce(
        (sum, inst) => sum + Number(inst.carDiscount || 0),
        0
      );

      return {
        data: installments,
        summary: {
          totalEducationDiscount,
          totalCarDiscount,
          totalDiscount: totalEducationDiscount + totalCarDiscount,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating discounts report');
      throw error;
    }
  }

  /**
   * Get Students Data Report
   */
  async getStudentsDataReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId, studentId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        companyId,
        isActive: true,
        deletedAt: null,
      };

      if (stageId) where.stageId = stageId;
      if (semesterId) where.semesterId = semesterId;
      if (studentId) where.id = studentId;

      const skip = (page - 1) * limit;

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ stage: { arabicName: 'asc' } }, { studentName: 'asc' }],
          include: {
            stage: true,
            semester: true,
            installments: {
              orderBy: { installment: 'asc' },
            },
          },
        }),
        prisma.student.count({ where }),
      ]);

      return {
        data: students,
        summary: {
          totalStudents: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating students data report');
      throw error;
    }
  }

  /**
   * Get Cash Receipt Report
   */
  async getCashReceiptReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, fromDate, toDate } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      const where: any = {
        student: { companyId },
        isPaid: true,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      };

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            student: {
              include: {
                stage: true,
                semester: true,
              },
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const totalAmount = installments.reduce((sum, inst) => sum + Number(inst.total || 0), 0);

      return {
        data: installments,
        summary: {
          totalAmount,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating cash receipt report');
      throw error;
    }
  }

  /**
   * Get Aggregated Activity Dues Report
   */
  async getAggregatedActivityDuesReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Aggregated Activity Dues');
  }

  /**
   * Get Aggregated Books Dues Report
   */
  async getAggregatedBooksDuesReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Aggregated Books Dues');
  }

  /**
   * Get Aggregated Car Dues Report
   */
  async getAggregatedCarDuesReport(
    filters: SchoolsReportFilters,
    options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    try {
      const { companyId, stageId, semesterId } = filters;
      const { page = 1, limit = 100 } = options;

      const where: any = {
        student: { companyId },
        carValue: { gt: 0 },
      };

      if (stageId) where.student = { ...where.student, stageId };
      if (semesterId) where.student = { ...where.student, semesterId };

      const skip = (page - 1) * limit;

      const [installments, total] = await Promise.all([
        prisma.studentInstallment.findMany({
          where,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: {
            student: {
              include: {
                stage: true,
                semester: true,
              },
            },
          },
        }),
        prisma.studentInstallment.count({ where }),
      ]);

      const totalCarDues = installments.reduce((sum, inst) => sum + Number(inst.carValue || 0), 0);

      return {
        data: installments,
        summary: {
          totalCarDues,
          totalCount: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating aggregated car dues report');
      throw error;
    }
  }

  /**
   * Get Aggregated Other Dues Report
   */
  async getAggregatedOtherDuesReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Aggregated Other Dues');
  }

  /**
   * Get Analytical Other Payments Report
   */
  async getAnalyticalOtherPaymentsReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Analytical Other Payments');
  }

  /**
   * Get Other Discount Report
   */
  async getOtherDiscountReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Other Discount');
  }

  /**
   * Get Partner Discount Report
   */
  async getPartnerDiscountReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Partner Discount');
  }

  /**
   * Get Partner Children Discounts Report
   */
  async getPartnerChildrenDiscountsReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Partner Children Discounts');
  }

  /**
   * Get Sibling Discounts Report
   */
  async getSiblingDiscountsReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Sibling Discounts');
  }

  /**
   * Get Management Shares Activity Report
   */
  async getManagementSharesActivityReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Management Shares Activity');
  }

  /**
   * Get Project Support Fund Report
   */
  async getProjectSupportFundReport(
    _filters: SchoolsReportFilters,
    _options: SchoolsReportOptions = {}
  ): Promise<SchoolsReportResult> {
    throw new ReportNotImplementedError('Project Support Fund');
  }
}

export const schoolsReportsService = new SchoolsReportsService();

