import type { ProjectCostCategory } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { projectCostQueryService } from '../project-cost/project-cost-query.service';
import { projectExecutionPerformanceService } from '../execution/project-execution-performance.service';
import { projectProfitabilityService } from '../profitability/project-profitability.service';
import { contractTenderPricingService } from '../tender/contract-tender-pricing.service';
import { money } from '../utils/money-decimal';
import type { ProjectProfitabilitySummary } from '../profitability/project-profitability.types';

const FIN_CERT = ['FINANCE_POSTED', 'PAID'] as const;
const CATEGORY_LABELS: Record<ProjectCostCategory, string> = {
  MATERIAL: 'خامات',
  LABOR: 'عمالة',
  SUBCONTRACTOR: 'مقاول باطن',
  EQUIPMENT: 'معدات',
  DIRECT_EXPENSE: 'مصاريف مباشرة',
  PURCHASE: 'مشتريات',
  OVERHEAD: 'أعباء',
  OTHER: 'أخرى',
};

export type ReportQueryFilters = {
  projectId?: string;
  customerId?: string;
  subcontractorId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  tenderStatus?: string;
  costCategory?: ProjectCostCategory;
  sort?: 'profit_desc' | 'margin_asc' | 'loss_desc' | 'overrun_desc';
};

async function loadProjectIds(companyId: string, projectId?: string) {
  const rows = await prisma.contractingProject.findMany({
    where: {
      companyId,
      ...(projectId ? { id: projectId } : {}),
    },
    select: {
      id: true,
      projectCode: true,
      projectName: true,
      status: true,
      startDate: true,
      endDate: true,
      sourceTenderId: true,
      customer: { select: { id: true, arabicName: true } },
      clientContract: { select: { id: true, contractNumber: true } },
    },
    orderBy: { projectCode: 'asc' },
    take: projectId ? 1 : 500,
  });
  return rows;
}

async function mapProjectSummaries(
  companyId: string,
  projectIds: string[],
  includePerformance: boolean
): Promise<
  Array<{
    profit: ProjectProfitabilitySummary;
    perf: Awaited<ReturnType<typeof projectExecutionPerformanceService.getPerformanceSummary>> | null;
  }>
> {
  const out: Array<{
    profit: ProjectProfitabilitySummary;
    perf: Awaited<ReturnType<typeof projectExecutionPerformanceService.getPerformanceSummary>> | null;
  }> = [];
  const chunkSize = 6;
  for (let i = 0; i < projectIds.length; i += chunkSize) {
    const chunk = projectIds.slice(i, i + chunkSize);
    const batch = await Promise.all(
      chunk.map(async (id) => {
        const profit = await projectProfitabilityService.getProjectSummary(companyId, id);
        let perf = null;
        if (includePerformance) {
          try {
            perf = await projectExecutionPerformanceService.getPerformanceSummary(companyId, id);
          } catch {
            perf = null;
          }
        }
        return { profit, perf };
      })
    );
    out.push(...batch);
  }
  return out;
}

function n(v: number | null | undefined) {
  return roundTo4(Number(v ?? 0));
}

export class ContractingReportsService {
  async getManagementDashboard(companyId: string) {
    const projects = await loadProjectIds(companyId);
    const active = projects.filter((p) => p.status === 'ACTIVE');
    const summaries = await mapProjectSummaries(
      companyId,
      active.map((p) => p.id),
      true
    );

    let revisedContractValue = 0;
    let certifiedRevenue = 0;
    let collected = 0;
    let outstanding = 0;
    let plannedCost = 0;
    let actualCost = 0;
    let remainingCommitment = 0;
    let portfolioEac = 0;
    let forecastProfit = 0;
    let delayedProjects = 0;
    let costOverrunProjects = 0;
    let negativeMarginProjects = 0;

    for (const { profit, perf } of summaries) {
      revisedContractValue = money(revisedContractValue + profit.revenue.revisedContractValue).toNumber();
      certifiedRevenue = money(certifiedRevenue + profit.revenue.financiallyCertifiedRevenue).toNumber();
      collected = money(collected + profit.revenue.collectedRevenue).toNumber();
      outstanding = money(outstanding + profit.revenue.outstandingCertifiedReceivable).toNumber();
      plannedCost = money(plannedCost + profit.cost.plannedCost).toNumber();
      actualCost = money(actualCost + profit.cost.actualCost).toNumber();
      remainingCommitment = money(remainingCommitment + profit.cost.remainingCommitment).toNumber();
      portfolioEac = money(portfolioEac + profit.cost.estimateAtCompletion).toNumber();
      forecastProfit = money(forecastProfit + profit.cost.forecastProfit).toNumber();

      if (profit.signals.some((s) => s.code === 'COST_OVERRUN')) costOverrunProjects += 1;
      if (profit.signals.some((s) => s.code === 'NEGATIVE_MARGIN')) negativeMarginProjects += 1;
      if (perf?.health.some((h) => h.code === 'SCHEDULE_DELAY') || (perf?.evm.spi != null && perf.evm.spi < 1)) {
        delayedProjects += 1;
      }
    }

    const forecastMarginPercent =
      revisedContractValue > 0 ? roundTo4((forecastProfit / revisedContractValue) * 100) : null;

    const tenderGroups = await prisma.contractTender.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
    });
    const awarded = tenderGroups.find((g) => g.status === 'AWARDED')?._count ?? 0;
    const lost = tenderGroups.find((g) => g.status === 'LOST')?._count ?? 0;
    const submittedStatuses = ['SUBMITTED', 'UNDER_NEGOTIATION', 'READY_TO_SUBMIT'] as const;
    const submitted = tenderGroups
      .filter((g) => submittedStatuses.includes(g.status as (typeof submittedStatuses)[number]))
      .reduce((s, g) => s + g._count, 0);
    const closed = awarded + lost;
    const winRate = closed > 0 ? roundTo4((awarded / closed) * 100) : null;

    return {
      asOfDate: new Date().toISOString().slice(0, 10),
      currencyNote: 'جميع المجاميع بالعملة الأساسية للشركة (amountBase)',
      portfolio: {
        activeProjects: active.length,
        revisedContractValue: n(revisedContractValue),
        certifiedRevenue: n(certifiedRevenue),
        collected: n(collected),
        outstanding: n(outstanding),
        plannedCost: n(plannedCost),
        actualCost: n(actualCost),
        remainingCommitment: n(remainingCommitment),
        portfolioEac: n(portfolioEac),
        forecastProfit: n(forecastProfit),
        forecastMarginPercent,
        delayedProjects,
        costOverrunProjects,
        negativeMarginProjects,
      },
      tenders: {
        pipelineByStatus: tenderGroups.map((g) => ({ status: g.status, count: g._count })),
        submitted,
        awarded,
        lost,
        winRatePercent: winRate,
      },
    };
  }

  async getProjectMaster(companyId: string, filters: ReportQueryFilters) {
    const projects = await loadProjectIds(companyId, filters.projectId);
    const summaries = await mapProjectSummaries(
      companyId,
      projects.map((p) => p.id),
      true
    );

    return summaries.map(({ profit, perf }) => ({
      projectId: profit.projectId,
      projectCode: profit.projectCode,
      projectName: profit.projectName,
      clientName: projects.find((p) => p.id === profit.projectId)?.customer?.arabicName ?? '—',
      contractNumber: projects.find((p) => p.id === profit.projectId)?.clientContract?.contractNumber ?? '—',
      originalContractValue: n(profit.revenue.originalContractValue),
      approvedVo: n(profit.revenue.approvedVariationImpact),
      revisedContractValue: n(profit.revenue.revisedContractValue),
      certifiedRevenue: n(profit.revenue.financiallyCertifiedRevenue),
      collected: n(profit.revenue.collectedRevenue),
      outstanding: n(profit.revenue.outstandingCertifiedReceivable),
      plannedCost: n(profit.cost.plannedCost),
      actualCost: n(profit.cost.actualCost),
      remainingCommitment: n(profit.cost.remainingCommitment),
      eac: n(profit.cost.estimateAtCompletion),
      forecastProfit: n(profit.cost.forecastProfit),
      forecastMarginPercent: profit.cost.forecastMarginPercent,
      plannedProgressPercent: perf?.progress.plannedPercent ?? null,
      actualProgressPercent: profit.progress.progressPercent,
      cpi: perf?.evm.cpi ?? null,
      spi: perf?.evm.spi ?? null,
      forecastFinish: perf?.schedule.forecastFinish ?? null,
      health: perf?.health ?? null,
      signals: profit.signals,
    }));
  }

  async getProjectFinancialPosition(companyId: string, projectId: string) {
    const [profit, perf, forecast, commitment] = await Promise.all([
      projectProfitabilityService.getProjectSummary(companyId, projectId),
      projectExecutionPerformanceService.getPerformanceSummary(companyId, projectId),
      projectProfitabilityService.getForecastDetail(companyId, projectId),
      projectProfitabilityService.getCommitmentBreakdown(companyId, projectId),
    ]);
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      include: { customer: true, clientContract: true },
    });
    if (!project) throw new AppError(404, 'المشروع غير موجود');

    return {
      project: {
        id: project.id,
        code: project.projectCode,
        name: project.projectName,
        client: project.customer?.arabicName,
        contractNumber: project.clientContract?.contractNumber,
      },
      contract: {
        original: n(profit.revenue.originalContractValue),
        approvedVoNet: n(profit.revenue.approvedVariationImpact),
        revised: n(profit.revenue.revisedContractValue),
      },
      revenue: {
        operationalCertified: n(profit.revenue.operationalCertifiedValue),
        financialCertified: n(profit.revenue.financiallyCertifiedRevenue),
        collected: n(profit.revenue.collectedRevenue),
        outstanding: n(profit.revenue.outstandingCertifiedReceivable),
        note: 'التحصيل ≠ الإيراد المعترف به',
      },
      cost: {
        planned: n(profit.cost.plannedCost),
        actual: n(profit.cost.actualCost),
        unallocated: n(profit.cost.unallocatedActualCost),
        remainingCommitment: n(profit.cost.remainingCommitment),
        uncommittedToComplete: n(profit.cost.uncommittedCostToComplete),
        eac: n(profit.cost.estimateAtCompletion),
        forecastProfit: n(profit.cost.forecastProfit),
        forecastMarginPercent: profit.cost.forecastMarginPercent,
      },
      execution: {
        plannedProgressPercent: perf.progress.plannedPercent,
        actualProgressPercent: perf.progress.actualPercent,
        spi: perf.evm.spi,
        cpi: perf.evm.cpi,
        forecastFinish: perf.schedule.forecastFinish,
        forecastMethod: perf.schedule.forecastFinishMethod,
        health: perf.health,
      },
      forecastDetail: forecast,
      subcontractCommitments: commitment.subcontracts,
      sources: profit.sources,
    };
  }

  async getProjectProfitabilityReport(companyId: string, filters: ReportQueryFilters) {
    const rows = await this.getProjectMaster(companyId, filters);
    const mapped = rows.map((r) => ({
      projectId: r.projectId,
      projectCode: r.projectCode,
      projectName: r.projectName,
      originalContractValue: r.originalContractValue,
      revisedContractValue: r.revisedContractValue,
      plannedCost: r.plannedCost,
      actualCost: r.actualCost,
      remainingCommitment: r.remainingCommitment,
      eac: r.eac,
      forecastProfit: r.forecastProfit,
      forecastMarginPercent: r.forecastMarginPercent,
      currentCertifiedMargin: n(r.certifiedRevenue - r.actualCost),
      unallocatedCost: null as number | null,
    }));

    for (const row of mapped) {
      const s = await projectProfitabilityService.getProjectSummary(companyId, row.projectId);
      row.unallocatedCost = n(s.cost.unallocatedActualCost);
    }

    const sort = filters.sort;
    if (sort === 'profit_desc') mapped.sort((a, b) => b.forecastProfit - a.forecastProfit);
    if (sort === 'margin_asc') {
      mapped.sort(
        (a, b) => (a.forecastMarginPercent ?? 999) - (b.forecastMarginPercent ?? 999)
      );
    }
    if (sort === 'loss_desc') mapped.sort((a, b) => a.forecastProfit - b.forecastProfit);
    if (sort === 'overrun_desc') mapped.sort((a, b) => b.eac - b.plannedCost - (a.eac - a.plannedCost));

    return { items: mapped };
  }

  async getBoqProfitability(companyId: string, projectId: string) {
    const data = await projectProfitabilityService.getBoqBreakdown(companyId, projectId);
    return {
      projectId,
      items: data.items.map((row) => ({
        boqCode: row.itemCode,
        descriptionAr: row.descriptionAr,
        effectiveQuantity: row.effectiveContractQuantity,
        sellingRate: row.effectiveUnitSellingPrice,
        sellingValue: row.effectiveSellingValue,
        plannedUnitCost: row.plannedUnitCost,
        plannedTotalCost: row.plannedTotalCost,
        actualCost: row.actualCost,
        commitment: row.remainingCommitment,
        forecastRemainingCost: row.forecastRemainingCost,
        eac: row.estimateAtCompletion,
        forecastProfit: row.forecastProfit,
        forecastMarginPercent: row.forecastMarginPercent,
        progressPercent: row.progressPercent,
        signals: row.signals,
        budgetStatus: row.budgetStatus,
      })),
    };
  }

  async getBudgetVsActualCommitted(companyId: string, projectId: string) {
    const [boq, costSummary, commitment] = await Promise.all([
      projectProfitabilityService.getBoqBreakdown(companyId, projectId),
      projectCostQueryService.getProjectSummary(companyId, projectId),
      projectProfitabilityService.getCommitmentBreakdown(companyId, projectId),
    ]);

    const byCategory = Object.entries(costSummary.totals)
      .filter(([k]) => k !== 'totalActualCost' && k !== 'unallocated')
      .map(([key, actual]) => ({
        category: key as ProjectCostCategory,
        labelAr: CATEGORY_LABELS[key as ProjectCostCategory] ?? key,
        actual: n(actual as number),
        planned: null as number | null,
        remainingCommitment: null as number | null,
        eac: null as number | null,
        variance: null as number | null,
        variancePercent: null as number | null,
      }));

    return {
      projectId,
      boq: boq.items.map((row) => ({
        itemCode: row.itemCode,
        descriptionAr: row.descriptionAr,
        budgetPlanned: row.plannedTotalCost,
        actual: row.actualCost,
        remainingCommitment: row.remainingCommitment,
        forecastRemaining: row.forecastRemainingCost,
        eac: row.estimateAtCompletion,
        variance: row.plannedTotalCost != null ? n(row.actualCost - row.plannedTotalCost) : null,
      })),
      categories: byCategory,
      totals: {
        plannedCost: n(
          boq.items.reduce((s, i) => s + (i.plannedTotalCost ?? 0), 0)
        ),
        actualCost: n(costSummary.totals.totalActualCost),
        remainingCommitment: n(commitment.totals.totalRemainingCommitment),
      },
      purchaseCommitmentCapability: commitment.purchaseOrders,
    };
  }

  async getProjectCostDetail(companyId: string, filters: ReportQueryFilters & { projectId: string }) {
    const sources = await projectCostQueryService.listSources(companyId, filters.projectId, {
      costCategory: filters.costCategory,
    });
    const filtered = sources.filter((row) => {
      if (filters.dateFrom && row.transactionDate < filters.dateFrom) return false;
      if (filters.dateTo && row.transactionDate > filters.dateTo) return false;
      return true;
    });
    return {
      projectId: filters.projectId,
      datePolicy: 'transactionDate من ProjectCostAllocation',
      items: filtered.map((row) => ({
        date: row.transactionDate,
        costCategory: row.costCategory,
        categoryLabel: CATEGORY_LABELS[row.costCategory],
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        description: row.description,
        quantity: row.quantity,
        amountBase: row.amountBase,
        projectBOQItemId: row.projectBOQItemId,
        status: row.status,
      })),
    };
  }

  async getUnallocatedCost(companyId: string, projectId?: string) {
    const projects = await loadProjectIds(companyId, projectId);
    const items: Array<{
      projectId: string;
      projectCode: string;
      date: Date;
      category: ProjectCostCategory;
      sourceType: string;
      description: string | null;
      amountBase: number;
    }> = [];

    const summaries: Array<{
      projectId: string;
      projectCode: string;
      totalUnallocated: number;
      totalActual: number;
      unallocatedPercent: number | null;
    }> = [];

    for (const p of projects) {
      const sources = await projectCostQueryService.listSources(companyId, p.id);
      const unallocated = sources.filter((s) => !s.projectBOQItemId);
      const summary = await projectCostQueryService.getProjectSummary(companyId, p.id);
      for (const row of unallocated) {
        items.push({
          projectId: p.id,
          projectCode: p.projectCode,
          date: row.transactionDate,
          category: row.costCategory,
          sourceType: row.sourceType,
          description: row.description,
          amountBase: row.amountBase,
        });
      }
      summaries.push({
        projectId: p.id,
        projectCode: p.projectCode,
        totalUnallocated: n(summary.totals.unallocated),
        totalActual: n(summary.totals.totalActualCost),
        unallocatedPercent: summary.totals.totalActualCost
          ? n((summary.totals.unallocated / summary.totals.totalActualCost) * 100)
          : null,
      });
    }
    return { items, summaries };
  }

  async getCostByCategory(companyId: string, projectId?: string) {
    const projects = await loadProjectIds(companyId, projectId);
    const rows = await Promise.all(
      projects.map(async (p) => {
        const t = await projectCostQueryService.getProjectSummary(companyId, p.id);
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          projectName: p.projectName,
          categories: CATEGORIES.map((c) => ({
            category: c,
            label: CATEGORY_LABELS[c],
            amount: n(t.totals[c]),
          })),
          total: n(t.totals.totalActualCost),
          unallocated: n(t.totals.unallocated),
        };
      })
    );
    return { items: rows };
  }

  async getMaterialCost(companyId: string, filters: ReportQueryFilters & { projectId?: string }) {
    const projects = await loadProjectIds(companyId, filters.projectId);
    const items: Array<Record<string, unknown>> = [];
    for (const p of projects) {
      const sources = await projectCostQueryService.listSources(companyId, p.id, {
        costCategory: 'MATERIAL',
      });
      for (const row of sources) {
        if (filters.dateFrom && row.transactionDate < filters.dateFrom) continue;
        if (filters.dateTo && row.transactionDate > filters.dateTo) continue;
        items.push({
          projectId: p.id,
          projectCode: p.projectCode,
          date: row.transactionDate,
          boqItemId: row.projectBOQItemId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          quantity: row.quantity,
          amountBase: row.amountBase,
          description: row.description,
        });
      }
    }
    return { items, note: 'تكلفة صرف مخزني فقط — لا سعر بيع' };
  }

  async getContractValueVo(companyId: string, projectId?: string) {
    const projects = await loadProjectIds(companyId, projectId);
    const items = await Promise.all(
      projects.map(async (p) => {
        const profit = await projectProfitabilityService.getProjectSummary(companyId, p.id);
        const pending = p.clientContract
          ? await prisma.contractVariationOrder.aggregate({
              where: {
                companyId,
                clientContractId: p.clientContract.id,
                status: { not: 'APPROVED' },
              },
              _sum: { netImpact: true },
            })
          : { _sum: { netImpact: null } };
        const vos = p.clientContract
          ? await prisma.contractVariationOrder.findMany({
              where: { companyId, clientContractId: p.clientContract.id },
              select: {
                id: true,
                orderNumber: true,
                status: true,
                netImpact: true,
                increaseValue: true,
                decreaseValue: true,
                orderDate: true,
              },
              orderBy: { orderDate: 'desc' },
              take: 50,
            })
          : [];
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          originalContractValue: n(profit.revenue.originalContractValue),
          approvedVoIncrease: n(profit.revenue.approvedVariationIncrease),
          approvedVoDecrease: n(profit.revenue.approvedVariationDecrease),
          netApprovedVo: n(profit.revenue.approvedVariationImpact),
          revisedContractValue: n(profit.revenue.revisedContractValue),
          pendingVoValue: n(Number(pending._sum.netImpact ?? 0)),
          variationOrders: vos,
        };
      })
    );
    return { items };
  }

  async getOwnerCertificates(companyId: string, filters: ReportQueryFilters) {
    const invoices = await prisma.clientInvoice.findMany({
      where: {
        companyId,
        ...(filters.customerId
          ? { clientContract: { clientCustomerId: filters.customerId } }
          : {}),
        ...(filters.projectId ? { clientContract: { projectId: filters.projectId } } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              periodEndDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: {
        clientContract: {
          select: {
            contractNumber: true,
            project: { select: { id: true, projectCode: true, projectName: true } },
            client: { select: { arabicName: true } },
          },
        },
      },
      orderBy: [{ periodEndDate: 'desc' }, { sequenceNumber: 'desc' }],
      take: 500,
    });
    return {
      datePolicy: 'periodEndDate',
      items: invoices.map((inv) => ({
        id: inv.id,
        projectId: inv.clientContract.project?.id,
        projectCode: inv.clientContract.project?.projectCode,
        client: inv.clientContract.client.arabicName,
        contractNumber: inv.clientContract.contractNumber,
        certificateNumber: inv.invoiceNumber,
        periodEnd: inv.periodEndDate,
        status: inv.status,
        grossWorks: n(Number(inv.cumulativeGrossWorks)),
        netPayable: n(Number(inv.netPayableByClient)),
        collected: n(Number(inv.collectedAmount)),
        remaining: n(Number(inv.remainingSettlementAmount)),
        financePosted: FIN_CERT.includes(inv.status as (typeof FIN_CERT)[number]),
        reversed: inv.status === 'REVERSED',
      })),
    };
  }

  async getOwnerCertificateSummary(companyId: string, projectId?: string) {
    const rows = await this.getProjectMaster(companyId, { projectId });
    return {
      items: rows.map((r) => ({
        projectId: r.projectId,
        projectCode: r.projectCode,
        revisedContractValue: r.revisedContractValue,
        financialCertified: r.certifiedRevenue,
        collected: r.collected,
        outstanding: r.outstanding,
        remainingContractValue: n(r.revisedContractValue - r.certifiedRevenue),
        certifiedPercent: r.revisedContractValue
          ? n((r.certifiedRevenue / r.revisedContractValue) * 100)
          : null,
        collectionPercent: r.certifiedRevenue
          ? n((r.collected / r.certifiedRevenue) * 100)
          : null,
      })),
    };
  }

  async getCollections(companyId: string, filters: ReportQueryFilters) {
    const cashTxFilter = {
      isPosted: true,
      isCancelled: false,
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };

    const allocs = await prisma.contractingCertificateAllocation.findMany({
      where: {
        companyId,
        clientInvoiceId: { not: null },
        cashTransaction: cashTxFilter,
        ...(filters.projectId
          ? { clientInvoice: { clientContract: { projectId: filters.projectId } } }
          : {}),
      },
      include: {
        cashTransaction: { select: { date: true, voucherNumber: true, amount: true } },
        clientInvoice: {
          select: {
            invoiceNumber: true,
            clientContract: {
              select: {
                project: { select: { projectCode: true, projectName: true } },
                client: { select: { arabicName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return {
      datePolicy: 'cashTransaction.date',
      items: allocs.map((a) => ({
        date: a.cashTransaction.date,
        projectCode: a.clientInvoice?.clientContract.project?.projectCode,
        client: a.clientInvoice?.clientContract.client.arabicName,
        certificateNumber: a.clientInvoice?.invoiceNumber,
        cashVoucher: a.cashTransaction.voucherNumber,
        amountBase: n(Number(a.allocatedAmount)),
      })),
    };
  }

  async getSubcontractorPosition(companyId: string, filters: ReportQueryFilters) {
    const subs = await prisma.subcontract.findMany({
      where: {
        companyId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.subcontractorId ? { subcontractorId: filters.subcontractorId } : {}),
      },
      include: {
        subcontractor: { select: { nameAr: true } },
        project: { select: { projectCode: true, projectName: true } },
      },
      take: 200,
    });
    const items = await Promise.all(
      subs.map(async (s) => {
        const commitment = await projectProfitabilityService.getCommitmentBreakdown(companyId, s.projectId);
        const row = commitment.subcontracts.find((c) => c.subcontractId === s.id);
        const paidAgg = await prisma.contractingCertificateAllocation.aggregate({
          where: {
            companyId,
            subcontractInvoiceId: { not: null },
            subcontractInvoice: { subcontractId: s.id, status: { in: [...FIN_CERT] } },
            cashTransaction: { isPosted: true, isCancelled: false },
          },
          _sum: { allocatedAmount: true },
        });
        return {
          subcontractId: s.id,
          subcontractNumber: s.subcontractNumber,
          subcontractor: s.subcontractor.nameAr,
          projectCode: s.project.projectCode,
          originalCommitment: row?.originalCommitment ?? 0,
          approvedVo: row?.approvedVariationImpact ?? 0,
          revisedCommitment: row?.revisedCommitment ?? 0,
          recognizedWork: row?.actualRecognizedWork ?? 0,
          paid: n(Number(paidAgg._sum.allocatedAmount ?? 0)),
          remainingCommitment: row?.remainingCommitment ?? 0,
        };
      })
    );
    return { items };
  }

  async getSubcontractorCertificates(companyId: string, filters: ReportQueryFilters) {
    const invoices = await prisma.subcontractInvoice.findMany({
      where: {
        companyId,
        ...(filters.projectId ? { subcontract: { projectId: filters.projectId } } : {}),
        ...(filters.subcontractorId ? { subcontract: { subcontractorId: filters.subcontractorId } } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              periodEndDate: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: {
        subcontract: {
          select: {
            subcontractNumber: true,
            subcontractor: { select: { nameAr: true } },
            project: { select: { projectCode: true } },
          },
        },
      },
      orderBy: { periodEndDate: 'desc' },
      take: 500,
    });
    return {
      items: invoices.map((inv) => ({
        id: inv.id,
        projectCode: inv.subcontract.project.projectCode,
        subcontractor: inv.subcontract.subcontractor.nameAr,
        subcontractNumber: inv.subcontract.subcontractNumber,
        certificateNumber: inv.invoiceNumber,
        status: inv.status,
        grossWork: n(Number(inv.grossCumulativeAmount)),
        netPayable: n(Number(inv.netPayableAmount)),
        paid: n(Number(inv.paidSettlementAmount)),
        remaining: n(Number(inv.remainingSettlementAmount)),
        reversed: inv.status === 'REVERSED',
      })),
    };
  }

  async getSubcontractCommitment(companyId: string, projectId?: string) {
    return this.getSubcontractorPosition(companyId, { projectId });
  }

  async getExecutionProgress(companyId: string, projectId?: string) {
    const projects = await loadProjectIds(companyId, projectId);
    const items = await Promise.all(
      projects.map(async (p) => {
        const perf = await projectExecutionPerformanceService.getPerformanceSummary(companyId, p.id);
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          originalStart: p.startDate,
          plannedFinish: perf.schedule.currentPlannedFinish,
          forecastFinish: perf.schedule.forecastFinish,
          plannedProgressPercent: perf.progress.plannedPercent,
          actualProgressPercent: perf.progress.actualPercent,
          scheduleVariancePoints: perf.progress.scheduleVariancePoints,
          spi: perf.evm.spi,
          health: perf.health,
        };
      })
    );
    return { items };
  }

  async getActivityPerformance(companyId: string, projectId: string) {
    const rows = await projectExecutionPerformanceService.getActivityPerformance(companyId, projectId);
    return { projectId, items: rows };
  }

  async getDelayedProjects(companyId: string) {
    const progress = await this.getExecutionProgress(companyId);
    return {
      items: progress.items.filter(
        (p) =>
          p.health?.some((h) => h.code === 'SCHEDULE_DELAY') ||
          (p.spi != null && p.spi < 1) ||
          (p.actualProgressPercent != null &&
            p.plannedProgressPercent != null &&
            p.actualProgressPercent < p.plannedProgressPercent - 5)
      ),
    };
  }

  async getCostOverrun(companyId: string) {
    const master = await this.getProjectMaster(companyId, {});
    return {
      items: master.filter((m) => m.signals.some((s) => s.code === 'COST_OVERRUN' || s.code === 'NEGATIVE_MARGIN')),
    };
  }

  async getForecastCompletion(companyId: string, projectId?: string) {
    const projects = await loadProjectIds(companyId, projectId);
    const items = await Promise.all(
      projects.map(async (p) => {
        const [forecast, perf, profit] = await Promise.all([
          projectProfitabilityService.getForecastDetail(companyId, p.id),
          projectExecutionPerformanceService.getPerformanceSummary(companyId, p.id),
          projectProfitabilityService.getProjectSummary(companyId, p.id),
        ]);
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          currentProgressPercent: profit.progress.progressPercent,
          actualCost: forecast.components.actualCost,
          remainingCommitment: forecast.components.remainingCommitment,
          uncommittedForecast: forecast.components.uncommittedCostToComplete,
          eac: forecast.estimateAtCompletion,
          forecastProfit: profit.cost.forecastProfit,
          forecastMarginPercent: profit.cost.forecastMarginPercent,
          forecastFinish: perf.schedule.forecastFinish,
          forecastMethod: perf.schedule.forecastFinishMethod,
          formula: forecast.formula,
        };
      })
    );
    return { items };
  }

  async getTenderPipeline(companyId: string, filters: ReportQueryFilters) {
    const tenders = await prisma.contractTender.findMany({
      where: {
        companyId,
        ...(filters.tenderStatus ? { status: filters.tenderStatus as never } : {}),
      },
      include: {
        customer: { select: { arabicName: true } },
        award: { select: { projectId: true, quotation: { select: { grandTotal: true, expectedProfit: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const items = await Promise.all(
      tenders.map(async (t) => {
        let pricing: Awaited<ReturnType<typeof contractTenderPricingService.getSummary>> | null = null;
        try {
          pricing = await contractTenderPricingService.getSummary(companyId, t.id);
        } catch {
          pricing = null;
        }
        return {
          tenderId: t.id,
          tenderNumber: t.tenderNumber,
          customer: t.customer.arabicName,
          nameAr: t.nameAr,
          status: t.status,
          submissionDeadline: t.submissionDeadline,
          expectedDirectCost: pricing?.directCost ?? null,
          fullyLoadedCost: pricing?.expectedCost ?? null,
          quotedValue: pricing?.sellingValue ?? null,
          expectedProfit: pricing?.fullyLoadedExpectedProfit ?? null,
          expectedMarginPercent: pricing?.fullyLoadedExpectedMarginPercent ?? null,
          winningQuotation: t.award?.quotation ? n(Number(t.award.quotation.grandTotal)) : null,
          awardedProjectId: t.award?.projectId ?? null,
        };
      })
    );
    return { items };
  }

  async getTenderWinLoss(companyId: string, filters: ReportQueryFilters) {
    const where = {
      companyId,
      ...(filters.dateFrom || filters.dateTo
        ? {
            updatedAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };
    const tenders = await prisma.contractTender.findMany({
      where,
      include: { award: { include: { quotation: true } } },
    });
    const total = tenders.length;
    const awarded = tenders.filter((t) => t.status === 'AWARDED');
    const lost = tenders.filter((t) => t.status === 'LOST');
    const submitted = tenders.filter((t) =>
      ['SUBMITTED', 'UNDER_NEGOTIATION', 'READY_TO_SUBMIT', 'UNDER_STUDY', 'PRICING'].includes(t.status)
    );
    const quotedValue = awarded.reduce(
      (s, t) => s + Number(t.award?.quotation?.grandTotal ?? 0),
      0
    );
    return {
      period: { from: filters.dateFrom, to: filters.dateTo },
      totalTenders: total,
      submitted: submitted.length,
      awarded: awarded.length,
      lost: lost.length,
      awardRatePercent: awarded.length + lost.length > 0 ? n((awarded.length / (awarded.length + lost.length)) * 100) : null,
      totalQuotedValueAwarded: n(quotedValue),
      lostReasons: lost.map((t) => ({ tenderNumber: t.tenderNumber, reason: t.lostReason, competitor: t.competitorName })),
    };
  }

  async getTenderEstimateVsActual(companyId: string, projectId?: string) {
    const projects = await prisma.contractingProject.findMany({
      where: { companyId, sourceTenderId: { not: null }, ...(projectId ? { id: projectId } : {}) },
      select: { id: true, projectCode: true, sourceTenderId: true },
      take: 100,
    });
    const items = await Promise.all(
      projects.map(async (p) => {
        const tenderId = p.sourceTenderId!;
        const [pricing, profit] = await Promise.all([
          contractTenderPricingService.getSummary(companyId, tenderId),
          projectProfitabilityService.getProjectSummary(companyId, p.id),
        ]);
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          tenderEstimatedCost: n(pricing.expectedCost),
          projectPlannedCost: n(profit.cost.plannedCost),
          actualCostToDate: n(profit.cost.actualCost),
          eac: n(profit.cost.estimateAtCompletion),
          estimateVariance: n(profit.cost.plannedCost - pricing.expectedCost),
          forecastVariance: n(profit.cost.estimateAtCompletion - pricing.expectedCost),
        };
      })
    );
    return { items };
  }

  async getMarginErosion(companyId: string, projectId?: string) {
    const projects = await prisma.contractingProject.findMany({
      where: { companyId, sourceTenderId: { not: null }, ...(projectId ? { id: projectId } : {}) },
      select: { id: true, projectCode: true, sourceTenderId: true },
    });
    const items = await Promise.all(
      projects.map(async (p) => {
        const [pricing, profit, award] = await Promise.all([
          contractTenderPricingService.getSummary(companyId, p.sourceTenderId!),
          projectProfitabilityService.getProjectSummary(companyId, p.id),
          prisma.contractTenderAward.findFirst({ where: { projectId: p.id, companyId } }),
        ]);
        const awardMargin = award
          ? pricing.fullyLoadedExpectedMarginPercent
          : null;
        return {
          projectId: p.id,
          projectCode: p.projectCode,
          tenderExpectedMarginPercent: pricing.fullyLoadedExpectedMarginPercent,
          awardMarginPercent: awardMargin,
          currentForecastMarginPercent: profit.cost.forecastMarginPercent,
          marginErosionPoints:
            awardMargin != null && profit.cost.forecastMarginPercent != null
              ? n(awardMargin - profit.cost.forecastMarginPercent)
              : null,
          signals: profit.signals,
        };
      })
    );
    return { items };
  }

  async getCashVsProfit(companyId: string, projectId?: string) {
    const rows = await this.getProjectMaster(companyId, { projectId });
    return {
      disclaimerAr: 'التحصيل ≠ الإيراد — التدفق النقدي ≠ الربح',
      items: rows.map((r) => ({
        projectId: r.projectId,
        projectCode: r.projectCode,
        financiallyCertifiedRevenue: r.certifiedRevenue,
        collectedCash: r.collected,
        outstandingAr: r.outstanding,
        actualCost: r.actualCost,
        forecastProfit: r.forecastProfit,
        forecastMarginPercent: r.forecastMarginPercent,
      })),
    };
  }
}

const CATEGORIES: ProjectCostCategory[] = [
  'MATERIAL',
  'LABOR',
  'SUBCONTRACTOR',
  'EQUIPMENT',
  'DIRECT_EXPENSE',
  'PURCHASE',
  'OVERHEAD',
  'OTHER',
];

export const contractingReportsService = new ContractingReportsService();
