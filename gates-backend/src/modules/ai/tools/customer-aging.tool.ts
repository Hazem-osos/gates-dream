import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { BaseAiTool } from './base-ai-tool';
import type { OverdueReceivablesPort } from './get-overdue-receivables.tool';
import { optionalUuid } from './shared-schemas';
import type { SecurityContext } from './types';

const paramsSchema = z.object({
  customerId: optionalUuid,
  minOverdueDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
});

type Params = z.infer<typeof paramsSchema>;

const BUCKET_MIN: Record<string, number> = {
  current_0_30: 0,
  days_31_60: 31,
  days_61_90: 61,
  days_91_120: 91,
  days_120_plus: 121,
};

export class CustomerAgingTool extends BaseAiTool<Params> {
  readonly name = 'customer_aging_tool';
  readonly description =
    'Accounts receivable aging and, when customerId is set, a 3-line buildup of that customer balance from the last 3 posted invoices and payment vouchers. Use this whenever the user asks why a customer balance is what it is.';
  readonly parameters = paramsSchema;
  readonly requiredPermission = 'invoice:view';
  readonly requiredPermissions = ['invoice:view', 'customer:view', 'report:view'];

  constructor(private readonly aging: OverdueReceivablesPort) {
    super();
  }

  protected async run(params: Params, context: SecurityContext) {
    const asOfDate = new Date();
    const report = await this.aging.getAgedReceivables({
      companyId: context.companyId,
      branchId: context.branchId,
      asOfDate,
      customerId: params.customerId,
    });

    const minDays = params.minOverdueDays ?? 30;
    const critical = (report.parties ?? [])
      .map((party) => {
        const overdue = Object.entries(party.buckets ?? {}).reduce((sum, [key, value]) => {
          return (BUCKET_MIN[key] ?? 0) >= minDays ? sum + Number(value) : sum;
        }, 0);
        return {
          customerId: party.partyId,
          customerName: party.partyName,
          remaining: party.total,
          overduePastMinDays: overdue,
          buckets: party.buckets,
        };
      })
      .filter((row) => row.overduePastMinDays > 0)
      .sort((a, b) => b.overduePastMinDays - a.overduePastMinDays)
      .slice(0, 10);

    const focus = params.customerId
      ? await loadCustomerBalanceBuildup(context.companyId, params.customerId)
      : undefined;

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      minOverdueDays: minDays,
      totalReceivable: report.grandTotal,
      bucketTotals: report.bucketTotals,
      topOverdueCustomers: critical,
      customerBalanceBuildup: focus,
    };
  }
}

async function loadCustomerBalanceBuildup(companyId: string, customerId: string) {
  const [customer, invoices, receipts] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: { id: true, arabicName: true, code: true },
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        customerId,
        isPosted: true,
        isCancelled: false,
        invoiceKind: { in: ['SALE', 'SALE_RETURN'] },
      },
      orderBy: { date: 'desc' },
      take: 3,
      select: {
        invoiceNumber: true,
        date: true,
        invoiceKind: true,
        netAmount: true,
        remainingAmount: true,
      },
    }),
    prisma.cashTransaction.findMany({
      where: {
        companyId,
        customerId,
        isPosted: true,
        isCancelled: false,
        transactionKind: { in: ['RECEIPT', 'PAYMENT'] },
      },
      orderBy: { date: 'desc' },
      take: 3,
      select: {
        voucherNumber: true,
        date: true,
        transactionKind: true,
        amount: true,
      },
    }),
  ]);

  const recentInvoices = invoices.map((row) => ({
    document: row.invoiceNumber ?? 'فاتورة',
    kind: row.invoiceKind,
    date: row.date.toISOString().slice(0, 10),
    amount: Number(row.netAmount),
    remaining: Number(row.remainingAmount),
  }));
  const recentReceipts = receipts.map((row) => ({
    document: row.voucherNumber ?? 'سند',
    kind: row.transactionKind,
    date: row.date.toISOString().slice(0, 10),
    amount: Number(row.amount),
  }));

  const lastInvoice = recentInvoices[0];
  const lastReceipt = recentReceipts[0];
  const openTotal = recentInvoices.reduce((sum, row) => sum + row.remaining, 0);

  return {
    customerId: customer?.id ?? customerId,
    customerName: customer?.arabicName ?? null,
    customerCode: customer?.code ?? null,
    recentInvoices,
    recentReceipts,
    threeLineBreakdown: [
      lastInvoice
        ? `آخر فاتورة ${lastInvoice.document} بتاريخ ${lastInvoice.date} بقيمة ${lastInvoice.amount} (المتبقي ${lastInvoice.remaining}).`
        : 'لا توجد فواتير مرحّلة حديثة لهذا العميل.',
      lastReceipt
        ? `آخر سند ${lastReceipt.kind === 'RECEIPT' ? 'قبض' : 'صرف'} ${lastReceipt.document} بتاريخ ${lastReceipt.date} بمبلغ ${lastReceipt.amount}.`
        : 'لا توجد سندات سداد مرحّلة حديثة لهذا العميل.',
      `صافي المتبقي الظاهر على آخر 3 فواتير مفتوحة: ${openTotal}.`,
    ],
  };
}
