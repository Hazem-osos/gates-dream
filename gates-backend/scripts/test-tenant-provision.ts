/**
 * Assert fresh company gets standard COA + master data + GL mappings.
 * Run: npm run test:tenant-provision
 */
import { PrismaClient } from '@prisma/client';
import { tenantProvisioningService } from '../src/modules/accounting/services/tenant-provisioning.service.js';
import { SYSTEM_GL_CODES } from '../src/modules/accounting/data/system-account-map.js';

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const company = await prisma.company.create({
    data: {
      arabicName: `Provision Test ${Date.now()}`,
      englishName: 'Provision Test Co',
      isActive: true,
    },
  });

  try {
    const result = await tenantProvisioningService.provisionStandardTenant(company.id, {
      currencyCode: 'EGP',
    });

    assert(result.count >= 40, `expected full COA, got ${result.count} accounts`);
    assert(!!result.warehouseId, 'warehouse created');

    const headerWh = await prisma.warehouse.findFirst({
      where: { companyId: company.id, warehouseKind: 'HEADER', parentWarehouseId: null },
    });
    const postingWh = await prisma.warehouse.findFirst({
      where: { companyId: company.id, id: result.warehouseId },
    });
    assert(!!headerWh, 'header warehouse created');
    assert(headerWh?.arabicName === 'المخزن الرئيسي', 'header warehouse named المخزن الرئيسي');
    assert(postingWh?.warehouseKind === 'POSTING', 'default warehouse is posting/حركة');
    assert(postingWh?.parentWarehouseId === headerWh?.id, 'posting warehouse sits under header');
    const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
    assert(branch?.defaultWarehouseId === postingWh?.id, 'branch default is the posting warehouse');
    assert(!!result.safeId, 'safe created');
    assert(!!result.fiscalYearId, 'fiscal year created');
    assert(!!result.unitId, 'unit PCS created');

    for (const code of Object.values(SYSTEM_GL_CODES)) {
      const acc = await prisma.account.findFirst({
        where: { companyId: company.id, code, deletedAt: null },
      });
      assert(!!acc, `account code ${code} exists`);
    }

    const settings = await prisma.companySettings.findUnique({
      where: { companyId: company.id },
    });
    assert(!!settings?.accountDefinitions, 'accountDefinitions populated');
    assert(!!settings?.retainedEarningsAccountId, 'retainedEarningsAccountId set');

    const defs = settings!.accountDefinitions as Record<string, string>;
    assert(defs.defaultArAccountId === defs.arAccount, 'AR mapping consistent');
    assert(defs.defaultInventoryAccountId === defs.inventoryAccount, 'inventory mapping consistent');

    const gl = await tenantProvisioningService.getGlDefaults(company.id);
    assert(!!gl.inventoryAccountId, 'gl-defaults inventory');
    assert(!!gl.arAccountId, 'gl-defaults AR');
    assert(!!gl.apAccountId, 'gl-defaults AP');

    const second = await tenantProvisioningService.provisionStandardTenant(company.id);
    assert(second.accountsCreated === 0, 'second run creates no new accounts');

    console.log('OK tenant provisioning verification passed');
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
