/**
 * Phase 5.1 Wave B.5 — localization validation (TEST configs only).
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../helpers/hcm-payroll-fixture';
import { payrollLocalizationAdminService } from '../../modules/hr/services/payroll/payroll-localization-admin.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('HCM Phase 5.1 Wave B.5 localization', () => {
  jest.setTimeout(60_000);

  it('rejects negative insurance cap in TEST config', async () => {
    const fx = await createPayrollFixture(prisma);
    await expect(
      payrollLocalizationAdminService.upsertConfig(fx.companyId, {
        countryCode: 'EG',
        configKey: 'INSURANCE_CAP',
        effectiveFrom: new Date('2026-03-01'),
        effectiveTo: null,
        config: { maxBase: -1 },
        isActive: true,
      })
    ).rejects.toThrow();
  });
});
