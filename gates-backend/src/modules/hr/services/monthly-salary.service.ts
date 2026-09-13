import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateMonthlySalaryData {
  employeeId: string;
  contractId?: string;
  serial?: string;
  periodYear: string;
  periodMonth: string;
  date: Date;
  hijriDate?: string;
  workDays?: number;
  basicSalary: number;
  totalAllowances?: number;
  totalDeductions?: number;
  additions?: number;
  discounts?: number;
  overtime?: number;
  absence?: number;
  advances?: number;
  employeeInsurance?: number;
  companyInsurance?: number;
  netSalary: number;
  record?: string;
  notes?: string;
}

export interface UpdateMonthlySalaryData extends Partial<CreateMonthlySalaryData> {
  isActive?: boolean;
}

export class MonthlySalaryService {
  /**
   * Create a new monthly salary
   */
  async createMonthlySalary(companyId: string, data: CreateMonthlySalaryData) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Verify contract if provided
      if (data.contractId) {
        const contract = await prisma.employeeContract.findFirst({
          where: {
            id: data.contractId,
            employeeId: data.employeeId,
            employee: { companyId },
          },
        });

        if (!contract) {
          throw new Error('Employee contract not found');
        }
      }

      // Check for duplicate salary for same period
      const existing = await prisma.monthlySalary.findFirst({
        where: {
          companyId,
          employeeId: data.employeeId,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
        },
      });

      if (existing) {
        throw new Error(
          `Monthly salary already exists for employee ${data.employeeId} for period ${data.periodYear}-${data.periodMonth}`
        );
      }

      // Create monthly salary
      const salary = await prisma.monthlySalary.create({
        data: {
          companyId,
          employeeId: data.employeeId,
          contractId: data.contractId,
          serial: data.serial,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
          date: data.date,
          hijriDate: data.hijriDate,
          workDays: data.workDays ? new Decimal(data.workDays) : null,
          basicSalary: new Decimal(data.basicSalary),
          totalAllowances: data.totalAllowances
            ? new Decimal(data.totalAllowances)
            : null,
          totalDeductions: data.totalDeductions
            ? new Decimal(data.totalDeductions)
            : null,
          additions: data.additions ? new Decimal(data.additions) : null,
          discounts: data.discounts ? new Decimal(data.discounts) : null,
          overtime: data.overtime ? new Decimal(data.overtime) : null,
          absence: data.absence ? new Decimal(data.absence) : null,
          advances: data.advances ? new Decimal(data.advances) : null,
          employeeInsurance: data.employeeInsurance
            ? new Decimal(data.employeeInsurance)
            : null,
          companyInsurance: data.companyInsurance
            ? new Decimal(data.companyInsurance)
            : null,
          netSalary: new Decimal(data.netSalary),
          record: data.record,
          notes: data.notes,
          isActive: true,
        },
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
          contract: {
            select: {
              id: true,
              serial: true,
              basicSalary: true,
            },
          },
        },
      });

      logger.info(
        { companyId, salaryId: salary.id, employeeId: data.employeeId },
        'Monthly salary created'
      );
      return salary;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating monthly salary');
      throw error;
    }
  }

  /**
   * Get monthly salary by ID
   */
  async getMonthlySalaryById(companyId: string, salaryId: string) {
    try {
      const salary = await prisma.monthlySalary.findFirst({
        where: {
          id: salaryId,
          companyId,
        },
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
          contract: {
            select: {
              id: true,
              serial: true,
              basicSalary: true,
            },
          },
        },
      });

      if (!salary) {
        throw new Error('Monthly salary not found');
      }

      return salary;
    } catch (error) {
      logger.error({ error, companyId, salaryId }, 'Error getting monthly salary');
      throw error;
    }
  }

  /**
   * List monthly salaries with pagination and filters
   */
  async listMonthlySalaries(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      employeeId?: string;
      contractId?: string;
      periodYear?: string;
      periodMonth?: string;
      fromDate?: Date;
      toDate?: Date;
      search?: string;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        companyId,
        isActive: true,
      };

      if (options.search) {
        where.OR = [
          { serial: { contains: options.search } },
          { record: { contains: options.search } },
          { notes: { contains: options.search } },
          { employee: { arabicName: { contains: options.search } } },
          { employee: { englishName: { contains: options.search } } },
        ];
      }

      if (options.employeeId) {
        where.employeeId = options.employeeId;
      }

      if (options.contractId) {
        where.contractId = options.contractId;
      }

      if (options.periodYear) {
        where.periodYear = options.periodYear;
      }

      if (options.periodMonth) {
        where.periodMonth = options.periodMonth;
      }

      if (options.fromDate || options.toDate) {
        where.date = {};
        if (options.fromDate) where.date.gte = options.fromDate;
        if (options.toDate) where.date.lte = options.toDate;
      }

      const [salaries, total] = await Promise.all([
        prisma.monthlySalary.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ date: 'desc' }, { periodYear: 'desc' }, { periodMonth: 'desc' }],
          include: {
            employee: {
              select: {
                id: true,
                serial: true,
                employeeId: true,
                arabicName: true,
                englishName: true,
              },
            },
            contract: {
              select: {
                id: true,
                serial: true,
                basicSalary: true,
              },
            },
          },
        }),
        prisma.monthlySalary.count({ where }),
      ]);

      return {
        salaries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing monthly salaries');
      throw error;
    }
  }

  /**
   * Update monthly salary
   */
  async updateMonthlySalary(
    companyId: string,
    salaryId: string,
    data: UpdateMonthlySalaryData
  ) {
    try {
      const existing = await prisma.monthlySalary.findFirst({
        where: {
          id: salaryId,
          companyId,
        },
      });

      if (!existing) {
        throw new Error('Monthly salary not found');
      }

      // Check for duplicate if period is being changed
      if (data.periodYear || data.periodMonth) {
        const periodYear = data.periodYear || existing.periodYear;
        const periodMonth = data.periodMonth || existing.periodMonth;
        const employeeId = data.employeeId || existing.employeeId;

        const duplicate = await prisma.monthlySalary.findFirst({
          where: {
            companyId,
            employeeId,
            periodYear,
            periodMonth,
            id: { not: salaryId },
          },
        });

        if (duplicate) {
          throw new Error(
            `Monthly salary already exists for employee ${employeeId} for period ${periodYear}-${periodMonth}`
          );
        }
      }

      const updateData: any = {};

      if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
      if (data.contractId !== undefined) updateData.contractId = data.contractId;
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.periodYear !== undefined) updateData.periodYear = data.periodYear;
      if (data.periodMonth !== undefined) updateData.periodMonth = data.periodMonth;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.hijriDate !== undefined) updateData.hijriDate = data.hijriDate;
      if (data.workDays !== undefined)
        updateData.workDays = data.workDays ? new Decimal(data.workDays) : null;
      if (data.basicSalary !== undefined)
        updateData.basicSalary = new Decimal(data.basicSalary);
      if (data.totalAllowances !== undefined)
        updateData.totalAllowances = data.totalAllowances
          ? new Decimal(data.totalAllowances)
          : null;
      if (data.totalDeductions !== undefined)
        updateData.totalDeductions = data.totalDeductions
          ? new Decimal(data.totalDeductions)
          : null;
      if (data.additions !== undefined)
        updateData.additions = data.additions ? new Decimal(data.additions) : null;
      if (data.discounts !== undefined)
        updateData.discounts = data.discounts ? new Decimal(data.discounts) : null;
      if (data.overtime !== undefined)
        updateData.overtime = data.overtime ? new Decimal(data.overtime) : null;
      if (data.absence !== undefined)
        updateData.absence = data.absence ? new Decimal(data.absence) : null;
      if (data.advances !== undefined)
        updateData.advances = data.advances ? new Decimal(data.advances) : null;
      if (data.employeeInsurance !== undefined)
        updateData.employeeInsurance = data.employeeInsurance
          ? new Decimal(data.employeeInsurance)
          : null;
      if (data.companyInsurance !== undefined)
        updateData.companyInsurance = data.companyInsurance
          ? new Decimal(data.companyInsurance)
          : null;
      if (data.netSalary !== undefined)
        updateData.netSalary = new Decimal(data.netSalary);
      if (data.record !== undefined) updateData.record = data.record;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const salary = await prisma.monthlySalary.update({
        where: { id: salaryId },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              serial: true,
              employeeId: true,
              arabicName: true,
              englishName: true,
            },
          },
          contract: {
            select: {
              id: true,
              serial: true,
              basicSalary: true,
            },
          },
        },
      });

      logger.info({ companyId, salaryId }, 'Monthly salary updated');
      return salary;
    } catch (error) {
      logger.error({ error, companyId, salaryId, data }, 'Error updating monthly salary');
      throw error;
    }
  }

  /**
   * Delete monthly salary
   */
  async deleteMonthlySalary(companyId: string, salaryId: string) {
    try {
      const salary = await prisma.monthlySalary.findFirst({
        where: {
          id: salaryId,
          companyId,
        },
      });

      if (!salary) {
        throw new Error('Monthly salary not found');
      }

      await prisma.monthlySalary.update({
        where: { id: salaryId },
        data: { isActive: false },
      });

      logger.info({ companyId, salaryId }, 'Monthly salary deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, salaryId }, 'Error deleting monthly salary');
      throw error;
    }
  }
}

export const monthlySalaryService = new MonthlySalaryService();

