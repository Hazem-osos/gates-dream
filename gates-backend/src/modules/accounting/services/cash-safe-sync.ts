import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invalidateTenantCache, tenantCacheKeys } from '../../../shared/cache/tenant-metadata-cache';
import { SYSTEM_GL_CODES } from '../data/system-account-map';
import {
  assertUniqueAccountName,
  normalizeAccountName,
} from '../utils/account-name-uniqueness';

const BANK_PARENT_CODE = SYSTEM_GL_CODES.bankDefault;

export function isSystemCashPostingCode(code: string | null | undefined): boolean {
  return String(code ?? '').trim() === SYSTEM_GL_CODES.cashMain;
}

export function cashPostingParentBlockedMessage(parentName?: string | null): string {
  const label = parentName?.trim() || 'الخزينة الرئيسية';
  return `لا يمكن إضافة حساب فرعي تحت ${label} لأنها حساب حركة. أنشئ الخزينة الجديدة تحت «النقدية وما في حكمها».`;
}

async function companyCurrency(companyId: string): Promise<string> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { defaultCurrency: true },
  });
  return (settings?.defaultCurrency || 'EGP').toUpperCase();
}

export async function grantSafeToExistingRightHolders(companyId: string, safeId: string): Promise<void> {
  const holders = await prisma.bankBoxRight.findMany({
    where: { companyId, safeId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });
  for (const { userId } of holders) {
    const exists = await prisma.bankBoxRight.findFirst({
      where: { companyId, userId, safeId },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.bankBoxRight.create({
      data: { companyId, userId, safeId, canView: true, canPost: true },
    });
  }
}

export async function grantBankToExistingRightHolders(
  companyId: string,
  bankAccountId: string
): Promise<void> {
  const holders = await prisma.bankBoxRight.findMany({
    where: { companyId, bankAccountId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });
  for (const { userId } of holders) {
    const exists = await prisma.bankBoxRight.findFirst({
      where: { companyId, userId, bankAccountId },
      select: { id: true },
    });
    if (exists) continue;
    await prisma.bankBoxRight.create({
      data: { companyId, userId, bankAccountId, canView: true, canPost: true },
    });
  }
}

export async function nextSafeCode(companyId: string): Promise<string> {
  const rows = await prisma.safe.findMany({
    where: { companyId },
    select: { code: true },
  });
  let max = 0;
  for (const row of rows) {
    const match = /^SAFE-(\d+)$/i.exec(String(row.code ?? '').trim());
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `SAFE-${String(max + 1).padStart(2, '0')}`;
}

async function nextSiblingAccountCode(companyId: string, parentId: string, parentCode: string): Promise<string> {
  const siblings = await prisma.account.findMany({
    where: { companyId, parentId, deletedAt: null },
    select: { code: true },
  });
  let maxSuffix = 0;
  for (const row of siblings) {
    if (!row.code.startsWith(parentCode) || row.code.length <= parentCode.length) continue;
    const suffix = Number.parseInt(row.code.slice(parentCode.length), 10);
    if (!Number.isNaN(suffix)) maxSuffix = Math.max(maxSuffix, suffix);
  }
  return `${parentCode}${maxSuffix + 1}`;
}

function isCashTreasuryAccount(params: {
  code: string;
  parentCode?: string | null;
  accountKind?: string | null;
}): boolean {
  if (params.accountKind === 'HEADER') return false;
  if (isSystemCashPostingCode(params.code)) return true;
  if (params.code === BANK_PARENT_CODE) return false;
  return params.parentCode === '111' || isSystemCashPostingCode(params.parentCode);
}

/** Banks folder is a control HEADER even when the template shipped it as a leaf. */
export async function ensureBankFolderIsHeader(companyId: string): Promise<void> {
  const row = await prisma.account.findFirst({
    where: {
      companyId,
      code: BANK_PARENT_CODE,
      deletedAt: null,
      accountKind: 'POSTING',
    },
    select: { id: true },
  });
  if (!row) return;
  await prisma.account.update({
    where: { id: row.id },
    data: { accountKind: 'HEADER' },
  });
  await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
}

export async function assertNotCashPostingParent(
  companyId: string,
  parentId: string,
  parent: { code: string; arabicName: string; accountKind?: string | null }
): Promise<void> {
  if (parent.accountKind === 'HEADER' && !isSystemCashPostingCode(parent.code)) {
    return;
  }
  if (isSystemCashPostingCode(parent.code)) {
    throw new AppError(409, cashPostingParentBlockedMessage(parent.arabicName));
  }

  const linkedSafe = await prisma.safe.findFirst({
    where: { companyId, glAccountId: parentId, isActive: true },
    select: { id: true, arabicName: true },
  });
  if (linkedSafe) {
    throw new AppError(409, cashPostingParentBlockedMessage(parent.arabicName || linkedSafe.arabicName));
  }
}

export async function ensureSafeForCashAccount(
  companyId: string,
  account: {
    id: string;
    code: string;
    arabicName: string;
    parentCode?: string | null;
    accountKind?: string | null;
  }
): Promise<void> {
  if (!isCashTreasuryAccount(account)) return;

  const existing = await prisma.safe.findFirst({
    where: { companyId, glAccountId: account.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.safe.update({
      where: { id: existing.id },
      data: { isActive: true, arabicName: account.arabicName },
    });
    return;
  }

  const currencyCode = await companyCurrency(companyId);
  const created = await prisma.safe.create({
    data: {
      companyId,
      code: await nextSafeCode(companyId),
      arabicName: account.arabicName,
      currencyCode,
      glAccountId: account.id,
      isActive: true,
    },
    select: { id: true },
  });
  await grantSafeToExistingRightHolders(companyId, created.id);
}

export async function createCashGlForNewSafe(
  companyId: string,
  arabicName: string,
  parentAccountId?: string | null
): Promise<string> {
  await ensureCashMainPosting(companyId);
  const cashMain = await prisma.account.findFirst({
    where: { companyId, code: SYSTEM_GL_CODES.cashMain, deletedAt: null },
    select: {
      id: true,
      parentId: true,
      accountType: true,
      accountSide: true,
      accountNature: true,
      statementType: true,
      parent: { select: { id: true, code: true, arabicName: true } },
    },
  });
  if (!cashMain?.parentId || !cashMain.parent) {
    throw new AppError(
      422,
      'حساب «النقدية وما في حكمها» غير موجود. الحل: راجع دليل الحسابات ثم أعد تعريف الخزينة.'
    );
  }

  let parentId = cashMain.parentId;
  let parentCode = cashMain.parent.code;
  if (parentAccountId && parentAccountId !== cashMain.parentId) {
    const chosen = await prisma.account.findFirst({
      where: { companyId, id: parentAccountId, deletedAt: null },
      select: { id: true, code: true, arabicName: true, accountKind: true },
    });
    if (!chosen) {
      throw new AppError(404, 'الحساب الأب غير موجود. الحل: اختَر حساب النقدية من الدليل.');
    }
    await assertNotCashPostingParent(companyId, chosen.id, chosen);
    parentId = chosen.id;
    parentCode = chosen.code;
  }

  const code = await nextSiblingAccountCode(companyId, parentId, parentCode);
  const clash = await prisma.account.findFirst({
    where: { companyId, code, deletedAt: null },
    select: { id: true },
  });
  if (clash) {
    throw new AppError(409, `رقم الحساب ${code} مستخدم بالفعل. الحل: أعد المحاولة ليأخذ الرقم التالي.`);
  }

  const safeAccountName = normalizeAccountName(arabicName);
  await assertUniqueAccountName(companyId, safeAccountName);

  const account = await prisma.account.create({
    data: {
      companyId,
      code,
      arabicName: safeAccountName,
      accountType: cashMain.accountType ?? 'asset',
      parentId,
      accountSide: cashMain.accountSide ?? 'مدين',
      accountNature: cashMain.accountNature ?? 'DEBIT',
      statementType: cashMain.statementType ?? 'BALANCE_SHEET',
      accountKind: 'POSTING',
      isActive: true,
    },
    select: { id: true },
  });
  await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
  return account.id;
}

/** Default main treasury: POSTING leaf under 111 (النقدية وما في حكمها). */
export async function ensureCashMainPosting(companyId: string): Promise<string | null> {
  const folder = await prisma.account.findFirst({
    where: { companyId, code: '111', deletedAt: null },
    select: {
      id: true,
      accountKind: true,
      accountType: true,
      accountSide: true,
      accountNature: true,
      statementType: true,
    },
  });
  if (!folder) return null;

  if (folder.accountKind !== 'HEADER') {
    await prisma.account.update({
      where: { id: folder.id },
      data: { accountKind: 'HEADER' },
    });
  }

  const live = await prisma.account.findFirst({
    where: { companyId, code: SYSTEM_GL_CODES.cashMain, deletedAt: null },
    select: { id: true, parentId: true, accountKind: true },
  });
  if (live) {
    const patch: { parentId?: string; accountKind?: 'POSTING' } = {};
    if (live.parentId !== folder.id) patch.parentId = folder.id;
    if (live.accountKind !== 'POSTING') patch.accountKind = 'POSTING';
    if (Object.keys(patch).length > 0) {
      await prisma.account.update({ where: { id: live.id }, data: patch });
    }
    return live.id;
  }

  const ghost = await prisma.account.findFirst({
    where: {
      companyId,
      OR: [
        { code: SYSTEM_GL_CODES.cashMain },
        { code: { startsWith: `${SYSTEM_GL_CODES.cashMain}__deleted__` } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, arabicName: true },
  });
  if (ghost) {
    await prisma.account.update({
      where: { id: ghost.id },
      data: {
        code: SYSTEM_GL_CODES.cashMain,
        arabicName: ghost.arabicName?.trim() || 'الخزينة الرئيسية',
        parentId: folder.id,
        accountKind: 'POSTING',
        isActive: true,
        deletedAt: null,
      },
    });
    await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
    return ghost.id;
  }

  const created = await prisma.account.create({
    data: {
      companyId,
      code: SYSTEM_GL_CODES.cashMain,
      arabicName: 'الخزينة الرئيسية',
      englishName: 'Main Cash Safe',
      accountType: folder.accountType ?? 'asset',
      parentId: folder.id,
      accountSide: folder.accountSide ?? 'مدين',
      accountNature: folder.accountNature ?? 'DEBIT',
      statementType: folder.statementType ?? 'BALANCE_SHEET',
      accountKind: 'POSTING',
      isActive: true,
    },
    select: { id: true },
  });
  await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
  return created.id;
}

export function isTreasuryMovementAccount(gl: {
  code?: string | null;
  accountKind?: string | null;
  parentCode?: string | null;
}): boolean {
  if (gl.accountKind === 'HEADER') return false;
  const code = String(gl.code ?? '').trim();
  const parentCode = String(gl.parentCode ?? '').trim();
  if (code === BANK_PARENT_CODE) return false;
  if (code === SYSTEM_GL_CODES.cashMain) return true;
  return parentCode === '111' || parentCode === SYSTEM_GL_CODES.cashMain;
}

/** Turns cash-leaf GL accounts into safes so they appear in every treasury picker. */
export async function ensureSafesFromChart(companyId: string): Promise<void> {
  await ensureCashMainPosting(companyId);
  const cashMain = await prisma.account.findFirst({
    where: { companyId, code: SYSTEM_GL_CODES.cashMain, deletedAt: null, isActive: true },
    select: { id: true, code: true, arabicName: true, parentId: true },
  });
  if (!cashMain) return;

  const or: Array<{ id?: string; parentId?: string; code?: { not: string } }> = [
    { id: cashMain.id },
    { parentId: cashMain.id },
  ];
  if (cashMain.parentId) {
    or.push({ parentId: cashMain.parentId, code: { not: BANK_PARENT_CODE } });
  }

  await prisma.safe.updateMany({
    where: {
      companyId,
      glAccountId: { not: null },
      glAccount: { is: { accountKind: 'HEADER' } },
    },
    data: { glAccountId: null },
  });

  const leaves = await prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      accountKind: 'POSTING',
      children: { none: { deletedAt: null } },
      OR: or,
    },
    select: { id: true, code: true, arabicName: true, parentId: true, accountKind: true },
  });

  const parentIds = [...new Set(leaves.map((row) => row.parentId).filter(Boolean))] as string[];
  const parents = parentIds.length
    ? await prisma.account.findMany({
        where: { companyId, id: { in: parentIds } },
        select: { id: true, code: true },
      })
    : [];
  const parentCodeById = new Map(parents.map((row) => [row.id, row.code]));

  for (const leaf of leaves) {
    await ensureSafeForCashAccount(companyId, {
      id: leaf.id,
      code: leaf.code,
      arabicName: leaf.arabicName,
      parentCode: leaf.parentId ? parentCodeById.get(leaf.parentId) ?? null : null,
      accountKind: leaf.accountKind,
    });
  }

  const unlinkedMain = await prisma.safe.findFirst({
    where: {
      companyId,
      glAccountId: null,
      OR: [{ code: 'SAFE-01' }, { arabicName: 'الخزينة الرئيسية' }],
    },
    select: { id: true },
  });
  if (unlinkedMain) {
    await prisma.safe.update({
      where: { id: unlinkedMain.id },
      data: { glAccountId: cashMain.id, isActive: true },
    });
  }
}

export async function nextBankAccountCode(companyId: string): Promise<string> {
  const rows = await prisma.bankAccount.findMany({
    where: { companyId },
    select: { code: true },
  });
  let max = 0;
  for (const row of rows) {
    const match = /^BANK-(\d+)$/i.exec(String(row.code ?? '').trim());
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `BANK-${String(max + 1).padStart(2, '0')}`;
}

async function ensureDefaultBankInstitution(companyId: string) {
  const existing = await prisma.bank.findFirst({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return prisma.bank.create({
    data: {
      companyId,
      code: 'BANK-DEFAULT',
      arabicName: 'البنك الافتراضي',
      englishName: 'Default Bank',
      isActive: true,
    },
  });
}

async function ensureBankAccountForGlAccount(
  companyId: string,
  account: { id: string; arabicName: string }
): Promise<void> {
  const existing = await prisma.bankAccount.findFirst({
    where: { companyId, glAccountId: account.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.bankAccount.update({
      where: { id: existing.id },
      data: { isActive: true, arabicName: account.arabicName },
    });
    return;
  }

  const orphan = await prisma.bankAccount.findFirst({
    where: {
      companyId,
      glAccountId: null,
      OR: [{ code: 'BANK-01' }, { arabicName: account.arabicName }],
    },
    select: { id: true },
  });
  if (orphan) {
    await prisma.bankAccount.update({
      where: { id: orphan.id },
      data: { glAccountId: account.id, isActive: true, arabicName: account.arabicName },
    });
    return;
  }

  const bank = await ensureDefaultBankInstitution(companyId);
  const currencyCode = await companyCurrency(companyId);
  const created = await prisma.bankAccount.create({
    data: {
      companyId,
      bankId: bank.id,
      code: await nextBankAccountCode(companyId),
      arabicName: account.arabicName,
      currencyCode,
      glAccountId: account.id,
      isActive: true,
    },
    select: { id: true },
  });
  await grantBankToExistingRightHolders(companyId, created.id);
}

/** Turns bank-leaf GL accounts into bank cards so they appear on إشعار خصم / إضافة. */
export async function ensureBankAccountsFromChart(companyId: string): Promise<void> {
  await ensureBankFolderIsHeader(companyId);
  const folder = await prisma.account.findFirst({
    where: { companyId, code: BANK_PARENT_CODE, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!folder) return;

  await prisma.bankAccount.updateMany({
    where: {
      companyId,
      glAccountId: { not: null },
      glAccount: { is: { accountKind: 'HEADER' } },
    },
    data: { glAccountId: null },
  });

  const leaves = await prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      accountKind: 'POSTING',
      children: { none: { deletedAt: null } },
      parentId: folder.id,
    },
    select: { id: true, arabicName: true },
  });

  for (const leaf of leaves) {
    await ensureBankAccountForGlAccount(companyId, leaf);
  }
}
