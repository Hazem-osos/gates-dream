import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { ContractingProjectNotFoundError } from '../cost-control/errors/cost-control-domain.errors';
import { projectCostQueryService } from '../project-cost/project-cost-query.service';
import { rateAnalysisCalculationService } from '../technical-office/services/rate-analysis-calculation.service';
import { money, rate, sumMoney } from '../utils/money-decimal';
import {
  loadApprovedOwnerVariationLinesInTx,
  loadApprovedSubcontractVariationLinesInTx,
  resolveEffectiveOwnerBoqQuantityFromBase,
  resolveEffectiveOwnerBoqRateFromLines,
  resolveEffectiveSubcontractBoqQuantityFromBase,
  resolveEffectiveSubcontractBoqRateFromLines,
} from '../variation/contract-variation-effective.service';
import type {
  BoqProfitabilityRow,
  ProjectBudgetStatus,
  ProjectCommitmentBreakdown,
  ProjectForecastDetail,
  ProjectForecastMethodCode,
  ProjectProfitabilitySignalCode,
  ProjectProfitabilitySummary,
  PurchaseCommitmentCapability,
  SubcontractCommitmentRow,
} from './project-profitability.types';

const FINANCIAL_CERT_STATUSES = ['FINANCE_POSTED', 'PAID'] as const;
const MARGIN_EROSION_THRESHOLD = 0.05;
const HIGH_UNALLOCATED_RATIO = 0.15;

type BoqCtx = Prisma.ProjectBOQItemGetPayload<{ include: { rateAnalysisItems: true } }>;

export class ProjectProfitabilityService {
  async getProjectSummary(companyId: string, projectId: string): Promise<ProjectProfitabilitySummary> {
    const bundle = await this.loadBundle(companyId, projectId);
    const boqRows = await this.buildBoqRows(bundle);
    const commitment = await this.buildCommitmentBreakdown(bundle, boqRows);
    const revenue = this.buildRevenueMetrics(bundle);
    const cost = this.buildProjectCostMetrics(bundle, boqRows, commitment);
    const progress = this.buildProgressMetrics(boqRows);
    const signals = this.buildProjectSignals(revenue, cost, boqRows);
    return {
      companyId,
      projectId,
      projectCode: bundle.project.projectCode,
      projectName: bundle.project.projectName,
      revenue,
      cost,
      progress,
      purchaseCommitment: commitment.purchaseOrders,
      signals,
      sources: this.sourceLegend(),
    };
  }

  async getBoqBreakdown(companyId: string, projectId: string) {
    const bundle = await this.loadBundle(companyId, projectId);
    const rows = await this.buildBoqRows(bundle);
    return { projectId, companyId, items: rows };
  }

  async getCommitmentBreakdown(companyId: string, projectId: string): Promise<ProjectCommitmentBreakdown> {
    const bundle = await this.loadBundle(companyId, projectId);
    const boqRows = await this.buildBoqRows(bundle);
    return this.buildCommitmentBreakdown(bundle, boqRows);
  }

  async getForecastDetail(companyId: string, projectId: string): Promise<ProjectForecastDetail> {
    const summary = await this.getProjectSummary(companyId, projectId);
    const boq = await this.getBoqBreakdown(companyId, projectId);
    return {
      projectId,
      formula: 'EAC = Actual Cost + Remaining Commitment + Uncommitted Cost To Complete',
      estimateAtCompletion: summary.cost.estimateAtCompletion,
      components: {
        actualCost: summary.cost.actualCost,
        remainingCommitment: summary.cost.remainingCommitment,
        uncommittedCostToComplete: summary.cost.uncommittedCostToComplete,
      },
      boq: boq.items.map((row) => ({
        projectBOQItemId: row.projectBOQItemId,
        itemCode: row.itemCode,
        forecastRemainingCost: row.forecastRemainingCost,
        forecastMethod: row.forecastMethod,
      })),
      unallocatedActualCost: summary.cost.unallocatedActualCost,
    };
  }

  async getBoqDrilldown(companyId: string, projectId: string, projectBOQItemId: string) {
    const [boq, sources, overrides] = await Promise.all([
      this.getBoqBreakdown(companyId, projectId),
      projectCostQueryService.listSources(companyId, projectId, { projectBOQItemId }),
      prisma.projectBoqForecastOverride.findMany({
        where: { companyId, projectId, projectBOQItemId },
        orderBy: { effectiveFrom: 'desc' },
        take: 20,
      }),
    ]);
    const row = boq.items.find((i) => i.projectBOQItemId === projectBOQItemId);
    if (!row) return null;
    const commitment = await this.getCommitmentBreakdown(companyId, projectId);
    return {
      profitability: row,
      actualCostSources: sources,
      forecastOverrides: overrides.map((o) => ({
        id: o.id,
        forecastRemainingCost: Number(o.forecastRemainingCost),
        reason: o.reason,
        effectiveFrom: o.effectiveFrom,
        createdBy: o.createdBy,
        createdAt: o.createdAt,
      })),
      subcontractCommitments: commitment.subcontracts,
    };
  }

  private sourceLegend(): Record<string, string> {
    return {
      originalContractValue: 'ClientContract.totalContractValue',
      approvedVariationImpact: 'ContractVariationOrder.netImpact (APPROVED only)',
      revisedContractValue: 'original + approved VO net',
      operationalCertifiedValue: 'OwnerPreliminaryCertificateLine cumulative (APPROVED)',
      financiallyCertifiedRevenue: 'ClientInvoice.cumulativeGrossWorks (latest FINANCE_POSTED/PAID)',
      collectedRevenue: 'ClientInvoice.collectedAmount (non-REVERSED posted)',
      outstandingCertifiedReceivable: 'ClientInvoice.remainingSettlementAmount',
      plannedCost: 'BOQ rate analysis direct unit × effective qty (or directCostEstimated)',
      actualCost: 'ProjectCostQueryService (P2-1 ProjectCostAllocation ACTIVE)',
      remainingCommitment: 'Subcontract effective BOQ value − P2-1 subcontract actual (+ PO at project level)',
      uncommittedCostToComplete: 'Σ BOQ forecast remaining (PLANNED_REMAINING or MANUAL_FORECAST)',
      estimateAtCompletion: 'actual + remainingCommitment + uncommittedCostToComplete',
    };
  }

  private async loadBundle(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      include: {
        clientContract: true,
        costCenter: true,
      },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const [
      boqItems,
      ownerVoLines,
      actualSummary,
      approvedVoOrders,
      approvedPrelimLines,
      financialInvoices,
      subcontracts,
      overrides,
    ] = await Promise.all([
      prisma.projectBOQItem.findMany({
        where: { companyId, projectId },
        include: { rateAnalysisItems: true },
        orderBy: { itemCode: 'asc' },
      }),
      project.clientContract
        ? loadApprovedOwnerVariationLinesInTx(prisma, companyId, project.clientContract.id)
        : Promise.resolve([]),
      projectCostQueryService.getProjectSummary(companyId, projectId),
      project.clientContract
        ? prisma.contractVariationOrder.findMany({
            where: { companyId, clientContractId: project.clientContract.id, status: 'APPROVED' },
            select: { netImpact: true, increaseValue: true, decreaseValue: true },
          })
        : Promise.resolve([]),
      prisma.ownerPreliminaryCertificateLine.findMany({
        where: {
          companyId,
          ownerPreliminaryCertificate: { projectId, status: 'APPROVED' },
        },
        select: {
          projectBOQItemId: true,
          cumulativeApprovedQuantity: true,
          cumulativeAmount: true,
          unitRateSnapshot: true,
        },
      }),
      project.clientContract
        ? prisma.clientInvoice.findMany({
            where: {
              companyId,
              clientContractId: project.clientContract.id,
              status: { in: [...FINANCIAL_CERT_STATUSES] },
            },
            orderBy: { sequenceNumber: 'desc' },
          })
        : Promise.resolve([]),
      prisma.subcontract.findMany({
        where: { companyId, projectId, status: 'ACTIVE' },
        include: { boqItems: true },
      }),
      prisma.projectBoqForecastOverride.findMany({
        where: { companyId, projectId },
        orderBy: { effectiveFrom: 'desc' },
      }),
    ]);

    const subVoLinesBySub = new Map<string, Awaited<ReturnType<typeof loadApprovedSubcontractVariationLinesInTx>>>();
    for (const sub of subcontracts) {
      subVoLinesBySub.set(
        sub.id,
        await loadApprovedSubcontractVariationLinesInTx(prisma, companyId, sub.id)
      );
    }

    return {
      project,
      boqItems,
      ownerVoLines,
      actualSummary,
      approvedVoOrders,
      approvedPrelimLines,
      financialInvoices,
      subcontracts,
      subVoLinesBySub,
      overrides,
    };
  }

  private buildRevenueMetrics(bundle: Awaited<ReturnType<typeof this.loadBundle>>) {
    const contract = bundle.project.clientContract;
    const originalContractValue = Number(contract?.totalContractValue ?? bundle.project.contractValue);
    const approvedVariationIncrease = sumMoney(
      bundle.approvedVoOrders.map((o) => money(o.increaseValue))
    ).toNumber();
    const approvedVariationDecrease = sumMoney(
      bundle.approvedVoOrders.map((o) => money(o.decreaseValue))
    ).toNumber();
    const approvedVariationImpact = sumMoney(
      bundle.approvedVoOrders.map((o) => money(o.netImpact))
    ).toNumber();
    const revisedContractValue = money(originalContractValue + approvedVariationImpact).toNumber();

    const certifiedByBoq = new Map<string, { qty: number; amount: number }>();
    for (const line of bundle.approvedPrelimLines) {
      const prev = certifiedByBoq.get(line.projectBOQItemId) ?? { qty: 0, amount: 0 };
      const qty = Math.max(prev.qty, Number(line.cumulativeApprovedQuantity));
      const amount = Math.max(prev.amount, Number(line.cumulativeAmount));
      certifiedByBoq.set(line.projectBOQItemId, { qty, amount });
    }
    let operationalCertifiedValue = 0;
    for (const boq of bundle.boqItems) {
      const cert = certifiedByBoq.get(boq.id);
      if (cert) operationalCertifiedValue = money(operationalCertifiedValue + cert.amount).toNumber();
    }

    const latestFinancial = bundle.financialInvoices[0];
    const financiallyCertifiedRevenue = latestFinancial
      ? Number(latestFinancial.cumulativeGrossWorks)
      : 0;
    const collectedRevenue = bundle.financialInvoices
      .filter((inv) => inv.status !== 'REVERSED')
      .reduce((s, inv) => money(s + Number(inv.collectedAmount)).toNumber(), 0);
    const outstandingCertifiedReceivable = bundle.financialInvoices
      .filter((inv) => inv.status !== 'REVERSED')
      .reduce((s, inv) => money(s + Number(inv.remainingSettlementAmount)).toNumber(), 0);

    return {
      originalContractValue,
      approvedVariationImpact,
      approvedVariationIncrease,
      approvedVariationDecrease,
      revisedContractValue,
      operationalCertifiedValue,
      financiallyCertifiedRevenue,
      collectedRevenue,
      outstandingCertifiedReceivable,
    };
  }

  private resolvePlannedUnit(boq: BoqCtx): { plannedUnitCost: number | null; budgetStatus: ProjectBudgetStatus } {
    if (boq.rateAnalysisItems.length) {
      const direct = rateAnalysisCalculationService.calculateDirectUnitCost(boq.id, boq.rateAnalysisItems);
      return { plannedUnitCost: Number(direct.totalDirectCost), budgetStatus: 'RATE_ANALYSIS' };
    }
    if (Number(boq.directCostEstimated) > 0) {
      return { plannedUnitCost: Number(boq.directCostEstimated), budgetStatus: 'ESTIMATED_DIRECT' };
    }
    return { plannedUnitCost: null, budgetStatus: 'MISSING_BUDGET' };
  }

  private latestOverride(
    overrides: Awaited<ReturnType<typeof this.loadBundle>>['overrides'],
    projectBOQItemId: string | null
  ) {
    return overrides.find((o) =>
      projectBOQItemId ? o.projectBOQItemId === projectBOQItemId : o.projectBOQItemId == null
    );
  }

  private async buildBoqRows(bundle: Awaited<ReturnType<typeof this.loadBundle>>): Promise<BoqProfitabilityRow[]> {
    const actualBoq = await projectCostQueryService.getBoqBreakdown(bundle.project.companyId, bundle.project.id);
    const actualByBoq = new Map(actualBoq.items.map((i) => [i.projectBOQItemId, i.totals.totalActualCost]));

    const certifiedQtyByBoq = new Map<string, number>();
    for (const line of bundle.approvedPrelimLines) {
      const prev = certifiedQtyByBoq.get(line.projectBOQItemId) ?? 0;
      certifiedQtyByBoq.set(
        line.projectBOQItemId,
        Math.max(prev, Number(line.cumulativeApprovedQuantity))
      );
    }

    const subCommitByOwnerItemCode = new Map<string, number>();
    for (const sub of bundle.subcontracts) {
      const voLines = bundle.subVoLinesBySub.get(sub.id) ?? [];
      for (const line of sub.boqItems) {
        const effQty = resolveEffectiveSubcontractBoqQuantityFromBase(
          line.contractQuantity,
          voLines,
          line.id
        );
        const effRate = resolveEffectiveSubcontractBoqRateFromLines(
          line.unitPrice,
          voLines,
          line.id
        );
        const value = Number(effQty.mul(effRate));
        subCommitByOwnerItemCode.set(
          line.itemCode,
          money((subCommitByOwnerItemCode.get(line.itemCode) ?? 0) + value).toNumber()
        );
      }
    }

    const rows: BoqProfitabilityRow[] = [];
    for (const boq of bundle.boqItems) {
      const effectiveQty = resolveEffectiveOwnerBoqQuantityFromBase(
        boq.contractQuantity,
        bundle.ownerVoLines,
        boq.id
      );
      const effectiveRate = resolveEffectiveOwnerBoqRateFromLines(
        boq.unitSellingPrice,
        bundle.ownerVoLines,
        boq.id
      );
      const originalSellingValue = money(Number(boq.contractQuantity) * Number(boq.unitSellingPrice)).toNumber();
      const effectiveSellingValue = money(Number(effectiveQty) * Number(effectiveRate)).toNumber();
      const variationSellingImpact = money(effectiveSellingValue - originalSellingValue).toNumber();
      const { plannedUnitCost, budgetStatus } = this.resolvePlannedUnit(boq);
      const plannedTotalCost =
        plannedUnitCost != null ? money(plannedUnitCost * Number(effectiveQty)).toNumber() : null;
      const actualCost = actualByBoq.get(boq.id) ?? 0;
      const grossSubCommitment = subCommitByOwnerItemCode.get(boq.itemCode) ?? 0;
      const boqActualBreakdown = actualBoq.items.find((i) => i.projectBOQItemId === boq.id);
      const actualSub = boqActualBreakdown?.totals.SUBCONTRACTOR ?? 0;
      const remainingCommitment = Math.max(0, money(grossSubCommitment - actualSub).toNumber());

      const certifiedQuantity = certifiedQtyByBoq.get(boq.id) ?? 0;
      const remainingQuantity = Math.max(0, money(Number(effectiveQty) - certifiedQuantity).toNumber());
      const progressPercent =
        Number(effectiveQty) > 0
          ? rate(money(certifiedQuantity).div(money(effectiveQty)).mul(100)).toNumber()
          : null;

      let forecastMethod: ProjectForecastMethodCode = 'PLANNED_REMAINING';
      let forecastRemainingCost = 0;
      const manual = this.latestOverride(bundle.overrides, boq.id);
      if (manual) {
        forecastMethod = 'MANUAL_FORECAST';
        forecastRemainingCost = Number(manual.forecastRemainingCost);
      } else if (plannedUnitCost != null) {
        forecastRemainingCost = money(remainingQuantity * plannedUnitCost).toNumber();
      }

      const estimateAtCompletion = money(actualCost + remainingCommitment + forecastRemainingCost).toNumber();
      const forecastProfit =
        plannedTotalCost != null || effectiveSellingValue > 0
          ? money(effectiveSellingValue - estimateAtCompletion).toNumber()
          : null;
      const forecastMarginPercent =
        effectiveSellingValue > 0 && forecastProfit != null
          ? rate(money(forecastProfit).div(money(effectiveSellingValue)).mul(100)).toNumber()
          : null;

      const signals: ProjectProfitabilitySignalCode[] = [];
      if (budgetStatus === 'MISSING_BUDGET') signals.push('MISSING_BUDGET');
      if (plannedTotalCost != null && estimateAtCompletion > plannedTotalCost + 0.01) {
        signals.push('BOQ_OVER_BUDGET');
      }
      if (forecastProfit != null && forecastProfit < 0) signals.push('NEGATIVE_MARGIN');

      rows.push({
        projectBOQItemId: boq.id,
        itemCode: boq.itemCode,
        descriptionAr: boq.descriptionAr,
        originalContractQuantity: Number(boq.contractQuantity),
        effectiveContractQuantity: Number(effectiveQty),
        originalUnitSellingPrice: Number(boq.unitSellingPrice),
        effectiveUnitSellingPrice: Number(effectiveRate),
        originalSellingValue,
        variationSellingImpact,
        effectiveSellingValue,
        plannedUnitCost,
        plannedTotalCost,
        budgetStatus,
        actualCost,
        grossSubcontractCommitment: grossSubCommitment,
        remainingCommitment,
        certifiedQuantity,
        remainingQuantity,
        progressPercent,
        forecastRemainingCost,
        forecastMethod,
        estimateAtCompletion,
        forecastProfit,
        forecastMarginPercent,
        signals,
      });
    }
    return rows;
  }

  private async buildCommitmentBreakdown(
    bundle: Awaited<ReturnType<typeof this.loadBundle>>,
    boqRows: BoqProfitabilityRow[]
  ): Promise<ProjectCommitmentBreakdown> {
    const actualSub = bundle.actualSummary.totals.SUBCONTRACTOR;
    const subRows: SubcontractCommitmentRow[] = [];
    const subActualBySubId = await this.loadSubcontractActualBySubId(
      bundle.project.companyId,
      bundle.project.id
    );

    for (const sub of bundle.subcontracts) {
      const voLines = bundle.subVoLinesBySub.get(sub.id) ?? [];
      let originalCommitment = 0;
      let revisedCommitment = 0;
      for (const line of sub.boqItems) {
        originalCommitment = money(
          originalCommitment + Number(line.contractQuantity) * Number(line.unitPrice)
        ).toNumber();
        const effQty = resolveEffectiveSubcontractBoqQuantityFromBase(
          line.contractQuantity,
          voLines,
          line.id
        );
        const effRate = resolveEffectiveSubcontractBoqRateFromLines(line.unitPrice, voLines, line.id);
        revisedCommitment = money(revisedCommitment + Number(effQty.mul(effRate))).toNumber();
      }
      const voOrders = await prisma.subcontractVariationOrder.findMany({
        where: { companyId: bundle.project.companyId, subcontractId: sub.id, status: 'APPROVED' },
        select: { netImpact: true },
      });
      const approvedVariationImpact = sumMoney(voOrders.map((o) => money(o.netImpact))).toNumber();
      const actualRecognizedWork = subActualBySubId.get(sub.id) ?? 0;
      const remainingCommitment = Math.max(0, money(revisedCommitment - actualRecognizedWork).toNumber());
      subRows.push({
        subcontractId: sub.id,
        subcontractNumber: sub.subcontractNumber,
        originalCommitment,
        approvedVariationImpact,
        revisedCommitment,
        actualRecognizedWork,
        remainingCommitment,
      });
    }

    const grossSub = boqRows.reduce((s, r) => money(s + r.grossSubcontractCommitment).toNumber(), 0);
    const remainingSub = Math.max(0, money(grossSub - actualSub).toNumber());

    const purchaseOrders = await this.loadPurchaseCommitment(bundle.project.companyId, bundle.project);
    return {
      subcontracts: subRows,
      purchaseOrders,
      totals: {
        grossSubcontractCommitment: grossSub,
        actualSubcontractWork: actualSub,
        remainingSubcontractCommitment: remainingSub,
        purchaseGrossCommitment: purchaseOrders.projectLevelGrossCommitment,
        totalRemainingCommitment: money(remainingSub + purchaseOrders.projectLevelGrossCommitment).toNumber(),
      },
    };
  }

  private async loadPurchaseCommitment(
    companyId: string,
    project: Prisma.ContractingProjectGetPayload<{ include: { costCenter: true } }>
  ): Promise<PurchaseCommitmentCapability> {
    if (!project.costCenterId) {
      return {
        supported: false,
        projectLevelGrossCommitment: 0,
        note: 'لا يوجد مركز تكلفة للمشروع — لا يمكن ربط أوامر الشراء.',
      };
    }
    const pos = await prisma.purchaseOrder.findMany({
      where: {
        companyId,
        costCenterId: project.costCenterId,
        isApproved: true,
        isCancelled: false,
        invoiceId: null,
      },
      select: { netAmount: true },
    });
    const gross = pos.reduce((s, po) => money(s + Number(po.netAmount)).toNumber(), 0);
    return {
      supported: true,
      projectLevelGrossCommitment: gross,
      note:
        'التزام على مستوى المشروع عبر مركز التكلفة فقط — لا توزيع على بنود BOQ؛ لا يُخصم منه تكلفة المخزون الفعلية تلقائياً.',
    };
  }

  private buildProjectCostMetrics(
    bundle: Awaited<ReturnType<typeof this.loadBundle>>,
    boqRows: BoqProfitabilityRow[],
    commitment: ProjectCommitmentBreakdown
  ) {
    const actualCost = bundle.actualSummary.totals.totalActualCost;
    const unallocatedActualCost = bundle.actualSummary.totals.unallocated;
    const allocatedActualCost = money(actualCost - unallocatedActualCost).toNumber();
    const plannedCost = boqRows.reduce(
      (s, r) => money(s + (r.plannedTotalCost ?? 0)).toNumber(),
      0
    );
    const remainingCommitment = commitment.totals.totalRemainingCommitment;
    const uncommittedCostToComplete = boqRows.reduce(
      (s, r) => money(s + r.forecastRemainingCost).toNumber(),
      0
    );
    const estimateAtCompletion = money(
      actualCost + remainingCommitment + uncommittedCostToComplete
    ).toNumber();
    const revised = this.buildRevenueMetrics(bundle).revisedContractValue;
    const forecastProfit = money(revised - estimateAtCompletion).toNumber();
    const forecastMarginPercent =
      revised > 0 ? rate(money(forecastProfit).div(money(revised)).mul(100)).toNumber() : null;
    const financiallyCertifiedRevenue = this.buildRevenueMetrics(bundle).financiallyCertifiedRevenue;
    const currentCertifiedGrossMargin = money(financiallyCertifiedRevenue - actualCost).toNumber();

    return {
      plannedCost,
      actualCost,
      allocatedActualCost,
      unallocatedActualCost,
      grossCommitment: commitment.totals.grossSubcontractCommitment + commitment.totals.purchaseGrossCommitment,
      remainingCommitment,
      uncommittedCostToComplete,
      estimateAtCompletion,
      forecastProfit,
      forecastMarginPercent,
      currentCertifiedGrossMargin,
    };
  }

  private buildProgressMetrics(boqRows: BoqProfitabilityRow[]) {
    const totalSelling = boqRows.reduce((s, r) => money(s + r.effectiveSellingValue).toNumber(), 0);
    let weighted = 0;
    for (const row of boqRows) {
      if (row.progressPercent == null || totalSelling <= 0) continue;
      weighted = money(
        weighted + (row.effectiveSellingValue / totalSelling) * row.progressPercent
      ).toNumber();
    }
    return {
      progressPercent: rate(weighted).toNumber(),
      weightingMethod: 'BOQ_SELLING_VALUE' as const,
    };
  }

  private buildProjectSignals(
    revenue: ReturnType<typeof this.buildRevenueMetrics>,
    cost: ReturnType<typeof this.buildProjectCostMetrics>,
    boqRows: BoqProfitabilityRow[]
  ) {
    const signals: ProjectProfitabilitySummary['signals'] = [];
    if (cost.plannedCost > 0 && cost.estimateAtCompletion > cost.plannedCost + 0.01) {
      signals.push({
        code: 'COST_OVERRUN',
        message: 'التكلفة المتوقعة عند الإتمام تتجاوز التكلفة المخططة',
        severity: 'warning',
      });
    }
    if (cost.forecastProfit < 0) {
      signals.push({
        code: 'NEGATIVE_MARGIN',
        message: 'هامش الربح المتوقع سالب',
        severity: 'critical',
      });
    }
    if (
      revenue.revisedContractValue > 0 &&
      cost.forecastMarginPercent != null &&
      cost.forecastMarginPercent < MARGIN_EROSION_THRESHOLD * 100
    ) {
      signals.push({
        code: 'MARGIN_EROSION',
        message: 'هامش الربح المتوقع منخفض',
        severity: 'warning',
      });
    }
    if (boqRows.some((r) => r.signals.includes('BOQ_OVER_BUDGET'))) {
      signals.push({
        code: 'BOQ_OVER_BUDGET',
        message: 'بند أو أكثر تجاوز ميزانيته المخططة',
        severity: 'warning',
      });
    }
    if (boqRows.some((r) => r.budgetStatus === 'MISSING_BUDGET')) {
      signals.push({
        code: 'MISSING_BUDGET',
        message: 'بنود بدون مقايسة تكلفة',
        severity: 'warning',
      });
    }
    if (
      cost.actualCost > 0 &&
      cost.unallocatedActualCost / cost.actualCost > HIGH_UNALLOCATED_RATIO
    ) {
      signals.push({
        code: 'HIGH_UNALLOCATED_COST',
        message: 'نسبة عالية من التكلفة الفعلية غير موزعة على البنود',
        severity: 'warning',
      });
    }
    return signals;
  }

  private async loadSubcontractActualBySubId(companyId: string, projectId: string) {
    const map = new Map<string, number>();
    const rows = await prisma.projectCostAllocation.findMany({
      where: { companyId, projectId, status: 'ACTIVE', costCategory: 'SUBCONTRACTOR' },
      select: { sourceId: true, amountBase: true },
    });
    if (!rows.length) return map;
    const invoiceIds = [...new Set(rows.map((r) => r.sourceId))];
    const invoices = await prisma.subcontractInvoice.findMany({
      where: { companyId, id: { in: invoiceIds } },
      select: { id: true, subcontractId: true },
    });
    const subByInvoice = new Map(invoices.map((i) => [i.id, i.subcontractId]));
    for (const row of rows) {
      const subId = subByInvoice.get(row.sourceId);
      if (!subId) continue;
      map.set(subId, money((map.get(subId) ?? 0) + Number(row.amountBase)).toNumber());
    }
    return map;
  }
}

export const projectProfitabilityService = new ProjectProfitabilityService();
