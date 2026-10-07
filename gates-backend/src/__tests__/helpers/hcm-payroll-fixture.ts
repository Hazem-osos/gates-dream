import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../../modules/hr/services/hcm/hcm-backfill.service';
import { seedTestPayrollCatalog } from '../../modules/hr/services/payroll/hcm-payroll-setup.service';

export type PayrollFixture = {
  companyId: string;
  employeeId: string;
  employmentId: string;
  branchId: string;
  fiscalYearId: string;
};

export async function createPayrollFixture(prisma: PrismaClient): Promise<PayrollFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await prisma.company.create({
    data: { arabicName: `Payroll ${suffix}`, isActive: true },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, arabicName: `Main ${suffix}` },
  });
  const fiscalYear = await prisma.fiscalYear.create({
    data: {
      companyId: company.id,
      legacyYearId: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'Open',
      isActive: true,
    },
  });
  const accountCodes = [
    { code: '6100', type: 'expense', name: 'Salaries' },
    { code: '6110', type: 'expense', name: 'ER Ins' },
    { code: '2400', type: 'liability', name: 'SI Pay' },
    { code: '2410', type: 'liability', name: 'Tax Pay' },
    { code: '1420', type: 'asset', name: 'Advances' },
    { code: '2420', type: 'liability', name: 'Accrued' },
  ];
  for (const a of accountCodes) {
    await prisma.account.create({
      data: {
        companyId: company.id,
        code: a.code,
        arabicName: a.name,
        accountType: a.type,
        isActive: true,
      },
    });
  }

  await prisma.hrSettings.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      employeeInsuranceRate: 0.11,
      employerInsuranceRate: 0.1875,
      payrollTaxFlatRate: 0.1,
      payrollEngineMode: 'RULE_ENGINE',
      payrollRequireTimeReady: false,
      salariesExpenseAccountCode: '6100',
      employerInsuranceExpenseAccountCode: '6110',
      socialInsurancePayableAccountCode: '2400',
      payrollTaxPayableAccountCode: '2410',
      employeeAdvancesAccountCode: '1420',
      accruedPayrollAccountCode: '2420',
    },
    update: {
      payrollEngineMode: 'RULE_ENGINE',
      payrollRequireTimeReady: false,
      salariesExpenseAccountCode: '6100',
      employerInsuranceExpenseAccountCode: '6110',
      socialInsurancePayableAccountCode: '2400',
      payrollTaxPayableAccountCode: '2410',
      employeeAdvancesAccountCode: '1420',
      accruedPayrollAccountCode: '2420',
    },
  });

  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      arabicName: 'Payroll Test',
      identityNumber: `P${suffix}`.replace(/\D/g, '').slice(0, 14).padEnd(14, '0'),
      basicSalary: 20000,
      fixedAllowances: 0,
      joinDate: new Date('2026-01-01'),
    },
  });

  await hcmBackfillService.backfillCompany(company.id);
  const employment = await prisma.hcmEmployment.findFirst({
    where: { companyId: company.id, employeeId: employee.id },
  });
  if (!employment) throw new Error('employment missing');

  const catalog = await seedTestPayrollCatalog(company.id);
  const basicId = catalog.componentIds.get('BASIC')!;
  const housingId = catalog.componentIds.get('HOUSING')!;
  const transportId = catalog.componentIds.get('TRANSPORT')!;

  await prisma.hcmCompensationComponentAssignment.createMany({
    data: [
      {
        companyId: company.id,
        employmentId: employment.id,
        payComponentId: basicId,
        amount: 20000,
        effectiveFrom: new Date('2026-01-01'),
      },
      {
        companyId: company.id,
        employmentId: employment.id,
        payComponentId: housingId,
        amount: 5000,
        effectiveFrom: new Date('2026-01-01'),
      },
      {
        companyId: company.id,
        employmentId: employment.id,
        payComponentId: transportId,
        amount: 2000,
        effectiveFrom: new Date('2026-01-01'),
      },
    ],
  });

  return {
    companyId: company.id,
    employeeId: employee.id,
    employmentId: employment.id,
    branchId: branch.id,
    fiscalYearId: fiscalYear.id,
  };
}
