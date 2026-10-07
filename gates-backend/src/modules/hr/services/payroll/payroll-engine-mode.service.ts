import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { PAYROLL_CALCULATION_MODES, type PayrollCalculationMode } from './payroll-calculation-strategy.domain';
import { payrollRuleEngineService } from './payroll-rule-engine.service';

export class PayrollEngineModeService {
  async getConfiguredMode(companyId: string): Promise<PayrollCalculationMode> {
    const settings = await prisma.hrSettings.findUnique({ where: { companyId } });
    const mode = settings?.payrollEngineMode ?? PAYROLL_CALCULATION_MODES.LEGACY_COMPATIBILITY;
    if (mode === PAYROLL_CALCULATION_MODES.RULE_ENGINE) {
      return PAYROLL_CALCULATION_MODES.RULE_ENGINE;
    }
    return PAYROLL_CALCULATION_MODES.LEGACY_COMPATIBILITY;
  }

  /**
   * Resolves run calculation mode. RULE_ENGINE tenants never silently fall back.
   */
  async resolveForCalculation(
    companyId: string,
    periodEnd: Date
  ): Promise<PayrollCalculationMode> {
    const configured = await this.getConfiguredMode(companyId);
    if (configured === PAYROLL_CALCULATION_MODES.LEGACY_COMPATIBILITY) {
      return PAYROLL_CALCULATION_MODES.LEGACY_COMPATIBILITY;
    }

    const rules = await payrollRuleEngineService.loadRules(companyId, periodEnd);
    if (rules.length === 0) {
      throw new AppError(
        422,
        'PAYROLL_ENGINE_MODE_RULE_ENGINE: active payroll rules required — calculation blocked (no legacy fallback)'
      );
    }
    return PAYROLL_CALCULATION_MODES.RULE_ENGINE;
  }

  async requireTimeReady(companyId: string): Promise<boolean> {
    const settings = await prisma.hrSettings.findUnique({ where: { companyId } });
    return settings?.payrollRequireTimeReady ?? true;
  }
}

export const payrollEngineModeService = new PayrollEngineModeService();
