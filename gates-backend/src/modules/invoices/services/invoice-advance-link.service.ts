import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import type { LinkInvoiceAdvancesInput } from '../schemas/invoice-m5.schema';
import type { InvoiceKind } from '../types/invoice-posting.types';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';

const RECEIPT_KINDS = new Set<InvoiceKind>(['SALE', 'PURCHASE_RETURN']);

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
  const legacyApplied =
    tx.invoiceId && tx.paymentAllocations.length === 0 ? total : 0;
  return roundTo4(Math.max(total - allocated - legacyApplied, 0));
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

    const txs = await prisma.cashTransaction.findMany({
      where: {
        companyId,
        isPosted: true,
        isCancelled: false,
        transactionKind: customerId ? 'RECEIPT' : 'PAYMENT',
        invoiceId: null,
        ...(customerId ? { customerId } : { supplierId }),
      },
      select: {
        id: true,
        voucherNumber: true,
        date: true,
        amount: true,
        description: true,
        currencyCode: true,
        invoiceId: true,
        safe: { select: { id: true, arabicName: true } },
        bankAccount: { select: { id: true, arabicName: true } },
        paymentAllocations: { select: { allocatedAmount: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 80,
    });

    return txs
      .map((tx) => {
        const unapplied = unappliedOf(tx);
        return {
          id: tx.id,
          voucherNumber: tx.voucherNumber,
          date: tx.date,
          amount: Number(tx.amount),
          unapplied,
          description: tx.description,
          currencyCode: tx.currencyCode,
          sourceLabel: tx.safe?.arabicName || tx.bankAccount?.arabicName || '—',
        };
      })
      .filter((row) => row.unapplied > 0.0001);
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

    const advances = await this.listPartyAdvances(companyId, {
      customerId: invoice.customerId ?? undefined,
      supplierId: invoice.supplierId ?? undefined,
    });
    return {
      invoiceId: invoice.id,
      isPosted: invoice.isPosted,
      remainingAmount: outstandingOf(invoice),
      cashKind: expectedCashKind(invoice.invoiceKind),
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
    const wantedIds = [...new Set(input.allocations.map((row) => row.cashTransactionId))];
    const txs = await prisma.cashTransaction.findMany({
      where: { id: { in: wantedIds }, companyId },
      select: {
        id: true,
        transactionKind: true,
        customerId: true,
        supplierId: true,
        amount: true,
        invoiceId: true,
        isPosted: true,
        isCancelled: true,
        paymentAllocations: { select: { allocatedAmount: true } },
      },
    });
    if (txs.length !== wantedIds.length) {
      throw new AppError(422, 'عملية التحصيل أو السداد غير موجودة');
    }

    const byId = new Map(txs.map((tx) => [tx.id, tx]));
    let remaining = outstandingOf(invoice);
    if (remaining <= 0.0001) {
      throw new AppError(422, 'لا يوجد مبلغ متبقٍ على الفاتورة');
    }

    for (const row of input.allocations) {
      const tx = byId.get(row.cashTransactionId);
      if (!tx) throw new AppError(422, 'عملية التحصيل أو السداد غير موجودة');
      if (!tx.isPosted || tx.isCancelled) {
        throw new AppError(422, 'يجب أن تكون العملية مرحّلة وغير ملغاة');
      }
      if (tx.transactionKind !== cashKind) {
        throw new AppError(
          422,
          cashKind === 'RECEIPT'
            ? 'اختَر عملية تحصيل على نفس العميل'
            : 'اختَر عملية سداد على نفس المورد'
        );
      }
      if (invoice.customerId && tx.customerId !== invoice.customerId) {
        throw new AppError(422, 'التحصيل ليس على نفس العميل المختار بالفاتورة');
      }
      if (invoice.supplierId && tx.supplierId !== invoice.supplierId) {
        throw new AppError(422, 'السداد ليس على نفس المورد المختار بالفاتورة');
      }
      const unapplied = unappliedOf(tx);
      if (row.amount > unapplied + 0.0001) {
        throw new AppError(422, 'المبلغ أكبر من المتبقي على الدفعة المقدمة');
      }
      if (row.amount > remaining + 0.0001) {
        throw new AppError(422, 'المبلغ أكبر من المتبقي على الفاتورة');
      }
      remaining = roundTo4(remaining - row.amount);
    }

    const result = await prisma.$transaction(async (db) => {
      for (const row of input.allocations) {
        await createPaymentAllocationInTx(db, {
          companyId,
          cashTransactionId: row.cashTransactionId,
          invoiceId,
          allocatedAmount: row.amount,
        });
      }
      return refreshInvoiceBalanceInTx(db, companyId, invoiceId);
    });

    return result;
  }
}

export const invoiceAdvanceLinkService = new InvoiceAdvanceLinkService();
