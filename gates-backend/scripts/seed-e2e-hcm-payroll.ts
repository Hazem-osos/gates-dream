/**
 * Disposable E2E payroll users (test DB only). Writes credentials to gates-web/e2e/.auth/e2e-credentials.json
 * Run: E2E_SEED=1 DATABASE_URL=... tsx scripts/seed-e2e-hcm-payroll.ts
 */
import { PrismaClient } from '@prisma/client';
import { createPayrollFixture } from '../src/__tests__/helpers/hcm-payroll-fixture';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const PAYROLL_ACTIONS = [
  'view',
  'calculate',
  'approve',
  'post',
  'pay',
  'rules_manage',
  'localization_manage',
  'inputs_manage',
  'gl_manage',
  'edit',
] as const;

async function main() {
  if (process.env.E2E_SEED !== '1') {
    console.error('Set E2E_SEED=1 to run');
    process.exit(1);
  }
  const fx = await createPayrollFixture(prisma);
  const { default: bcrypt } = await import('bcryptjs');
  const password = process.env.E2E_HCM_PASSWORD ?? `E2e-${Date.now().toString(36)}`;
  const email = process.env.E2E_HCM_EMAIL ?? `e2e-hcm-payroll-${fx.companyId.slice(0, 8)}@gates-test.local`;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      companyId: fx.companyId,
      email,
      username: email,
      passwordHash,
      isActive: true,
      firstName: 'E2E',
      lastName: 'Payroll',
    },
  });

  for (const action of PAYROLL_ACTIONS) {
    await prisma.userPermission.create({
      data: {
        userId: user.id,
        companyId: fx.companyId,
        resource: 'payroll',
        action,
        module: 'hr',
        allow: true,
      },
    });
  }

  const viewerPassword = process.env.E2E_HCM_VIEWER_PASSWORD ?? `E2e-view-${Date.now().toString(36)}`;
  const viewerEmail =
    process.env.E2E_HCM_VIEWER_EMAIL ?? `e2e-hcm-viewer-${fx.companyId.slice(0, 8)}@gates-test.local`;
  const viewerHash = await bcrypt.hash(viewerPassword, 10);
  const viewer = await prisma.user.create({
    data: {
      companyId: fx.companyId,
      email: viewerEmail,
      username: viewerEmail,
      passwordHash: viewerHash,
      isActive: true,
      firstName: 'E2E',
      lastName: 'Viewer',
    },
  });
  await prisma.userPermission.create({
    data: {
      userId: viewer.id,
      companyId: fx.companyId,
      resource: 'payroll',
      action: 'view',
      module: 'hr',
      allow: true,
    },
  });

  const otherFx = await createPayrollFixture(prisma);
  const otherComp = await prisma.hcmPayComponent.findFirst({ where: { companyId: otherFx.companyId } });
  let foreignLocalization = await prisma.hcmPayrollLocalizationConfig.findFirst({
    where: { companyId: otherFx.companyId },
  });
  if (!foreignLocalization) {
    foreignLocalization = await prisma.hcmPayrollLocalizationConfig.create({
      data: {
        companyId: otherFx.companyId,
        countryCode: 'EG',
        configKey: 'TAX_BRACKETS',
        effectiveFrom: new Date('2099-01-01'),
        configJson: { brackets: [{ rate: 0.01 }] },
        isActive: true,
      },
    });
  }
  const foreignRule = await prisma.hcmPayrollRule.create({
    data: {
      companyId: otherFx.companyId,
      payComponentId: otherComp!.id,
      code: `E2EFOR${Date.now()}`,
      name: 'Foreign tenant rule',
      phase: 10,
      priority: 100,
      effectiveFrom: new Date('2026-01-01'),
      formulaExpr: 'comp_basic',
      roundingMode: 'HALF_UP_2',
      isActive: true,
    },
  });
  await prisma.userPermission.create({
    data: {
      userId: user.id,
      companyId: fx.companyId,
      resource: 'employee',
      action: 'view',
      module: 'hr',
      allow: true,
    },
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.resolve(here, '../../gates-web/e2e/.auth');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'e2e-credentials.json');
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        email,
        password,
        companyId: fx.companyId,
        fiscalYearId: fx.fiscalYearId,
        branchId: fx.branchId,
        employeeId: fx.employeeId,
        viewerEmail,
        viewerPassword,
        foreignRuleId: foreignRule.id,
        foreignLocalizationId: foreignLocalization.id,
        foreignCompanyId: otherFx.companyId,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${outFile} (password not logged)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
