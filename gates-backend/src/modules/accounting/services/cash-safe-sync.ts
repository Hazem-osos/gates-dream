import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invalidateTenantCache, tenantCacheKeys } from '../../../shared/cache/tenant-metadata-cache';
import { SYSTEM_GL_CODES } from '../data/system-account-map';

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
}): boolean {
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
  parent: { code: string; arabicName: string }
): Promise<void> {
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
  account: { id: string; code: string; arabicName: string; parentCode?: string | null }
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

  const account = await prisma.account.create({
    data: {
      companyId,
      code,
      arabicName,
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

/** Turns cash-leaf GL accounts into safes so they appear in every treasury picker. */
export async function ensureSafesFromChart(companyId: string): Promise<void> {
  const cashMain = await prisma.account.findFirst({
    where: { companyId, code: SYSTEM_GL_CODES.cashMain, deletedAt: null },
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

  const leaves = await prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      children: { none: { deletedAt: null } },
      OR: or,
    },
    select: { id: true, code: true, arabicName: true, parentId: true },
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
