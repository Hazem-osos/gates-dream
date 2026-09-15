import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export type DocumentNavEntity =
  | 'invoice'
  | 'journal-entry'
  | 'cash-transaction'
  | 'issue'
  | 'transfer';

type AdjacentInput = {
  entity: DocumentNavEntity;
  currentId: string;
  invoiceKind?: string;
  transactionKind?: string;
  fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
  entryType?: string;
};

export type AdjacentResult = {
  previousId: string | null;
  nextId: string | null;
  totalCount: number;
  currentIndex: number | null;
};

type DateDelegate = {
  findCurrent: () => Promise<{ id: string; date: Date } | null>;
  countAll: () => Promise<number>;
  findOlder: (current: { id: string; date: Date }) => Promise<{ id: string } | null>;
  findNewer: (current: { id: string; date: Date }) => Promise<{ id: string } | null>;
  countNewer: (current: { id: string; date: Date }) => Promise<number>;
};

async function resolveAdjacent(delegate: DateDelegate): Promise<AdjacentResult> {
  const current = await delegate.findCurrent();
  const totalCount = await delegate.countAll();
  if (!current) {
    return { previousId: null, nextId: null, totalCount, currentIndex: null };
  }
  const [older, newer, newerCount] = await Promise.all([
    delegate.findOlder(current),
    delegate.findNewer(current),
    delegate.countNewer(current),
  ]);
  return {
    previousId: older?.id ?? null,
    nextId: newer?.id ?? null,
    totalCount,
    currentIndex: newerCount + 1,
  };
}

function olderWhere(current: { id: string; date: Date }) {
  return {
    OR: [{ date: { lt: current.date } }, { date: current.date, id: { lt: current.id } }],
  };
}

function newerWhere(current: { id: string; date: Date }) {
  return {
    OR: [{ date: { gt: current.date } }, { date: current.date, id: { gt: current.id } }],
  };
}

export async function getAdjacentDocument(
  companyId: string,
  input: AdjacentInput
): Promise<AdjacentResult> {
  const { entity, currentId } = input;

  if (entity === 'invoice') {
    const where = {
      companyId,
      ...(input.invoiceKind ? { invoiceKind: input.invoiceKind } : {}),
    };
    return resolveAdjacent({
      findCurrent: () =>
        prisma.invoice.findFirst({ where: { id: currentId, ...where }, select: { id: true, date: true } }),
      countAll: () => prisma.invoice.count({ where }),
      findOlder: (current) =>
        prisma.invoice.findFirst({
          where: { ...where, ...olderWhere(current) },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true },
        }),
      findNewer: (current) =>
        prisma.invoice.findFirst({
          where: { ...where, ...newerWhere(current) },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          select: { id: true },
        }),
      countNewer: (current) => prisma.invoice.count({ where: { ...where, ...newerWhere(current) } }),
    });
  }

  if (entity === 'journal-entry') {
    const where = {
      companyId,
      ...(input.entryType ? { entryType: input.entryType } : { NOT: { entryType: 'OPENING_BALANCE' } }),
    };
    return resolveAdjacent({
      findCurrent: () =>
        prisma.journalEntry.findFirst({
          where: { id: currentId, ...where },
          select: { id: true, date: true },
        }),
      countAll: () => prisma.journalEntry.count({ where }),
      findOlder: (current) =>
        prisma.journalEntry.findFirst({
          where: { ...where, ...olderWhere(current) },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true },
        }),
      findNewer: (current) =>
        prisma.journalEntry.findFirst({
          where: { ...where, ...newerWhere(current) },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          select: { id: true },
        }),
      countNewer: (current) => prisma.journalEntry.count({ where: { ...where, ...newerWhere(current) } }),
    });
  }

  if (entity === 'cash-transaction') {
    const where = {
      companyId,
      documentRole: 'VOUCHER',
      ...(input.transactionKind ? { transactionKind: input.transactionKind } : {}),
      ...(input.fundType === 'BANK_ACCOUNT'
        ? { bankAccountId: { not: null } }
        : input.fundType === 'CASHBOX'
          ? { safeId: { not: null } }
          : {}),
    };
    return resolveAdjacent({
      findCurrent: () =>
        prisma.cashTransaction.findFirst({
          where: { id: currentId, ...where },
          select: { id: true, date: true },
        }),
      countAll: () => prisma.cashTransaction.count({ where }),
      findOlder: (current) =>
        prisma.cashTransaction.findFirst({
          where: { ...where, ...olderWhere(current) },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true },
        }),
      findNewer: (current) =>
        prisma.cashTransaction.findFirst({
          where: { ...where, ...newerWhere(current) },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          select: { id: true },
        }),
      countNewer: (current) =>
        prisma.cashTransaction.count({ where: { ...where, ...newerWhere(current) } }),
    });
  }

  if (entity === 'issue') {
    return resolveAdjacent({
      findCurrent: () =>
        prisma.issue.findFirst({
          where: { id: currentId, companyId },
          select: { id: true, date: true },
        }),
      countAll: () => prisma.issue.count({ where: { companyId } }),
      findOlder: (current) =>
        prisma.issue.findFirst({
          where: { companyId, ...olderWhere(current) },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true },
        }),
      findNewer: (current) =>
        prisma.issue.findFirst({
          where: { companyId, ...newerWhere(current) },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          select: { id: true },
        }),
      countNewer: (current) => prisma.issue.count({ where: { companyId, ...newerWhere(current) } }),
    });
  }

  if (entity === 'transfer') {
    return resolveAdjacent({
      findCurrent: () =>
        prisma.transfer.findFirst({
          where: { id: currentId, companyId },
          select: { id: true, date: true },
        }),
      countAll: () => prisma.transfer.count({ where: { companyId } }),
      findOlder: (current) =>
        prisma.transfer.findFirst({
          where: { companyId, ...olderWhere(current) },
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          select: { id: true },
        }),
      findNewer: (current) =>
        prisma.transfer.findFirst({
          where: { companyId, ...newerWhere(current) },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
          select: { id: true },
        }),
      countNewer: (current) => prisma.transfer.count({ where: { companyId, ...newerWhere(current) } }),
    });
  }

  throw new AppError(400, 'Unknown document entity');
}

export const documentNavigationService = { getAdjacentDocument };
