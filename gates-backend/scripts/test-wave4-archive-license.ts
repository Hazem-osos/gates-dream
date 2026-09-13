/**
 * Wave 4/5 — M20 document archive + M21 SaaS licensing.
 * Run: npm run test:wave4-archive-license
 */
import { PrismaClient } from '@prisma/client';
import { documentArchiveService } from '../src/modules/archive/services/document-archive.service.js';
import { licenseSubscriptionService } from '../src/modules/platform/services/license-subscription.service.js';
import { AppError } from '../src/shared/middleware/error-handler.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function assertForbidden(fn: () => Promise<void>, label: string) {
  let blocked = false;
  try {
    await fn();
  } catch (e) {
    blocked = e instanceof AppError && e.statusCode === 403;
  }
  assert(blocked, `${label} should return 403`);
}

async function testArchiveOnInvoice() {
  console.log('  • Archive upload/list/delete on invoice');
  const invoice = await prisma.invoice.findFirst({
    where: { companyId: COMPANY_ID, isPosted: true, isCancelled: false },
    orderBy: { createdAt: 'desc' },
  });
  assert(!!invoice, 'Need a posted invoice (run test:wave1-invoices if missing)');

  const payload = Buffer.from('Wave4 archive test file', 'utf8');
  const uploaded = await documentArchiveService.upload({
    companyId: COMPANY_ID,
    entityType: 'INVOICE',
    entityId: invoice!.id,
    fileName: 'test-attachment.txt',
    mimeType: 'text/plain',
    buffer: payload,
    uploadedById: 'wave4-archive-test',
    description: 'M20 integration',
    tags: ['wave4', 'invoice'],
  });

  assert(uploaded.fileSize === payload.length, 'fileSize matches');
  assert(uploaded.storagePath.length > 0, 'storagePath set');

  const listed = await documentArchiveService.listForEntity(
    COMPANY_ID,
    'INVOICE',
    invoice!.id
  );
  assert(listed.some((a) => a.id === uploaded.id), 'attachment listed for invoice');

  await documentArchiveService.softDelete(COMPANY_ID, uploaded.id);
  const afterDelete = await documentArchiveService.listForEntity(
    COMPANY_ID,
    'INVOICE',
    invoice!.id
  );
  assert(!afterDelete.some((a) => a.id === uploaded.id), 'attachment removed after delete');
}

async function testLicenseEnforcement() {
  console.log('  • Subscription activate + module guard');
  await licenseSubscriptionService.activate({
    companyId: COMPANY_ID,
    planType: 'SUBSCRIPTION',
    status: 'ACTIVE',
    allowedModules: ['ACCOUNTING', 'INVENTORY'],
    maxBranches: 2,
    maxUsers: 10,
    maxStorageMb: 256,
    expiryDate: new Date('2035-12-31T00:00:00.000Z'),
    licenseKey: 'wave4-test-license-key',
  });

  await licenseSubscriptionService.assertModuleLicensed(COMPANY_ID, 'ACCOUNTING');
  await licenseSubscriptionService.assertModuleLicensed(COMPANY_ID, 'INVENTORY');

  await assertForbidden(
    () => licenseSubscriptionService.assertModuleLicensed(COMPANY_ID, 'REAL_ESTATE'),
    'REAL_ESTATE'
  );
  await assertForbidden(
    () => licenseSubscriptionService.assertModuleLicensed(COMPANY_ID, 'SCHOOLS'),
    'SCHOOLS'
  );

  const current = await licenseSubscriptionService.getCurrent(COMPANY_ID);
  assert(current.unrestricted === false, 'subscription is restricted');
  assert(current.allowedModules.includes('ACCOUNTING'), 'ACCOUNTING licensed');
  assert(!current.allowedModules.includes('SCHOOLS'), 'SCHOOLS not licensed');

  // Leaving this row behind locks the fixture company out of every guarded vertical, so any
  // later suite hitting /api/v1/{schools,manufacturing,…} over HTTP would fail with a 403.
  await prisma.tenantSubscription.deleteMany({ where: { companyId: COMPANY_ID } });
}

async function main() {
  console.log('Wave4 M20/M21 archive & license — start');
  await testArchiveOnInvoice();
  await testLicenseEnforcement();
  console.log('Wave4 M20/M21 archive & license — PASSED');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    // licenseSubscriptionService/tenant-metadata-cache hold an open Redis connection that
    // otherwise keeps the event loop alive forever after the script's work is done.
    process.exit(process.exitCode ?? 0);
  });
