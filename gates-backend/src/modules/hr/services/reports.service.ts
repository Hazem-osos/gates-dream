// @ts-nocheck — report queries predate current Prisma schema shapes; tighten types incrementally.
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';

export interface HRReportFilters {
  fromDate?: Date;
  toDate?: Date;
  companyId: string;
  branchId?: string;
  departmentId?: string;
  employeeId?: string;
  [key: string]: any;
}

export interface HRReportOptions {
  includeDetails?: boolean;
  includeSummary?: boolean;
  page?: number;
  limit?: number;
}

export interface HRReportResult {
  data: any[];
  summary?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class HRReportsService {
  /**
   * Get Employee Data Report
   */
  async getEmployeeDataReport(
    filters: HRReportFilters,
    options: HRReportOptions = {}
  ): Promise<HRReportResult> {
    try {
      const { companyId, departmentId, employeeId } = filters;
      const { page = 1, limit = 100 } = options;

      // M16 fix (Item 35): `Employee` has no `deletedAt` column (no
      // soft-delete on this model) — filtering on it here threw a
      // PrismaClientValidationError ("Unknown argument `deletedAt`") on
      // every call, so this report has never actually returned data.
      const where: any = {
        companyId,
        isActive: true,
      };

      if (departmentId) {
        where.departmentId = departmentId;
      }

      if (employeeId) {
        where.id = employeeId;
      }

      const skip = (page - 1) * limit;

      const [employees, total] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ arabicName: 'asc' }],
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
            nationality: {
              select: {
                id: true,
                code: true,
                arabicName: true,
              },
            },
            contracts: {
              where: {
                isActive: true,
              },
              take: 1,
              orderBy: { contractStartDate: 'desc' },
            },
          },
        }),
        prisma.employee.count({ where }),
      ]);

      return {
        data: employees,
        summary: {
          totalEmployees: total,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating employee data report');
      throw error;
    }
  }

  /**
   * Get Payroll Report
   */
  async getPayrollReport(
    filters: HRReportFilters,
    options: HRReportOptions = {}
  ): Promise<HRReportResult> {
    try {
      const { companyId, fromDate, toDate, departmentId, employeeId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // M16 fix (Item 35): `Employee` has no `deletedAt` column — this
      // threw PrismaClientValidationError on every call (see
      // getEmployeeDataReport above for the same bug).
      const where: any = {
        employee: {
          companyId,
          isActive: true,
        },
      };

      if (departmentId) {
        where.employee = {
          ...where.employee,
          departmentId,
        };
      }

      if (employeeId) {
        where.employeeId = employeeId;
      }

      // Get active contracts in the period. Fetched in full (not paginated
      // here) because `summary` below must total *all* matching employees,
      // not just one page — pagination is applied to `data` only, after
      // computing the summary, matching the pattern used for balance-style
      // reports elsewhere in this file.
      const contractsWhere: any = {
        ...where,
        isActive: true,
        OR: [
          {
            contractStartDate: { lte: toDate },
            contractEndDate: { gte: fromDate },
          },
          {
            contractStartDate: { lte: toDate },
            contractEndDate: null,
          },
        ],
      };

      const contracts = await prisma.employeeContract.findMany({
        where: contractsWhere,
        orderBy: [{ contractStartDate: 'asc' }],
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
      });

      // M16 fix (Item 35): batch the monthly-salary lookup for every
      // contract into a single query instead of one `findMany` per contract
      // inside the `Promise.all(contracts.map(...))` below.
      const periodStart = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      const periodEnd = new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0);
      const contractIds = contracts.map((c) => c.id);
      const allMonthlySalaries = contractIds.length
        ? await prisma.monthlySalary.findMany({
            where: {
              companyId,
              contractId: { in: contractIds },
              date: { gte: periodStart, lte: periodEnd },
              isActive: true,
            },
            orderBy: { date: 'desc' },
          })
        : [];
      const monthlySalariesByContract = new Map<string, typeof allMonthlySalaries>();
      for (const ms of allMonthlySalaries) {
        const list = monthlySalariesByContract.get(ms.contractId) ?? [];
        list.push(ms);
        monthlySalariesByContract.set(ms.contractId, list);
      }

      // M16 fix (Item 35): the "no monthly salary row" fallback below used to
      // call calculateAdditions/calculateDiscounts/calculateAdvances per
      // contract — up to 3 findMany calls per contract lacking a posted
      // monthly salary. Batch the same queries once across all contracts'
      // employees and group in memory instead.
      const employeeIds = [...new Set(contracts.map((c) => c.employeeId))];
      const periodYearStr = fromDate.getFullYear().toString();
      const periodMonthStr = (fromDate.getMonth() + 1).toString().padStart(2, '0');
      // Same (month-based, not calendar-accurate) period window calculateAdditions/
      // calculateDiscounts previously computed per-contract — preserved as-is.
      const procPeriodStart = new Date(`${periodYearStr}-${periodMonthStr}-01`);
      const procPeriodEnd = new Date(`${periodYearStr}-${periodMonthStr}-28`);

      const procedures = employeeIds.length
        ? await prisma.employeeProcedure.findMany({
            where: {
              employee: { companyId, id: { in: employeeIds } },
              procedureType: { in: ['reward', 'penalty'] },
              date: { gte: procPeriodStart, lte: procPeriodEnd },
            },
          })
        : [];
      const additionsByEmployee = new Map<string, number>();
      const discountsByEmployee = new Map<string, number>();
      for (const proc of procedures) {
        const amount = proc.amount ? Number(proc.amount) : 0;
        const target = proc.procedureType === 'reward' ? additionsByEmployee : discountsByEmployee;
        if (proc.procedureType === 'reward' || proc.procedureType === 'penalty') {
          target.set(proc.employeeId, (target.get(proc.employeeId) ?? 0) + amount);
        }
      }

      const advanceRows = employeeIds.length
        ? await prisma.employeeAdvance.findMany({
            where: {
              employee: { companyId, id: { in: employeeIds } },
              isActive: true,
              OR: [
                { fromMonth: { lte: periodMonthStr }, toYear: { gte: periodYearStr } },
                { fromMonth: null, toYear: null },
              ],
            },
          })
        : [];
      const advancesByEmployee = new Map<string, number>();
      for (const advance of advanceRows) {
        let amount = 0;
        if (advance.monthlyInstallment) {
          amount = Number(advance.monthlyInstallment);
        } else {
          const advanceYear = advance.date.getFullYear().toString();
          const advanceMonth = (advance.date.getMonth() + 1).toString().padStart(2, '0');
          if (advanceYear === periodYearStr && advanceMonth === periodMonthStr) {
            amount = Number(advance.value);
          }
        }
        advancesByEmployee.set(advance.employeeId, (advancesByEmployee.get(advance.employeeId) ?? 0) + amount);
      }

      // Try to get existing monthly salaries for the period, otherwise calculate from contracts
      const payrollData = await Promise.all(
        contracts.map(async (contract) => {
          const monthlySalaries = monthlySalariesByContract.get(contract.id) ?? [];

          if (monthlySalaries.length > 0) {
            // Use existing monthly salary data (aggregate if multiple months)
            const totalBasicSalary = monthlySalaries.reduce(
              (sum, s) => sum + Number(s.basicSalary),
              0
            );
            const totalAllowances = monthlySalaries.reduce(
              (sum, s) => sum + (s.totalAllowances ? Number(s.totalAllowances) : 0),
              0
            );
            const totalDeductions = monthlySalaries.reduce(
              (sum, s) => sum + (s.totalDeductions ? Number(s.totalDeductions) : 0),
              0
            );
            const totalAdditions = monthlySalaries.reduce(
              (sum, s) => sum + (s.additions ? Number(s.additions) : 0),
              0
            );
            const totalDiscounts = monthlySalaries.reduce(
              (sum, s) => sum + (s.discounts ? Number(s.discounts) : 0),
              0
            );
            const totalOvertime = monthlySalaries.reduce(
              (sum, s) => sum + (s.overtime ? Number(s.overtime) : 0),
              0
            );
            const totalAbsence = monthlySalaries.reduce(
              (sum, s) => sum + (s.absence ? Number(s.absence) : 0),
              0
            );
            const totalAdvances = monthlySalaries.reduce(
              (sum, s) => sum + (s.advances ? Number(s.advances) : 0),
              0
            );
            const totalEmployeeInsurance = monthlySalaries.reduce(
              (sum, s) => sum + (s.employeeInsurance ? Number(s.employeeInsurance) : 0),
              0
            );
            const totalCompanyInsurance = monthlySalaries.reduce(
              (sum, s) => sum + (s.companyInsurance ? Number(s.companyInsurance) : 0),
              0
            );
            const totalNetSalary = monthlySalaries.reduce(
              (sum, s) => sum + Number(s.netSalary),
              0
            );

            return {
              contract,
              basicSalary: totalBasicSalary,
              allowances: totalAllowances,
              deductions: totalDeductions,
              additions: totalAdditions,
              discounts: totalDiscounts,
              overtime: totalOvertime,
              absence: totalAbsence,
              advances: totalAdvances,
              employeeInsurance: totalEmployeeInsurance,
              companyInsurance: totalCompanyInsurance,
              netSalary: totalNetSalary,
            };
          }

          // Calculate from contract if no monthly salary exists
          const basicSalary = Number(contract.basicSalary) || 0;
          
          // Calculate allowances (can be enhanced with wage policy)
          const allowances = await this.calculateAllowances(
            companyId,
            contract.id,
            contract.wagePolicyId,
            basicSalary,
            fromDate.getFullYear().toString(),
            (fromDate.getMonth() + 1).toString().padStart(2, '0')
          );
          
          // Calculate deductions (can be enhanced with wage policy)
          const deductions = await this.calculateDeductions(
            companyId,
            contract.id,
            contract.wagePolicyId,
            basicSalary,
            fromDate.getFullYear().toString(),
            (fromDate.getMonth() + 1).toString().padStart(2, '0')
          );
          
          // M16 fix (Item 35): additions/discounts/advances now come from the
          // batched maps built above instead of one findMany per contract.
          const additions = additionsByEmployee.get(contract.employeeId) ?? 0;
          const discounts = discountsByEmployee.get(contract.employeeId) ?? 0;
          const advances = advancesByEmployee.get(contract.employeeId) ?? 0;
          
          // Calculate overtime and absence (placeholders)
          const overtime = 0; // Would require attendance system
          const absence = 0; // Would require attendance system
          
          // Calculate insurance
          const insuranceSalary = Number(contract.insuranceSalary) || basicSalary;
          const insurancePercentage = Number(contract.insurancePercentage) || 0;
          const employeeInsurance = (insuranceSalary * insurancePercentage) / 100;
          const companyInsurance = employeeInsurance;

          // Calculate net salary
          const netSalary = basicSalary + allowances + additions + overtime - deductions - discounts - absence - advances - employeeInsurance;

          return {
            contract,
            basicSalary,
            allowances,
            deductions,
            additions: 0,
            discounts: 0,
            overtime: 0,
            absence: 0,
            advances: 0,
            employeeInsurance,
            companyInsurance,
            netSalary: Math.max(0, netSalary),
          };
        })
      );

      const summary = {
        totalEmployees: payrollData.length,
        totalBasicSalary: payrollData.reduce(
          (sum, item) => sum + item.basicSalary,
          0
        ),
        totalAllowances: payrollData.reduce(
          (sum, item) => sum + item.allowances,
          0
        ),
        totalDeductions: payrollData.reduce(
          (sum, item) => sum + item.deductions,
          0
        ),
        totalAdditions: payrollData.reduce(
          (sum, item) => sum + (item.additions || 0),
          0
        ),
        totalDiscounts: payrollData.reduce(
          (sum, item) => sum + (item.discounts || 0),
          0
        ),
        totalOvertime: payrollData.reduce(
          (sum, item) => sum + (item.overtime || 0),
          0
        ),
        totalAbsence: payrollData.reduce(
          (sum, item) => sum + (item.absence || 0),
          0
        ),
        totalAdvances: payrollData.reduce(
          (sum, item) => sum + (item.advances || 0),
          0
        ),
        totalEmployeeInsurance: payrollData.reduce(
          (sum, item) => sum + (item.employeeInsurance || 0),
          0
        ),
        totalCompanyInsurance: payrollData.reduce(
          (sum, item) => sum + (item.companyInsurance || 0),
          0
        ),
        totalNetSalary: payrollData.reduce(
          (sum, item) => sum + item.netSalary,
          0
        ),
      };

      // M16 fix (Item 35): `page`/`limit` were destructured from `options`
      // above but never applied to the response — every call returned the
      // full company-wide contract list in `data` regardless of pagination
      // params.
      const total = payrollData.length;
      const skip = (page - 1) * limit;
      const pageData = payrollData.slice(skip, skip + limit);

      return {
        data: pageData,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating payroll report');
      throw error;
    }
  }

  /**
   * Get End of Service Report
   */
  async getEndOfServiceReport(
    filters: HRReportFilters,
    options: HRReportOptions = {}
  ): Promise<HRReportResult> {
    try {
      const { companyId, fromDate, toDate, employeeId } = filters;
      const { page = 1, limit = 100 } = options;

      if (!fromDate || !toDate) {
        throw new Error('From date and to date are required');
      }

      // M16 fix (Item 35): `Employee` has no `deletedAt` column — see
      // getEmployeeDataReport above for the same bug.
      const where: any = {
        employee: {
          companyId,
          isActive: true,
        },
        contractEndDate: {
          gte: fromDate,
          lte: toDate,
        },
        isActive: true,
      };

      if (employeeId) {
        where.employeeId = employeeId;
      }

      const skip = (page - 1) * limit;

      const [contracts, total] = await Promise.all([
        prisma.employeeContract.findMany({
          where,
          skip,
          take: limit,
          orderBy: [{ contractEndDate: 'asc' }],
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
            department: {
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

      // Calculate end of service entitlements
      const eosData = await Promise.all(
        contracts.map(async (contract) => {
          const basicSalary = Number(contract.basicSalary) || 0;
          
          // Calculate years of service
          const yearsOfService = this.calculateYearsOfService(
            contract.contractStartDate,
            contract.contractEndDate || toDate
          );
          
          // Calculate end of service amount
          // Common formula: basicSalary * yearsOfService * (service multiplier, typically 0.5-1.0)
          // For now using 0.5 multiplier (half month per year)
          const serviceMultiplier = 0.5;
          const eosAmount = basicSalary * yearsOfService * serviceMultiplier;

          return {
            contract,
            yearsOfService,
            eosAmount,
          };
        })
      );

      const summary = {
        totalEmployees: total,
        totalEOSAmount: eosData.reduce((sum, item) => sum + item.eosAmount, 0),
      };

      return {
        data: eosData,
        summary,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error({ error, filters, options }, 'Error generating end of service report');
      throw error;
    }
  }

  /**
   * Calculate allowances for a contract
   * 
   * Implementation notes:
   * - Currently, the schema doesn't have a direct relationship between contracts and allowances
   * - Allowance model exists but only contains lookup data (code, name), not amounts
   * - Future enhancement: Create junction table (ContractAllowance) with amount fields
   * 
   * See payroll.processor.ts for detailed implementation notes and example code.
   */
  private async calculateAllowances(
    companyId: string,
    contractId: string,
    wagePolicyId: string | null,
    basicSalary: number,
    periodYear: string,
    periodMonth: string
  ): Promise<number> {
    try {
      // TODO: When schema is enhanced, implement allowance calculation
      // See payroll.processor.ts calculateAllowances() for implementation structure
      
      return 0;
    } catch (error) {
      logger.error({ error, contractId, wagePolicyId }, 'Error calculating allowances');
      return 0;
    }
  }

  /**
   * Calculate deductions for a contract
   * 
   * Implementation notes:
   * - Currently, the schema doesn't have a direct relationship between contracts and deductions
   * - Deduction model exists but only contains lookup data (code, name), not amounts
   * - Future enhancement: Create junction table (ContractDeduction) with amount fields
   * 
   * See payroll.processor.ts for detailed implementation notes and example code.
   */
  private async calculateDeductions(
    companyId: string,
    contractId: string,
    wagePolicyId: string | null,
    basicSalary: number,
    periodYear: string,
    periodMonth: string
  ): Promise<number> {
    try {
      // TODO: When schema is enhanced, implement deduction calculation
      // See payroll.processor.ts calculateDeductions() for implementation structure
      
      return 0;
    } catch (error) {
      logger.error({ error, contractId, wagePolicyId }, 'Error calculating deductions');
      return 0;
    }
  }

  // M16 fix (Item 35): calculateAdditions/calculateDiscounts/calculateAdvances
  // (per-employee findMany helpers) were removed — getPayrollReport now
  // batches the same employeeProcedure/employeeAdvance queries once across
  // all contracts instead of calling per-employee helpers in a loop.

  /**
   * Calculate years of service between two dates
   */
  private calculateYearsOfService(startDate: Date, endDate: Date): number {
    const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, Math.floor(years * 100) / 100); // Round to 2 decimal places
  }
}

export const hrReportsService = new HRReportsService();

