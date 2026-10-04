import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { companySettingsService } from '../../company/services/company-settings.service';
import { logger } from '../../../shared/logger';
import type { HrPayrollSettingsInput } from '../schemas/hr-settings.schema';

const HR_ADVANCED_KEY = 'hrPayroll';

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

const GL_FIELD_MAP = {
  payrollAccount: 'salariesExpenseAccountCode',
  insuranceExpense: 'employerInsuranceExpenseAccountCode',
  insuranceAccount: 'socialInsurancePayableAccountCode',
  workTaxAccount: 'payrollTaxPayableAccountCode',
  accountCode: 'employeeAdvancesAccountCode',
  endServiceAccruedAccount: 'accruedPayrollAccountCode',
} as const;

type GlUiField = keyof typeof GL_FIELD_MAP;

function codeOrNull(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

export class HrSettingsService {
  private async readGlRow(companyId: string) {
    return prisma.hrSettings.upsert({
      where: { companyId },
      update: {},
      create: { companyId },
    });
  }

  private overlayGl(blob: Record<string, unknown>, gl: Awaited<ReturnType<HrSettingsService['readGlRow']>>) {
    const next = { ...blob };
    for (const [uiField, column] of Object.entries(GL_FIELD_MAP) as [GlUiField, (typeof GL_FIELD_MAP)[GlUiField]][]) {
      const stored = gl[column];
      if (stored && !codeOrNull(next[uiField])) next[uiField] = stored;
    }
    return next as HrPayrollSettingsInput;
  }

  async getHrPayrollSettings(companyId: string): Promise<HrPayrollSettingsInput> {
    const [row, gl] = await Promise.all([
      companySettingsService.getCompanySettings(companyId),
      this.readGlRow(companyId),
    ]);
    const adv = asRecord(row.advancedSettings);
    return this.overlayGl(asRecord(adv[HR_ADVANCED_KEY]), gl);
  }

  async saveHrPayrollSettings(
    companyId: string,
    payload: HrPayrollSettingsInput
  ): Promise<HrPayrollSettingsInput> {
    const row = await companySettingsService.getCompanySettings(companyId);
    const adv = asRecord(row.advancedSettings);
    const prev = asRecord(adv[HR_ADVANCED_KEY]);
    const merged = { ...prev, ...payload };
    adv[HR_ADVANCED_KEY] = merged;

    const glPatch: Prisma.HrSettingsUncheckedCreateInput = { companyId };
    if (payload.payrollAccount !== undefined) {
      glPatch.salariesExpenseAccountCode = codeOrNull(payload.payrollAccount);
    }
    if (payload.insuranceExpense !== undefined) {
      glPatch.employerInsuranceExpenseAccountCode = codeOrNull(payload.insuranceExpense);
    }
    if (payload.insuranceAccount !== undefined) {
      glPatch.socialInsurancePayableAccountCode = codeOrNull(payload.insuranceAccount);
    }
    if (payload.workTaxAccount !== undefined) {
      glPatch.payrollTaxPayableAccountCode = codeOrNull(payload.workTaxAccount);
    }
    if (payload.accountCode !== undefined) {
      glPatch.employeeAdvancesAccountCode = codeOrNull(payload.accountCode);
    }
    if (payload.endServiceAccruedAccount !== undefined) {
      glPatch.accruedPayrollAccountCode = codeOrNull(payload.endServiceAccruedAccount);
    }
    const { companyId: _companyId, ...glUpdate } = glPatch;

    await companySettingsService.updateCompanySettings(companyId, {
      advancedSettings: adv as Record<string, unknown>,
    });
    if (Object.keys(glUpdate).length) {
      await prisma.hrSettings.upsert({
        where: { companyId },
        update: glUpdate,
        create: glPatch,
      });
    }

    logger.info({ companyId }, 'HR payroll settings saved to HrSettings');
    return this.overlayGl(merged, await this.readGlRow(companyId));
  }
}

export const hrSettingsService = new HrSettingsService();
