import type { Job } from 'bullmq';
import type { PropertyUnit } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { companySettingService } from '../../platform/services/company-setting.service';
import { money, rate, toDecimal } from '../../real-estate/utils/money-decimal';
import { AUTOMATION_SYSTEM_ACTOR_ID, PRICING_TIERS, SOLD_UNIT_STATUSES } from '../constants';
import { emitAutomationEvent } from '../events/notification-bus';
import { automationJobOptions, automationSchedulersQueue } from '../queues/automation.queues';
import { claimIdempotencyKey, dynamicPricingIdempotencyKey } from '../redis/job-idempotency';
import { AUTOMATION_JOB_NAMES, AUTOMATION_SETTING_KEYS } from '../types/automation-jobs.types';
import type { DynamicPricingJobData } from '../types/automation-jobs.types';
import { dynamicPricingJobId, utcDateKey, utcIsoWeekKey } from '../utils/job-ids';

function suggestedBump(soldRatio: number): number {
  for (const tier of PRICING_TIERS) {
    if (soldRatio >= tier.minSoldRatio) return tier.multiplierBump;
  }
  return 0;
}

function isSold(status: string): boolean {
  return (SOLD_UNIT_STATUSES as readonly string[]).includes(status);
}

async function repriceAvailableUnits(
  units: PropertyUnit[],
  scale: ReturnType<typeof toDecimal>
) {
  let updated = 0;
  for (const unit of units) {
    if (unit.status !== 'AVAILABLE') continue;
    const newBase = money(toDecimal(unit.basePricePerMeter).mul(scale));
    const newTotal = money(newBase.mul(toDecimal(unit.netArea)).plus(toDecimal(unit.premiumModifiersTotal)));
    await prisma.propertyUnit.update({
      where: { id: unit.id },
      data: {
        basePricePerMeter: newBase,
        totalPrice: newTotal,
      },
    });
    updated += 1;
  }
  return updated;
}

export async function processTenantDynamicPricing(companyId: string, asOfDate: string, weekKey: string) {
  const claimed = await claimIdempotencyKey(dynamicPricingIdempotencyKey(companyId, weekKey), 8 * 24 * 3600);
  if (!claimed) {
    return { companyId, skipped: true, phasesEvaluated: 0, unitsRepriced: 0 };
  }

  const autoReprice = await companySettingService.getFlag(
    companyId,
    AUTOMATION_SETTING_KEYS.autoReprice,
    false
  );

  const phases = await prisma.propertyPhase.findMany({
    where: { project: { companyId } },
    include: {
      units: true,
      project: { select: { id: true, projectCode: true, nameAr: true } },
    },
  });

  let unitsRepriced = 0;
  const suggestions: Array<Record<string, unknown>> = [];

  for (const phase of phases) {
    const totalUnitsCount = phase.units.length;
    const soldUnitsCount = phase.units.filter((unit) => isSold(unit.status)).length;
    const soldRatio = totalUnitsCount === 0 ? 0 : soldUnitsCount / totalUnitsCount;
    const bump = suggestedBump(soldRatio);
    const currentMultiplier = rate(phase.activePriceMultiplier);
    const suggestedMultiplier = rate(currentMultiplier.mul(toDecimal(1).plus(toDecimal(bump))));
    const availableCount = phase.units.filter((unit) => unit.status === 'AVAILABLE').length;

    const suggestion = {
      phaseId: phase.id,
      phaseCode: phase.phaseCode,
      projectCode: phase.project.projectCode,
      totalUnitsCount,
      soldUnitsCount,
      soldRatio: Number(soldRatio.toFixed(4)),
      availableCount,
      currentMultiplier: currentMultiplier.toFixed(6),
      suggestedMultiplier: suggestedMultiplier.toFixed(6),
      multiplierBump: bump,
      autoRepriceApplied: false,
    };

    if (bump > 0 && autoReprice && suggestedMultiplier.gt(currentMultiplier) && availableCount > 0) {
      const scale = toDecimal(suggestedMultiplier.div(currentMultiplier));
      await prisma.propertyPhase.update({
        where: { id: phase.id },
        data: { activePriceMultiplier: suggestedMultiplier },
      });
      unitsRepriced += await repriceAvailableUnits(phase.units, scale);
      suggestion.autoRepriceApplied = true;
    }

    await prisma.activityLog.create({
      data: {
        tenantId: companyId,
        actorId: AUTOMATION_SYSTEM_ACTOR_ID,
        kind: 'DYNAMIC_PRICING_REVALUATION',
        subjectType: 'PropertyPhase',
        subjectId: phase.id,
        severity: bump > 0 ? 'warn' : 'info',
        reason: `Sales velocity ${(soldRatio * 100).toFixed(1)}% — suggested multiplier ${suggestion.suggestedMultiplier}`,
        metadata: suggestion,
      },
    });

    suggestions.push(suggestion);
  }

  if (suggestions.some((row) => Number(row.multiplierBump) > 0)) {
    await emitAutomationEvent({
      companyId,
      event: 'DYNAMIC_PRICING_REVALUATION',
      type: 'PRICE_REVIEW',
      title: 'مراجعة تسعير المراحل العقارية',
      message: `${suggestions.filter((row) => Number(row.multiplierBump) > 0).length} phase(s) crossed a sales-velocity pricing tier.`,
      linkUrl: '/real-estate',
      subjectType: 'PropertyProject',
      subjectId: companyId,
      metadata: { asOfDate, weekKey, autoReprice, suggestions },
    });
  }

  logger.info(
    { companyId, asOfDate, weekKey, phasesEvaluated: phases.length, unitsRepriced, autoReprice },
    'Dynamic pricing revaluation finished for tenant'
  );

  return { companyId, skipped: false, phasesEvaluated: phases.length, unitsRepriced, suggestions };
}

export async function processDynamicPricingJob(job: Job<DynamicPricingJobData>) {
  const asOfDate = job.data.asOfDate ? job.data.asOfDate : utcDateKey();
  const weekKey = utcIsoWeekKey(job.data.asOfDate ? new Date(job.data.asOfDate) : new Date());

  if (job.data.kind === 'tenant') {
    if (!job.data.companyId) throw new Error('DynamicPricingRevaluationJob tenant job missing companyId');
    return processTenantDynamicPricing(job.data.companyId, asOfDate, weekKey);
  }

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      propertyProjects: { some: {} },
    },
    select: { id: true },
  });

  const failures: Array<{ companyId: string; error: string }> = [];
  let enqueued = 0;
  for (const company of companies) {
    try {
      await automationSchedulersQueue.add(
        AUTOMATION_JOB_NAMES.dynamicPricing,
        {
          kind: 'tenant',
          companyId: company.id,
          requestedBy: job.data.requestedBy,
          asOfDate,
        },
        {
          ...automationJobOptions(),
          jobId: dynamicPricingJobId(company.id, weekKey),
        }
      );
      enqueued += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already') || message.includes('JobId')) {
        continue;
      }
      failures.push({ companyId: company.id, error: message });
    }
  }

  return {
    asOfDate,
    weekKey,
    tenantsAttempted: companies.length,
    tenantsEnqueued: enqueued,
    failures,
  };
}
