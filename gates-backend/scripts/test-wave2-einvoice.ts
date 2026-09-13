/**
 * Wave 2 — M14 ETA e-invoice integration test (mock ETA API).
 * Run: npm run test:wave2-einvoice
 */
import { PrismaClient } from '@prisma/client';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { invoicePostingOrchestrator } from '../src/modules/invoices/services/invoice-posting-orchestrator.js';
import { invoicePostingContextFromIds } from '../src/modules/invoices/services/invoice-posting-context.js';
import { eInvoicePayloadBuilderService } from '../src/modules/electronic-invoices/services/e-invoice-payload-builder.service.js';
import { eInvoiceSubmissionService } from '../src/modules/electronic-invoices/services/e-invoice-submission.service.js';
import { AppError } from '../src/shared/middleware/error-handler.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';
const BRANCH_ID = '00000000-0000-0000-0000-000000000010';
const FISCAL_YEAR_ID = '00000000-0000-0000-0000-000000000020';
const WAREHOUSE_ID = '00000000-0000-0000-0000-000000000030';
const ITEM_ID = '00000000-0000-0000-0000-000000000040';
const UNIT_ID = '00000000-0000-0000-0000-000000000041';
const CUSTOMER_ID = '00000000-0000-0000-0000-000000000060';
const TAX_PERIOD_ID = '00000000-0000-0000-0000-000000000080';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function seedEtaSettings() {
  await prisma.taxPeriod.updateMany({
    where: { id: TAX_PERIOD_ID, companyId: COMPANY_ID },
    data: { status: 'OPEN', closedAt: null },
  });

  // The ETA RIN validator (`validateEgyptianRin`) requires exactly 9 digits;
  // this fixture previously seeded a 15-digit value that only ever applied
  // once (`update: {}` was a no-op on re-runs), so every subsequent run hit
  // a stale, invalid row and failed at `getSettings()`. Now idempotently
  // re-applies a valid 9-digit RIN on every run.
  const validIssuerTaxId = '123456789';
  await prisma.eInvoiceSetting.upsert({
    where: { companyId: COMPANY_ID },
    update: { issuerTaxId: validIssuerTaxId, issuerName: 'Wave1 Test Co' },
    create: {
      companyId: COMPANY_ID,
      clientId: 'mock-client',
      clientSecret: 'mock-secret',
      environment: 'PRE_PRODUCTION',
      issuerTaxId: validIssuerTaxId,
      issuerName: 'Wave1 Test Co',
      activityCode: '6201',
    },
  });
}

/**
 * Idempotency: each run posts a sale invoice that stays posted, so without this the
 * customer balance and period VAT totals drift across runs.
 */
async function resetEtaInvoices() {
  const stale = await prisma.invoice.findMany({
    where: { companyId: COMPANY_ID, invoiceNumber: { startsWith: 'SI-ETA-' } },
    select: { id: true, journalEntryId: true, costJournalEntryId: true },
  });
  if (stale.length === 0) return;

  const ids = stale.map((i) => i.id);
  const journalIds = stale
    .flatMap((i) => [i.journalEntryId, i.costJournalEntryId])
    .filter((id): id is string => !!id);

  await prisma.eInvoiceDocument.deleteMany({ where: { invoiceId: { in: ids } } });
  await prisma.cashTransaction.deleteMany({ where: { invoiceId: { in: ids } } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
  await prisma.invoice.deleteMany({ where: { id: { in: ids } } });
  if (journalIds.length > 0) {
    await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: { in: journalIds } } });
    await prisma.journalEntry.deleteMany({ where: { id: { in: journalIds } } });
  }
  await prisma.customer.update({ where: { id: CUSTOMER_ID }, data: { balance: 0 } });
}

async function main() {
  console.log('Wave2 e-invoice integration test — start');
  await seedEtaSettings();
  await resetEtaInvoices();

  const fiscalYear = await prisma.fiscalYear.findFirst({
    where: { id: FISCAL_YEAR_ID, companyId: COMPANY_ID },
  });
  assert(!!fiscalYear, 'Fiscal year fixture');

  const ctx = invoicePostingContextFromIds({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FISCAL_YEAR_ID,
    userId: 'wave2-einvoice-test',
  });

  const si = await invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FISCAL_YEAR_ID, {
    invoiceKind: 'SALE',
    invoiceNumber: `SI-ETA-${Date.now()}`,
    date: new Date(),
    currencyCode: 'EGP',
    customerId: CUSTOMER_ID,
    warehouseId: WAREHOUSE_ID,
    sourceYearId: fiscalYear!.legacyYearId,
    lines: [
      {
        itemId: ITEM_ID,
        unitId: UNIT_ID,
        quantity: 2,
        baseQuantity: 2,
        price: 100,
        taxPercent: 14,
        taxAmount: 28,
        lineOrder: 1,
      },
    ],
  });

  await invoicePostingOrchestrator.post(ctx, si!.id);

  const payload = await eInvoicePayloadBuilderService.buildFromM5Invoice(
    COMPANY_ID,
    si!.id
  );
  assert(payload.documentType === 'I', 'Sales invoice maps to type I');
  assert(payload.documentTypeVersion === '1.0', 'ETA payload version 1.0');
  assert(payload.invoiceLines.length === 1, 'One invoice line');
  assert(payload.invoiceLines[0].itemType === 'EGS', 'Default EGS item coding');
  assert(payload.taxTotals[0].taxType === 'T1', 'VAT tax type T1');
  assert(payload.issuer.id === '123456789', 'Issuer tax ID from settings');

  const doc = await eInvoiceSubmissionService.submitM5Invoice(COMPANY_ID, si!.id);
  assert(doc.status === 'VALID', 'Mock ETA returns VALID');
  assert(!!doc.documentUuid, 'documentUuid persisted');
  assert(!!doc.submissionUuid, 'submissionUuid persisted');
  assert(!!doc.longId, 'longId persisted');
  assert(!!doc.publicUrl, 'publicUrl persisted');

  let duplicateBlocked = false;
  try {
    await eInvoiceSubmissionService.submitM5Invoice(COMPANY_ID, si!.id);
  } catch (e) {
    duplicateBlocked = e instanceof AppError && e.statusCode === 409;
  }
  assert(duplicateBlocked, 'Duplicate submission blocked');

  const polled = await eInvoiceSubmissionService.getStatus(
    COMPANY_ID,
    doc.documentUuid!
  );
  assert(polled.status === 'VALID', 'Status poll returns VALID');

  console.log('Wave2 e-invoice integration test — PASSED');
}

main()
  .catch((e) => {
    console.error('Wave2 e-invoice integration test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
