import prisma from '../../../shared/database/prisma';
import { ContractingProjectNotFoundError } from '../cost-control/errors/cost-control-domain.errors';
import { projectCostQueryService } from '../project-cost/project-cost-query.service';
import { projectProfitabilityService } from '../profitability/project-profitability.service';
import { money, rate } from '../utils/money-decimal';
import { projectExecutionPlanService } from './project-execution-plan.service';
import {
  forecastFinishDate,
  linearScheduleFraction,
  safeRatio,
} from './project-execution-progress.util';
import type {
  ExecutionActivityPerformanceRow,
  ExecutionHealthCode,
  ProjectExecutionPerformanceSummary,
  UnplannedScopeRow,
} from './project-execution.types';

const ACTUAL_PROGRESS_SOURCE =
  'OwnerPreliminaryCertificateLine.cumulativeApprovedQuantity (APPROVED certs, max per BOQ line)';
const PLANNED_WEIGHTING =
  'Activity weight = share of execution-plan budgeted cost (Σ allocation qty × planned unit cost); planned % = Σ(weight × linear time fraction)';

type ActivityCtx = {
  id: string;
  code: string;
  nameAr: string;
  plannedStart: Date;
  plannedFinish: Date;
  weightShare: number;
  plannedCost: number;
  allocations: Array<{ projectBOQItemId: string; plannedQuantity: number; unitCost: number | null }>;
};

export class ProjectExecutionPerformanceService {
  async getPerformanceSummary(
    companyId: string,
    projectId: string,
    options?: { asOfDate?: Date }
  ): Promise<ProjectExecutionPerformanceSummary> {
    const asOf = options?.asOfDate ?? new Date();
    const ctx = await this.loadContext(companyId, projectId, asOf);
    const profitability = await projectProfitabilityService.getProjectSummary(companyId, projectId);
    const p21 = await projectCostQueryService.getProjectSummary(companyId, projectId);

    const bac = profitability.cost.plannedCost;
    const ac = p21.totals.totalActualCost;
    const plannedPercent = ctx.plannedProgressPercent;
    const actualPercent = profitability.progress.progressPercent;

    const pv = money(bac * (plannedPercent / 100)).toNumber();
    const ev = money(bac * (actualPercent / 100)).toNumber();
    const cpi = safeRatio(ev, ac);
    const spi = safeRatio(ev, pv);
    const cv = money(ev - ac).toNumber();
    const sv = money(ev - pv).toNumber();

    const originalBaseline = await prisma.projectExecutionPlan.findFirst({
      where: { companyId, projectId, baselineKind: 'ORIGINAL_BASELINE' },
      select: { plannedFinish: true, baselineSnapshot: true },
    });
    const activePlan = ctx.plan;

    const forecast = forecastFinishDate(
      asOf,
      activePlan?.plannedFinish ?? asOf,
      plannedPercent,
      actualPercent
    );

    const health = this.buildHealth({
      plannedPercent,
      actualPercent,
      cpi,
      spi,
      profitability,
      hasBaseline: Boolean(originalBaseline?.baselineSnapshot),
      hasUnplanned: ctx.unplannedScope.length > 0,
      bac,
    });

    return {
      asOfDate: asOf.toISOString().slice(0, 10),
      progress: {
        plannedPercent: rate(plannedPercent).toNumber(),
        actualPercent: rate(actualPercent).toNumber(),
        scheduleVariancePoints: rate(actualPercent - plannedPercent).toNumber(),
        weightingMethod: PLANNED_WEIGHTING,
        actualProgressSource: ACTUAL_PROGRESS_SOURCE,
      },
      evm: {
        pv,
        ev,
        ac,
        bac,
        cpi: cpi != null ? rate(cpi).toNumber() : null,
        spi: spi != null ? rate(spi).toNumber() : null,
        cv,
        sv,
        definitions: {
          pv: 'Budgeted cost of work scheduled as of date (= BAC × planned progress %). Not revenue.',
          ev: 'Budgeted cost of work performed (= BAC × certified physical progress %). Not certified selling value.',
          ac: 'P2-1 ProjectCostQueryService total actual cost (canonical).',
          bac: 'P2-2 planned project cost (rate analysis × effective BOQ qty).',
          cpi: 'EV / AC',
          spi: 'EV / PV',
          cv: 'EV − AC',
          sv: 'EV − PV',
        },
      },
      schedule: {
        originalBaselineFinish: originalBaseline?.plannedFinish.toISOString().slice(0, 10) ?? null,
        currentPlannedFinish: activePlan?.plannedFinish.toISOString().slice(0, 10) ?? null,
        forecastFinish: forecast.date?.toISOString().slice(0, 10) ?? null,
        forecastFinishMethod: forecast.method,
      },
      financial: {
        certifiedRevenue: profitability.revenue.financiallyCertifiedRevenue,
        collectedCash: profitability.revenue.collectedRevenue,
        actualCost: ac,
        eac: profitability.cost.estimateAtCompletion,
        forecastProfit: profitability.cost.forecastProfit,
        forecastMarginPercent: profitability.cost.forecastMarginPercent,
        source: 'P2-2 projectProfitabilityService (no P3 recomputation)',
      },
      health,
    };
  }

  async getActivityPerformance(
    companyId: string,
    projectId: string,
    options?: { asOfDate?: Date }
  ): Promise<ExecutionActivityPerformanceRow[]> {
    const asOf = options?.asOfDate ?? new Date();
    const ctx = await this.loadContext(companyId, projectId, asOf);
    const profitability = await projectProfitabilityService.getBoqBreakdown(companyId, projectId);
    const p21 = await projectCostQueryService.getProjectSummary(companyId, projectId);
    const summary = await this.getPerformanceSummary(companyId, projectId, { asOfDate: asOf });

    const certifiedByBoq = new Map(
      profitability.items.map((i) => [i.projectBOQItemId, i.certifiedQuantity])
    );
    const plannedQtyByBoq = ctx.plannedQtyByBoq;

    return ctx.activities.map((act) => {
      const linear = linearScheduleFraction(asOf, act.plannedStart, act.plannedFinish);
      const plannedPercent = rate(linear * 100).toNumber();
      let activityEv = 0;
      for (const alloc of act.allocations) {
        const unitCost = alloc.unitCost ?? 0;
        const totalPlannedForBoq = plannedQtyByBoq.get(alloc.projectBOQItemId) ?? 0;
        const certified = certifiedByBoq.get(alloc.projectBOQItemId) ?? 0;
        const share =
          totalPlannedForBoq > 0 ? Math.min(1, alloc.plannedQuantity / totalPlannedForBoq) : 0;
        const attributedQty = certified * share;
        activityEv = money(activityEv + unitCost * Math.min(attributedQty, alloc.plannedQuantity)).toNumber();
      }
      const activityPv = money(act.plannedCost * linear).toNumber();
      const acShare =
        summary.evm.ev > 0
          ? money(p21.totals.totalActualCost * (activityEv / summary.evm.ev)).toNumber()
          : money(p21.totals.totalActualCost * act.weightShare).toNumber();

      let actualPercent = 0;
      if (act.plannedCost > 0) actualPercent = rate((activityEv / act.plannedCost) * 100).toNumber();

      const cpi = safeRatio(activityEv, acShare);
      const spi = safeRatio(activityEv, activityPv);
      let status = 'NOT_STARTED';
      if (actualPercent >= 99.9) status = 'COMPLETED';
      else if (actualPercent > 0) status = 'IN_PROGRESS';
      if (plannedPercent > actualPercent + 5 && linear > 0.05) status = 'DELAYED';

      return {
        activityId: act.id,
        code: act.code,
        nameAr: act.nameAr,
        plannedStart: act.plannedStart.toISOString().slice(0, 10),
        plannedFinish: act.plannedFinish.toISOString().slice(0, 10),
        weight: rate(act.weightShare * 100).toNumber(),
        plannedPercent,
        actualPercent,
        pv: activityPv,
        ev: activityEv,
        acShare,
        cpi: cpi != null ? rate(cpi).toNumber() : null,
        spi: spi != null ? rate(spi).toNumber() : null,
        status,
      };
    });
  }

  async getUnplannedScope(companyId: string, projectId: string): Promise<UnplannedScopeRow[]> {
    const ctx = await this.loadContext(companyId, projectId, new Date());
    return ctx.unplannedScope;
  }

  async getTimeSeries(
    companyId: string,
    projectId: string,
    options?: { from?: Date; to?: Date; stepDays?: number }
  ) {
    const to = options?.to ?? new Date();
    const from = options?.from ?? new Date(to.getTime() - 90 * 86400000);
    const step = options?.stepDays ?? 7;
    const points: Array<{
      date: string;
      plannedProgress: number;
      actualProgress: number;
      pv: number;
      ev: number;
      ac: number;
    }> = [];

    const snapshots = await prisma.projectExecutionPerformanceSnapshot.findMany({
      where: { companyId, projectId, snapshotDate: { gte: from, lte: to } },
      orderBy: { snapshotDate: 'asc' },
    });
    const snapByDay = new Map(
      snapshots.map((s) => [s.snapshotDate.toISOString().slice(0, 10), s])
    );

    for (let t = from.getTime(); t <= to.getTime(); t += step * 86400000) {
      const d = new Date(t);
      const key = d.toISOString().slice(0, 10);
      const snap = snapByDay.get(key);
      if (snap) {
        points.push({
          date: key,
          plannedProgress: Number(snap.plannedProgressPercent),
          actualProgress: Number(snap.actualProgressPercent),
          pv: Number(snap.pv),
          ev: Number(snap.ev),
          ac: Number(snap.ac),
        });
        continue;
      }
      const summary = await this.getPerformanceSummary(companyId, projectId, { asOfDate: d });
      points.push({
        date: key,
        plannedProgress: summary.progress.plannedPercent,
        actualProgress: summary.progress.actualPercent,
        pv: summary.evm.pv,
        ev: summary.evm.ev,
        ac: summary.evm.ac,
      });
    }
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), points };
  }

  async getAllocationSummary(companyId: string, projectId: string, executionPlanId: string) {
    const plan = await prisma.projectExecutionPlan.findFirst({
      where: { id: executionPlanId, companyId, projectId },
      include: {
        activities: { include: { boqAllocations: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!plan) return null;

    const boqItems = await prisma.projectBOQItem.findMany({ where: { companyId, projectId } });
    const rows = [];
    for (const boq of boqItems) {
      const effectiveQty = await projectExecutionPlanService.effectiveBoqQuantity(
        companyId,
        projectId,
        boq.id
      );
      const allocated = plan.activities.reduce((s, a) => {
        const line = a.boqAllocations.find((x) => x.projectBOQItemId === boq.id);
        return s + (line ? Number(line.plannedQuantity) : 0);
      }, 0);
      const unitCost = await projectExecutionPlanService.plannedBoqUnitCost(companyId, boq.id);
      rows.push({
        projectBOQItemId: boq.id,
        itemCode: boq.itemCode,
        effectiveQuantity: effectiveQty,
        allocatedQuantity: allocated,
        remainingToAllocate: Math.max(0, money(effectiveQty - allocated).toNumber()),
        plannedUnitCost: unitCost,
        plannedCost: unitCost != null ? money(unitCost * allocated).toNumber() : null,
      });
    }
    return { executionPlanId, items: rows };
  }

  private async loadContext(companyId: string, projectId: string, asOf: Date) {
    const project = await prisma.contractingProject.findFirst({ where: { id: projectId, companyId } });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const plan = await projectExecutionPlanService.getActivePlan(companyId, projectId);
    if (!plan) {
      return {
        plan: null,
        activities: [] as ActivityCtx[],
        plannedProgressPercent: 0,
        plannedQtyByBoq: new Map<string, number>(),
        unplannedScope: [] as UnplannedScopeRow[],
      };
    }

    const activities: ActivityCtx[] = [];
    let totalPlannedCost = 0;
    const plannedQtyByBoq = new Map<string, number>();

    for (const act of plan.activities) {
      const allocations: ActivityCtx['allocations'] = [];
      let actCost = 0;
      for (const alloc of act.boqAllocations) {
        const qty = Number(alloc.plannedQuantity);
        plannedQtyByBoq.set(
          alloc.projectBOQItemId,
          (plannedQtyByBoq.get(alloc.projectBOQItemId) ?? 0) + qty
        );
        const unitCost = await projectExecutionPlanService.plannedBoqUnitCost(
          companyId,
          alloc.projectBOQItemId
        );
        if (unitCost != null) actCost = money(actCost + unitCost * qty).toNumber();
        allocations.push({ projectBOQItemId: alloc.projectBOQItemId, plannedQuantity: qty, unitCost });
      }
      totalPlannedCost = money(totalPlannedCost + actCost).toNumber();
      activities.push({
        id: act.id,
        code: act.code,
        nameAr: act.nameAr,
        plannedStart: act.plannedStart,
        plannedFinish: act.plannedFinish,
        weightShare: 0,
        plannedCost: actCost,
        allocations,
      });
    }

    for (const act of activities) {
      act.weightShare = totalPlannedCost > 0 ? act.plannedCost / totalPlannedCost : 0;
    }

    let plannedProgressPercent = 0;
    for (const act of activities) {
      const linear = linearScheduleFraction(asOf, act.plannedStart, act.plannedFinish);
      plannedProgressPercent = money(plannedProgressPercent + act.weightShare * linear * 100).toNumber();
    }

    const boqItems = await prisma.projectBOQItem.findMany({ where: { companyId, projectId } });
    const unplannedScope: UnplannedScopeRow[] = [];
    for (const boq of boqItems) {
      const effectiveQty = await projectExecutionPlanService.effectiveBoqQuantity(
        companyId,
        projectId,
        boq.id
      );
      const allocated = plannedQtyByBoq.get(boq.id) ?? 0;
      const unplanned = money(effectiveQty - allocated).toNumber();
      if (unplanned > 0.0001) {
        unplannedScope.push({
          projectBOQItemId: boq.id,
          itemCode: boq.itemCode,
          effectiveQuantity: effectiveQty,
          plannedQuantity: allocated,
          unplannedQuantity: unplanned,
        });
      }
    }

    return { plan, activities, plannedProgressPercent, plannedQtyByBoq, unplannedScope };
  }

  private buildHealth(input: {
    plannedPercent: number;
    actualPercent: number;
    cpi: number | null;
    spi: number | null;
    profitability: Awaited<ReturnType<typeof projectProfitabilityService.getProjectSummary>>;
    hasBaseline: boolean;
    hasUnplanned: boolean;
    bac: number;
  }) {
    const rows: ProjectExecutionPerformanceSummary['health'] = [];
    const svPts = input.actualPercent - input.plannedPercent;
    if (!input.hasBaseline) {
      rows.push({
        code: 'MISSING_BASELINE',
        message: 'لا يوجد خط أساس معتمد للمخطط',
        severity: 'warning',
      });
    }
    if (input.bac <= 0) {
      rows.push({
        code: 'MISSING_BUDGET',
        message: 'التكلفة المخططة للمشروع غير متوفرة',
        severity: 'warning',
      });
    }
    if (svPts < -0.5) {
      rows.push({
        code: 'SCHEDULE_DELAY',
        message: `تأخر زمني: الإنجاز الفعلي أقل من المخطط بـ ${rate(Math.abs(svPts)).toNumber()} نقطة مئوية`,
        severity: 'warning',
      });
    }
    if (input.profitability.signals.some((s) => s.code === 'COST_OVERRUN')) {
      rows.push({
        code: 'COST_OVERRUN',
        message: 'التكلفة المتوقعة تتجاوز الميزانية',
        severity: 'warning',
      });
    }
    if (input.profitability.signals.some((s) => s.code === 'NEGATIVE_MARGIN')) {
      rows.push({
        code: 'NEGATIVE_MARGIN',
        message: 'هامش الربح المتوقع سالب',
        severity: 'critical',
      });
    }
    if (input.cpi != null && input.cpi < 0.95) {
      rows.push({ code: 'LOW_CPI', message: `CPI=${rate(input.cpi).toNumber()}`, severity: 'warning' });
    }
    if (input.spi != null && input.spi < 0.95) {
      rows.push({ code: 'LOW_SPI', message: `SPI=${rate(input.spi).toNumber()}`, severity: 'warning' });
    }
    if (input.hasUnplanned) {
      rows.push({
        code: 'UNPLANNED_SCOPE',
        message: 'نطاق معتمد غير موزع على مخطط التنفيذ',
        severity: 'warning',
      });
    }
    if (
      rows.length === 0 ||
      (rows.length === 1 && rows[0].code === 'MISSING_BASELINE' && svPts >= -0.5)
    ) {
      rows.unshift({
        code: 'ON_TRACK',
        message: 'لا توجد إشارات حرجة خارج خط الأساس الناقص',
        severity: 'info',
      });
    }
    return rows;
  }
}

export const projectExecutionPerformanceService = new ProjectExecutionPerformanceService();
