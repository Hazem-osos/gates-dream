import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, type InvoiceInstallmentStatus } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { cashTransactionService } from '../../treasury/services/cash-transaction.service';
import { treasuryPostingService } from '../../treasury/services/treasury-posting.service';
import type { TreasuryPostingContext } from '../../treasury/types/treasury.types';
import {
  createPaymentAllocationInTx,
  refreshInvoiceBalanceInTx,
} from './invoice-balance.service';
import { settlementKind } from './invoice-settlement.service';
import type {
  CollectInvoiceInstallmentInput,
  InvoiceInstallmentInput,
  InvoiceInstallmentTrackerQuery,
} from '../schemas/invoice-installment.schema';

const AMOUNT_TOLERANCE = 0.0001;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toHijriMedium(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { dateStyle: 'medium' }).format(date);
  } catch {
    return '';
  }
}

export function resolveInstallmentStatus(row: {
  amount: Decimal | number;
  paidAmount: Decimal | number;
  isPaid: boolean;
  dueDate: Date;
  status?: InvoiceInstallmentStatus;
}): InvoiceInstallmentStatus {
  const amount = Number(row.amount);
  const paid = Number(row.paidAmount);
  if (row.isPaid || paid >= amount - AMOUNT_TOLERANCE) return 'PAID';
  if (row.dueDate < startOfToday()) return 'OVERDUE';
  if (paid > AMOUNT_TOLERANCE) return 'PARTIALLY_PAID';
  return 'PENDING';
}

function arabicPaymentLabel(status: InvoiceInstallmentStatus): string {
  switch (status) {
    case 'PAID':
      return 'مسددة';
    case 'PARTIALLY_PAID':
      return 'مسددة جزئياً';
    case 'OVERDUE':
      return 'متأخرة';
    default:
      return 'غير مسددة';
  }
}

function mapInstallmentRow<T extends {
  amount: Decimal | number;
  paidAmount: Decimal | number;
  isPaid: boolean;
  dueDate: Date;
  status: InvoiceInstallmentStatus;
}>(row: T) {
  const status = resolveInstallmentStatus(row);
  return {
    ...row,
    amount: Number(row.amount),
    paidAmount: Number(row.paidAmount),
    remainingAmount: roundTo4(Math.max(Number(row.amount) - Number(row.paidAmount), 0)),
    status,
    paymentStatusLabel: arabicPaymentLabel(status),
  };
}

export async function replaceInvoiceInstallmentsInTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  rows?: InvoiceInstallmentInput[]
) {
  if (rows === undefined) return;

  const paid = await tx.invoiceInstallment.findMany({
    where: {
      invoiceId,
      OR: [{ isPaid: true }, { paidAmount: { gt: 0 } }],
    },
    select: { installmentNumber: true },
  });
  const paidNumbers = new Set(paid.map((r) => r.installmentNumber));

  await tx.invoiceInstallment.deleteMany({
    where: { invoiceId, isPaid: false, paidAmount: 0 },
  });

  const seen = new Set<number>();
  const toCreate = rows.map((row, index) => {
    const installmentNumber = row.installmentNumber ?? index + 1;
    if (seen.has(installmentNumber)) {
      throw new AppError(422, `رقم الدفعة ${installmentNumber} مكرر`);
    }
    seen.add(installmentNumber);
    return {
      invoiceId,
      installmentNumber,
      dueDate: row.dueDate,
      hijriDueDate: row.hijriDueDate?.trim() || toHijriMedium(row.dueDate) || null,
      amount: new Decimal(roundTo4(row.amount)),
      notes: row.notes?.trim() || null,
    };
  });

  const fresh = toCreate.filter((row) => !paidNumbers.has(row.installmentNumber));
  if (!fresh.length) return;

  await tx.invoiceInstallment.createMany({ data: fresh });
}

export class InvoiceInstallmentService {
  async listByInvoice(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');

    const rows = await prisma.invoiceInstallment.findMany({
      where: { invoiceId },
      orderBy: { installmentNumber: 'asc' },
    });
    return rows.map(mapInstallmentRow);
  }

  async listTracker(companyId: string, query: InvoiceInstallmentTrackerQuery) {
    const statusFilter = query.status;
    const dueFrom = query.fromDate ? new Date(query.fromDate) : undefined;
    const dueTo = query.toDate ? new Date(query.toDate) : undefined;

    const rows = await prisma.invoiceInstallment.findMany({
      where: {
        invoice: {
          companyId,
          id: query.invoiceId,
          customerId: query.customerId,
          invoiceKind: query.invoiceKind,
          isCancelled: false,
        },
        dueDate: {
          gte: dueFrom && !Number.isNaN(dueFrom.getTime()) ? dueFrom : undefined,
          lte: dueTo && !Number.isNaN(dueTo.getTime()) ? dueTo : undefined,
        },
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            invoiceKind: true,
            customerId: true,
            customer: { select: { id: true, arabicName: true, code: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      take: 500,
    });

    return rows
      .map((row) => {
        const mapped = mapInstallmentRow(row);
        return {
          id: mapped.id,
          invoiceId: mapped.invoiceId,
          invoiceNumber: row.invoice.invoiceNumber,
          invoiceKind: row.invoice.invoiceKind,
          customerId: row.invoice.customerId,
          customerName: row.invoice.customer?.arabicName ?? null,
          customerCode: row.invoice.customer?.code ?? null,
          installmentNumber: mapped.installmentNumber,
          dueDate: mapped.dueDate,
          hijriDueDate: mapped.hijriDueDate,
          amount: mapped.amount,
          paidAmount: mapped.paidAmount,
          remainingAmount: mapped.remainingAmount,
          isPaid: mapped.isPaid,
          status: mapped.status,
          paymentStatusLabel: mapped.paymentStatusLabel,
          paymentDate: mapped.paymentDate,
          notes: mapped.notes,
        };
      })
      .filter((row) => {
        if (!statusFilter) return true;
        if (statusFilter === 'UNPAID') return row.status !== 'PAID';
        return row.status === statusFilter;
      });
  }

  async collect(
    ctx: TreasuryPostingContext,
    invoiceId: string,
    installmentId: string,
    input: CollectInvoiceInstallmentInput
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: ctx.companyId },
      select: {
        id: true,
        invoiceKind: true,
        invoiceNumber: true,
        currencyCode: true,
        customerId: true,
        supplierId: true,
        netAmount: true,
        paidAmount: true,
        isPosted: true,
        isCancelled: true,
      },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');
    if (invoice.isCancelled) throw new AppError(422, 'Cancelled invoices cannot be settled');
    if (!invoice.isPosted) {
      throw new AppError(422, 'رحّل الفاتورة قبل تحصيل القسط');
    }

    const installment = await prisma.invoiceInstallment.findFirst({
      where: { id: installmentId, invoiceId },
    });
    if (!installment) throw new AppError(404, 'القسط غير موجود على هذه الفاتورة');

    const installmentRemaining = roundTo4(Number(installment.amount) - Number(installment.paidAmount));
    if (installmentRemaining <= AMOUNT_TOLERANCE) {
      throw new AppError(422, 'هذا القسط مسدد بالكامل');
    }

    const invoiceOutstanding = roundTo4(Number(invoice.netAmount) - Number(invoice.paidAmount));
    if (invoiceOutstanding <= AMOUNT_TOLERANCE) {
      throw new AppError(422, 'الفاتورة مسددة بالكامل');
    }

    const collectAmount = roundTo4(input.amount ?? installmentRemaining);
    if (collectAmount <= 0) throw new AppError(422, 'أدخل مبلغ تحصيل أكبر من صفر');
    if (collectAmount > installmentRemaining + AMOUNT_TOLERANCE) {
      throw new AppError(422, `مبلغ التحصيل أكبر من المتبقي على القسط (${installmentRemaining.toFixed(2)})`);
    }
    if (collectAmount > invoiceOutstanding + AMOUNT_TOLERANCE) {
      throw new AppError(422, `مبلغ التحصيل أكبر من المتبقي على الفاتورة (${invoiceOutstanding.toFixed(2)})`);
    }

    const kind = settlementKind(invoice.invoiceKind);
    const paidAfter = roundTo4(Number(installment.paidAmount) + collectAmount);
    const fullyPaid = paidAfter >= Number(installment.amount) - AMOUNT_TOLERANCE;
    const nextStatus: InvoiceInstallmentStatus = fullyPaid
      ? 'PAID'
      : installment.dueDate < startOfToday()
        ? 'OVERDUE'
        : 'PARTIALLY_PAID';

    const { cashTx, totals, updatedInstallment } = await prisma.$transaction(async (tx) => {
      const cashTx = await cashTransactionService.createInTx(
        tx,
        ctx.companyId,
        ctx.branchId ?? undefined,
        ctx.fiscalYearId,
        {
          transactionKind: kind,
          voucherNumber: input.voucherNumber,
          date: input.date ?? new Date(),
          description:
            input.description ??
            `تحصيل قسط ${installment.installmentNumber} — فاتورة ${invoice.invoiceNumber ?? invoice.id.slice(0, 8)}`,
          amount: collectAmount,
          currencyCode: invoice.currencyCode,
          customerId: invoice.customerId ?? undefined,
          supplierId: invoice.supplierId ?? undefined,
          offsetAccountId: input.offsetAccountId,
          safeId: input.safeId,
          bankAccountId: input.bankAccountId,
          exchangeRate: input.exchangeRate,
        },
        { invoiceId: invoice.id, invoiceInstallmentId: installment.id }
      );

      await treasuryPostingService.postCashTransactionInTx(tx, ctx, cashTx.id);

      await createPaymentAllocationInTx(tx, {
        companyId: ctx.companyId,
        cashTransactionId: cashTx.id,
        invoiceId: invoice.id,
        allocatedAmount: collectAmount,
        allocatedAt: input.date ?? new Date(),
      });

      const updatedInstallment = await tx.invoiceInstallment.update({
        where: { id: installment.id },
        data: {
          paidAmount: new Decimal(paidAfter),
          isPaid: fullyPaid,
          status: nextStatus,
          paymentDate: fullyPaid ? (input.date ?? new Date()) : installment.paymentDate,
        },
      });

      const totals = await refreshInvoiceBalanceInTx(tx, ctx.companyId, invoice.id);
      return { cashTx, totals, updatedInstallment };
    });

    return {
      cashTransactionId: cashTx.id,
      installment: mapInstallmentRow(updatedInstallment),
      ...totals,
    };
  }
}

export const invoiceInstallmentService = new InvoiceInstallmentService();
