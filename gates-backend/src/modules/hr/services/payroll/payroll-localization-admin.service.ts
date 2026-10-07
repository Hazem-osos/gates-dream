import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';

const PROVIDER_SCHEMAS: Record<string, { fields: Array<{ key: string; label: string; type: 'number' | 'string' | 'json' }> }> = {
  EG: {
    fields: [
      { key: 'insuranceCap', label: 'Insurance cap (TEST)', type: 'number' },
      { key: 'taxBrackets', label: 'Tax brackets (TEST JSON)', type: 'json' },
    ],
  },
  SA: {
    fields: [
      { key: 'gosiEmployeeRate', label: 'GOSI employee rate (TEST)', type: 'number' },
      { key: 'gosiEmployerRate', label: 'GOSI employer rate (TEST)', type: 'number' },
    ],
  },
};

export class PayrollLocalizationAdminService {
  providerSchema(countryCode: string) {
    const code = countryCode.toUpperCase();
    return PROVIDER_SCHEMAS[code] ?? { fields: [{ key: 'config', label: 'Configuration', type: 'json' }] };
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
    if (data.effectiveTo && data.effectiveTo < data.effectiveFrom) {
      throw new AppError(422, 'effectiveTo must be after effectiveFrom');
    }
    const overlap = await prisma.hcmPayrollLocalizationConfig.findFirst({
      where: {
        companyId,
        countryCode,
        NOT: {
          OR: [
            { effectiveTo: { lt: data.effectiveFrom } },
            { effectiveFrom: { gt: data.effectiveTo ?? new Date('9999-12-31') } },
          ],
        },
      },
    });
    if (overlap) {
      throw new AppError(422, 'Localization config overlaps an existing version');
    }
    return prisma.hcmPayrollLocalizationConfig.create({
      data: {
        companyId,
        countryCode,
        configKey: data.configKey,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        configJson: data.config as object,
        isActive: data.isActive ?? true,
      },
    });
  }
}

export const payrollLocalizationAdminService = new PayrollLocalizationAdminService();
