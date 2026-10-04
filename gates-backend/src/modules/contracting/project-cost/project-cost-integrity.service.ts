import type {
  ProjectCostAllocation,
  ProjectCostCategory,
  ProjectCostSourceType,
} from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { projectCostAllocationService } from './project-cost-allocation.service';
import {
  isCashLineEligibleDirectExpenseDebit,
  isCashTransactionSettlementExcludedFromDirectExpense,
} from './project-cost-direct-expense.policy';
import { buildProjectCostAllocationKey } from './project-cost-allocation.util';

export type ProjectCostIntegrityStatus =
  | 'MATCH'
  | 'DUPLICATE_SOURCE'
  | 'OVER_ALLOCATED'
  | 'INVALID_SOURCE_STATE'
  | 'SOURCE_AMOUNT_MISMATCH'
  | 'MISSING_REVERSAL'
  | 'CURRENCY_MISMATCH'
  | 'ORPHAN_ALLOCATION'
  | 'CROSS_COMPANY_ALLOCATION'
  | 'DOUBLE_RECOGNITION';

export type ProjectCostIntegrityRow = {
  status: ProjectCostIntegrityStatus;
  allocationId: string;
  projectId: string;
  projectBOQItemId: string | null;
  costCategory: ProjectCostCategory;
  sourceType: ProjectCostSourceType;
  sourceId: string;
  sourceLineId: string | null;
  expectedAmountBase: number | null;
  actualAmountBase: number;
  expectedSourceState: string | null;
  actualSourceState: string | null;
  reason: string;
};

export type ProjectCostIntegrityReport = {
  projectId: string;
  rows: ProjectCostIntegrityRow[];
  matchCount: number;
  issueCount: number;
};

const TOL = 0.02;

function close(a: number, b: number) {
  return Math.abs(a - b) <= TOL;
}

function sourceFingerprint(row: Pick<ProjectCostAllocation, 'sourceType' | 'sourceId' | 'sourceLineId' | 'projectBOQItemId' | 'costCategory'>) {
  return [
    row.sourceType,
    row.sourceId,
    row.sourceLineId ?? '',
    row.projectBOQItemId ?? '',
    row.costCategory,
  ].join('|');
}

export class ProjectCostIntegrityService {
  async reconcileProject(companyId: string, projectId: string): Promise<ProjectCostIntegrityReport> {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, companyId: true },
    });
    if (!project) {
      return { projectId, rows: [], matchCount: 0, issueCount: 0 };
    }

    const allocations = await prisma.projectCostAllocation.findMany({
      where: { projectId },
      orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
    });

    const rows: ProjectCostIntegrityRow[] = [];
    const activeByFingerprint = new Map<string, ProjectCostAllocation[]>();

    for (const alloc of allocations) {
      if (alloc.status === 'ACTIVE') {
        const fp = sourceFingerprint(alloc);
        const bucket = activeByFingerprint.get(fp) ?? [];
        bucket.push(alloc);
        activeByFingerprint.set(fp, bucket);
      }
    }

    for (const alloc of allocations) {
      const baseRow = {
        allocationId: alloc.id,
        projectId: alloc.projectId,
        projectBOQItemId: alloc.projectBOQItemId,
        costCategory: alloc.costCategory,
        sourceType: alloc.sourceType,
        sourceId: alloc.sourceId,
        sourceLineId: alloc.sourceLineId,
        actualAmountBase: Number(alloc.amountBase),
        expectedAmountBase: null as number | null,
        expectedSourceState: null as string | null,
        actualSourceState: null as string | null,
        reason: '',
        status: 'MATCH' as ProjectCostIntegrityStatus,
      };

      if (alloc.companyId !== project.companyId) {
        rows.push({
          ...baseRow,
          status: 'CROSS_COMPANY_ALLOCATION',
          reason: 'Allocation companyId does not match project company',
        });
        continue;
      }

      const expectedKey = buildProjectCostAllocationKey({
        sourceType: alloc.sourceType,
        sourceId: alloc.sourceId,
        sourceLineId: alloc.sourceLineId,
        projectBOQItemId: alloc.projectBOQItemId,
      });
      if (alloc.allocationKey !== expectedKey) {
        rows.push({
          ...baseRow,
          status: 'ORPHAN_ALLOCATION',
          reason: `allocationKey mismatch (stored=${alloc.allocationKey})`,
        });
        continue;
      }

      if (alloc.status === 'ACTIVE') {
        const dupes = activeByFingerprint.get(sourceFingerprint(alloc)) ?? [];
        if (dupes.length > 1) {
          rows.push({
            ...baseRow,
            status: 'DUPLICATE_SOURCE',
            reason: `${dupes.length} ACTIVE rows share the same operational source fingerprint`,
          });
          continue;
        }
      }

      const sourceCheck = await this.inspectSource(companyId, alloc);
      baseRow.expectedAmountBase = sourceCheck.expectedAmountBase;
      baseRow.expectedSourceState = sourceCheck.expectedSourceState;
      baseRow.actualSourceState = sourceCheck.actualSourceState;

      if (sourceCheck.orphan) {
        rows.push({
          ...baseRow,
          status: 'ORPHAN_ALLOCATION',
          reason: sourceCheck.reason ?? 'Source document or line not found',
        });
        continue;
      }

      if (alloc.status === 'ACTIVE' && !sourceCheck.sourceEconomicallyActive) {
        rows.push({
          ...baseRow,
          status: sourceCheck.reversedSource ? 'MISSING_REVERSAL' : 'INVALID_SOURCE_STATE',
          reason: sourceCheck.reason ?? 'Source is not economically active',
        });
        continue;
      }

      if (alloc.status === 'REVERSED' && sourceCheck.sourceEconomicallyActive) {
        rows.push({
          ...baseRow,
          status: 'MISSING_REVERSAL',
          reason: 'Allocation reversed while source is still economically active',
        });
        continue;
      }

      if (
        sourceCheck.expectedAmountBase != null &&
        alloc.status === 'ACTIVE' &&
        !close(Number(alloc.amountBase), sourceCheck.expectedAmountBase)
      ) {
        if (Number(alloc.amountBase) > sourceCheck.expectedAmountBase + TOL) {
          rows.push({
            ...baseRow,
            status: 'OVER_ALLOCATED',
            reason: `Allocated ${alloc.amountBase} exceeds eligible source ${sourceCheck.expectedAmountBase}`,
          });
          continue;
        }
        rows.push({
          ...baseRow,
          status: 'SOURCE_AMOUNT_MISMATCH',
          reason: `Expected ${sourceCheck.expectedAmountBase}, allocation ${alloc.amountBase}`,
        });
        continue;
      }

      if (
        sourceCheck.expectedCurrency &&
        alloc.sourceCurrencyCode &&
        alloc.sourceCurrencyCode !== sourceCheck.expectedCurrency
      ) {
        rows.push({
          ...baseRow,
          status: 'CURRENCY_MISMATCH',
          reason: `Allocation currency ${alloc.sourceCurrencyCode} vs source ${sourceCheck.expectedCurrency}`,
        });
        continue;
      }

      rows.push({
        ...baseRow,
        status: 'MATCH',
        reason: 'Allocation matches canonical source',
      });
    }

    const doubleRows = await this.detectDoubleRecognition(companyId, projectId, allocations);
    rows.push(...doubleRows);

    const matchCount = rows.filter((r) => r.status === 'MATCH').length;
    return {
      projectId,
      rows,
      matchCount,
      issueCount: rows.length - matchCount,
    };
  }

  private async inspectSource(companyId: string, alloc: ProjectCostAllocation) {
    switch (alloc.sourceType) {
      case 'INVENTORY_ISSUE_LINE':
        return this.inspectIssueLine(companyId, alloc);
      case 'SUBCONTRACT_INVOICE_ITEM':
        return this.inspectSubcontractItem(companyId, alloc);
      case 'CASH_TRANSACTION_LINE':
        return this.inspectCashLine(companyId, alloc);
      case 'MANUAL_COST_SPLIT':
        return this.inspectManualSplit(alloc);
      default:
        return {
          orphan: false,
          sourceEconomicallyActive: alloc.status === 'ACTIVE',
          reversedSource: alloc.status === 'REVERSED',
          expectedAmountBase: Number(alloc.amountBase),
          expectedSourceState: 'UNSUPPORTED_SOURCE',
          actualSourceState: alloc.status,
          expectedCurrency: alloc.sourceCurrencyCode,
          reason: null as string | null,
        };
    }
  }

  private async inspectIssueLine(companyId: string, alloc: ProjectCostAllocation) {
    const issue = await prisma.issue.findFirst({
      where: { id: alloc.sourceId, companyId },
      include: { lines: true },
    });
    if (!issue) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: 'MISSING',
        actualSourceState: 'MISSING',
        expectedCurrency: null,
        reason: 'Issue not found',
      };
    }
    const line = issue.lines.find((l) => l.id === alloc.sourceLineId);
    if (!line) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: issue.isPosted ? 'POSTED' : 'DRAFT',
        actualSourceState: 'LINE_MISSING',
        expectedCurrency: null,
        reason: 'Issue line not found',
      };
    }
    const qty = Number(line.quantity);
    const expected =
      line.total != null
        ? Number(line.total)
        : line.unitPrice != null
          ? qty * Number(line.unitPrice)
          : 0;
    const active = issue.isPosted && !issue.isCancelled && Boolean(line.contractingProjectId);
    return {
      orphan: false,
      sourceEconomicallyActive: active,
      reversedSource: !active,
      expectedAmountBase: expected,
      expectedSourceState: issue.isCancelled ? 'CANCELLED' : issue.isPosted ? 'POSTED' : 'DRAFT',
      actualSourceState: issue.isCancelled ? 'CANCELLED' : issue.isPosted ? 'POSTED' : 'DRAFT',
      expectedCurrency: null,
      reason: !line.contractingProjectId ? 'Issue line not tagged to a project' : null,
    };
  }

  private async inspectSubcontractItem(companyId: string, alloc: ProjectCostAllocation) {
    const invoice = await prisma.subcontractInvoice.findFirst({
      where: { id: alloc.sourceId, companyId },
      include: { items: true, subcontract: { select: { projectId: true } } },
    });
    if (!invoice) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: 'MISSING',
        actualSourceState: 'MISSING',
        expectedCurrency: null,
        reason: 'Subcontract invoice not found',
      };
    }
    const item = invoice.items.find((i) => i.id === alloc.sourceLineId);
    if (!item) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: invoice.status,
        actualSourceState: 'LINE_MISSING',
        expectedCurrency: null,
        reason: 'Invoice line not found',
      };
    }
    const active = invoice.status === 'FINANCE_POSTED' || invoice.status === 'PAID';
    return {
      orphan: false,
      sourceEconomicallyActive: active,
      reversedSource: invoice.status === 'REVERSED' || invoice.status === 'CANCELLED',
      expectedAmountBase: Number(item.totalCurrentAmount),
      expectedSourceState: active ? 'FINANCE_ACTIVE' : invoice.status,
      actualSourceState: invoice.status,
      expectedCurrency: null,
      reason:
        invoice.subcontract.projectId !== alloc.projectId
          ? 'Invoice project differs from allocation project'
          : null,
    };
  }

  private async inspectCashLine(companyId: string, alloc: ProjectCostAllocation) {
    const tx = await prisma.cashTransaction.findFirst({
      where: { id: alloc.sourceId, companyId },
      include: { lines: { include: { account: true } } },
    });
    if (!tx) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: 'MISSING',
        actualSourceState: 'MISSING',
        expectedCurrency: null,
        reason: 'Cash transaction not found',
      };
    }
    const line = tx.lines.find((l) => l.id === alloc.sourceLineId);
    if (!line) {
      return {
        orphan: true,
        sourceEconomicallyActive: false,
        reversedSource: true,
        expectedAmountBase: null,
        expectedSourceState: tx.isPosted ? 'POSTED' : 'DRAFT',
        actualSourceState: 'LINE_MISSING',
        expectedCurrency: null,
        reason: 'Cash line not found',
      };
    }

    const settlementExcluded = await isCashTransactionSettlementExcludedFromDirectExpense(prisma, tx);
    const expenseOk = isCashLineEligibleDirectExpenseDebit(
      line,
      projectCostAllocationService.isExpenseAccount(line.account.code, line.account.accountType)
    );
    const projectId = await projectCostAllocationService.resolveProjectIdByCostCenterInTx(
      prisma,
      companyId,
      line.costCenterId
    );
    const eligible =
      tx.isPosted &&
      !tx.isCancelled &&
      !settlementExcluded &&
      expenseOk &&
      projectId === alloc.projectId;
    const expectedBase = Number(line.amount) * Number(line.exchangeRate ?? 1);

    return {
      orphan: false,
      sourceEconomicallyActive: eligible,
      reversedSource: !tx.isPosted || tx.isCancelled || settlementExcluded,
      expectedAmountBase: eligible ? expectedBase : 0,
      expectedSourceState: tx.isCancelled ? 'CANCELLED' : tx.isPosted ? 'POSTED' : 'DRAFT',
      actualSourceState: tx.isCancelled ? 'CANCELLED' : tx.isPosted ? 'POSTED' : 'DRAFT',
      expectedCurrency: line.currencyCode ?? tx.currencyCode,
      reason: settlementExcluded
        ? 'Treasury settlement payment (excluded from DIRECT_EXPENSE)'
        : !expenseOk
          ? 'Line is not an eligible expense debit'
          : projectId !== alloc.projectId
            ? 'Cost center does not map to allocation project'
            : null,
    };
  }

  private inspectManualSplit(alloc: ProjectCostAllocation) {
    const meta = alloc.metadata as { eligibleAmount?: number } | null;
    const eligible = meta?.eligibleAmount != null ? Number(meta.eligibleAmount) : null;
    return {
      orphan: false,
      sourceEconomicallyActive: alloc.status === 'ACTIVE',
      reversedSource: alloc.status === 'REVERSED',
      expectedAmountBase: eligible ?? Number(alloc.amountBase),
      expectedSourceState: 'MANUAL',
      actualSourceState: alloc.status,
      expectedCurrency: alloc.sourceCurrencyCode,
      reason: null as string | null,
    };
  }

  private async detectDoubleRecognition(
    companyId: string,
    projectId: string,
    allocations: ProjectCostAllocation[]
  ): Promise<ProjectCostIntegrityRow[]> {
    const rows: ProjectCostIntegrityRow[] = [];
    const subItems = allocations.filter(
      (a) => a.status === 'ACTIVE' && a.sourceType === 'SUBCONTRACT_INVOICE_ITEM'
    );
    for (const sub of subItems) {
      const certPay = await prisma.contractingCertificateAllocation.findFirst({
        where: {
          companyId,
          subcontractInvoiceId: sub.sourceId,
          cashTransaction: { isPosted: true, isCancelled: false },
        },
        include: { cashTransaction: true },
      });
      if (!certPay) continue;
      const dupExpense = allocations.find(
        (a) =>
          a.status === 'ACTIVE' &&
          a.costCategory === 'DIRECT_EXPENSE' &&
          a.sourceType === 'CASH_TRANSACTION_LINE' &&
          a.sourceId === certPay.cashTransactionId
      );
      if (dupExpense) {
        rows.push({
          status: 'DOUBLE_RECOGNITION',
          allocationId: dupExpense.id,
          projectId,
          projectBOQItemId: dupExpense.projectBOQItemId,
          costCategory: dupExpense.costCategory,
          sourceType: dupExpense.sourceType,
          sourceId: dupExpense.sourceId,
          sourceLineId: dupExpense.sourceLineId,
          expectedAmountBase: 0,
          actualAmountBase: Number(dupExpense.amountBase),
          expectedSourceState: 'SETTLEMENT_EXCLUDED',
          actualSourceState: 'ACTIVE',
          reason: `Subcontract invoice ${sub.sourceId} cost already recognized; treasury payment must not add DIRECT_EXPENSE`,
        });
      }
    }
    return rows;
  }
}

export const projectCostIntegrityService = new ProjectCostIntegrityService();
