import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { payrollLocalizationService } from './payroll-localization.service';

const SUPPORTED_COUNTRIES = new Set(['EG', 'SA']);

const PROVIDER_SCHEMAS: Record<
  string,
  { configKeys: string[]; fields: Array<{ key: string; label: string; type: 'number' | 'string' | 'json' }> }
> = {
  EG: {
    configKeys: ['INSURANCE_CAP', 'TAX_BRACKETS'],
    fields: [
      { key: 'maxBase', label: 'Insurance cap max base (TEST)', type: 'number' },
      { key: 'brackets', label: 'Tax brackets (TEST JSON array)', type: 'json' },
    ],
  },
  SA: {
    configKeys: ['GOSI_RATES'],
    fields: [
      { key: 'employeeRate', label: 'GOSI employee rate (TEST)', type: 'number' },
      { key: 'employerRate', label: 'GOSI employer rate (TEST)', type: 'number' },
    ],
  },
};

export type LocalizationValidationResult = {
  valid: boolean;
  errors: string[];
};

function parseBrackets(raw: unknown): Array<{ upTo?: number; rate: number }> {
  if (!Array.isArray(raw)) return [];
  return raw as Array<{ upTo?: number; rate: number }>;
}

export class PayrollLocalizationAdminService {
  providerSchema(countryCode: string) {
    const code = countryCode.toUpperCase();
    const schema = PROVIDER_SCHEMAS[code];
    if (!schema) {
      return { configKeys: [] as string[], fields: [{ key: 'config', label: 'Configuration', type: 'json' as const }] };
    }
    return schema;
  }

  validateConfigInput(input: {
    countryCode: string;
    configKey: string;
    effectiveFrom: Date;
    effectiveTo?: Date | null;
    config: Record<string, unknown>;
  }): LocalizationValidationResult {
    const errors: string[] = [];
    const countryCode = input.countryCode.toUpperCase();
    const configKey = input.configKey.trim();

    if (!SUPPORTED_COUNTRIES.has(countryCode)) {
      errors.push(`Unsupported country ${countryCode}`);
    }
    const schema = PROVIDER_SCHEMAS[countryCode];
    if (schema && !schema.configKeys.includes(configKey)) {
      errors.push(`Invalid configKey ${configKey} for ${countryCode}`);
    }
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
      errors.push('effectiveTo must be after effectiveFrom');
    }

    if (countryCode === 'EG' && configKey === 'INSURANCE_CAP') {
      const maxBase = Number(input.config.maxBase ?? input.config.insuranceCap);
      if (!Number.isFinite(maxBase) || maxBase < 0) {
        errors.push('Invalid insurance cap (TEST): maxBase must be >= 0');
      }
    }

    if (countryCode === 'EG' && configKey === 'TAX_BRACKETS') {
      const brackets = parseBrackets(input.config.brackets ?? input.config.taxBrackets);
      if (!brackets.length) {
        errors.push('TAX_BRACKETS requires at least one bracket (TEST)');
      }
      let prevUpTo: number | null = null;
      for (const [i, b] of brackets.entries()) {
        if (!Number.isFinite(b.rate) || b.rate < 0 || b.rate > 1) {
          errors.push(`Bracket ${i + 1}: rate must be between 0 and 1 (TEST)`);
        }
        if (b.upTo != null && (!Number.isFinite(b.upTo) || b.upTo < 0)) {
          errors.push(`Bracket ${i + 1}: invalid upTo threshold`);
        }
        if (b.upTo != null && prevUpTo != null && b.upTo <= prevUpTo) {
          errors.push(`Bracket ${i + 1}: upTo must increase`);
        }
        if (b.upTo != null) prevUpTo = b.upTo;
      }
    }

    if (countryCode === 'SA' && configKey === 'GOSI_RATES') {
      const er = Number(input.config.employeeRate ?? input.config.gosiEmployeeRate);
      const rr = Number(input.config.employerRate ?? input.config.gosiEmployerRate);
      if (!Number.isFinite(er) || er < 0 || er > 1) {
        errors.push('GOSI employee rate must be between 0 and 1 (TEST)');
      }
      if (!Number.isFinite(rr) || rr < 0 || rr > 1) {
        errors.push('GOSI employer rate must be between 0 and 1 (TEST)');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  normalizeConfig(countryCode: string, configKey: string, config: Record<string, unknown>): Record<string, unknown> {
    const code = countryCode.toUpperCase();
    if (code === 'EG' && configKey === 'INSURANCE_CAP') {
      const maxBase = config.maxBase ?? config.insuranceCap;
      return { maxBase: Number(maxBase) };
    }
    if (code === 'EG' && configKey === 'TAX_BRACKETS') {
      const brackets = config.brackets ?? config.taxBrackets ?? [];
      return { brackets };
    }
    if (code === 'SA' && configKey === 'GOSI_RATES') {
      return {
        employeeRate: Number(config.employeeRate ?? config.gosiEmployeeRate),
        employerRate: Number(config.employerRate ?? config.gosiEmployerRate),
      };
    }
    return config;
  }

  async validateWithProvider(companyId: string, input: {
    countryCode: string;
    configKey: string;
    config: Record<string, unknown>;
  }): Promise<LocalizationValidationResult> {
    const base = this.validateConfigInput({
      countryCode: input.countryCode,
      configKey: input.configKey,
      effectiveFrom: new Date(),
      config: input.config,
    });
    if (!base.valid) return base;
    const normalized = this.normalizeConfig(input.countryCode, input.configKey, input.config);
    const providerErrors = await payrollLocalizationService.validateConfig(
      companyId,
      input.countryCode,
      input.configKey,
      normalized
    );
    if (providerErrors.length) {
      return { valid: false, errors: providerErrors };
    }
    return base;
  }

  async getConfigById(companyId: string, id: string) {
    const row = await prisma.hcmPayrollLocalizationConfig.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new AppError(404, 'Localization config not found');
    return {
      ...row,
      config: row.configJson as Record<string, unknown>,
    };
  }

  async listVersions(companyId: string, countryCode: string, configKey: string) {
    return prisma.hcmPayrollLocalizationConfig.findMany({
      where: { companyId, countryCode: countryCode.toUpperCase(), configKey },
      orderBy: [{ effectiveFrom: 'desc' }],
    });
  }

  async assertNoOverlap(
    companyId: string,
    countryCode: string,
    configKey: string,
    effectiveFrom: Date,
    effectiveTo: Date | null | undefined
  ) {
    const rangeEnd = effectiveTo ?? new Date('9999-12-31');
    const overlap = await prisma.hcmPayrollLocalizationConfig.findFirst({
      where: {
        companyId,
        countryCode,
        configKey,
        NOT: {
          OR: [{ effectiveTo: { lt: effectiveFrom } }, { effectiveFrom: { gt: rangeEnd } }],
        },
      },
    });
    if (overlap) {
      throw new AppError(422, 'Localization config overlaps an existing effective period');
    }
  }

  async upsertConfig(
    companyId: string,
    data: {
      countryCode: string;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
      configKey: string;
      config: Record<string, unknown>;
      isActive?: boolean;
    }
  ) {
    const countryCode = data.countryCode.toUpperCase();
    const configKey = String(data.configKey).trim();
    const validation = this.validateConfigInput({
      countryCode,
      configKey,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
      config: data.config,
    });
    if (!validation.valid) {
      throw new AppError(422, validation.errors.join('; ') || 'Invalid localization config');
    }
    const normalized = this.normalizeConfig(countryCode, configKey, data.config);
    const providerCheck = await this.validateWithProvider(companyId, {
      countryCode,
      configKey,
      config: normalized,
    });
    if (!providerCheck.valid) {
      throw new AppError(422, providerCheck.errors.join('; '));
    }
    await this.assertNoOverlap(companyId, countryCode, configKey, data.effectiveFrom, data.effectiveTo);

    return prisma.hcmPayrollLocalizationConfig.create({
      data: {
        companyId,
        countryCode,
        configKey,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        configJson: normalized as object,
        isActive: data.isActive ?? true,
      },
    });
  }
}

export const payrollLocalizationAdminService = new PayrollLocalizationAdminService();
