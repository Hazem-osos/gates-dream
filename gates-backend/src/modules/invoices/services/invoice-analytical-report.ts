import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { endOfDayUtc, startOfDayUtc } from '../../../shared/utils/report-date';

const KINDS = ['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'] as const;
type Kind = (typeof KINDS)[number];

const KIND_LABEL: Record<Kind, string> = {
  SALE: 'فاتورة مبيعات',
  PURCHASE: 'فاتورة مشتريات',
  SALE_RETURN: 'مردود مبيعات',
  PURCHASE_RETURN: 'مردود مشتريات',
};

export type AnalyticalPayment = {
  date: string | null;
  number: string;
  amount: number;
  note: string;
  transactionId?: string;
  transactionKind?: string;
  documentRole?: string;
  bankAccountId?: string | null;
  safeId?: string | null;
};

export type AnalyticalInstallment = {
  dueDate: string | null;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: string;
};

export type InvoiceAnalyticalCard = {
  id: string;
  kind: Kind;
  kindLabel: string;
  invoiceNumber: string;
  date: string | null;
  terms: string;
  partyName: string;
  warehouseName: string;
  costCenterName: string;
  currencyCode: string;
  description: string;
  lines: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    unitName: string;
    quantity: number;
    price: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
  }>;
  gross: number;
  discount: number;
  additions: number;
  tax: number;
  withholding: number;
  developmentFee: number;
  net: number;
  advances: AnalyticalPayment[];
  paidAtIssue: AnalyticalPayment[];
  paidAfter: AnalyticalPayment[];
  installments: AnalyticalInstallment[];
  advanceTotal: number;
  paidAtIssueTotal: number;
  paidAfterTotal: number;
  remaining: number;
};

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayKey(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function kindOf(invoiceKind: string | null, invoiceType: string): Kind {
  const kind = (invoiceKind || '').toUpperCase();
  if (kind === 'SALE' || kind === 'PURCHASE' || kind === 'SALE_RETURN' || kind === 'PURCHASE_RETURN') return kind;
  if (invoiceType === 'purchase') return 'PURCHASE';
  if (invoiceType === 'purchaseReturn') return 'PURCHASE_RETURN';
  if (invoiceType === 'salesReturn' || invoiceType === 'return') return 'SALE_RETURN';
  return 'SALE';
}

function termsLabel(date: Date, dueDate: Date | null, paymentMethod: string | null): string {
  if (dueDate) {
    const days = Math.round((dueDate.getTime() - date.getTime()) / 86_400_000);
    if (days > 0) return `${days} يوم`;
  }
  if (paymentMethod === 'credit') return 'آجل';
  if (paymentMethod === 'split') return 'مختلط';
  return 'نقدي';
}

const INSTALLMENT_STATUS: Record<string, string> = {
  PENDING: 'مفتوح',
  PARTIALLY_PAID: 'جزئي',
  PAID: 'مسدد',
  OVERDUE: 'متأخر',
};

type RawPayment = {
  id: string;
  date: Date;
  amount: number;
  number: string;
  note: string;
  transactionKind?: string;
  documentRole?: string;
  bankAccountId?: string | null;
  safeId?: string | null;
};

export function classifyPayments(
  invoiceDate: Date,
  payments: RawPayment[],
  paidAmount: number
): { advances: AnalyticalPayment[]; paidAtIssue: AnalyticalPayment[]; paidAfter: AnalyticalPayment[] } {
  const invoiceDay = dayKey(invoiceDate);
  const advances: AnalyticalPayment[] = [];
  const paidAtIssue: AnalyticalPayment[] = [];
  const paidAfter: AnalyticalPayment[] = [];
  let listed = 0;
  for (const payment of payments) {
    listed += payment.amount;
    const row = {
      date: dayKey(payment.date),
      number: payment.number,
      amount: round2(payment.amount),
      note: payment.note,
      transactionId: payment.id,
      transactionKind: payment.transactionKind,
      documentRole: payment.documentRole,
      bankAccountId: payment.bankAccountId,
      safeId: payment.safeId,
    };
    const payDay = dayKey(payment.date);
    if (invoiceDay && payDay && payDay < invoiceDay) advances.push(row);
    else if (invoiceDay && payDay && payDay > invoiceDay) paidAfter.push(row);
    else paidAtIssue.push(row);
  }
  const gap = round2(paidAmount - listed);
  if (gap > 0.009) {
    paidAtIssue.unshift({
      date: invoiceDay,
      number: '',
      amount: gap,
      note: 'مسدد على الفاتورة',
    });
  }
  return { advances, paidAtIssue, paidAfter };
}

function sum(rows: AnalyticalPayment[]): number {
  return round2(rows.reduce((total, row) => total + row.amount, 0));
}

export async function getInvoiceAnalyticalReport(
  companyId: string,
  opts: {
    fromDate: string;
    toDate: string;
    partyId?: string;
    warehouseId?: string;
    kind?: Kind;
    showUnposted?: boolean;
  }
) {
  const where: Prisma.InvoiceWhereInput = {
    companyId,
    isCancelled: false,
    date: {
      gte: startOfDayUtc(opts.fromDate, 'fromDate'),
      lte: endOfDayUtc(opts.toDate, 'toDate'),
    },
    ...(opts.showUnposted ? {} : { isPosted: true }),
    ...(opts.kind
      ? { invoiceKind: opts.kind }
      : { invoiceKind: { in: [...KINDS] } }),
    ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
    ...(opts.partyId ? { OR: [{ customerId: opts.partyId }, { supplierId: opts.partyId }] } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
    take: 200,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceKind: true,
      invoiceType: true,
      date: true,
      dueDate: true,
      description: true,
      currencyCode: true,
      paymentMethod: true,
      totalAmount: true,
      discountAmount: true,
      taxAmount: true,
      withholdingTaxAmount: true,
      developmentFeeAmount: true,
      netAmount: true,
      paidAmount: true,
      remainingAmount: true,
      customer: { select: { arabicName: true } },
      supplier: { select: { arabicName: true } },
      warehouse: { select: { arabicName: true } },
      costCenter: { select: { arabicName: true } },
      documentProfile: { select: { nameAr: true } },
      lines: {
        orderBy: { lineOrder: 'asc' },
        select: {
          quantity: true,
          price: true,
          total: true,
          discountPercent: true,
          discountAmount: true,
          taxPercent: true,
          taxAmount: true,
          item: { select: { id: true, serial: true, arabicName: true } },
          unit: { select: { arabicName: true } },
        },
      },
      adjustments: { select: { type: true, amount: true, description: true } },
      installments: {
        orderBy: { installmentNumber: 'asc' },
        select: { dueDate: true, amount: true, paidAmount: true, status: true },
      },
      paymentAllocations: {
        select: {
          allocatedAmount: true,
          cashTransactionId: true,
          cashTransaction: {
            select: {
              date: true,
              voucherNumber: true,
              description: true,
              isCancelled: true,
              transactionKind: true,
              documentRole: true,
              bankAccountId: true,
              safeId: true,
            },
          },
        },
      },
      settlements: {
        where: { isCancelled: false },
        select: {
          id: true,
          date: true,
          amount: true,
          voucherNumber: true,
          description: true,
          transactionKind: true,
          documentRole: true,
          bankAccountId: true,
          safeId: true,
        },
      },
    },
  });

  const cards: InvoiceAnalyticalCard[] = invoices.map((invoice) => {
    const kind = kindOf(invoice.invoiceKind, invoice.invoiceType);
    const seen = new Set(
      invoice.paymentAllocations.map((row) => row.cashTransactionId)
    );
    const payments: RawPayment[] = [];
    for (const row of invoice.paymentAllocations) {
      if (row.cashTransaction.isCancelled) continue;
      payments.push({
        id: row.cashTransactionId,
        date: row.cashTransaction.date,
        amount: n(row.allocatedAmount),
        number: row.cashTransaction.voucherNumber || '',
        note: row.cashTransaction.description || '',
        transactionKind: row.cashTransaction.transactionKind,
        documentRole: row.cashTransaction.documentRole,
        bankAccountId: row.cashTransaction.bankAccountId,
        safeId: row.cashTransaction.safeId,
      });
    }
    for (const row of invoice.settlements) {
      if (seen.has(row.id)) continue;
      payments.push({
        id: row.id,
        date: row.date,
        amount: n(row.amount),
        number: row.voucherNumber || '',
        note: row.description || '',
        transactionKind: row.transactionKind,
        documentRole: row.documentRole,
        bankAccountId: row.bankAccountId,
        safeId: row.safeId,
      });
    }
    const grouped = classifyPayments(invoice.date, payments, n(invoice.paidAmount));
    const additions = round2(
      invoice.adjustments
        .filter((row) => row.type === 'ADDITION')
        .reduce((total, row) => total + n(row.amount), 0)
    );
    const extraDiscount = round2(
      invoice.adjustments
        .filter((row) => row.type === 'DEDUCTION')
        .reduce((total, row) => total + n(row.amount), 0)
    );
    const advanceTotal = sum(grouped.advances);
    const paidAtIssueTotal = sum(grouped.paidAtIssue);
    const paidAfterTotal = sum(grouped.paidAfter);
    return {
      id: invoice.id,
      kind,
      kindLabel: invoice.documentProfile?.nameAr || KIND_LABEL[kind],
      invoiceNumber: invoice.invoiceNumber || '',
      date: dayKey(invoice.date),
      terms: termsLabel(invoice.date, invoice.dueDate, invoice.paymentMethod),
      partyName: invoice.customer?.arabicName || invoice.supplier?.arabicName || '',
      warehouseName: invoice.warehouse?.arabicName || '',
      costCenterName: invoice.costCenter?.arabicName || '',
      currencyCode: invoice.currencyCode || '',
      description: invoice.description || '',
      lines: invoice.lines.map((line) => ({
        itemId: line.item.id,
        itemCode: line.item.serial || '',
        itemName: line.item.arabicName,
        unitName: line.unit.arabicName,
        quantity: n(line.quantity),
        price: n(line.price),
        discountPercent: n(line.discountPercent),
        discountAmount: n(line.discountAmount),
        taxPercent: n(line.taxPercent),
        taxAmount: n(line.taxAmount),
        total: n(line.total),
      })),
      gross: n(invoice.totalAmount),
      discount: round2(n(invoice.discountAmount) + extraDiscount),
      additions,
      tax: n(invoice.taxAmount),
      withholding: n(invoice.withholdingTaxAmount),
      developmentFee: n(invoice.developmentFeeAmount),
      net: n(invoice.netAmount),
      advances: grouped.advances,
      paidAtIssue: grouped.paidAtIssue,
      paidAfter: grouped.paidAfter,
      installments: invoice.installments.map((row) => {
        const amount = n(row.amount);
        const paidAmount = n(row.paidAmount);
        return {
          dueDate: dayKey(row.dueDate),
          amount,
          paidAmount,
          remaining: round2(Math.max(amount - paidAmount, 0)),
          status: INSTALLMENT_STATUS[row.status] || row.status,
        };
      }),
      advanceTotal,
      paidAtIssueTotal,
      paidAfterTotal,
      remaining: n(invoice.remainingAmount),
    };
  });

  return {
    invoices: cards,
    truncated: cards.length >= 200,
    summary: {
      invoiceCount: cards.length,
      net: round2(cards.reduce((total, card) => total + card.net, 0)),
      remaining: round2(cards.reduce((total, card) => total + card.remaining, 0)),
      truncated: cards.length >= 200,
    },
  };
}
