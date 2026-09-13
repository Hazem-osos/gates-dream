import prisma from '../../../shared/database/prisma';
import { safeService } from '../../accounting/services/safe.service';
import { bankAccountService } from '../../accounting/services/bank-account.service';
import { addDays, money } from './detector.types';
import type { CashFlowPorts } from './detectors/cash-flow-risk.detector';
import type { ReceivableCustomer, ReceivablesPorts } from './detectors/receivables-risk.detector';
import type { ProjectMarginPorts } from './detectors/project-margin.detector';
import type { StockItemSnapshot, StockRunoutPorts } from './detectors/stock-runout.detector';

const OUTWARD_OPEN: Array<'UNDER_HAND' | 'SENT_TO_BANK'> = ['UNDER_HAND', 'SENT_TO_BANK'];

export const prismaCashFlowPorts: CashFlowPorts = {
  async liquidCash(companyId) {
    const [safes, banks] = await Promise.all([
      safeService.getSafes(companyId, { isActive: true }),
      bankAccountService.getBankAccounts(companyId, { isActive: true }),
    ]);
    return {
      treasuryTotal: safes.reduce((sum, row) => sum + money(row.balance), 0),
      bankTotal: banks.reduce((sum, row) => sum + money(row.balance), 0),
    };
  },

  async upcomingCheques(companyId, from, to) {
    const rows = await prisma.cheque.findMany({
      where: {
        companyId,
        direction: 'OUTWARD',
        status: { in: OUTWARD_OPEN },
        dueDate: { gte: from, lte: to },
      },
      select: { id: true, chequeNumber: true, amount: true, dueDate: true },
    });
    return rows
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: row.id,
        number: row.chequeNumber,
        amount: money(row.amount),
        dueDate: row.dueDate as Date,
      }));
  },

  async upcomingSecurities(companyId, from, to) {
    const rows = await prisma.securitiesPayment.findMany({
      where: {
        companyId,
        isCancelled: false,
        dueDate: { gte: from, lte: to },
        securityType: { in: ['check', 'cheque', 'promissory-note'] },
      },
      select: { id: true, securityNumber: true, paymentNumber: true, amount: true, dueDate: true },
    });
    return rows
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: row.id,
        number: row.securityNumber || row.paymentNumber || row.id,
        amount: money(row.amount),
        dueDate: row.dueDate as Date,
      }));
  },

  async upcomingSupplierInvoices(companyId, from, to) {
    const rows = await prisma.invoice.findMany({
      where: {
        companyId,
        isPosted: true,
        isCancelled: false,
        remainingAmount: { gt: 0 },
        invoiceKind: 'PURCHASE',
        dueDate: { gte: from, lte: to },
      },
      select: { id: true, invoiceNumber: true, remainingAmount: true, dueDate: true },
    });
    return rows
      .filter((row) => row.dueDate)
      .map((row) => ({
        id: row.id,
        number: row.invoiceNumber || row.id,
        amount: money(row.remainingAmount),
        dueDate: row.dueDate as Date,
      }));
  },
};

export const prismaReceivablesPorts: ReceivablesPorts = {
  async loadCustomers(companyId, asOf) {
    const cutoff = addDays(asOf, -45);
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        isPosted: true,
        isCancelled: false,
        remainingAmount: { gt: 0 },
        invoiceKind: 'SALE',
        customerId: { not: null },
      },
      select: {
        customerId: true,
        remainingAmount: true,
        dueDate: true,
        date: true,
        customer: { select: { id: true, arabicName: true, creditLimit: true } },
      },
    });

    const byCustomer = new Map<string, ReceivableCustomer>();
    for (const row of invoices) {
      const customerId = row.customerId ?? row.customer?.id;
      if (!customerId) continue;
      const current = byCustomer.get(customerId) ?? {
        customerId,
        customerName: row.customer?.arabicName ?? customerId,
        overdue45: 0,
        openBalance: 0,
        creditLimit: row.customer?.creditLimit == null ? null : money(row.customer.creditLimit),
      };
      const remaining = money(row.remainingAmount);
      current.openBalance += remaining;
      const agedFrom = row.dueDate ?? row.date;
      if (agedFrom <= cutoff) current.overdue45 += remaining;
      byCustomer.set(customerId, current);
    }
    return [...byCustomer.values()];
  },
};

export const prismaStockRunoutPorts: StockRunoutPorts = {
  async loadItems(companyId, asOf) {
    const from = addDays(asOf, -30);
    const [balances, sales] = await Promise.all([
      prisma.itemWarehouseBalance.groupBy({
        by: ['itemId'],
        where: { companyId },
        _sum: { quantityOnHand: true },
      }),
      prisma.invoiceLine.findMany({
        where: {
          invoice: {
            companyId,
            isPosted: true,
            isCancelled: false,
            invoiceKind: 'SALE',
            date: { gte: from, lte: asOf },
          },
        },
        select: {
          itemId: true,
          quantity: true,
          item: { select: { arabicName: true } },
        },
      }),
    ]);

    const sold = new Map<string, { name: string; qty: number }>();
    for (const line of sales) {
      const current = sold.get(line.itemId) ?? { name: line.item?.arabicName ?? line.itemId, qty: 0 };
      current.qty += money(line.quantity);
      sold.set(line.itemId, current);
    }

    const names = new Map<string, string>();
    const items: StockItemSnapshot[] = balances.map((row) => {
      const soldRow = sold.get(row.itemId);
      return {
        itemId: row.itemId,
        itemName: soldRow?.name ?? row.itemId,
        quantityOnHand: money(row._sum.quantityOnHand),
        soldLast30Days: soldRow?.qty ?? 0,
      };
    });

    for (const [itemId, row] of sold) {
      if (!items.some((item) => item.itemId === itemId)) {
        items.push({
          itemId,
          itemName: row.name,
          quantityOnHand: 0,
          soldLast30Days: row.qty,
        });
      }
      names.set(itemId, row.name);
    }

    return items.map((item) => ({
      ...item,
      itemName: names.get(item.itemId) ?? item.itemName,
    }));
  },
};

export const prismaProjectMarginPorts: ProjectMarginPorts = {
  async loadProjects(companyId) {
    const projects = await prisma.contractingProject.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: {
        id: true,
        projectName: true,
        contractValue: true,
        ownerBoqItems: {
          select: {
            contractQuantity: true,
            cumulativeExecutedQty: true,
            directCostEstimated: true,
          },
        },
      },
    });

    return projects.map((project) => {
      let estimatedCost = 0;
      let actualCost = 0;
      for (const item of project.ownerBoqItems) {
        const rate = money(item.directCostEstimated);
        estimatedCost += money(item.contractQuantity) * rate;
        actualCost += money(item.cumulativeExecutedQty) * rate;
      }
      return {
        projectId: project.id,
        projectName: project.projectName,
        contractValue: money(project.contractValue),
        estimatedCost: money(estimatedCost),
        actualCost: money(actualCost),
      };
    });
  },
};
