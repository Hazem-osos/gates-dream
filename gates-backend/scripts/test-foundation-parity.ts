/**
 * Foundation parity test — Delphi-to-Web foundation conversion
 * ("Delphi parity foundation" plan, Verification section).
 *
 * Asserts:
 *  1. Numbering: SerialStart honored, continuous vs. per-year scoping,
 *     manual entry (SerialAutomatic='M') opts out of auto-allocation.
 *  2. Settings default resolution when a row is absent (legacy-exact
 *     static defaults + the one dynamic default, CurrencyCode).
 *  3. Per-module composite-key resolution (SalesDariba + moduleCode) and
 *     the offLiteral-driven default polarity of getModuleFlag/getModuleEnum.
 *  4. AdvancedRights permission denial paths (default-allow-when-
 *     unprovisioned, explicit deny, admin bypass) and UserBranchPermission
 *     enforcement in the tenant-context middleware.
 *  5. Closed-period and closed-year rejection (GetPeriod semantics: no
 *     year for date / closed year / closed period / posting-lock date).
 *
 * Run: npm run test:foundation-parity
 */
import { PrismaClient } from '@prisma/client';
import { companySettingService } from '../src/modules/platform/services/company-setting.service.js';
import { documentSequenceService } from '../src/modules/platform/services/document-sequence.service.js';
import { advancedRightsService } from '../src/modules/platform/services/advanced-rights.service.js';
import { fiscalYearService } from '../src/modules/platform/services/fiscal-year.service.js';
import { tenantAndFiscalContextMiddleware } from '../src/shared/middleware/tenant-fiscal-context.middleware.js';
import { invoiceM5Service } from '../src/modules/invoices/services/invoice-m5.service.js';
import { computeInvoiceAmounts } from '../src/modules/invoices/services/invoice-line-math.js';
import {
  defaultInvoiceModuleCode,
  resolveInvoiceModule,
  shouldAutoPostOnSave,
} from '../src/modules/invoices/services/invoice-document-type.js';
import { invoiceModuleSettingsService } from '../src/modules/platform/services/invoice-module-settings.service.js';
import { newModuleService } from '../src/modules/platform/services/new-module.service.js';
import {
  branchScopeFilter,
  resolvePermittedBranchIds,
} from '../src/shared/auth/branch-scope.js';
import {
  buildAccountDefinitions,
  SYSTEM_GL_CODES,
} from '../src/modules/accounting/data/system-account-map.js';
import { AppError } from '../src/shared/middleware/error-handler.js';
import {
  NO_FISCAL_YEAR_FOR_DATE_MESSAGE,
  FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE,
  PERIOD_LOCKED_MESSAGE,
  POSTING_LOCKED_BEFORE_DATE_MESSAGE,
} from '../src/modules/accounting/constants/ledger-integrity.js';
import type { AuthRequest } from '../src/shared/auth/types.js';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-0000000000fa';
const BRANCH_ID = '00000000-0000-0000-0000-0000000000fb';
const BRANCH2_ID = '00000000-0000-0000-0000-0000000000fc';
const FY1_ID = '00000000-0000-0000-0000-0000000000fd';
const FY2_ID = '00000000-0000-0000-0000-0000000000fe';
const USER_ID = '00000000-0000-0000-0000-0000000000ff';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function assertThrows(fn: () => Promise<unknown>, matcher: (e: unknown) => boolean, msg: string) {
  try {
    await fn();
  } catch (e) {
    if (matcher(e)) return;
    throw new Error(`ASSERT: ${msg} (wrong error: ${(e as Error)?.message})`);
  }
  throw new Error(`ASSERT: ${msg} (did not throw)`);
}

async function seedFixtures() {
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { isActive: true },
    create: {
      id: COMPANY_ID,
      arabicName: 'Foundation Parity Test Co',
      englishName: 'Foundation Parity Test Co',
      isActive: true,
    },
  });

  await prisma.branch.upsert({
    where: { id: BRANCH_ID },
    update: { deletedAt: null },
    create: { id: BRANCH_ID, companyId: COMPANY_ID, arabicName: 'Main', legacyBranchCode: '01' },
  });
  await prisma.branch.upsert({
    where: { id: BRANCH2_ID },
    update: { deletedAt: null },
    create: { id: BRANCH2_ID, companyId: COMPANY_ID, arabicName: 'Branch2', legacyBranchCode: '02' },
  });

  await prisma.fiscalYear.upsert({
    where: { id: FY1_ID },
    update: { status: 'Open', startDate: new Date(Date.UTC(2020, 0, 1)), endDate: new Date(Date.UTC(2020, 11, 31)) },
    create: {
      id: FY1_ID,
      companyId: COMPANY_ID,
      legacyYearId: '2020',
      arabicName: 'FY2020',
      startDate: new Date(Date.UTC(2020, 0, 1)),
      endDate: new Date(Date.UTC(2020, 11, 31)),
      status: 'Open',
    },
  });
  await prisma.fiscalYear.upsert({
    where: { id: FY2_ID },
    update: { status: 'Open', startDate: new Date(Date.UTC(2021, 0, 1)), endDate: new Date(Date.UTC(2021, 11, 31)) },
    create: {
      id: FY2_ID,
      companyId: COMPANY_ID,
      legacyYearId: '2021',
      arabicName: 'FY2021',
      startDate: new Date(Date.UTC(2021, 0, 1)),
      endDate: new Date(Date.UTC(2021, 11, 31)),
      status: 'Open',
    },
  });

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: { companyId: COMPANY_ID, isActive: true },
    create: {
      id: USER_ID,
      companyId: COMPANY_ID,
      email: 'foundation-parity-test@example.com',
      username: 'foundation-parity-test',
      passwordHash: 'x',
      isActive: true,
    },
  });

  await prisma.companySettings.upsert({
    where: { companyId: COMPANY_ID },
    update: { defaultCurrency: 'EGP', lockPostingBeforeDate: null },
    create: { companyId: COMPANY_ID, defaultCurrency: 'EGP' },
  });

  // Clean slate for repeat runs.
  await prisma.documentSequence.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.companySettingEntry.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.userAdvancedPermission.deleteMany({ where: { companyId: COMPANY_ID } });
  await prisma.userBranchPermission.deleteMany({ where: { userId: USER_ID } });
  await prisma.fiscalPeriod.deleteMany({ where: { companyId: COMPANY_ID } });
}

async function testNumbering() {
  // SerialStart honored + periodic (SerialContanious='P') scoping resets per fiscal year.
  await companySettingService.setEntry(COMPANY_ID, 'SerialStartZT01', '500');
  await companySettingService.setEntry(COMPANY_ID, 'SerialContaniousZT01', 'P');

  const p1a = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-PERIODIC',
    legacySuffix: 'ZT01',
  });
  assert(p1a === '00000500', `SerialStart honored on first allocation (got ${p1a})`);

  const p1b = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-PERIODIC',
    legacySuffix: 'ZT01',
  });
  assert(p1b === '00000501', `Sequential allocation within same year (got ${p1b})`);

  const p2a = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY2_ID,
    docType: 'TEST-NUM-PERIODIC',
    legacySuffix: 'ZT01',
  });
  assert(p2a === '00000500', `Periodic (SerialContanious='P') scope resets in new fiscal year (got ${p2a})`);

  // Continuous (default, no SerialContanious row) — one running sequence across years.
  const c1 = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-CONTINUOUS',
    legacySuffix: 'ZT02',
  });
  assert(c1 === '00000001', `Continuous default startNumber=1 (got ${c1})`);

  const c2 = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY2_ID,
    docType: 'TEST-NUM-CONTINUOUS',
    legacySuffix: 'ZT02',
  });
  assert(c2 === '00000002', `Continuous scope ignores fiscalYearId across years (got ${c2})`);

  // Manual entry — SerialAutomatic='M' opts out of auto-allocation entirely.
  await companySettingService.setEntry(COMPANY_ID, 'SerialAutomaticZT03', 'M');
  const manual = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-MANUAL',
    legacySuffix: 'ZT03',
  });
  assert(manual === undefined, `SerialAutomatic='M' skips auto-allocation (got ${manual})`);

  // Adopting a docType whose table already holds hand-numbered documents: the
  // first allocation must clear the existing series instead of colliding.
  const seeded = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-SEEDED',
    legacySuffix: 'ZT05',
    seedFromExisting: async () => 42,
  });
  assert(seeded === '00000043', `seedFromExisting starts above the existing series (got ${seeded})`);

  // And when the sequence row already exists below the data (a sequence created
  // before seeding, or a later import), taken numbers are skipped.
  const taken = new Set(['00000044', '00000045']);
  const skipped = await documentSequenceService.nextNumberForFamily({
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    fiscalYearId: FY1_ID,
    docType: 'TEST-NUM-SEEDED',
    legacySuffix: 'ZT05',
    isAvailable: async (candidate) => !taken.has(candidate),
  });
  assert(skipped === '00000046', `isAvailable skips numbers already used (got ${skipped})`);

  console.log('  ✓ numbering: SerialStart / continuous-vs-periodic scope / manual opt-out / series adoption');
}

async function testSettingsDefaults() {
  // Legacy-exact static default from untcompanyvariables.pas (row absent).
  const allowMinusQtyDefault = await companySettingService.getEntryOrLegacyDefault(COMPANY_ID, 'AllowMinusQty');
  assert(allowMinusQtyDefault === 'T', `Legacy-exact default for absent AllowMinusQty row (got ${allowMinusQtyDefault})`);
  const allowMinusQtyFlagDefault = await companySettingService.getFlagOrLegacyDefault(COMPANY_ID, 'AllowMinusQty');
  assert(allowMinusQtyFlagDefault === true, 'getFlagOrLegacyDefault resolves legacy T default to true');

  // The web-wiring decision (foundation-flag-wiring) intentionally keeps the
  // *caller's* explicit default (false) distinct from the legacy default
  // above, to preserve pre-existing block-by-default behavior — confirm
  // plain getFlag still honors the caller's own default when no row exists.
  const explicitDefaultFalse = await companySettingService.getFlag(COMPANY_ID, 'AllowMinusQty', false);
  assert(explicitDefaultFalse === false, 'getFlag(explicit default) is independent of the legacy catalog default');

  // Dynamic default key: CurrencyCode falls back to the company's own base currency.
  assert(companySettingService.isDynamicDefaultKey('CurrencyCode'), 'CurrencyCode is registered as a dynamic-default key');
  const currency = await companySettingService.getCurrencyCodeOrCompanyDefault(COMPANY_ID);
  assert(currency === 'EGP', `CurrencyCode dynamic default resolves to company defaultCurrency (got ${currency})`);

  await companySettingService.setEntry(COMPANY_ID, 'CurrencyCode', 'USD');
  const currencyOverride = await companySettingService.getCurrencyCodeOrCompanyDefault(COMPANY_ID);
  assert(currencyOverride === 'USD', 'Explicit CurrencyCode row overrides the dynamic default');
  await companySettingService.deleteEntry(COMPANY_ID, 'CurrencyCode');

  console.log('  ✓ settings defaults: legacy-exact static default + dynamic CurrencyCode default');
}

async function testModuleKeys() {
  assert(
    companySettingService.moduleKey('SalesDariba', 'SI01') === 'SalesDaribaSI01',
    'moduleKey composes baseName + moduleCode legacy-exact'
  );

  // offLiteral='F': legacy default is TRUE unless the row is explicitly 'F'.
  const unprovisioned = await companySettingService.getModuleFlag(
    COMPANY_ID,
    'SalesDariba',
    'SI02',
    { offLiteral: 'F' }
  );
  assert(unprovisioned === true, 'getModuleFlag(offLiteral=F) defaults true when row absent');

  await companySettingService.setModuleEntry(COMPANY_ID, 'SalesDariba', 'SI01', 'F');
  const explicitOff = await companySettingService.getModuleFlag(
    COMPANY_ID,
    'SalesDariba',
    'SI01',
    { offLiteral: 'F' }
  );
  assert(explicitOff === false, 'getModuleFlag(offLiteral=F) is false only when row is exactly F');

  // offLiteral='T': legacy default is FALSE unless the row is explicitly 'T'.
  const notCreateGlDefault = await companySettingService.getModuleFlag(
    COMPANY_ID,
    'NotCreateGL',
    'SR01',
    { offLiteral: 'T' }
  );
  assert(notCreateGlDefault === false, 'getModuleFlag(offLiteral=T) defaults false when row absent');

  // Two-value enum resolution (SerialAutomatic/SerialContanious shape).
  const enumDefault = await companySettingService.getModuleEnum(
    COMPANY_ID,
    'SerialAutomatic',
    'ZT04',
    { defaultValue: 'A' as const, otherValue: 'M' as const }
  );
  assert(enumDefault === 'A', 'getModuleEnum defaults when row absent');

  await companySettingService.setModuleEntry(COMPANY_ID, 'SerialAutomatic', 'ZT04', 'M');
  const enumOverride = await companySettingService.getModuleEnum(
    COMPANY_ID,
    'SerialAutomatic',
    'ZT04',
    { defaultValue: 'A' as const, otherValue: 'M' as const }
  );
  assert(enumOverride === 'M', 'getModuleEnum resolves the explicit other-value');

  console.log('  ✓ per-module composite keys: moduleKey / getModuleFlag polarity / getModuleEnum');
}

async function testAdvancedRightsDenial() {
  // Unprovisioned user -> default-allow (legacy behaves as if AdvancedRights row is absent).
  const unprovisioned = await advancedRightsService.canPostFamily(COMPANY_ID, USER_ID, null, 'glPost');
  assert(unprovisioned === true, 'AdvancedRights default-allow when unprovisioned');

  // Unknown key rejected outright.
  await assertThrows(
    () => advancedRightsService.setDocumentRights(COMPANY_ID, USER_ID, null, { notARealKey: true }),
    (e) => e instanceof AppError && e.statusCode === 400,
    'setDocumentRights rejects unknown legacy right keys'
  );

  // Explicit deny.
  await advancedRightsService.setDocumentRights(COMPANY_ID, USER_ID, null, { glPost: false });
  const denied = await advancedRightsService.canPostFamily(COMPANY_ID, USER_ID, null, 'glPost');
  assert(denied === false, 'AdvancedRights explicit deny is honored once provisioned');

  await assertThrows(
    () => advancedRightsService.assertCanPostFamily(COMPANY_ID, USER_ID, null, 'glPost'),
    (e) => e instanceof AppError && e.statusCode === 403,
    'assertCanPostFamily throws 403 on explicit deny'
  );

  // Admin bypass overrides even an explicit deny.
  const adminBypass = await advancedRightsService.canPostFamily(COMPANY_ID, USER_ID, null, 'glPost', {
    isAdmin: true,
  });
  assert(adminBypass === true, 'AdvancedRights admin bypass overrides explicit deny');

  // Once the documentRights bucket exists at all, every key not explicitly
  // `true` in it denies (legacy `<>'T' -> deny` on a real row) — a sibling
  // key absent from that same bucket is NOT treated as still-unprovisioned.
  const siblingKeyDenied = await advancedRightsService.canPostFamily(COMPANY_ID, USER_ID, null, 'glUnpost');
  assert(siblingKeyDenied === false, 'A sibling key absent from a provisioned bucket denies, not default-allows');

  console.log('  ✓ AdvancedRights: default-allow / explicit deny / admin bypass / unknown-key rejection');
}

async function testUserBranchPermissionMiddleware() {
  // Restrict USER_ID to BRANCH_ID only.
  await prisma.userBranchPermission.create({
    data: { userId: USER_ID, companyId: COMPANY_ID, branchId: BRANCH_ID },
  });

  function mockReq(branchId: string): AuthRequest {
    return {
      headers: { 'x-branch-id': branchId },
      method: 'GET',
      user: { sub: USER_ID, email: '', username: '', realm_access: { roles: [] } },
      companyId: COMPANY_ID,
      tenantId: COMPANY_ID,
    } as unknown as AuthRequest;
  }

  let deniedErr: unknown;
  await new Promise<void>((resolve) => {
    const req = mockReq(BRANCH2_ID);
    tenantAndFiscalContextMiddleware(req, {} as any, (err?: unknown) => {
      deniedErr = err;
      resolve();
    });
  });
  assert(
    deniedErr instanceof AppError && deniedErr.statusCode === 403,
    `UserBranchPermission blocks access to an unauthorized branch (got ${(deniedErr as Error)?.message})`
  );

  let allowedErr: unknown;
  let allowedReq: AuthRequest = mockReq(BRANCH_ID);
  await new Promise<void>((resolve) => {
    tenantAndFiscalContextMiddleware(allowedReq, {} as any, (err?: unknown) => {
      allowedErr = err;
      resolve();
    });
  });
  assert(allowedErr === undefined, `UserBranchPermission allows the authorized branch (got ${(allowedErr as Error)?.message})`);
  assert(allowedReq.branchId === BRANCH_ID, 'Middleware resolves req.branchId to the authorized branch');

  // An unknown branch id falls back to the company's default (oldest) branch,
  // and the permission check must run against that resolved branch too —
  // otherwise sending garbage was a way around the restriction. Grant only the
  // *non*-default branch so the fallback lands somewhere off-limits.
  await prisma.userBranchPermission.deleteMany({ where: { userId: USER_ID } });
  await prisma.userBranchPermission.create({
    data: { userId: USER_ID, companyId: COMPANY_ID, branchId: BRANCH2_ID },
  });

  const unknownBranchId = '00000000-0000-0000-0000-0000000000aa';
  let fallbackErr: unknown;
  await new Promise<void>((resolve) => {
    tenantAndFiscalContextMiddleware(mockReq(unknownBranchId), {} as any, (err?: unknown) => {
      fallbackErr = err;
      resolve();
    });
  });
  assert(
    fallbackErr instanceof AppError && fallbackErr.statusCode === 403,
    `Default-branch fallback is still permission-checked (got ${(fallbackErr as Error)?.message})`
  );

  await prisma.userBranchPermission.deleteMany({ where: { userId: USER_ID } });
  await prisma.userBranchPermission.create({
    data: { userId: USER_ID, companyId: COMPANY_ID, branchId: BRANCH_ID },
  });

  // Query-level scoping: the shared filter narrows an unfiltered listing and
  // blanks out an explicit request for a branch the user may not read.
  const permitted = await resolvePermittedBranchIds(USER_ID, COMPANY_ID);
  assert(
    JSON.stringify(branchScopeFilter(permitted)) === JSON.stringify({ branchId: { in: [BRANCH_ID] } }),
    'branchScopeFilter narrows an unfiltered listing to the permitted branches'
  );
  assert(
    JSON.stringify(branchScopeFilter(permitted, BRANCH2_ID)) === JSON.stringify({ branchId: { in: [] } }),
    'branchScopeFilter returns nothing for a branch outside the permitted set'
  );
  assert(
    JSON.stringify(branchScopeFilter(null)) === JSON.stringify({}),
    'branchScopeFilter leaves an unrestricted user unfiltered'
  );

  await prisma.userBranchPermission.deleteMany({ where: { userId: USER_ID } });
  assert(
    (await resolvePermittedBranchIds(USER_ID, COMPANY_ID)) === null,
    'A user with zero branch rows resolves to unrestricted, not restricted-to-nothing'
  );
  console.log('  ✓ UserBranchPermission: middleware, fallback re-check and query-level scoping');
}

async function testFiscalYearAndPeriodRejection() {
  // No fiscal year covers this date at all.
  await assertThrows(
    () => fiscalYearService.assertOpenForDate(COMPANY_ID, new Date(Date.UTC(1999, 0, 1))),
    (e) => e instanceof AppError && e.statusCode === 422 && e.message === NO_FISCAL_YEAR_FOR_DATE_MESSAGE,
    'assertOpenForDate rejects a date with no covering fiscal year (legacy 1123)'
  );

  // Closed fiscal year.
  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Close' } });
  await assertThrows(
    () => fiscalYearService.assertOpenForDate(COMPANY_ID, new Date(Date.UTC(2020, 5, 15))),
    (e) => e instanceof AppError && e.statusCode === 422 && e.message === FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE,
    'assertOpenForDate rejects a date in a closed fiscal year (legacy 1124)'
  );
  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Open' } });

  // Closed fiscal period within an otherwise-open year.
  await prisma.fiscalPeriod.create({
    data: {
      companyId: COMPANY_ID,
      fiscalYearId: FY2_ID,
      periodNumber: 1,
      startDate: new Date(Date.UTC(2021, 0, 1)),
      endDate: new Date(Date.UTC(2021, 5, 30)),
      isClosed: true,
    },
  });
  await assertThrows(
    () => fiscalYearService.assertOpenForDate(COMPANY_ID, new Date(Date.UTC(2021, 2, 15))),
    (e) => e instanceof AppError && e.statusCode === 422 && e.message === PERIOD_LOCKED_MESSAGE,
    'assertOpenForDate rejects a date in a closed fiscal period'
  );
  await prisma.fiscalPeriod.deleteMany({ where: { fiscalYearId: FY2_ID } });

  // Company-wide posting-lock cutoff date (lockPostingBeforeDate).
  await prisma.companySettings.update({
    where: { companyId: COMPANY_ID },
    data: { lockPostingBeforeDate: new Date(Date.UTC(2021, 5, 1)).toISOString() },
  });
  await assertThrows(
    () => fiscalYearService.assertOpenForDate(COMPANY_ID, new Date(Date.UTC(2021, 3, 1))),
    (e) => e instanceof AppError && e.statusCode === 422 && e.message === POSTING_LOCKED_BEFORE_DATE_MESSAGE,
    'assertOpenForDate rejects a date before the configured lockPostingBeforeDate'
  );
  const afterLock = await fiscalYearService.assertOpenForDate(COMPANY_ID, new Date(Date.UTC(2021, 6, 1)));
  assert(afterLock === FY2_ID, 'assertOpenForDate succeeds for a date on/after the lock cutoff');
  await prisma.companySettings.update({ where: { companyId: COMPANY_ID }, data: { lockPostingBeforeDate: null } });

  // A closed year rejected by id (the header/middleware path) must report the
  // year message, not the monthly period one.
  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Close' } });
  await assertThrows(
    () => fiscalYearService.assertOpenById(COMPANY_ID, FY1_ID),
    (e) => e instanceof AppError && e.message === FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE,
    'assertOpenById reports the closed-year message (1124), not the period lock'
  );
  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Open' } });

  console.log('  ✓ fiscal year/period rejection: no-year (1123) / closed-year (1124) / closed-period / lock-date / by-id');
}

/**
 * Legacy `GetPeriod` runs when a document is *saved*, so these paths must
 * reject a closed date at draft time, not only at post time.
 */
async function testDraftAndQuantityLocks() {
  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Close' } });

  await assertThrows(
    () =>
      invoiceM5Service.create(COMPANY_ID, BRANCH_ID, FY1_ID, {
        invoiceKind: 'SALE',
        invoiceNumber: 'SI-LOCK-TEST',
        date: new Date(Date.UTC(2020, 5, 15)),
        currencyCode: 'EGP',
        lines: [],
      } as never),
    (e) => e instanceof AppError && e.message === FISCAL_YEAR_CLOSED_FOR_DATE_MESSAGE,
    'M5 invoice draft create is rejected in a closed fiscal year'
  );

  await prisma.fiscalYear.update({ where: { id: FY1_ID }, data: { status: 'Open' } });
  console.log('  ✓ draft-time period locks: invoice create rejected in a closed year');
}

/**
 * Provisioning has to seed every alias the posting resolvers look up, not just
 * the legacy slot names: a missing key surfaces as a 422 at post time on an
 * otherwise fully configured tenant.
 */
async function testPhaseBDynamicRules() {
  // CascadingDiscounts off: header discount does not reduce the VAT base.
  const line = { quantity: 10, price: 100, discountPercent: 10, taxPercent: 14 };
  const off = computeInvoiceAmounts([line], { headerDiscountPercent: 10 }, { cascadingDiscounts: false });
  assert(off.totalAmount === 1000, `line total 1000 (got ${off.totalAmount})`);
  assert(off.lineDiscountAmount === 100, `trade discount 100 (got ${off.lineDiscountAmount})`);
  assert(off.headerDiscountAmount === 90, `header 10% of 900 = 90 (got ${off.headerDiscountAmount})`);
  assert(off.taxAmount === 126, `VAT on 900, not 810 (got ${off.taxAmount})`);

  // CascadingDiscounts on: header share reduces the VAT base (900 - 90 = 810).
  const on = computeInvoiceAmounts([line], { headerDiscountPercent: 10 }, { cascadingDiscounts: true });
  assert(on.taxAmount === 113.4, `cascaded VAT on 810 at 14% = 113.4 (got ${on.taxAmount})`);
  assert(on.netAmount === 923.4, `cascaded net 1000-190+113.4 (got ${on.netAmount})`);

  // NewModule suffix: SI02 resolves instead of the hardcoded SI01 map.
  const exhibition = await newModuleService.create({
    companyId: COMPANY_ID,
    baseType: 'SI',
    nameAr: 'معرض',
    menuNameAr: 'معرض',
    nameEn: 'Exhibition',
  });
  const second = await newModuleService.create({
    companyId: COMPANY_ID,
    baseType: 'SI',
    nameAr: 'معرض 2',
    menuNameAr: 'معرض 2',
  });
  assert(exhibition.fullCode === 'SI01', `first SI module is SI01 (got ${exhibition.fullCode})`);
  assert(second.fullCode === 'SI02', `second SI module is SI02 (got ${second.fullCode})`);

  const byId = await resolveInvoiceModule(COMPANY_ID, 'SALE', { newModuleId: second.id });
  assert(byId.moduleCode === 'SI02', 'resolveFullCode path yields SI02');
  assert(byId.newModuleId === second.id, 'resolved NewModule id is persisted');

  const fallback = await resolveInvoiceModule(COMPANY_ID, 'SALE');
  assert(
    fallback.moduleCode === defaultInvoiceModuleCode('SALE'),
    'omitting NewModule still falls back to SI01'
  );

  await assertThrows(
    () => resolveInvoiceModule(COMPANY_ID, 'PURCHASE', { newModuleId: second.id }),
    (e) => e instanceof AppError && e.statusCode === 422,
    'a sales NewModule cannot be used on a purchase invoice'
  );

  await companySettingService.setModuleEntry(COMPANY_ID, 'CascadingDiscounts', 'SI02', 'T');
  await companySettingService.setModuleEntry(COMPANY_ID, 'AutoPost', 'SI02', 'T');
  const settings = await invoiceModuleSettingsService.resolve(COMPANY_ID, 'SI02');
  assert(settings.cascadingDiscounts === true, 'invoiceModuleSettingsService reads CascadingDiscountsSI02');
  assert(settings.autoPost === true, 'invoiceModuleSettingsService reads AutoPostSI02');
  assert(
    (await shouldAutoPostOnSave(COMPANY_ID, 'SI02')) === true,
    'explicit AutoPost{Module}=T triggers auto-post'
  );

  assert(
    (await shouldAutoPostOnSave(COMPANY_ID, 'SI01')) === false,
    'absent AutoPost{Module} does not auto-post (conservative deviation from legacy default-true)'
  );
  await companySettingService.setFlag(COMPANY_ID, 'DirectAffectMoney', true);
  assert(
    (await shouldAutoPostOnSave(COMPANY_ID, 'SI01')) === true,
    'DirectAffectMoney=T triggers auto-post on save'
  );
  await companySettingService.setFlag(COMPANY_ID, 'DirectAffectMoney', false);

  await prisma.newModule.deleteMany({ where: { companyId: COMPANY_ID } });

  console.log('  ✓ Phase B: NewModule suffix, cascading tax base, auto-post flags');
}

function testProvisionedAccountAliases() {
  const codeToId = new Map(Object.values(SYSTEM_GL_CODES).map((code, i) => [code, `id-${i}`]));
  const defs = buildAccountDefinitions(codeToId) as Record<string, string | undefined>;

  const requiredByResolvers = [
    // invoice-account-resolver.service.ts
    'arAccount', 'apAccount', 'inventoryAccount', 'salesRevenueAccount', 'cogsAccount',
    'salesDiscountAccount', 'vatOutputAccount', 'vatInputAccount',
    'withholdingTaxAccount', 'whtReceivableAccount',
    // stock-movement-gl.service.ts
    'stockIssueExpenseAccount', 'inventoryAdjustmentAccount',
    // legacy slot names the gl-account-defaults screen writes
    'daribaManbaAccount', 'daribaManbaAccountDebit', 'itemLossAccount', 'customersAccount',
  ];
  const missing = requiredByResolvers.filter((key) => !defs[key]);
  assert(missing.length === 0, `Provisioning seeds every resolver alias (missing: ${missing.join(', ')})`);

  console.log('  ✓ account slots: provisioning seeds every alias the posting resolvers read');
}

async function main() {
  console.log('Foundation parity test — starting');
  await seedFixtures();

  await testNumbering();
  await testSettingsDefaults();
  await testModuleKeys();
  await testAdvancedRightsDenial();
  await testUserBranchPermissionMiddleware();
  await testFiscalYearAndPeriodRejection();
  await testDraftAndQuantityLocks();
  await testPhaseBDynamicRules();
  testProvisionedAccountAliases();

  console.log('Foundation parity test — PASSED');
}

main()
  .catch((e) => {
    console.error('Foundation parity test — FAILED');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
