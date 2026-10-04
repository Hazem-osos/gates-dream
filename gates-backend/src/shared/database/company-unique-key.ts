import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error-handler';

export const UNIQUE_KINDS = {
  itemName: 'ITEM_NAME',
  chequeNumber: 'CHEQUE_NUMBER',
} as const;

export type UniqueKind = (typeof UNIQUE_KINDS)[keyof typeof UNIQUE_KINDS];

type KeyClient = Prisma.TransactionClient;

export function normalizeUniqueValue(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
}

export function duplicateUniqueKeyMessage(kind: UniqueKind, value: string): string {
  if (kind === UNIQUE_KINDS.itemName) return 'اسم الصنف مستخدم لصنف آخر';
  return `رقم الشيك ${value} مستخدم من قبل`;
}

/** First repeated non-empty value in one save, such as a cheque batch. */
export function repeatedUniqueValue(values: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  for (const raw of values) {
    const value = normalizeUniqueValue(raw);
    if (!value) continue;
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Reserve a company-scoped key. A second reservation of the same key fails,
 * including when the two saves run at the same time.
 */
export async function acquireUniqueKey(
  tx: KeyClient,
  companyId: string,
  kind: UniqueKind,
  raw: string | null | undefined
): Promise<string | null> {
  const value = normalizeUniqueValue(raw);
  if (!value) return null;
  try {
    await tx.companyUniqueKey.create({
      data: { companyId, kind, value },
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppError(409, duplicateUniqueKeyMessage(kind, value));
    }
    throw error;
  }
  return value;
}

/** Keep a key that already belongs to this document, without treating it as a new duplicate. */
export async function holdUniqueKey(
  tx: KeyClient,
  companyId: string,
  kind: UniqueKind,
  raw: string | null | undefined
): Promise<string | null> {
  const value = normalizeUniqueValue(raw);
  if (!value) return null;
  await tx.companyUniqueKey.upsert({
    where: { companyId_kind_value: { companyId, kind, value } },
    create: { companyId, kind, value },
    update: {},
  });
  return value;
}

async function keyStillUsed(
  tx: KeyClient,
  companyId: string,
  kind: UniqueKind,
  value: string
): Promise<boolean> {
  if (kind === UNIQUE_KINDS.itemName) {
    const item = await tx.item.findFirst({
      where: { companyId, arabicName: value },
      select: { id: true },
    });
    return Boolean(item);
  }

  const [receipt, payment, cheque, postDated] = await Promise.all([
    tx.securitiesReceipt.findFirst({
      where: { companyId, securityNumber: value },
      select: { id: true },
    }),
    tx.securitiesPayment.findFirst({
      where: { companyId, securityNumber: value },
      select: { id: true },
    }),
    tx.cheque.findFirst({
      where: { companyId, chequeNumber: value },
      select: { id: true },
    }),
    tx.postDatedCheque.findFirst({
      where: { companyId, chequeNumber: value },
      select: { id: true },
    }),
  ]);
  return Boolean(receipt || payment || cheque || postDated);
}

/** Free a key after the row that used it was renamed or removed. */
export async function releaseUniqueKeyIfUnused(
  tx: KeyClient,
  companyId: string,
  kind: UniqueKind,
  raw: string | null | undefined
): Promise<void> {
  const value = normalizeUniqueValue(raw);
  if (!value) return;
  if (await keyStillUsed(tx, companyId, kind, value)) return;
  await tx.companyUniqueKey.deleteMany({
    where: { companyId, kind, value },
  });
}
