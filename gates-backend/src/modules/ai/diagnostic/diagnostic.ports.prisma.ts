import { SubcontractInvoiceStatus } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { prismaCashFlowPorts } from '../proactive/detector-ports.prisma';
import { prismaProjectMarginPorts } from '../proactive/detector-ports.prisma';
import { addDays, money } from '../sentinel/sentinel.math';
import type { DiagnosticDataPorts } from './diagnostic.ports';

const PENDING_SUB: SubcontractInvoiceStatus[] = [
  SubcontractInvoiceStatus.SITE_SUBMITTED,
  SubcontractInvoiceStatus.CONSULTANT_APPROVED,
  SubcontractInvoiceStatus.TECH_OFFICE_APPROVED,
  SubcontractInvoiceStatus.FINANCE_POSTED,
];

async function invoiceTotal(
  companyId: string,
  kind: 'SALE' | 'PURCHASE',
  from: Date,
  to: Date
): Promise<number> {
  const agg = await prisma.invoice.aggregate({
    where: {
      companyId,
      invoiceKind: kind,
      isCancelled: false,
      date: { gte: from, lte: to },
    },
    _sum: { netAmount: true },
  });
  return money(agg._sum.netAmount);
}

export const prismaDiagnosticPorts: DiagnosticDataPorts = {
  liquidCash: prismaCashFlowPorts.liquidCash,

  periodSales: (companyId, from, to) => invoiceTotal(companyId, 'SALE', from, to),
  periodPurchases: (companyId, from, to) => invoiceTotal(companyId, 'PURCHASE', from, to),

  async openReceivables(companyId, asOf) {
    const rows = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceKind: 'SALE',
        isPosted: true,
        isCancelled: false,
        remainingAmount: { gt: 0 },
      },
      select: { remainingAmount: true, dueDate: true, date: true },
    });
    let total = 0;
    let overdue = 0;
    let overdue90 = 0;
    const cutoff90 = addDays(asOf, -90);
    for (const row of rows) {
      const amount = money(row.remainingAmount);
      total += amount;
      const due = row.dueDate ?? row.date;
      if (due.getTime() < asOf.getTime()) {
        overdue += amount;
        if (due.getTime() < cutoff90.getTime()) overdue90 += amount;
      }
    }
    return { total: money(total), overdue: money(overdue), overdue90: money(overdue90) };
  },

  async openPayables(companyId) {
    const agg = await prisma.invoice.aggregate({
      where: {
        companyId,
        invoiceKind: 'PURCHASE',
        isPosted: true,
        isCancelled: false,
        remainingAmount: { gt: 0 },
      },
      _sum: { remainingAmount: true },
    });
    return money(agg._sum.remainingAmount);
  },

  async inventoryValue(companyId) {
    const balances = await prisma.itemWarehouseBalance.findMany({
      where: { companyId },
      select: { quantityOnHand: true, item: { select: { averageCost: true } } },
    });
    return money(
      balances.reduce((sum, row) => sum + money(row.quantityOnHand) * money(row.item.averageCost), 0)
    );
  },

  async customerRevenue(companyId, from, to) {
    const rows = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceKind: 'SALE',
        isCancelled: false,
        date: { gte: from, lte: to },
        customerId: { not: null },
      },
      select: {
        netAmount: true,
        customerId: true,
        customer: { select: { arabicName: true } },
      },
    });
    const by = new Map<string, { customerName: string; revenue: number }>();
    for (const row of rows) {
      const id = row.customerId;
      if (!id) continue;
      const current = by.get(id) ?? { customerName: row.customer?.arabicName ?? id, revenue: 0 };
      current.revenue = money(current.revenue + money(row.netAmount));
      by.set(id, current);
    }
    return [...by.entries()].map(([customerId, row]) => ({ customerId, ...row }));
  },

  async stockItems(companyId) {
    const [balances, lastSales] = await Promise.all([
      prisma.itemWarehouseBalance.findMany({
        where: { companyId },
        select: {
          itemId: true,
          quantityOnHand: true,
          item: { select: { arabicName: true, averageCost: true, lastPurchasePrice: true } },
        },
      }),
      prisma.invoiceLine.findMany({
        where: {
          invoice: {
            companyId,
            invoiceKind: 'SALE',
            isCancelled: false,
            date: { gte: addDays(new Date(), -365) },
          },
        },
        select: { itemId: true, invoice: { select: { date: true } } },
        orderBy: { invoice: { date: 'desc' } },
      }),
    ]);
    const lastSale = new Map<string, Date>();
    for (const row of lastSales) {
      if (!lastSale.has(row.itemId)) lastSale.set(row.itemId, row.invoice.date);
    }
    const byItem = new Map<
      string,
      { itemName: string; quantityOnHand: number; averageCost: number; lastPurchasePrice: number }
    >();
    for (const row of balances) {
      const current = byItem.get(row.itemId) ?? {
        itemName: row.item.arabicName,
        quantityOnHand: 0,
        averageCost: money(row.item.averageCost),
        lastPurchasePrice: money(row.item.lastPurchasePrice),
      };
      current.quantityOnHand = money(current.quantityOnHand + money(row.quantityOnHand));
      byItem.set(row.itemId, current);
    }
    return [...byItem.entries()].map(([itemId, row]) => ({
      itemId,
      ...row,
      lastSaleAt: lastSale.get(itemId) ?? null,
    }));
  },

  async cogs(companyId, from, to) {
    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceKind: 'SALE',
          isCancelled: false,
          date: { gte: from, lte: to },
        },
      },
      select: { quantity: true, unitCostAtIssue: true, item: { select: { averageCost: true } } },
    });
    return money(
      lines.reduce((sum, row) => {
        const cost = money(row.unitCostAtIssue ?? row.item.averageCost);
        return sum + money(row.quantity) * cost;
      }, 0)
    );
  },

  async belowReplacementSales(companyId, from) {
    const sales = await prisma.invoiceLine.findMany({
      where: {
        invoice: { companyId, invoiceKind: 'SALE', isCancelled: false, date: { gte: from } },
      },
      select: {
        itemId: true,
        price: true,
        item: { select: { arabicName: true, lastPurchasePrice: true } },
      },
    });
    const itemIds = [...new Set(sales.map((row) => row.itemId))];
    const purchases = itemIds.length
      ? await prisma.invoiceLine.findMany({
          where: {
            itemId: { in: itemIds },
            invoice: { companyId, invoiceKind: 'PURCHASE', isCancelled: false, isPosted: true },
          },
          select: { itemId: true, price: true, invoice: { select: { date: true } } },
          orderBy: { invoice: { date: 'desc' } },
        })
      : [];
    const latest = new Map<string, number>();
    for (const row of purchases) {
      if (!latest.has(row.itemId) && money(row.price) > 0) latest.set(row.itemId, money(row.price));
    }
    const flags = [];
    for (const row of sales) {
      const replacement = latest.get(row.itemId) || money(row.item.lastPurchasePrice);
      if (replacement > 0 && money(row.price) < replacement) {
        flags.push({
          itemId: row.itemId,
          itemName: row.item.arabicName,
          salePrice: money(row.price),
          replacementCost: replacement,
        });
      }
    }
    return flags.slice(0, 40);
  },

  async contractingProjects(companyId, asOf, horizonDays) {
    const to = addDays(asOf, horizonDays);
    const [projects, subs, owners] = await Promise.all([
      prismaProjectMarginPorts.loadProjects(companyId),
      prisma.subcontractInvoice.findMany({
        where: { companyId, status: { in: PENDING_SUB }, periodEndDate: { lte: to } },
        select: {
          netPayableAmount: true,
          subcontract: { select: { projectId: true } },
        },
      }),
      prisma.clientExtract.findMany({
        where: {
          companyId,
          status: { in: ['APPROVED', 'POSTED'] },
          OR: [{ periodEnd: { gte: asOf, lte: to } }, { periodEnd: null, createdAt: { gte: asOf, lte: to } }],
        },
        select: { netAmount: true, projectId: true },
      }),
    ]);
    const subBy = new Map<string, number>();
    for (const row of subs) {
      const id = row.subcontract.projectId;
      subBy.set(id, money((subBy.get(id) ?? 0) + money(row.netPayableAmount)));
    }
    const ownBy = new Map<string, number>();
    for (const row of owners) {
      ownBy.set(row.projectId, money((ownBy.get(row.projectId) ?? 0) + money(row.netAmount)));
    }
    const seen = new Set(projects.map((row) => row.projectId));
    const extraIds = [...subBy.keys(), ...ownBy.keys()].filter((id) => !seen.has(id));
    const extras = extraIds.length
      ? await prisma.contractingProject.findMany({
          where: { companyId, id: { in: extraIds } },
          select: { id: true, projectName: true, contractValue: true },
        })
      : [];
    return [
      ...projects.map((row) => ({
        ...row,
        subcontractorDue: subBy.get(row.projectId) ?? 0,
        ownerInflow: ownBy.get(row.projectId) ?? 0,
      })),
      ...extras.map((row) => ({
        projectId: row.id,
        projectName: row.projectName,
        contractValue: money(row.contractValue),
        estimatedCost: 0,
        actualCost: 0,
        subcontractorDue: subBy.get(row.id) ?? 0,
        ownerInflow: ownBy.get(row.id) ?? 0,
      })),
    ];
  },

  async production(companyId, from) {
    const orders = await prisma.productionOrder.findMany({
      where: {
        companyId,
        status: { in: ['RELEASED', 'IN_PROGRESS', 'COMPLETED'] },
        updatedAt: { gte: from },
      },
      select: {
        plannedQuantity: true,
        actualQuantity: true,
        bom: {
          select: {
            baseQuantity: true,
            lines: { select: { quantity: true, scrapPercentage: true } },
          },
        },
        materialIssues: { select: { lines: { select: { quantity: true } } } },
      },
    });
    let plannedQuantity = 0;
    let actualQuantity = 0;
    let standardMaterialQty = 0;
    let issuedMaterialQty = 0;
    for (const order of orders) {
      const planned = money(order.plannedQuantity);
      plannedQuantity += planned;
      actualQuantity += money(order.actualQuantity);
      const base = money(order.bom.baseQuantity) || 1;
      for (const line of order.bom.lines) {
        const scrapRaw = money(line.scrapPercentage);
        const scrapRate = scrapRaw > 1 ? scrapRaw / 100 : scrapRaw;
        const std = money(line.quantity) * (planned / base) * (1 + scrapRate);
        standardMaterialQty += std;
      }
      for (const issue of order.materialIssues) {
        for (const line of issue.lines) issuedMaterialQty += money(line.quantity);
      }
    }
    return {
      plannedQuantity: money(plannedQuantity),
      actualQuantity: money(actualQuantity),
      standardMaterialQty: money(standardMaterialQty),
      issuedMaterialQty: money(issuedMaterialQty),
    };
  },

  async realEstate(companyId, asOf) {
    const [units, installments] = await Promise.all([
      prisma.realEstateUnit.findMany({
        where: { building: { project: { companyId } } },
        select: { status: true },
      }),
      prisma.unitInstallment.findMany({
        where: {
          contract: { companyId },
          status: { notIn: ['CANCELLED', 'PAID'] },
          dueDate: { lte: asOf },
        },
        select: { status: true, dueDate: true },
      }),
    ]);
    const absorbed = units.filter((row) =>
      ['RESERVED', 'SOLD', 'DELIVERED'].includes(row.status)
    ).length;
    const overdue = installments.filter(
      (row) => row.status === 'OVERDUE' || row.dueDate.getTime() < asOf.getTime()
    ).length;
    return {
      totalUnits: units.length,
      absorbedUnits: absorbed,
      dueInstallments: installments.length,
      overdueInstallments: overdue,
    };
  },

  async latestPayroll(companyId) {
    const run = await prisma.payrollRun.findFirst({
      where: { companyId, status: { in: ['POSTED', 'PAID', 'APPROVED'] } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      select: { totalGross: true, totalNet: true, items: { select: { overtime: true } } },
    });
    if (!run) return null;
    return {
      gross: money(run.totalGross),
      net: money(run.totalNet),
      overtime: money(run.items.reduce((sum, row) => sum + money(row.overtime), 0)),
    };
  },
};
