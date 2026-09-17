import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export function normalizeAccountName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function duplicateAccountNameMessage(name: string, clashCode: string): string {
  return `اسم الحساب «${name}» مستخدم بالفعل على الحساب ${clashCode}. الحل: غيّر الاسم أو افتح الحساب الموجود.`;
}

export function partyAccountTakenMessage(
  side: 'CUSTOMER' | 'SUPPLIER',
  partyName: string,
  partyCode?: string | null
): string {
  const who = side === 'CUSTOMER' ? 'العميل' : 'المورد';
  const code = partyCode?.trim();
  return `الحساب مربوط ب${who} «${partyName}»${code ? ` (${code})` : ''}. لا يمكن ربط طرف آخر بنفس الحساب.`;
}

/** Company-wide: the same Arabic name cannot appear twice anywhere in the tree. */
export async function assertUniqueAccountName(
  companyId: string,
  arabicName: string,
  options?: { exceptAccountId?: string }
): Promise<void> {
  const name = normalizeAccountName(arabicName);
  if (!name) return;

  const rows = await prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(options?.exceptAccountId ? { id: { not: options.exceptAccountId } } : {}),
    },
    select: { id: true, code: true, arabicName: true },
  });
  const needle = name.toLocaleLowerCase('ar');
  const clash = rows.find(
    (row) => normalizeAccountName(row.arabicName).toLocaleLowerCase('ar') === needle
  );

  if (clash) {
    throw new AppError(409, duplicateAccountNameMessage(name, clash.code));
  }
}
