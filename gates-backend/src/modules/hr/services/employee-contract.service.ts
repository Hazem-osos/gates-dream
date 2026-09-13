import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateEmployeeContractData {
  employeeId: string;
  serial?: string;
  contractStartDate: Date;
  contractEndDate?: Date;
  wagePolicyId?: string;
  basicSalary?: number;
  insuranceSalary?: number;
  insurancePercentage?: number;
  paymentMethod?: string;
  employeeResponsibility?: number;
  companyResponsibility?: number;
  leaveBalance?: number;
  departmentId?: string;
  sectionId?: string;
  jobCadreId?: string;
  jobTitleId?: string;
  cityId?: string;
  workBranchId?: string;
  salaryBranchId?: string;
  costCenterId?: string;
  autoRenewal?: boolean;
  attendancePolicy?: boolean;
  incomeTax?: boolean;
  generalNotes?: string;
}

export interface UpdateEmployeeContractData extends Partial<CreateEmployeeContractData> {
  isActive?: boolean;
}

export class EmployeeContractService {
  /**
   * Calculate insurance and responsibility amounts
   */
  private calculateInsurance(
    insuranceSalary: number | undefined,
    insurancePercentage: number | undefined
  ): { employeeResponsibility: number; companyResponsibility: number } {
    if (!insuranceSalary || !insurancePercentage) {
      return { employeeResponsibility: 0, companyResponsibility: 0 };
    }

    const totalInsurance = (insuranceSalary * insurancePercentage) / 100;
    // Typically split 50/50 or based on company policy
    const employeeResponsibility = totalInsurance / 2;
    const companyResponsibility = totalInsurance / 2;

    return { employeeResponsibility, companyResponsibility };
  }

  /**
   * Create a new employee contract
   */
  async createEmployeeContract(
    companyId: string,
    data: CreateEmployeeContractData
  ) {
    try {
      // Verify employee belongs to company
      const employee = await prisma.employee.findFirst({
        where: { id: data.employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Validate contract dates
      if (data.contractEndDate && data.contractStartDate >= data.contractEndDate) {
        throw new Error('Contract start date must be before end date');
      }

      // Calculate insurance responsibilities if provided
      let employeeResponsibility = data.employeeResponsibility;
      let companyResponsibility = data.companyResponsibility;

      if (
        data.insuranceSalary &&
        data.insurancePercentage &&
        !employeeResponsibility &&
        !companyResponsibility
      ) {
        const calculated = this.calculateInsurance(
          data.insuranceSalary,
          data.insurancePercentage
        );
        employeeResponsibility = calculated.employeeResponsibility;
        companyResponsibility = calculated.companyResponsibility;
      }

      // If wagePolicyId is provided, verify it belongs to company
      if (data.wagePolicyId) {
        const wagePolicy = await prisma.wagePolicy.findFirst({
          where: { id: data.wagePolicyId, companyId },
        });

        if (!wagePolicy) {
          throw new Error('Wage policy not found');
        }
      }

      const contract = await prisma.employeeContract.create({
        data: {
          employeeId: data.employeeId,
          serial: data.serial,
          contractStartDate: data.contractStartDate,
          contractEndDate: data.contractEndDate,
          wagePolicyId: data.wagePolicyId,
          basicSalary: data.basicSalary
            ? new Decimal(data.basicSalary)
            : null,
          insuranceSalary: data.insuranceSalary
            ? new Decimal(data.insuranceSalary)
            : null,
          insurancePercentage: data.insurancePercentage
            ? new Decimal(data.insurancePercentage)
            : null,
          paymentMethod: data.paymentMethod,
          employeeResponsibility: employeeResponsibility
            ? new Decimal(employeeResponsibility)
            : null,
          companyResponsibility: companyResponsibility
            ? new Decimal(companyResponsibility)
            : null,
          leaveBalance: data.leaveBalance
            ? new Decimal(data.leaveBalance)
            : null,
          departmentId: data.departmentId,
          sectionId: data.sectionId,
          jobCadreId: data.jobCadreId,
          jobTitleId: data.jobTitleId,
          cityId: data.cityId,
          workBranchId: data.workBranchId,
          salaryBranchId: data.salaryBranchId,
          costCenterId: data.costCenterId,
          autoRenewal: data.autoRenewal || false,
          attendancePolicy: data.attendancePolicy !== undefined
            ? data.attendancePolicy
            : true,
          incomeTax: data.incomeTax !== undefined ? data.incomeTax : true,
          generalNotes: data.generalNotes,
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
          wagePolicy: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobTitle: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobCadre: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          city: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          costCenter: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info(
        { companyId, contractId: contract.id, employeeId: data.employeeId },
        'Employee contract created'
      );
      return contract;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating employee contract');
      throw error;
    }
  }

  /**
   * Get employee contract by ID
   */
  async getEmployeeContractById(
    companyId: string,
    contractId: string
  ) {
    try {
      const contract = await prisma.employeeContract.findFirst({
        where: {
          id: contractId,
          employee: {
            companyId,
          },
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
          wagePolicy: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobTitle: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobCadre: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          city: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          costCenter: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      if (!contract) {
        throw new Error('Employee contract not found');
      }

      return contract;
    } catch (error) {
      logger.error(
        { error, companyId, contractId },
        'Error getting employee contract'
      );
      throw error;
    }
  }

  /**
   * List employee contracts with pagination and filters
   */
  async listEmployeeContracts(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      employeeId?: string;
      departmentId?: string;
      jobTitleId?: string;
      isActive?: boolean;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const where: any = {
        employee: {
          companyId,
        },
      };

      if (options.search) {
        where.OR = [
          { serial: { contains: options.search } },
          { generalNotes: { contains: options.search } },
          { employee: { arabicName: { contains: options.search } } },
          { employee: { englishName: { contains: options.search } } },
        ];
      }

      if (options.employeeId) {
        where.employeeId = options.employeeId;
      }

      if (options.departmentId) {
        where.departmentId = options.departmentId;
      }

      if (options.jobTitleId) {
        where.jobTitleId = options.jobTitleId;
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.startDate || options.endDate) {
        where.contractStartDate = {};
        if (options.startDate) where.contractStartDate.gte = options.startDate;
        if (options.endDate) where.contractStartDate.lte = options.endDate;
      }

      const [contracts, total] = await Promise.all([
        prisma.employeeContract.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ contractStartDate: 'desc' }],
          include: {
            employee: {
              select: {
                id: true,
                serial: true,
                employeeId: true,
                arabicName: true,
              },
            },
            department: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            jobTitle: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
          },
        }),
        prisma.employeeContract.count({ where }),
      ]);

      return {
        contracts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error(
        { error, companyId, options },
        'Error listing employee contracts'
      );
      throw error;
    }
  }

  /**
   * Update employee contract
   */
  async updateEmployeeContract(
    companyId: string,
    contractId: string,
    data: UpdateEmployeeContractData
  ) {
    try {
      const existing = await prisma.employeeContract.findFirst({
        where: {
          id: contractId,
          employee: {
            companyId,
          },
        },
      });

      if (!existing) {
        throw new Error('Employee contract not found');
      }

      // Validate contract dates if being updated
      if (data.contractStartDate && data.contractEndDate) {
        if (data.contractStartDate >= data.contractEndDate) {
          throw new Error('Contract start date must be before end date');
        }
      }

      if (
        data.contractStartDate &&
        existing.contractEndDate &&
        data.contractStartDate >= existing.contractEndDate
      ) {
        throw new Error('Contract start date must be before end date');
      }

      if (
        data.contractEndDate &&
        existing.contractStartDate >= data.contractEndDate
      ) {
        throw new Error('Contract start date must be before end date');
      }

      // Calculate insurance if being updated
      let employeeResponsibility = data.employeeResponsibility;
      let companyResponsibility = data.companyResponsibility;

      if (
        (data.insuranceSalary !== undefined || data.insurancePercentage !== undefined) &&
        !employeeResponsibility &&
        !companyResponsibility
      ) {
        const insuranceSalary =
          data.insuranceSalary ?? Number(existing.insuranceSalary || 0);
        const insurancePercentage =
          data.insurancePercentage ??
          Number(existing.insurancePercentage || 0);

        if (insuranceSalary && insurancePercentage) {
          const calculated = this.calculateInsurance(
            insuranceSalary,
            insurancePercentage
          );
          employeeResponsibility = calculated.employeeResponsibility;
          companyResponsibility = calculated.companyResponsibility;
        }
      }

      const updateData: any = {};

      if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.contractStartDate !== undefined)
        updateData.contractStartDate = data.contractStartDate;
      if (data.contractEndDate !== undefined)
        updateData.contractEndDate = data.contractEndDate;
      if (data.wagePolicyId !== undefined)
        updateData.wagePolicyId = data.wagePolicyId;
      if (data.basicSalary !== undefined)
        updateData.basicSalary = data.basicSalary
          ? new Decimal(data.basicSalary)
          : null;
      if (data.insuranceSalary !== undefined)
        updateData.insuranceSalary = data.insuranceSalary
          ? new Decimal(data.insuranceSalary)
          : null;
      if (data.insurancePercentage !== undefined)
        updateData.insurancePercentage = data.insurancePercentage
          ? new Decimal(data.insurancePercentage)
          : null;
      if (data.paymentMethod !== undefined)
        updateData.paymentMethod = data.paymentMethod;
      if (employeeResponsibility !== undefined)
        updateData.employeeResponsibility = employeeResponsibility
          ? new Decimal(employeeResponsibility)
          : null;
      if (companyResponsibility !== undefined)
        updateData.companyResponsibility = companyResponsibility
          ? new Decimal(companyResponsibility)
          : null;
      if (data.leaveBalance !== undefined)
        updateData.leaveBalance = data.leaveBalance
          ? new Decimal(data.leaveBalance)
          : null;
      if (data.departmentId !== undefined)
        updateData.departmentId = data.departmentId;
      if (data.sectionId !== undefined) updateData.sectionId = data.sectionId;
      if (data.jobCadreId !== undefined)
        updateData.jobCadreId = data.jobCadreId;
      if (data.jobTitleId !== undefined)
        updateData.jobTitleId = data.jobTitleId;
      if (data.cityId !== undefined) updateData.cityId = data.cityId;
      if (data.workBranchId !== undefined)
        updateData.workBranchId = data.workBranchId;
      if (data.salaryBranchId !== undefined)
        updateData.salaryBranchId = data.salaryBranchId;
      if (data.costCenterId !== undefined)
        updateData.costCenterId = data.costCenterId;
      if (data.autoRenewal !== undefined)
        updateData.autoRenewal = data.autoRenewal;
      if (data.attendancePolicy !== undefined)
        updateData.attendancePolicy = data.attendancePolicy;
      if (data.incomeTax !== undefined) updateData.incomeTax = data.incomeTax;
      if (data.generalNotes !== undefined)
        updateData.generalNotes = data.generalNotes;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const contract = await prisma.employeeContract.update({
        where: { id: contractId },
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
          wagePolicy: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          department: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobTitle: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          jobCadre: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          city: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          costCenter: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, contractId }, 'Employee contract updated');
      return contract;
    } catch (error) {
      logger.error(
        { error, companyId, contractId, data },
        'Error updating employee contract'
      );
      throw error;
    }
  }

  /**
   * Delete employee contract (soft delete)
   */
  async deleteEmployeeContract(companyId: string, contractId: string) {
    try {
      const contract = await prisma.employeeContract.findFirst({
        where: {
          id: contractId,
          employee: {
            companyId,
          },
        },
      });

      if (!contract) {
        throw new Error('Employee contract not found');
      }

      await prisma.employeeContract.update({
        where: { id: contractId },
        data: { isActive: false },
      });

      logger.info({ companyId, contractId }, 'Employee contract deleted');
      return { success: true };
    } catch (error) {
      logger.error(
        { error, companyId, contractId },
        'Error deleting employee contract'
      );
      throw error;
    }
  }
}

export const employeeContractService = new EmployeeContractService();
