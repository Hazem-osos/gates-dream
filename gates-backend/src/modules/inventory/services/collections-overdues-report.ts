import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { applyCustomerMasterWhere } from '../../accounting/services/party-group-filter';
import { appliedCollectionAmount, buildCollectionsOverdueRows } from './collections-overdues-sheet';

export async function loadCollectionsAndOverduesReport(input: {
  companyId: string;
  customerId?: string;
  customerCategoryId?: string;
  branchId?: string;
  asOf: Date;
  allAccounts: boolean;
  page: number;
  limit: number;
}) {
  const masterWhere: Prisma.CustomerWhereInput = {
    companyId: input.companyId,
    deletedAt: null,
  };
  applyCustomerMasterWhere(masterWhere as Record<string, unknown>, input);

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    companyId: input.companyId,
    isPosted: true,
    isCancelled: false,
    customerId: { not: null },
    date: { lte: input.asOf },
    OR: [
      { invoiceKind: { in: ['SALE', 'SALE_RETURN'] } },
      { invoiceType: { in: ['sales', 'salesReturn'] } },
      {
        invoiceType: 'return',
        NOT: { invoiceKind: { in: ['PURCHASE', 'PURCHASE_RETURN'] } },
      },
    ],
  };
  if (input.customerId) invoiceWhere.customerId = input.customerId;
  if (input.customerCategoryId) {
    invoiceWhere.customer = { customerCategoryId: input.customerCategoryId };
  }
  if (input.branchId) invoiceWhere.branchId = input.branchId;

  const cashWhere: Prisma.CashTransactionWhereInput = {
    companyId: input.companyId,
    isPosted: true,
    isCancelled: false,
    customerId: { not: null },
    documentRole: { not: 'ORDER' },
    transactionKind: 'RECEIPT',
    date: { lte: input.asOf },
  };
  if (input.customerId) cashWhere.customerId = input.customerId;
  if (input.customerCategoryId) {
    cashWhere.customer = { customerCategoryId: input.customerCategoryId };
  }
  if (input.branchId) cashWhere.branchId = input.branchId;

  const chequeWhere: Prisma.ChequeWhereInput = {
    companyId: input.companyId,
    direction: 'INWARD',
    status: { in: ['UNDER_HAND', 'SENT_TO_BANK', 'COLLECTED'] },
    customerId: { not: null },
    createdAt: { lte: input.asOf },
  };
  if (input.customerId) chequeWhere.customerId = input.customerId;
  if (input.customerCategoryId) {
    chequeWhere.customer = { customerCategoryId: input.customerCategoryId };
  }
  if (input.branchId) chequeWhere.branchId = input.branchId;

  const paperWhere: Prisma.SecuritiesReceiptWhereInput = {
    companyId: input.companyId,
    isPosted: true,
    isCancelled: false,
    isOpening: false,
    customerId: { not: null },
    date: { lte: input.asOf },
    paperCase: { notIn: ['BOUNCED', 'CANCELLED'] },
  };
  if (input.customerId) paperWhere.customerId = input.customerId;
  if (input.customerCategoryId) {
    paperWhere.customer = { customerCategoryId: input.customerCategoryId };
  }
  if (input.branchId) paperWhere.branchId = input.branchId;

  const [customers, invoices, cash, cheques, papers] = await Promise.all([
    prisma.customer.findMany({
      where: masterWhere,
      select: { id: true, code: true, arabicName: true },
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        customerId: true,
        date: true,
        dueDate: true,
        invoiceKind: true,
        invoiceType: true,
        netAmount: true,
        remainingAmount: true,
        installments: {
          select: { dueDate: true, amount: true, paidAmount: true, isPaid: true },
        },
      },
    }),
    prisma.cashTransaction.findMany({
      where: cashWhere,
      select: {
        customerId: true,
        invoiceId: true,
        date: true,
        amount: true,
        paymentAllocations: { select: { allocatedAmount: true } },
      },
    }),
    prisma.cheque.findMany({
      where: chequeWhere,
      select: { customerId: true, invoiceId: true, createdAt: true, amount: true },
    }),
    prisma.securitiesReceipt.findMany({
      where: paperWhere,
      select: { customerId: true, date: true, amount: true },
    }),
  ]);

  const saleSign = (invoice: { invoiceKind: string | null; invoiceType: string | null }) => {
    if (invoice.invoiceKind === 'SALE_RETURN') return -1;
    if (invoice.invoiceKind === 'SALE') return 1;
    if (invoice.invoiceType === 'salesReturn' || invoice.invoiceType === 'return') return -1;
    return 1;
  };

  const rows = buildCollectionsOverdueRows({
    customers,
    invoices: invoices.flatMap((invoice) => {
      if (!invoice.customerId) return [];
      const sign = saleSign(invoice);
      return [
        {
          customerId: invoice.customerId,
          date: invoice.date,
          dueDate: invoice.dueDate,
          netAmount: sign * Number(invoice.netAmount || 0),
          remainingAmount: sign * Number(invoice.remainingAmount || 0),
          installments:
            sign < 0
              ? []
              : invoice.installments.map((installment) => ({
                  dueDate: installment.dueDate,
                  amount: Number(installment.amount || 0),
                  paidAmount: Number(installment.paidAmount || 0),
                  isPaid: installment.isPaid,
                })),
        },
      ];
    }),
    cash: [
      ...cash.flatMap((movement) => {
        if (!movement.customerId) return [];
        const amount = Number(movement.amount || 0);
        const allocated = movement.paymentAllocations.reduce(
          (sum, row) => sum + Number(row.allocatedAmount || 0),
          0
        );
        return [
          {
            customerId: movement.customerId,
            date: movement.date,
            amount,
            allocatedAmount: appliedCollectionAmount(amount, allocated, Boolean(movement.invoiceId)),
          },
        ];
      }),
      ...cheques.flatMap((cheque) => {
        if (!cheque.customerId) return [];
        const amount = Number(cheque.amount || 0);
        return [
          {
            customerId: cheque.customerId,
            date: cheque.createdAt,
            amount,
            allocatedAmount: appliedCollectionAmount(amount, 0, Boolean(cheque.invoiceId)),
          },
        ];
      }),
      ...papers.flatMap((paper) => {
        if (!paper.customerId) return [];
        return [
          {
            customerId: paper.customerId,
            date: paper.date,
            amount: Number(paper.amount || 0),
            allocatedAmount: 0,
          },
        ];
      }),
    ],
    asOf: input.asOf,
    allAccounts: input.allAccounts,
  });

  const total = rows.length;
  const skip = (input.page - 1) * input.limit;
  return {
    data: rows.slice(skip, skip + input.limit),
    summary: {
      totalCustomers: total,
      totalSales: roundTo4(rows.reduce((sum, row) => sum + row.totalSales, 0)),
      totalCollections: roundTo4(rows.reduce((sum, row) => sum + row.totalCollections, 0)),
      totalCurrent: roundTo4(rows.reduce((sum, row) => sum + row.currentDue, 0)),
      totalOverdue: roundTo4(rows.reduce((sum, row) => sum + row.overdueAmount, 0)),
      totalBalances: roundTo4(rows.reduce((sum, row) => sum + row.balance, 0)),
    },
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit) || 0,
    },
  };
}
