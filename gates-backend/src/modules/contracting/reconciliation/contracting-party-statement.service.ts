import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { sumPartnerNetOriginal } from '../../accounting/services/party-ledger-balance.service';

const POSTED_JE = {
  isPosted: true,
  isCancelled: false,
  deletedAt: null,
} as const;

export type SubcontractorStatementLine = {
  date: Date;
  voucherNumber: string | null;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  sourceType: string | null;
};

export async function getCustomerPartyStatement(
  companyId: string,
  customerId: string,
  options?: { fromDate?: Date; toDate?: Date }
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true, arabicName: true },
  });
  if (!customer) throw new AppError(404, 'العميل غير موجود');

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      partnerId: customerId,
      partnerType: 'CUSTOMER',
      journalEntry: {
        companyId,
        ...POSTED_JE,
        ...(options?.fromDate || options?.toDate
          ? {
              date: {
                ...(options.fromDate ? { gte: options.fromDate } : {}),
                ...(options.toDate ? { lte: options.toDate } : {}),
              },
            }
          : {}),
      },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
    select: {
      debitBase: true,
      creditBase: true,
      description: true,
      journalEntry: {
        select: {
          date: true,
          voucherNumber: true,
          legacyGlNum: true,
          description: true,
          sourceType: true,
        },
      },
    },
  });

  let running = 0;
  const rows: SubcontractorStatementLine[] = lines.map((line) => {
    const debit = roundTo4(Number(line.debitBase));
    const credit = roundTo4(Number(line.creditBase));
    running = roundTo4(running + debit - credit);
    return {
      date: line.journalEntry.date,
      voucherNumber: line.journalEntry.voucherNumber ?? line.journalEntry.legacyGlNum,
      description: line.description ?? line.journalEntry.description,
      debit,
      credit,
      runningBalance: running,
      sourceType: line.journalEntry.sourceType,
    };
  });

  const ledgerNet = await sumPartnerNetOriginal(prisma, companyId, customerId, 'CUSTOMER');

  return {
    customerId,
    nameAr: customer.arabicName,
    lines: rows,
    receivableBalance: roundTo4(Number(ledgerNet)),
    note: 'لا يُنسَب سطر اليومية للمشروع إلا إذا كان المصدر يدعم ذلك صراحة',
  };
}

export async function getSubcontractorPartyStatement(
  companyId: string,
  subcontractorId: string,
  options?: { fromDate?: Date; toDate?: Date }
) {
  const sub = await prisma.subcontractor.findFirst({
    where: { id: subcontractorId, companyId },
    select: { id: true, nameAr: true },
  });
  if (!sub) throw new AppError(404, 'المقاول غير موجود');

  const lines = await prisma.journalEntryLine.findMany({
    where: {
      partnerId: subcontractorId,
      partnerType: 'SUBCONTRACTOR',
      journalEntry: {
        companyId,
        ...POSTED_JE,
        ...(options?.fromDate || options?.toDate
          ? {
              date: {
                ...(options.fromDate ? { gte: options.fromDate } : {}),
                ...(options.toDate ? { lte: options.toDate } : {}),
              },
            }
          : {}),
      },
    },
    orderBy: [{ journalEntry: { date: 'asc' } }, { lineOrder: 'asc' }],
    select: {
      debitBase: true,
      creditBase: true,
      description: true,
      journalEntry: {
        select: {
          date: true,
          voucherNumber: true,
          legacyGlNum: true,
          description: true,
          sourceType: true,
        },
      },
    },
  });

  let running = 0;
  const rows: SubcontractorStatementLine[] = lines.map((line) => {
    const debit = roundTo4(Number(line.debitBase));
    const credit = roundTo4(Number(line.creditBase));
    running = roundTo4(running + credit - debit);
    return {
      date: line.journalEntry.date,
      voucherNumber: line.journalEntry.voucherNumber ?? line.journalEntry.legacyGlNum,
      description: line.description ?? line.journalEntry.description,
      debit,
      credit,
      runningBalance: running,
      sourceType: line.journalEntry.sourceType,
    };
  });

  const ledgerOutstanding = await sumPartnerNetOriginal(
    prisma,
    companyId,
    subcontractorId,
    'SUBCONTRACTOR'
  );

  return {
    subcontractorId,
    nameAr: sub.nameAr,
    lines: rows,
    /** Payable outstanding: credits − debits on SUBCONTRACTOR partner lines (positive = owed to subcontractor). */
    payableOutstanding: roundTo4(-Number(ledgerOutstanding)),
    ledgerNetOriginal: ledgerOutstanding,
  };
}

export async function assertCashTransactionPartyMatchesClientInvoiceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientInvoiceId: string,
  cashTransactionId: string
) {
  const invoice = await tx.clientInvoice.findFirst({
    where: { id: clientInvoiceId, companyId },
    include: { clientContract: { select: { clientCustomerId: true } } },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المالك غير موجود');
  const cash = await tx.cashTransaction.findFirst({
    where: { id: cashTransactionId, companyId },
    select: { customerId: true },
  });
  if (!cash) throw new AppError(404, 'سند الخزينة غير موجود');
  if (cash.customerId && cash.customerId !== invoice.clientContract.clientCustomerId) {
    throw new AppError(422, 'سند القبض لا يخص نفس عميل المستخلص');
  }
}

export async function assertCashTransactionPartyMatchesSubcontractInvoiceInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  subcontractInvoiceId: string,
  cashTransactionId: string
) {
  const invoice = await tx.subcontractInvoice.findFirst({
    where: { id: subcontractInvoiceId, companyId },
    include: { subcontract: { select: { subcontractorId: true } } },
  });
  if (!invoice) throw new AppError(404, 'مستخلص المقاول غير موجود');
  const cash = await tx.cashTransaction.findFirst({
    where: { id: cashTransactionId, companyId },
    select: { subcontractorId: true, supplierId: true },
  });
  if (!cash) throw new AppError(404, 'سند الخزينة غير موجود');
  const expected = invoice.subcontract.subcontractorId;
  if (cash.subcontractorId && cash.subcontractorId !== expected) {
    throw new AppError(422, 'سند الصرف لا يخص نفس مقاول الباطن للمستخلص');
  }
  if (cash.supplierId) {
    throw new AppError(422, 'سند صرف المقاول يجب أن يُسجّل على مقاول الباطن وليس مورّد');
  }
}
