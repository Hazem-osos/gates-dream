import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export interface CreateEmployeeData {
  serial?: string;
  employeeId?: string;
  arabicName: string;
  englishName?: string;
  userId?: string;
  gender?: string;
  nationalityId?: string;
  religionId?: string;
  maritalStatusId?: string;
  birthDate?: Date;
  academicQualification?: string;
  specialization?: string;
  university?: string;
  passportNumber?: string;
  insurancePolicyNumber?: string;
  socialInsurance?: string;
  joinDate?: Date;
  basicSalary?: number;
  departmentId?: string;
  advanceAccountId?: string;
  // Identity Document Fields
  fingerprintNumber?: string;
  identityNumber?: string;
  identityIssueDate?: Date;
  identityIssueDateHijri?: string;
  identityExpiryDate?: Date;
  identityExpiryDateHijri?: string;
  // Passport Fields
  passportIssueDate?: Date;
  passportIssueDateHijri?: string;
  passportExpiryDate?: Date;
  passportExpiryDateHijri?: string;
  // Graduation Date
  graduationDate?: Date;
  graduationDateHijri?: string;
  // Insurance Dates
  insuranceIssueDate?: Date;
  insuranceIssueDateHijri?: string;
  insuranceExpiryDate?: Date;
  insuranceExpiryDateHijri?: string;
  // Contact Information
  mobile?: string;
  homePhone?: string;
  workPhone?: string;
  address?: string;
  city?: string;
}

export interface UpdateEmployeeData extends Partial<CreateEmployeeData> {
  isActive?: boolean;
}

export class EmployeeService {
  /**
   * Create a new employee
   */
  async createEmployee(companyId: string, data: CreateEmployeeData) {
    try {
      const employee = await prisma.employee.create({
        data: {
          companyId,
          serial: data.serial,
          employeeId: data.employeeId,
          arabicName: data.arabicName,
          englishName: data.englishName,
          userId: data.userId,
          gender: data.gender,
          nationalityId: data.nationalityId,
          religionId: data.religionId,
          maritalStatusId: data.maritalStatusId,
          birthDate: data.birthDate,
          academicQualification: data.academicQualification,
          specialization: data.specialization,
          university: data.university,
          passportNumber: data.passportNumber,
          insurancePolicyNumber: data.insurancePolicyNumber,
          socialInsurance: data.socialInsurance,
          joinDate: data.joinDate,
          basicSalary: data.basicSalary,
          departmentId: data.departmentId,
          advanceAccountId: data.advanceAccountId,
          // Identity Document Fields
          fingerprintNumber: data.fingerprintNumber,
          identityNumber: data.identityNumber,
          identityIssueDate: data.identityIssueDate,
          identityIssueDateHijri: data.identityIssueDateHijri,
          identityExpiryDate: data.identityExpiryDate,
          identityExpiryDateHijri: data.identityExpiryDateHijri,
          // Passport Fields
          passportIssueDate: data.passportIssueDate,
          passportIssueDateHijri: data.passportIssueDateHijri,
          passportExpiryDate: data.passportExpiryDate,
          passportExpiryDateHijri: data.passportExpiryDateHijri,
          // Graduation Date
          graduationDate: data.graduationDate,
          graduationDateHijri: data.graduationDateHijri,
          // Insurance Dates
          insuranceIssueDate: data.insuranceIssueDate,
          insuranceIssueDateHijri: data.insuranceIssueDateHijri,
          insuranceExpiryDate: data.insuranceExpiryDate,
          insuranceExpiryDateHijri: data.insuranceExpiryDateHijri,
          // Contact Information
          mobile: data.mobile,
          homePhone: data.homePhone,
          workPhone: data.workPhone,
          address: data.address,
          city: data.city,
        },
        include: {
          nationality: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          religion: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          maritalStatus: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          contracts: {
            where: { isActive: true },
            orderBy: { contractStartDate: 'desc' },
            take: 1,
          },
        },
      });

      logger.info({ companyId, employeeId: employee.id }, 'Employee created');
      return employee;
    } catch (error) {
      logger.error({ error, companyId, data }, 'Error creating employee');
      throw error;
    }
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(companyId: string, employeeId: string) {
    try {
      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          companyId,
        },
        include: {
          nationality: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          religion: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          maritalStatus: {
            select: {
              id: true,
              code: true,
              arabicName: true,
              englishName: true,
            },
          },
          contracts: {
            where: { isActive: true },
            orderBy: { contractStartDate: 'desc' },
            include: {
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
          },
          procedures: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      return employee;
    } catch (error) {
      logger.error({ error, companyId, employeeId }, 'Error getting employee');
      throw error;
    }
  }

  /**
   * List employees with pagination and filters
   */
  async listEmployees(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      departmentId?: string;
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
          { serial: { contains: options.search } },
          { employeeId: { contains: options.search } },
        ];
      }

      if (options.isActive !== undefined) {
        where.isActive = options.isActive;
      }

      if (options.departmentId) {
        where.contracts = {
          some: {
            departmentId: options.departmentId,
            isActive: true,
          },
        };
      }

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
          include: {
            nationality: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            contracts: {
              where: { isActive: true },
              orderBy: { contractStartDate: 'desc' },
              take: 1,
              include: {
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
            },
          },
        }),
        prisma.employee.count({ where }),
      ]);

      return {
        employees,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, companyId, options }, 'Error listing employees');
      throw error;
    }
  }

  /**
   * Update employee
   */
  async updateEmployee(
    companyId: string,
    employeeId: string,
    data: UpdateEmployeeData
  ) {
    try {
      const existing = await prisma.employee.findFirst({
        where: { id: employeeId, companyId },
      });

      if (!existing) {
        throw new Error('Employee not found');
      }

      const updateData: any = {};

      // Basic fields
      if (data.serial !== undefined) updateData.serial = data.serial;
      if (data.employeeId !== undefined) updateData.employeeId = data.employeeId;
      if (data.arabicName !== undefined) updateData.arabicName = data.arabicName;
      if (data.englishName !== undefined) updateData.englishName = data.englishName;
      if (data.userId !== undefined) updateData.userId = data.userId;
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.nationalityId !== undefined) updateData.nationalityId = data.nationalityId;
      if (data.religionId !== undefined) updateData.religionId = data.religionId;
      if (data.maritalStatusId !== undefined) updateData.maritalStatusId = data.maritalStatusId;
      if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;
      if (data.academicQualification !== undefined) updateData.academicQualification = data.academicQualification;
      if (data.specialization !== undefined) updateData.specialization = data.specialization;
      if (data.university !== undefined) updateData.university = data.university;
      if (data.passportNumber !== undefined) updateData.passportNumber = data.passportNumber;
      if (data.insurancePolicyNumber !== undefined) updateData.insurancePolicyNumber = data.insurancePolicyNumber;
      if (data.socialInsurance !== undefined) updateData.socialInsurance = data.socialInsurance;
      if (data.joinDate !== undefined) updateData.joinDate = data.joinDate;
      if (data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary;
      if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
      if (data.advanceAccountId !== undefined) updateData.advanceAccountId = data.advanceAccountId;
      // Identity Document Fields
      if (data.fingerprintNumber !== undefined) updateData.fingerprintNumber = data.fingerprintNumber;
      if (data.identityNumber !== undefined) updateData.identityNumber = data.identityNumber;
      if (data.identityIssueDate !== undefined) updateData.identityIssueDate = data.identityIssueDate;
      if (data.identityIssueDateHijri !== undefined) updateData.identityIssueDateHijri = data.identityIssueDateHijri;
      if (data.identityExpiryDate !== undefined) updateData.identityExpiryDate = data.identityExpiryDate;
      if (data.identityExpiryDateHijri !== undefined) updateData.identityExpiryDateHijri = data.identityExpiryDateHijri;
      // Passport Fields
      if (data.passportIssueDate !== undefined) updateData.passportIssueDate = data.passportIssueDate;
      if (data.passportIssueDateHijri !== undefined) updateData.passportIssueDateHijri = data.passportIssueDateHijri;
      if (data.passportExpiryDate !== undefined) updateData.passportExpiryDate = data.passportExpiryDate;
      if (data.passportExpiryDateHijri !== undefined) updateData.passportExpiryDateHijri = data.passportExpiryDateHijri;
      // Graduation Date
      if (data.graduationDate !== undefined) updateData.graduationDate = data.graduationDate;
      if (data.graduationDateHijri !== undefined) updateData.graduationDateHijri = data.graduationDateHijri;
      // Insurance Dates
      if (data.insuranceIssueDate !== undefined) updateData.insuranceIssueDate = data.insuranceIssueDate;
      if (data.insuranceIssueDateHijri !== undefined) updateData.insuranceIssueDateHijri = data.insuranceIssueDateHijri;
      if (data.insuranceExpiryDate !== undefined) updateData.insuranceExpiryDate = data.insuranceExpiryDate;
      if (data.insuranceExpiryDateHijri !== undefined) updateData.insuranceExpiryDateHijri = data.insuranceExpiryDateHijri;
      // Contact Information
      if (data.mobile !== undefined) updateData.mobile = data.mobile;
      if (data.homePhone !== undefined) updateData.homePhone = data.homePhone;
      if (data.workPhone !== undefined) updateData.workPhone = data.workPhone;
      if (data.address !== undefined) updateData.address = data.address;
      if (data.city !== undefined) updateData.city = data.city;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const employee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
        include: {
          nationality: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
          religion: {
            select: {
              id: true,
              code: true,
              arabicName: true,
            },
          },
        },
      });

      logger.info({ companyId, employeeId }, 'Employee updated');
      return employee;
    } catch (error) {
      logger.error({ error, companyId, employeeId, data }, 'Error updating employee');
      throw error;
    }
  }

  /**
   * Delete employee (soft delete)
   */
  async deleteEmployee(companyId: string, employeeId: string) {
    try {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, companyId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: { isActive: false },
      });

      logger.info({ companyId, employeeId }, 'Employee deleted');
      return { success: true };
    } catch (error) {
      logger.error({ error, companyId, employeeId }, 'Error deleting employee');
      throw error;
    }
  }
}

export const employeeService = new EmployeeService();
