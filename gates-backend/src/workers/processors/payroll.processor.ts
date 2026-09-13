import { Worker, Job } from 'bullmq';
import { PayrollJobData } from '../queues/payroll.queue';
import { logger } from '../../shared/logger';
import { prisma } from '../../shared/database/prisma';
import { monthlySalaryService } from '../../modules/hr/services/monthly-salary.service';
import { workerRedisConnection } from '../redis-connection';

/**
 * Payroll Processor
 * Processes payroll calculation jobs
 */

interface PayrollCalculationResult {
  employeeId: string;
  contractId: string | null;
  basicSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  additions: number;
  discounts: number;
  overtime: number;
  absence: number;
  advances: number;
  employeeInsurance: number;
  companyInsurance: number;
  netSalary: number;
}

export const createPayrollWorker = (): Worker<PayrollJobData> => {
  return new Worker<PayrollJobData>(
    'payroll',
    async (job: Job<PayrollJobData>) => {
      const { companyId, period, userId } = job.data;

      logger.info(
        { jobId: job.id, companyId, period, userId },
        'Processing payroll calculation'
      );

      try {
        // Parse period (format: YYYY-MM)
        const [periodYear, periodMonth] = period.split('-');
        if (!periodYear || !periodMonth) {
          throw new Error('Invalid period format. Expected YYYY-MM');
        }

        await job.updateProgress(10);

        // Get all active employee contracts for the company
        const contracts = await prisma.employeeContract.findMany({
          where: {
            employee: { companyId, isActive: true },
            isActive: true,
            contractStartDate: {
              lte: new Date(`${periodYear}-${periodMonth}-28`), // End of month
            },
            OR: [
              { contractEndDate: null },
              { contractEndDate: { gte: new Date(`${periodYear}-${periodMonth}-01`) } },
            ],
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
          },
        });

        logger.info(
          { companyId, period, contractCount: contracts.length },
          'Found active contracts for payroll calculation'
        );

        await job.updateProgress(30);

        // Wave 6 fix: `calculateOvertime`/`calculateAbsence` always return 0
        // (no Attendance model exists yet), and `calculateAllowances`/
        // `calculateDeductions` always return 0 (no amount-bearing junction
        // table exists yet). That is a real, permanent limitation of the
        // current schema — but it used to be invisible: the job logged
        // nothing about it and reported plain success. Surface it once per
        // run so anyone watching payroll runs knows those four figures are
        // structural placeholders, not "this company legitimately has none".
        logger.warn(
          { companyId, period },
          'Payroll calculation: overtime, absence, allowance and deduction amounts are not yet ' +
            'computable from the current schema (no Attendance model, no amount-bearing ' +
            'allowance/deduction junction tables) and will be posted as 0 for every employee'
        );

        const results: PayrollCalculationResult[] = [];
        const periodDate = new Date(`${periodYear}-${periodMonth}-15`); // Mid-month date
        let processedCount = 0;
        // Wave 6 fix: the per-contract try/catch below used to log and
        // `continue` on error, then the job unconditionally returned
        // `{ success: true, ... }` — a payroll run where half the company's
        // employees failed to calculate still reported clean success with no
        // way for a caller/monitor to detect it. Collect failures and fail
        // the whole job at the end so BullMQ's retry/alerting (3 attempts,
        // exponential backoff — see `payroll.queue.ts`) actually engages.
        const calculationFailures: { employeeId: string; contractId: string; error: string }[] = [];

        // Calculate payroll for each contract
        for (const contract of contracts) {
          try {
            // Check if salary already exists for this period
            const existingSalary = await prisma.monthlySalary.findFirst({
              where: {
                companyId,
                employeeId: contract.employeeId,
                contractId: contract.id,
                periodYear,
                periodMonth,
              },
            });

            if (existingSalary) {
              logger.debug(
                { employeeId: contract.employeeId, period },
                'Salary already exists, skipping'
              );
              continue;
            }

            // Calculate basic salary
            const basicSalary = Number(contract.basicSalary) || 0;

            // Calculate allowances (from contract or wage policy)
            const totalAllowances = await calculateAllowances(
              companyId,
              contract.id,
              contract.wagePolicyId,
              basicSalary,
              periodYear,
              periodMonth
            );

            // Calculate deductions (from contract or wage policy)
            const totalDeductions = await calculateDeductions(
              companyId,
              contract.id,
              contract.wagePolicyId,
              basicSalary,
              periodYear,
              periodMonth
            );

            // Calculate additions (bonuses, rewards, etc.)
            const additions = await calculateAdditions(
              companyId,
              contract.employeeId,
              periodYear,
              periodMonth
            );

            // Calculate discounts (penalties, etc.)
            const discounts = await calculateDiscounts(
              companyId,
              contract.employeeId,
              periodYear,
              periodMonth
            );

            // Calculate overtime (if applicable)
            const overtime = await calculateOvertime(
              companyId,
              contract.employeeId,
              periodYear,
              periodMonth
            );

            // Calculate absence deductions
            const absence = await calculateAbsence(
              companyId,
              contract.employeeId,
              basicSalary,
              periodYear,
              periodMonth
            );

            // Calculate advances for this period
            const advances = await calculateAdvances(
              companyId,
              contract.employeeId,
              periodYear,
              periodMonth
            );

            // Calculate insurance contributions
            const insuranceSalary = Number(contract.insuranceSalary) || basicSalary;
            const insurancePercentage = Number(contract.insurancePercentage) || 0;
            const employeeInsurance = (insuranceSalary * insurancePercentage) / 100;
            const companyInsurance = employeeInsurance; // Typically same amount

            // Calculate net salary
            // Formula: basicSalary + allowances + additions + overtime - deductions - discounts - absence - advances - employeeInsurance
            const netSalary =
              basicSalary +
              totalAllowances +
              additions +
              overtime -
              totalDeductions -
              discounts -
              absence -
              advances -
              employeeInsurance;

            results.push({
              employeeId: contract.employeeId,
              contractId: contract.id,
              basicSalary,
              totalAllowances,
              totalDeductions,
              additions,
              discounts,
              overtime,
              absence,
              advances,
              employeeInsurance,
              companyInsurance,
              netSalary: Math.max(0, netSalary), // Ensure non-negative
            });

            processedCount++;
            await job.updateProgress(30 + (processedCount / contracts.length) * 60);
          } catch (error) {
            logger.error(
              { error, employeeId: contract.employeeId, contractId: contract.id },
              'Error calculating payroll for contract'
            );
            calculationFailures.push({
              employeeId: contract.employeeId,
              contractId: contract.id,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue with next contract so one bad record doesn't block the
            // rest of the run; the accumulated failures still fail the job below.
          }
        }

        await job.updateProgress(95);

        // Create monthly salary records
        let createdCount = 0;
        let totalAmount = 0;

        for (const result of results) {
          try {
            await monthlySalaryService.createMonthlySalary(companyId, {
              employeeId: result.employeeId,
              contractId: result.contractId || undefined,
              periodYear,
              periodMonth,
              date: periodDate,
              basicSalary: result.basicSalary,
              totalAllowances: result.totalAllowances,
              totalDeductions: result.totalDeductions,
              additions: result.additions,
              discounts: result.discounts,
              overtime: result.overtime,
              absence: result.absence,
              advances: result.advances,
              employeeInsurance: result.employeeInsurance,
              companyInsurance: result.companyInsurance,
              netSalary: result.netSalary,
              notes: `Auto-generated payroll for period ${period}`,
            });

            createdCount++;
            totalAmount += result.netSalary;
          } catch (error) {
            logger.error(
              { error, employeeId: result.employeeId },
              'Error creating monthly salary record'
            );
            calculationFailures.push({
              employeeId: result.employeeId,
              contractId: result.contractId ?? '',
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        await job.updateProgress(100);

        logger.info(
          {
            jobId: job.id,
            companyId,
            period,
            processedCount,
            createdCount,
            totalAmount,
            failedCount: calculationFailures.length,
          },
          'Payroll calculation completed'
        );

        // Wave 6 fix: fail the job when any employee failed to calculate or
        // save instead of silently reporting `success: true` for a partial
        // run. BullMQ will retry (up to 3 attempts) and the `failed` event
        // handler below logs it — previously neither ever fired.
        if (calculationFailures.length > 0) {
          throw new Error(
            `Payroll calculation had ${calculationFailures.length} failure(s) out of ${contracts.length} ` +
              `contract(s): ${JSON.stringify(calculationFailures)}`
          );
        }

        return {
          success: true,
          companyId,
          period,
          totalAmount,
          employeeCount: createdCount,
          processedCount,
        };
      } catch (error) {
        logger.error({ error, jobId: job.id }, 'Payroll calculation failed');
        throw error;
      }
    },
    {
      connection: workerRedisConnection,
      concurrency: 2, // Process 2 jobs concurrently
    }
  );
};

/**
 * Calculate allowances for a contract
 * 
 * Implementation notes:
 * - Currently, the schema doesn't have a direct relationship between contracts and allowances
 * - Allowance model exists but only contains lookup data (code, name), not amounts
 * - Future enhancement: Create junction table (ContractAllowance) with amount fields
 * - Or add allowance fields directly to EmployeeContract model
 * 
 * For now, this function provides a structure that can be extended when schema is enhanced.
 */
async function calculateAllowances(
  _companyId: string,
  contractId: string,
  wagePolicyId: string | null,
  _basicSalary: number,
  _periodYear: string,
  _periodMonth: string
): Promise<number> {
  try {
    // Get the contract to check for any allowance-related data
    const contract = await prisma.employeeContract.findUnique({
      where: { id: contractId },
      include: {
        wagePolicy: true,
      },
    });

    if (!contract) {
      logger.warn({ contractId }, 'Contract not found for allowance calculation');
      return 0;
    }

    let totalAllowances = 0;

    // TODO: When schema is enhanced, implement:
    // 1. Contract-specific allowances: Query ContractAllowance table (if exists)
    //    Example: const contractAllowances = await prisma.contractAllowance.findMany({ where: { contractId } });
    //    totalAllowances += contractAllowances.reduce((sum, a) => sum + Number(a.amount), 0);
    
    // 2. Wage policy allowances: Query WagePolicyAllowance table (if exists)
    //    if (wagePolicyId) {
    //      const policyAllowances = await prisma.wagePolicyAllowance.findMany({ where: { wagePolicyId } });
    //      totalAllowances += policyAllowances.reduce((sum, a) => sum + Number(a.amount), 0);
    //    }
    
    // 3. Company-wide default allowances: Query Allowance table with amounts (if schema enhanced)
    //    const companyAllowances = await prisma.allowance.findMany({ where: { companyId, isActive: true } });
    //    totalAllowances += companyAllowances.reduce((sum, a) => sum + Number(a.amount || 0), 0);

    // For now, return 0 as the schema doesn't support allowance amounts
    // The Allowance model only contains lookup data (code, name), not amounts
    return totalAllowances;
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
 * - Or add deduction fields directly to EmployeeContract model
 * 
 * For now, this function provides a structure that can be extended when schema is enhanced.
 */
async function calculateDeductions(
  _companyId: string,
  contractId: string,
  wagePolicyId: string | null,
  _basicSalary: number,
  _periodYear: string,
  _periodMonth: string
): Promise<number> {
  try {
    // Get the contract to check for any deduction-related data
    const contract = await prisma.employeeContract.findUnique({
      where: { id: contractId },
      include: {
        wagePolicy: true,
      },
    });

    if (!contract) {
      logger.warn({ contractId }, 'Contract not found for deduction calculation');
      return 0;
    }

    let totalDeductions = 0;

    // TODO: When schema is enhanced, implement:
    // 1. Contract-specific deductions: Query ContractDeduction table (if exists)
    //    Example: const contractDeductions = await prisma.contractDeduction.findMany({ where: { contractId } });
    //    totalDeductions += contractDeductions.reduce((sum, d) => sum + Number(d.amount), 0);
    
    // 2. Wage policy deductions: Query WagePolicyDeduction table (if exists)
    //    if (wagePolicyId) {
    //      const policyDeductions = await prisma.wagePolicyDeduction.findMany({ where: { wagePolicyId } });
    //      totalDeductions += policyDeductions.reduce((sum, d) => sum + Number(d.amount), 0);
    //    }
    
    // 3. Company-wide default deductions: Query Deduction table with amounts (if schema enhanced)
    //    const companyDeductions = await prisma.deduction.findMany({ where: { companyId, isActive: true } });
    //    totalDeductions += companyDeductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);

    // For now, return 0 as the schema doesn't support deduction amounts
    // The Deduction model only contains lookup data (code, name), not amounts
    return totalDeductions;
  } catch (error) {
    logger.error({ error, contractId, wagePolicyId }, 'Error calculating deductions');
    return 0;
  }
}

/**
 * Calculate additions (rewards, bonuses) from employee procedures
 */
async function calculateAdditions(
  companyId: string,
  employeeId: string,
  periodYear: string,
  periodMonth: string
): Promise<number> {
  try {
    const periodStart = new Date(`${periodYear}-${periodMonth}-01`);
    const periodEnd = new Date(`${periodYear}-${periodMonth}-28`);
    
    // Get employee procedures of type 'reward' for this period
    const rewards = await prisma.employeeProcedure.findMany({
      where: {
        employee: { companyId, id: employeeId },
        procedureType: 'reward',
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Sum all reward amounts
    const totalAdditions = rewards.reduce((sum, reward) => {
      return sum + (reward.amount ? Number(reward.amount) : 0);
    }, 0);

    return totalAdditions;
  } catch (error) {
    logger.error({ error, employeeId, periodYear, periodMonth }, 'Error calculating additions');
    return 0;
  }
}

/**
 * Calculate discounts (penalties) from employee procedures
 */
async function calculateDiscounts(
  companyId: string,
  employeeId: string,
  periodYear: string,
  periodMonth: string
): Promise<number> {
  try {
    const periodStart = new Date(`${periodYear}-${periodMonth}-01`);
    const periodEnd = new Date(`${periodYear}-${periodMonth}-28`);
    
    // Get employee procedures of type 'penalty' for this period
    const penalties = await prisma.employeeProcedure.findMany({
      where: {
        employee: { companyId, id: employeeId },
        procedureType: 'penalty',
        date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Sum all penalty amounts
    const totalDiscounts = penalties.reduce((sum, penalty) => {
      return sum + (penalty.amount ? Number(penalty.amount) : 0);
    }, 0);

    return totalDiscounts;
  } catch (error) {
    logger.error({ error, employeeId, periodYear, periodMonth }, 'Error calculating discounts');
    return 0;
  }
}

/**
 * Calculate overtime hours and amount
 * 
 * Implementation notes:
 * - Requires an Attendance model/table to track employee attendance and overtime hours
 * - The schema currently doesn't have an Attendance model
 * - Future enhancement: Create Attendance model with fields:
 *   - employeeId, date, checkIn, checkOut, overtimeHours, etc.
 * 
 * To implement:
 * 1. Create Attendance model in Prisma schema
 * 2. Query attendance records for this employee and period
 * 3. Sum overtime hours from attendance records
 * 4. Calculate overtime amount based on contract overtime rate
 *    Formula: overtimeHours * hourlyRate * overtimeMultiplier
 * 
 * Example implementation (when Attendance model exists):
 * ```typescript
 * const attendances = await prisma.attendance.findMany({
 *   where: {
 *     employeeId,
 *     date: { gte: periodStart, lte: periodEnd }
 *   }
 * });
 * const totalOvertimeHours = attendances.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
 * const hourlyRate = basicSalary / (workingDaysInMonth * workingHoursPerDay);
 * return totalOvertimeHours * hourlyRate * overtimeMultiplier;
 * ```
 */
async function calculateOvertime(
  _companyId: string,
  employeeId: string,
  periodYear: string,
  periodMonth: string
): Promise<number> {
  try {
    // TODO: Implement overtime calculation from attendance records
    // Requires Attendance model to be created in schema first
    
    // For now, return 0 as there's no attendance system
    return 0;
  } catch (error) {
    logger.error({ error, employeeId, periodYear, periodMonth }, 'Error calculating overtime');
    return 0;
  }
}

/**
 * Calculate absence deductions
 * 
 * Implementation notes:
 * - Requires an Attendance model/table to track employee attendance and absences
 * - The schema currently doesn't have an Attendance model
 * - Future enhancement: Create Attendance model with fields:
 *   - employeeId, date, status (present/absent/leave), leaveType, etc.
 * 
 * To implement:
 * 1. Create Attendance model in Prisma schema
 * 2. Query attendance records for this employee and period
 * 3. Count absent days (excluding approved leave)
 * 4. Calculate absence deduction
 *    Formula: (basicSalary / workingDaysInMonth) * absentDays
 * 
 * Example implementation (when Attendance model exists):
 * ```typescript
 * const attendances = await prisma.attendance.findMany({
 *   where: {
 *     employeeId,
 *     date: { gte: periodStart, lte: periodEnd },
 *     status: 'absent'
 *   }
 * });
 * const absentDays = attendances.filter(a => !a.isApprovedLeave).length;
 * const workingDaysInMonth = getWorkingDaysInMonth(periodYear, periodMonth);
 * return (basicSalary / workingDaysInMonth) * absentDays;
 * ```
 */
async function calculateAbsence(
  _companyId: string,
  employeeId: string,
  _basicSalary: number,
  periodYear: string,
  periodMonth: string
): Promise<number> {
  try {
    // TODO: Implement absence calculation from attendance records
    // Requires Attendance model to be created in schema first
    
    // For now, return 0 as there's no attendance system
    return 0;
  } catch (error) {
    logger.error({ error, employeeId, periodYear, periodMonth }, 'Error calculating absence');
    return 0;
  }
}

/**
 * Calculate advances for an employee in a specific period
 */
async function calculateAdvances(
  companyId: string,
  employeeId: string,
  periodYear: string,
  periodMonth: string
): Promise<number> {
  try {
    // Get active advances that should be deducted in this period
    const advances = await prisma.employeeAdvance.findMany({
      where: {
        employee: { companyId, id: employeeId },
        isActive: true,
        OR: [
          // Advances that start in this period or earlier
          {
            fromMonth: { lte: periodMonth },
            toYear: { gte: periodYear },
          },
          // Advances without specific period (one-time deductions)
          {
            fromMonth: null,
            toYear: null,
          },
        ],
      },
    });

    let totalAdvances = 0;

    for (const advance of advances) {
      if (advance.monthlyInstallment) {
        // Monthly installment advance
        totalAdvances += Number(advance.monthlyInstallment);
      } else {
        // One-time advance - check if it should be deducted this period
        const advanceDate = advance.date;
        const advanceYear = advanceDate.getFullYear().toString();
        const advanceMonth = (advanceDate.getMonth() + 1).toString().padStart(2, '0');

        if (advanceYear === periodYear && advanceMonth === periodMonth) {
          totalAdvances += Number(advance.value);
        }
      }
    }

    return totalAdvances;
  } catch (error) {
    logger.error({ error, employeeId, periodYear, periodMonth }, 'Error calculating advances');
    return 0;
  }
}

export const payrollWorker = createPayrollWorker();

// Event handlers
payrollWorker.on('completed', (job) => {
  logger.info({ jobId: job.id }, 'Payroll job completed');
});

payrollWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err }, 'Payroll job failed');
});

payrollWorker.on('error', (err) => {
  logger.error({ error: err }, 'Payroll worker error');
});

logger.info('Payroll worker started');
