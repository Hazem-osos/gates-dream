import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import type { LinkInvoiceAdvancesInput } from '../schemas/invoice-m5.schema';
import type { InvoiceKind } from '../types/invoice-posting.types';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';
import { holdUniqueKey, UNIQUE_KINDS } from '../../../shared/database/company-unique-key';

const RECEIPT_KINDS = new Set<InvoiceKind>(['SALE', 'PURCHASE_RETURN']);

export type AdvanceSource = 'RECEIPT' | 'BANK' | 'CHEQUE' | 'PAPER';

function outstandingOf(invoice: {
  remainingAmount?: unknown;
  netAmount?: unknown;
  paidAmount?: unknown;
}) {
  const stored = Number(invoice.remainingAmount);
  if (Number.isFinite(stored) && stored > 0.0001) return roundTo4(stored);
  return roundTo4(Math.max(Number(invoice.netAmount ?? 0) - Number(invoice.paidAmount ?? 0), 0));
}

function expectedCashKind(invoiceKind: string | null): 'RECEIPT' | 'PAYMENT' {
  return RECEIPT_KINDS.has(invoiceKind as InvoiceKind) ? 'RECEIPT' : 'PAYMENT';
}

function unappliedOf(tx: {
  amount: unknown;
  invoiceId: string | null;
  paymentAllocations: { allocatedAmount: unknown }[];
}) {
  const total = Number(tx.amount);
  const allocated = tx.paymentAllocations.reduce(
    (sum, row) => sum + Number(row.allocatedAmount),
    0
  );
  const legacyApplied = tx.invoiceId && tx.paymentAllocations.length === 0 ? total : 0;
  return roundTo4(Math.max(total - allocated - legacyApplied, 0));
}

function cashSourceLabel(
  tx: {
    bankAccountId?: string | null;
    bankAccount?: { arabicName?: string | null } | null;
    safe?: { arabicName?: string | null } | null;
  },
  cashKind: 'RECEIPT' | 'PAYMENT'
): { source: AdvanceSource; sourceLabel: string } {
  const isBank = Boolean(tx.bankAccountId || tx.bankAccount?.arabicName);
  if (cashKind === 'PAYMENT') {
    if (isBank) {
      return {
        source: 'BANK',
        sourceLabel: tx.bankAccount?.arabicName
          ? `إشعار خصم بنك — ${tx.bankAccount.arabicName}`
          : 'إشعار خصم بنك',
      };
    }
    return {
      source: 'RECEIPT',
      sourceLabel: tx.safe?.arabicName ? `سند صرف — ${tx.safe.arabicName}` : 'سند صرف',
    };
  }
  if (isBank) {
    return {
      source: 'BANK',
      sourceLabel: tx.bankAccount?.arabicName
        ? `إشعار إضافة بنك — ${tx.bankAccount.arabicName}`
        : 'إشعار إضافة بنك',
    };
  }
  return {
    source: 'RECEIPT',
    sourceLabel: tx.safe?.arabicName ? `سند قبض — ${tx.safe.arabicName}` : 'سند قبض',
  };
}

function collectPartyAccountIds(party: {
  accountId?: string | null;
  mainAccountId?: string | null;
}) {
  return [party.mainAccountId, party.accountId].filter((id): id is string => Boolean(id));
}

export class InvoiceAdvanceLinkService {
  async listPartyAdvances(
    companyId: string,
    params: { customerId?: string; supplierId?: string }
  ) {
    const customerId = params.customerId?.trim() || undefined;
    const supplierId = params.supplierId?.trim() || undefined;
    if (!customerId && !supplierId) {
      throw new AppError(422, 'حدد العميل أو المورد');
    }

    const partyAccountIds: string[] = [];
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, companyId },
        select: { accountId: true, mainAccountId: true },
      });
      if (customer) partyAccountIds.push(...collectPartyAccountIds(customer));
    }
    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, companyId },
        select: { accountId: true, mainAccountId: true },
      });
      if (supplier) partyAccountIds.push(...collectPartyAccountIds(supplier));
    }

    const cashKind = customerId ? 'RECEIPT' : 'PAYMENT';
    const partyOr = [
      customerId ? { customerId } : { supplierId },
      ...(partyAccountIds.length
        ? [
            { offsetAccountId: { in: partyAccountIds } },
            { lines: { some: { accountId: { in: partyAccountIds } } } },
          ]
        : []),
    ];

    const txs = await prisma.cashTransaction.findMany({
      where: {
        companyId,
        isCancelled: false,
        transactionKind: cashKind,
        documentRole: { not: 'ORDER' },
        invoiceId: null,
        paymentAllocations: { none: {} },
        lines: { none: { invoiceId: { not: null } } },
        OR: partyOr,
      },
      select: {
        id: true,
        voucherNumber: true,
        date: true,
        amount: true,
        description: true,
        currencyCode: true,
        invoiceId: true,
        bankAccountId: true,
        isPosted: true,
        safe: { select: { id: true, arabicName: true } },
        bankAccount: { select: { id: true, arabicName: true } },
        paymentAllocations: { select: { allocatedAmount: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 120,
    });

    const cashRows = txs
      .map((tx) => {
        const unapplied = unappliedOf(tx);
        const source = cashSourceLabel(tx, cashKind);
        return {
          id: tx.id,
          source: source.source,
          voucherNumber: tx.voucherNumber,
          date: tx.date,
          amount: Number(tx.amount),
          unapplied,
          description: tx.description,
          currencyCode: tx.currencyCode,
          sourceLabel: tx.isPosted ? source.sourceLabel : `${source.sourceLabel} (مسودة)`,
          cashTransactionId: tx.id,
        };
      })
      .filter((row) => row.unapplied > 0.0001);

    const chequeRecords = customerId
      ? await prisma.cheque.findMany({
          where: {
            companyId,
            customerId,
            direction: 'INWARD',
            status: { in: ['UNDER_HAND', 'SENT_TO_BANK', 'COLLECTED'] },
          },
          select: {
            id: true,
            chequeNumber: true,
            dueDate: true,
            amount: true,
            bankName: true,
            description: true,
            currencyCode: true,
            invoiceId: true,
          },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
          take: 120,
        })
      : await prisma.cheque.findMany({
          where: {
            companyId,
            supplierId,
            direction: 'OUTWARD',
            status: { in: ['UNDER_HAND', 'SENT_TO_BANK', 'COLLECTED'] },
          },
          select: {
            id: true,
            chequeNumber: true,
            dueDate: true,
            amount: true,
            bankName: true,
            description: true,
            currencyCode: true,
            invoiceId: true,
          },
          orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
          take: 120,
        });
    const linkedChequeNumbers = new Set(
      chequeRecords
        .filter((row) => row.invoiceId)
        .map((row) => row.chequeNumber)
        .filter((value): value is string => Boolean(value))
    );
    const chequeRows = chequeRecords
      .filter((row) => !row.invoiceId)
      .map((row) => ({
        id: row.id,
        source: 'CHEQUE' as const,
        voucherNumber: row.chequeNumber,
        date: row.dueDate ?? new Date(),
        amount: Number(row.amount),
        unapplied: Number(row.amount),
        description: row.description,
        currencyCode: row.currencyCode,
        sourceLabel: customerId
          ? row.bankName
            ? `ورقة مقبوضات — ${row.bankName}`
            : 'ورقة مقبوضات'
          : row.bankName
            ? `ورقة مدفوعات — ${row.bankName}`
            : 'ورقة مدفوعات',
        chequeId: row.id,
      }));

    const paperRows = customerId
      ? (
          await prisma.securitiesReceipt.findMany({
            where: {
              companyId,
              customerId,
              isCancelled: false,
            },
            select: {
              id: true,
              receiptNumber: true,
              serial: true,
              securityNumber: true,
              date: true,
              amount: true,
              description: true,
              currencyCode: true,
              issuerBank: true,
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 80,
          })
        )
          .filter(
            (row) =>
              !row.securityNumber ||
              (!chequeRows.some((cheque) => cheque.voucherNumber === row.securityNumber) &&
                !linkedChequeNumbers.has(row.securityNumber))
          )
          .map((row) => ({
            id: row.id,
            source: 'PAPER' as const,
            voucherNumber: row.receiptNumber || row.serial || row.securityNumber,
            date: row.date,
            amount: Number(row.amount),
            unapplied: Number(row.amount),
            description: row.description,
            currencyCode: row.currencyCode,
            sourceLabel: row.issuerBank
              ? `ورقة مقبوضات — ${row.issuerBank}`
              : 'ورقة مقبوضات',
            securitiesReceiptId: row.id,
          }))
      : (
          await prisma.securitiesPayment.findMany({
            where: {
              companyId,
              supplierId,
              isCancelled: false,
            },
            select: {
              id: true,
              paymentNumber: true,
              serial: true,
              securityNumber: true,
              date: true,
              amount: true,
              description: true,
              currencyCode: true,
              payeeBank: true,
            },
            orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
            take: 80,
          })
        )
          .filter(
            (row) =>
              !row.securityNumber ||
              (!chequeRows.some((cheque) => cheque.voucherNumber === row.securityNumber) &&
                !linkedChequeNumbers.has(row.securityNumber))
          )
          .map((row) => ({
            id: row.id,
            source: 'PAPER' as const,
            voucherNumber: row.paymentNumber || row.serial || row.securityNumber,
            date: row.date,
            amount: Number(row.amount),
            unapplied: Number(row.amount),
            description: row.description,
            currencyCode: row.currencyCode,
            sourceLabel: row.payeeBank ? `ورقة مدفوعات — ${row.payeeBank}` : 'ورقة مدفوعات',
            securitiesReceiptId: row.id,
          }));

    return [...cashRows, ...chequeRows, ...paperRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async listAvailableForInvoice(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        customerId: true,
        supplierId: true,
        invoiceKind: true,
        remainingAmount: true,
        netAmount: true,
        paidAmount: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');
    if (invoice.isCancelled) throw new AppError(422, 'لا يمكن ربط دفعة بفاتورة ملغاة');

    const cashKind = expectedCashKind(invoice.invoiceKind);
    const advances = await this.listPartyAdvances(companyId, {
      customerId: cashKind === 'RECEIPT' ? invoice.customerId ?? undefined : undefined,
      supplierId: cashKind === 'PAYMENT' ? invoice.supplierId ?? undefined : undefined,
    });
    return {
      invoiceId: invoice.id,
      isPosted: invoice.isPosted,
      remainingAmount: outstandingOf(invoice),
      cashKind,
      advances,
    };
  }

  async applyToInvoice(
    companyId: string,
    invoiceId: string,
    input: LinkInvoiceAdvancesInput
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        customerId: true,
        supplierId: true,
        invoiceKind: true,
        remainingAmount: true,
        netAmount: true,
        paidAmount: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');
    if (invoice.isCancelled) throw new AppError(422, 'لا يمكن ربط دفعة بفاتورة ملغاة');

    const cashKind = expectedCashKind(invoice.invoiceKind);
    let remaining = outstandingOf(invoice);
    if (remaining <= 0.0001) {
      throw new AppError(422, 'لا يوجد مبلغ متبقٍ على الفاتورة');
    }

    const result = await prisma.$transaction(async (db) => {
      for (const row of input.allocations) {
        const amount = roundTo4(row.amount);
        if (amount > remaining + 0.0001) {
          throw new AppError(422, 'المبلغ أكبر من المتبقي على الفاتورة');
        }

        if (row.cashTransactionId) {
          const tx = await db.cashTransaction.findFirst({
            where: { id: row.cashTransactionId, companyId },
            select: {
              id: true,
              transactionKind: true,
              customerId: true,
              supplierId: true,
              amount: true,
              invoiceId: true,
              isCancelled: true,
              offsetAccountId: true,
              paymentAllocations: { select: { allocatedAmount: true } },
              lines: { select: { accountId: true } },
            },
          });
          if (!tx || tx.isCancelled) {
            throw new AppError(422, 'عملية التحصيل أو السداد غير موجودة أو ملغاة');
          }
          if (tx.transactionKind !== cashKind) {
            throw new AppError(
              422,
              cashKind === 'RECEIPT'
                ? 'اختَر سند قبض أو إشعار إضافة على نفس العميل'
                : 'اختَر سند صرف أو إشعار خصم على نفس المورد'
            );
          }
          if (tx.invoiceId && tx.invoiceId !== invoiceId) {
            throw new AppError(422, 'هذا السند مربوط بفاتورة أخرى');
          }
          const unapplied = unappliedOf(tx);
          if (amount > unapplied + 0.0001) {
            throw new AppError(422, 'المبلغ أكبر من المتبقي على الدفعة المقدمة');
          }
          await createPaymentAllocationInTx(db, {
            companyId,
            cashTransactionId: tx.id,
            invoiceId,
            allocatedAmount: amount,
          });
          if (!tx.invoiceId) {
            await db.cashTransaction.update({
              where: { id: tx.id },
              data: { invoiceId },
            });
          }
        } else if (row.chequeId) {
          const cheque = await db.cheque.findFirst({
            where: { id: row.chequeId, companyId },
          });
          if (!cheque) throw new AppError(422, 'ورقة القبض/الدفع غير موجودة');
          if (cheque.invoiceId && cheque.invoiceId !== invoiceId) {
            throw new AppError(422, 'هذه الورقة مربوطة بفاتورة أخرى');
          }
          if (invoice.customerId && cheque.customerId && cheque.customerId !== invoice.customerId) {
            throw new AppError(422, 'الورقة ليست على نفس العميل');
          }
          if (invoice.supplierId && cheque.supplierId && cheque.supplierId !== invoice.supplierId) {
            throw new AppError(422, 'الورقة ليست على نفس المورد');
          }
          const face = Number(cheque.amount);
          if (Math.abs(amount - face) > 0.05) {
            throw new AppError(
              422,
              'ربط الشيك أو الورقة يكون بكامل قيمتها. يمكن تجزئة سندات الخزينة فقط.'
            );
          }
          await db.cheque.update({
            where: { id: cheque.id },
            data: { invoiceId },
          });
        } else if (row.securitiesReceiptId) {
          if (cashKind === 'RECEIPT') {
            const paper = await db.securitiesReceipt.findFirst({
              where: { id: row.securitiesReceiptId, companyId, isCancelled: false },
            });
            if (!paper) throw new AppError(422, 'ورقة المقبوضات غير موجودة');
            if (invoice.customerId && paper.customerId && paper.customerId !== invoice.customerId) {
              throw new AppError(422, 'الورقة ليست على نفس العميل');
            }
            const chequeNumber = (
              paper.securityNumber ||
              paper.receiptNumber ||
              paper.serial ||
              paper.id.slice(0, 8)
            ).trim();
            const existingCheque = await db.cheque.findFirst({
              where: { companyId, chequeNumber },
            });
            if (existingCheque && existingCheque.direction !== 'INWARD') {
              throw new AppError(409, `رقم الشيك ${chequeNumber} مستخدم من قبل`);
            }
            if (existingCheque?.invoiceId && existingCheque.invoiceId !== invoiceId) {
              throw new AppError(422, 'هذه الورقة مربوطة بفاتورة أخرى');
            }
            if (existingCheque) {
              await db.cheque.update({
                where: { id: existingCheque.id },
                data: { invoiceId },
              });
            } else {
              await holdUniqueKey(db, companyId, UNIQUE_KINDS.chequeNumber, chequeNumber);
              await db.cheque.create({
                data: {
                  companyId,
                  branchId: paper.branchId,
                  direction: 'INWARD',
                  status: 'UNDER_HAND',
                  chequeNumber,
                  bankName: paper.issuerBank,
                  dueDate: paper.dueDate,
                  amount: paper.amount,
                  currencyCode: paper.currencyCode,
                  customerId: paper.customerId ?? invoice.customerId,
                  description: paper.description,
                  invoiceId,
                },
              });
            }
          } else {
            const paper = await db.securitiesPayment.findFirst({
              where: { id: row.securitiesReceiptId, companyId, isCancelled: false },
            });
            if (!paper) throw new AppError(422, 'ورقة المدفوعات غير موجودة');
            const chequeNumber = (
              paper.securityNumber ||
              paper.paymentNumber ||
              paper.serial ||
              paper.id.slice(0, 8)
            ).trim();
            const existingCheque = await db.cheque.findFirst({
              where: { companyId, chequeNumber },
            });
            if (existingCheque && existingCheque.direction !== 'OUTWARD') {
              throw new AppError(409, `رقم الشيك ${chequeNumber} مستخدم من قبل`);
            }
            if (existingCheque?.invoiceId && existingCheque.invoiceId !== invoiceId) {
              throw new AppError(422, 'هذه الورقة مربوطة بفاتورة أخرى');
            }
            if (existingCheque) {
              await db.cheque.update({
                where: { id: existingCheque.id },
                data: { invoiceId },
              });
            } else {
              await holdUniqueKey(db, companyId, UNIQUE_KINDS.chequeNumber, chequeNumber);
              await db.cheque.create({
                data: {
                  companyId,
                  branchId: paper.branchId,
                  direction: 'OUTWARD',
                  status: 'UNDER_HAND',
                  chequeNumber,
                  bankName: paper.payeeBank,
                  dueDate: paper.dueDate,
                  amount: paper.amount,
                  currencyCode: paper.currencyCode,
                  supplierId: paper.supplierId ?? invoice.supplierId,
                  description: paper.description,
                  invoiceId,
                },
              });
            }
          }
        } else {
          throw new AppError(422, 'حدد السند أو الورقة المراد ربطها');
        }

        remaining = roundTo4(remaining - amount);
      }

      return refreshInvoiceBalanceInTx(db, companyId, invoiceId);
    });

    return result;
  }
}

export const invoiceAdvanceLinkService = new InvoiceAdvanceLinkService();
