import { SubcontractInvoiceStatus } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { prismaCashFlowPorts } from '../proactive/detector-ports.prisma';
import { money } from './sentinel.math';
import type { SentinelPorts } from './sentinel.ports';

const PENDING_SUB_STATUSES: SubcontractInvoiceStatus[] = [
  SubcontractInvoiceStatus.SITE_SUBMITTED,
  SubcontractInvoiceStatus.CONSULTANT_APPROVED,
  SubcontractInvoiceStatus.TECH_OFFICE_APPROVED,
  SubcontractInvoiceStatus.FINANCE_POSTED,
];

const OWNER_APPROVED = ['APPROVED', 'POSTED'];

export const prismaSentinelPorts: SentinelPorts = {
  async listInvoices(companyId, from, to) {
    const rows = await prisma.invoice.findMany({
      where: { companyId, createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        invoiceNumber: true,
        createdBy: true,
        date: true,
        createdAt: true,
        isCancelled: true,
        netAmount: true,
      },
    });
    return rows.map((row) => ({
      ...row,
      netAmount: money(row.netAmount),
    }));
  },

  async listUsers(companyId, ids) {
    if (!ids.length) return [];
    return prisma.user.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, username: true },
    });
  },

  async listShortageWriteoffs(companyId, from) {
    const [stockLines, adjLines] = await Promise.all([
      prisma.stocktakingLine.findMany({
        where: {
          shortageQuantity: { gt: 0 },
          stocktaking: { companyId, isCancelled: false, date: { gte: from } },
        },
        select: {
          itemId: true,
          shortageQuantity: true,
          item: { select: { arabicName: true, serial: true } },
        },
      }),
      prisma.adjustmentLine.findMany({
        where: {
          adjustmentQuantity: { lt: 0 },
          adjustment: { companyId, isCancelled: false, date: { gte: from } },
        },
        select: {
          itemId: true,
          adjustmentQuantity: true,
          item: { select: { arabicName: true, serial: true } },
        },
      }),
    ]);

    return [
      ...stockLines.map((row) => ({
        itemId: row.itemId,
        itemName: row.item.arabicName,
        itemCode: row.item.serial,
        shortageQty: money(row.shortageQuantity),
      })),
      ...adjLines.map((row) => ({
        itemId: row.itemId,
        itemName: row.item.arabicName,
        itemCode: row.item.serial,
        shortageQty: money(Math.abs(Number(row.adjustmentQuantity))),
      })),
    ];
  },

  async listRecentSaleLines(companyId, from) {
    const rows = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceKind: 'SALE',
          isCancelled: false,
          date: { gte: from },
        },
      },
      select: {
        invoiceId: true,
        itemId: true,
        price: true,
        invoice: { select: { invoiceNumber: true } },
        item: { select: { arabicName: true, averageCost: true, lastPurchasePrice: true } },
      },
    });
    return rows.map((row) => ({
      invoiceId: row.invoiceId,
      invoiceNumber: row.invoice.invoiceNumber,
      itemId: row.itemId,
      itemName: row.item.arabicName,
      salePrice: money(row.price),
      averageCost: money(row.item.averageCost),
      lastPurchasePrice: money(row.item.lastPurchasePrice),
    }));
  },

  async listLatestPurchasePrices(companyId, itemIds) {
    if (!itemIds.length) return [];
    const rows = await prisma.invoiceLine.findMany({
      where: {
        itemId: { in: itemIds },
        invoice: {
          companyId,
          invoiceKind: 'PURCHASE',
          isCancelled: false,
          isPosted: true,
        },
      },
      select: {
        itemId: true,
        price: true,
        invoice: { select: { date: true } },
      },
      orderBy: { invoice: { date: 'desc' } },
    });
    return rows.map((row) => ({
      itemId: row.itemId,
      unitPrice: money(row.price),
      date: row.invoice.date,
    }));
  },

  async listPendingSubcontractorCertificates(companyId, to) {
    const rows = await prisma.subcontractInvoice.findMany({
      where: {
        companyId,
        status: { in: PENDING_SUB_STATUSES },
        periodEndDate: { lte: to },
      },
      select: {
        id: true,
        netPayableAmount: true,
        periodEndDate: true,
        subcontract: {
          select: {
            projectId: true,
            project: { select: { projectName: true, projectCode: true } },
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      projectId: row.subcontract.projectId,
      projectName: row.subcontract.project.projectName,
      projectCode: row.subcontract.project.projectCode,
      netPayable: money(row.netPayableAmount),
      periodEndDate: row.periodEndDate,
    }));
  },

  async listApprovedOwnerCertificates(companyId, from, to) {
    const rows = await prisma.clientExtract.findMany({
      where: {
        companyId,
        status: { in: OWNER_APPROVED },
        OR: [{ periodEnd: { gte: from, lte: to } }, { periodEnd: null, createdAt: { gte: from, lte: to } }],
      },
      select: {
        id: true,
        netAmount: true,
        projectId: true,
        project: { select: { projectName: true, projectCode: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.projectName,
      projectCode: row.project.projectCode,
      netAmount: money(row.netAmount),
    }));
  },

  liquidCash: prismaCashFlowPorts.liquidCash,
};
