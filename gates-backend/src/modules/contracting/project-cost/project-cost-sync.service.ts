import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  isCashLineEligibleDirectExpenseDebit,
  isCashTransactionSettlementExcludedFromDirectExpense,
} from './project-cost-direct-expense.policy';
import { projectCostAllocationService } from './project-cost-allocation.service';

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Subcontract work cost policy (P2-1):
 * Recognized project subcontract cost = invoice line gross executed work (`totalCurrentAmount`)
 * at FINANCE_POSTED — not net payable (retention/WHT are settlement, not work cost reversal).
 */
export class ProjectCostSyncService {
  async syncSubcontractInvoiceInTx(db: Db, companyId: string, subcontractInvoiceId: string) {
    const invoice = await db.subcontractInvoice.findFirst({
      where: { id: subcontractInvoiceId, companyId },
      include: {
        items: { include: { boqItem: true } },
        subcontract: { select: { projectId: true } },
      },
    });
    if (!invoice) return;
    if (invoice.status !== 'FINANCE_POSTED' && invoice.status !== 'PAID') {
      await projectCostAllocationService.reverseBySourceInTx(
        db,
        companyId,
        'SUBCONTRACT_INVOICE_ITEM',
        invoice.id
      );
      return;
    }

    for (const item of invoice.items) {
      const ownerBoq = await projectCostAllocationService.resolveOwnerBoqBySubItemCodeInTx(
        db,
        companyId,
        invoice.subcontract.projectId,
        item.boqItem.itemCode
      );
      await projectCostAllocationService.upsertActive(db, {
        companyId,
        projectId: invoice.subcontract.projectId,
        projectBOQItemId: ownerBoq?.id ?? null,
        costCategory: 'SUBCONTRACTOR',
        sourceType: 'SUBCONTRACT_INVOICE_ITEM',
        sourceId: invoice.id,
        sourceLineId: item.id,
        amountBase: Number(item.totalCurrentAmount),
        transactionDate: invoice.periodEndDate,
        description: `مستخلص باطن ${invoice.invoiceNumber} — ${item.boqItem.itemCode}`,
        metadata: {
          subcontractBOQItemId: item.subcontractBOQItemId,
          grossCurrentAmount: Number(item.totalCurrentAmount),
        },
      });
    }
  }

  async syncPostedIssueInTx(db: Db, companyId: string, issueId: string) {
    const issue = await db.issue.findFirst({
      where: { id: issueId, companyId },
      include: { lines: true },
    });
    if (!issue) return;
    if (!issue.isPosted || issue.isCancelled) {
      await projectCostAllocationService.reverseBySourceInTx(
        db,
        companyId,
        'INVENTORY_ISSUE_LINE',
        issue.id
      );
      return;
    }

    for (const line of issue.lines) {
      if (!line.contractingProjectId) continue;
      const qty = Number(line.quantity);
      const lineTotal =
        line.total != null
          ? Number(line.total)
          : line.unitPrice != null
            ? qty * Number(line.unitPrice)
            : 0;
      if (lineTotal <= 0) continue;
      await projectCostAllocationService.upsertActive(db, {
        companyId,
        projectId: line.contractingProjectId,
        projectBOQItemId: line.projectBOQItemId,
        costCategory: 'MATERIAL',
        sourceType: 'INVENTORY_ISSUE_LINE',
        sourceId: issue.id,
        sourceLineId: line.id,
        quantity: qty,
        amountBase: lineTotal,
        transactionDate: issue.date,
        description: issue.serial ? `إذن صرف ${issue.serial}` : `إذن صرف ${issue.id.slice(0, 8)}`,
      });
    }
  }

  async syncPostedCashTransactionInTx(db: Db, companyId: string, cashTransactionId: string) {
    const tx = await db.cashTransaction.findFirst({
      where: { id: cashTransactionId, companyId },
      include: { lines: { include: { account: true } } },
    });
    if (!tx) return;
    if (!tx.isPosted || tx.isCancelled) {
      await projectCostAllocationService.reverseBySourceInTx(
        db,
        companyId,
        'CASH_TRANSACTION_LINE',
        tx.id
      );
      return;
    }

    const settlementExcluded = await isCashTransactionSettlementExcludedFromDirectExpense(db, tx);

    const eligibleLineIds = new Set<string>();
    for (const line of tx.lines) {
      if (settlementExcluded) continue;
      if (
        !isCashLineEligibleDirectExpenseDebit(line, projectCostAllocationService.isExpenseAccount(
          line.account.code,
          line.account.accountType
        ))
      ) {
        continue;
      }
      const projectId = await projectCostAllocationService.resolveProjectIdByCostCenterInTx(
        db,
        companyId,
        line.costCenterId
      );
      if (!projectId) continue;
      const amountBase = Number(line.amount) * Number(line.exchangeRate ?? 1);
      if (amountBase <= 0) continue;
      eligibleLineIds.add(line.id);
      await projectCostAllocationService.upsertActive(db, {
        companyId,
        projectId,
        costCategory: 'DIRECT_EXPENSE',
        sourceType: 'CASH_TRANSACTION_LINE',
        sourceId: tx.id,
        sourceLineId: line.id,
        amountBase,
        sourceCurrencyCode: line.currencyCode,
        exchangeRate: Number(line.exchangeRate ?? 1),
        transactionDate: tx.date,
        description: line.description ?? tx.description ?? tx.voucherNumber ?? undefined,
        metadata: { treasuryKind: tx.transactionKind },
      });
    }

    const staleActive = await db.projectCostAllocation.findMany({
      where: {
        companyId,
        sourceType: 'CASH_TRANSACTION_LINE',
        sourceId: tx.id,
        status: 'ACTIVE',
      },
      select: { id: true, sourceLineId: true },
    });
    for (const row of staleActive) {
      if (row.sourceLineId && !eligibleLineIds.has(row.sourceLineId)) {
        await db.projectCostAllocation.update({
          where: { id: row.id },
          data: { status: 'REVERSED' },
        });
      }
    }
  }

  async reverseSubcontractInvoiceInTx(db: Db, companyId: string, subcontractInvoiceId: string) {
    await projectCostAllocationService.reverseBySourceInTx(
      db,
      companyId,
      'SUBCONTRACT_INVOICE_ITEM',
      subcontractInvoiceId
    );
  }
}

export const projectCostSyncService = new ProjectCostSyncService();
