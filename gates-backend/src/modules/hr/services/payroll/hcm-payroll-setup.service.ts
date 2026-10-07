import prisma from '../../../../shared/database/prisma';
import { createHash } from 'crypto';

/** Deterministic TEST payroll catalog — not statutory law. */
export async function seedTestPayrollCatalog(companyId: string, effectiveFrom = '2026-01-01') {
  const eff = new Date(`${effectiveFrom}T12:00:00.000Z`);
  const components = [
    { code: 'BASIC', ar: 'أساسي', type: 'EARNING', priority: 10 },
    { code: 'HOUSING', ar: 'سكن', type: 'EARNING', priority: 20 },
    { code: 'TRANSPORT', ar: 'مواصلات', type: 'EARNING', priority: 30 },
    { code: 'OVERTIME', ar: 'إضافي', type: 'EARNING', priority: 40 },
    { code: 'BONUS', ar: 'مكافأة', type: 'EARNING', priority: 50, recurring: false },
    { code: 'ABSENCE', ar: 'غياب', type: 'DEDUCTION', priority: 60 },
    { code: 'LATE', ar: 'تأخير', type: 'DEDUCTION', priority: 62 },
    { code: 'EARLY_LEAVE', ar: 'انصراف مبكر', type: 'DEDUCTION', priority: 63 },
    { code: 'UNPAID_LEAVE', ar: 'إجازة غير مدفوعة', type: 'DEDUCTION', priority: 65 },
    { code: 'SOCIAL_INSURANCE_EE', ar: 'تأمينات موظف', type: 'DEDUCTION', priority: 70 },
    { code: 'TAX', ar: 'ضريبة', type: 'DEDUCTION', priority: 80 },
    { code: 'ADVANCE_RECOVERY', ar: 'سلفة', type: 'DEDUCTION', priority: 90 },
    { code: 'SOCIAL_INSURANCE_ER', ar: 'تأمينات شركة', type: 'EMPLOYER_CONTRIBUTION', priority: 100 },
  ];

  const compMap = new Map<string, string>();
  for (const c of components) {
    const row = await prisma.hcmPayComponent.upsert({
      where: { companyId_code: { companyId, code: c.code } },
      create: {
        companyId,
        code: c.code,
        arabicName: c.ar,
        englishName: c.code,
        componentType: c.type,
        priority: c.priority,
        isRecurring: c.recurring !== false,
      },
      update: { isActive: true },
    });
    compMap.set(c.code, row.id);
  }

  const rules: Array<{
    code: string;
    component: string;
    phase: number;
    formula: string;
    condition?: string;
    depends?: string[];
  }> = [
    { code: 'R_BASIC', component: 'BASIC', phase: 1, formula: 'comp_basic' },
    { code: 'R_HOUSING', component: 'HOUSING', phase: 1, formula: 'comp_housing' },
    { code: 'R_TRANSPORT', component: 'TRANSPORT', phase: 1, formula: 'comp_transport' },
    {
      code: 'R_OT',
      component: 'OVERTIME',
      phase: 2,
      formula:
        'comp_basic / time_scheduled_minutes * time_approved_overtime_minutes * 1.5',
      condition: 'time_approved_overtime_minutes > 0',
    },
    {
      code: 'R_BONUS',
      component: 'BONUS',
      phase: 3,
      formula: 'input_bonus',
      condition: 'input_bonus > 0',
    },
    {
      code: 'R_ABS',
      component: 'ABSENCE',
      phase: 2,
      formula:
        '(comp_basic + comp_housing + comp_transport) / period_days / time_scheduled_minutes * time_absence_billable_minutes',
      condition: 'time_absence_billable_minutes > 0',
    },
    {
      code: 'R_LATE',
      component: 'LATE',
      phase: 2,
      formula:
        '(comp_basic + comp_housing + comp_transport) / period_days / time_scheduled_minutes * time_late_billable_minutes',
      condition: 'time_late_billable_minutes > 0',
    },
    {
      code: 'R_EARLY',
      component: 'EARLY_LEAVE',
      phase: 2,
      formula:
        '(comp_basic + comp_housing + comp_transport) / period_days / time_scheduled_minutes * time_early_leave_billable_minutes',
      condition: 'time_early_leave_billable_minutes > 0',
    },
    {
      code: 'R_UNPAID',
      component: 'UNPAID_LEAVE',
      phase: 2,
      formula:
        '(comp_basic + comp_housing + comp_transport) / period_days / time_scheduled_minutes * leave_unpaid_minutes',
      condition: 'leave_unpaid_minutes > 0',
    },
    {
      code: 'R_SI_EE',
      component: 'SOCIAL_INSURANCE_EE',
      phase: 6,
      formula: 'statutory_employee_insurance_amount',
      condition: 'statutory_employee_insurance_amount > 0',
    },
    {
      code: 'R_TAX',
      component: 'TAX',
      phase: 6,
      formula: 'max(0, comp_basic + comp_housing + comp_transport + comp_overtime + comp_bonus - comp_absence - comp_unpaid_leave - comp_social_insurance_ee - tax_exemption) * statutory_tax_flat_rate',
    },
    {
      code: 'R_ADV',
      component: 'ADVANCE_RECOVERY',
      phase: 8,
      formula: 'advance_due',
      condition: 'advance_due > 0',
    },
    {
      code: 'R_SI_ER',
      component: 'SOCIAL_INSURANCE_ER',
      phase: 9,
      formula: 'statutory_employer_insurance_amount',
      condition: 'statutory_employer_insurance_amount > 0',
    },
  ];

  for (const r of rules) {
    await prisma.hcmPayrollRule.upsert({
      where: {
        companyId_code_effectiveFrom: { companyId, code: r.code, effectiveFrom: eff },
      },
      create: {
        companyId,
        payComponentId: compMap.get(r.component)!,
        code: r.code,
        name: r.code,
        phase: r.phase,
        priority: 10,
        effectiveFrom: eff,
        formulaExpr: r.formula,
        conditionExpr: r.condition ?? null,
        dependsOnCodes: r.depends ? JSON.stringify(r.depends) : null,
      },
      update: {
        formulaExpr: r.formula,
        conditionExpr: r.condition ?? null,
        isActive: true,
      },
    });
  }

  await prisma.hcmPayrollLocalizationConfig.upsert({
    where: {
      companyId_countryCode_configKey_effectiveFrom: {
        companyId,
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: eff,
      },
    },
    create: {
      companyId,
      countryCode: 'EG',
      configKey: 'INSURANCE_CAP',
      effectiveFrom: eff,
      configJson: { maxBase: 999999, note: 'TEST CONFIG ONLY' },
    },
    update: { configJson: { maxBase: 999999, note: 'TEST CONFIG ONLY' } },
  });

  return { componentIds: compMap };
}

export function ruleFingerprint(formula: string, condition: string | null): string {
  return createHash('sha256').update(`${formula}|${condition ?? ''}`).digest('hex').slice(0, 16);
}
