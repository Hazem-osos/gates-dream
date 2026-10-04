import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { applyCustomerMasterWhere } from '../../accounting/services/party-group-filter';
import { buildCustomerBalanceRows } from './customer-balances-sheet';

function saleKind(invoice: {
  invoiceKind: string | null;
  invoiceType: string | null;
}): 'SALE' | 'SALE_RETURN' | null {
  if (invoice.invoiceKind === 'SALE') return 'SALE';
  if (invoice.invoiceKind === 'SALE_RETURN') return 'SALE_RETURN';
  if (invoice.invoiceKind === 'PURCHASE' || invoice.invoiceKind === 'PURCHASE_RETURN') return null;
  if (invoice.invoiceType === 'sales') return 'SALE';
  if (invoice.invoiceType === 'salesReturn' || invoice.invoiceType === 'return') return 'SALE_RETURN';
  return null;
}

export async function loadCustomerBalancesReport(input: {
  companyId: string;
  customerId?: string;
  customerCategoryId?: string;
  branchId?: string;
  costCenterId?: string;
  currencyId?: string;
  fromDate?: Date;
  toDate: Date;
  allAccounts: boolean;
  page: number;
  limit: number;
}) {
  const masterWhere: Prisma.CustomerWhereInput = {
    companyId: input.companyId,
    deletedAt: null,
  };
  applyCustomerMasterWhere(masterWhere as Record<string, unknown>, input);

  let currencyCode = '';
  if (input.currencyId) {
    const currency = await prisma.currency.findFirst({
      where: {
        companyId: input.companyId,
        OR: [{ id: input.currencyId }, { code: input.currencyId }],
      },
      select: { code: true },
    });
    currencyCode = currency?.code || String(input.currencyId);
  }

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    companyId: input.companyId,
    isPosted: true,
    isCancelled: false,
    customerId: { not: null },
    date: { lte: input.toDate },
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
  if (currencyCode) invoiceWhere.currencyCode = currencyCode;
  if (input.costCenterId) {
    invoiceWhere.AND = [
      {
        OR: [
          { costCenterId: input.costCenterId },
          { lines: { some: { costCenterId: input.costCenterId } } },
        ],
      },
    ];
  }

  const cashWhere: Prisma.CashTransactionWhereInput = {
    companyId: input.companyId,
    isPosted: true,
    isCancelled: false,
    customerId: { not: null },
    documentRole: { not: 'ORDER' },
    transactionKind: { in: ['RECEIPT', 'PAYMENT'] },
    date: { lte: input.toDate },
  };
  if (input.customerId) cashWhere.customerId = input.customerId;
  if (input.customerCategoryId) {
    cashWhere.customer = { customerCategoryId: input.customerCategoryId };
  }
  if (input.branchId) cashWhere.branchId = input.branchId;
  if (currencyCode) cashWhere.currencyCode = currencyCode;
  if (input.costCenterId) {
    cashWhere.lines = { some: { costCenterId: input.costCenterId } };
  }

  const [customers, invoices, cash] = await Promise.all([
    prisma.customer.findMany({
      where: masterWhere,
      select: {
        id: true,
        code: true,
        arabicName: true,
        estimatedBudget: true,
        mainAccount: {
          select: {
            code: true,
            budget: true,
            parent: { select: { code: true, arabicName: true } },
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        customerId: true,
        invoiceKind: true,
        invoiceType: true,
        date: true,
        netAmount: true,
      },
    }),
    prisma.cashTransaction.findMany({
      where: cashWhere,
      select: {
        customerId: true,
        transactionKind: true,
        date: true,
        amount: true,
      },
    }),
  ]);

  const rows = buildCustomerBalanceRows({
    customers: customers.map((customer) => ({
      id: customer.id,
      code: customer.code,
      arabicName: customer.arabicName,
      accountCode: customer.mainAccount?.code || customer.code,
      parentAccountCode: customer.mainAccount?.parent?.code || null,
      parentAccountName: customer.mainAccount?.parent?.arabicName || null,
      budget: Number(customer.estimatedBudget ?? customer.mainAccount?.budget ?? 0),
    })),
    invoices: invoices.flatMap((invoice) => {
      if (!invoice.customerId) return [];
      const kind = saleKind(invoice);
      if (!kind) return [];
      return [
        {
          customerId: invoice.customerId,
          kind,
          date: invoice.date,
          netAmount: Number(invoice.netAmount || 0),
        },
      ];
    }),
    cash: cash.flatMap((movement) => {
      if (!movement.customerId) return [];
      if (movement.transactionKind !== 'RECEIPT' && movement.transactionKind !== 'PAYMENT') return [];
      return [
        {
          customerId: movement.customerId,
          kind: movement.transactionKind,
          date: movement.date,
          amount: Number(movement.amount || 0),
        },
      ];
    }),
    fromDate: input.fromDate,
    toDate: input.toDate,
    allAccounts: input.allAccounts,
  });

  const detail = rows.filter((row) => !row.isGroup);
  const columnSum = (pick: (row: (typeof detail)[number]) => number) =>
    roundTo4(detail.reduce((sum, row) => sum + pick(row), 0));
  const columnTotals = {
    previousBalance: columnSum((row) => row.previousBalance),
    debit: columnSum((row) => row.debit),
    credit: columnSum((row) => row.credit),
    currentBalance: columnSum((row) => row.currentBalance),
    budget: columnSum((row) => row.budget),
    budgetRemaining: columnSum((row) => row.budgetRemaining),
  };
  const total = rows.length;
  const skip = (input.page - 1) * input.limit;
  const pageRows = rows.slice(skip, skip + input.limit);
  return {
    data: pageRows,
    summary: {
      totalCustomers: detail.length,
      totalPreviousBalance: columnTotals.previousBalance,
      totalDebit: columnTotals.debit,
      totalCredit: columnTotals.credit,
      totalCurrentBalance: columnTotals.currentBalance,
      totalBudget: columnTotals.budget,
      totalBudgetRemaining: columnTotals.budgetRemaining,
      columnTotals,
    },
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit) || 0,
    },
  };
}
