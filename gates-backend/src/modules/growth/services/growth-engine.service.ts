import type { GrowthOpportunityCategory, GrowthOpportunityPriority, GrowthOpportunityStatus, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { customerFollowupService } from '../../real-estate/services/customer-followup.service';
import { GROWTH_DETECTORS } from '../detectors';
import { asMoney } from '../money';
import type { DetectedOpportunity } from '../types';
import { logGrowthActivity } from './growth-audit';
import { explainMissingOpportunities } from './growth-explain.service';

const TERMINAL: GrowthOpportunityStatus[] = ['DISMISSED', 'WON', 'LOST'];

function serialize(row: {
  id: string;
  type: string;
  category: GrowthOpportunityCategory;
  title: string;
  description: string;
  whyDetected: string;
  status: GrowthOpportunityStatus;
  priority: GrowthOpportunityPriority;
  estimatedValue: unknown;
  actionedValue: unknown;
  realizedValue: unknown;
  currencyCode: string;
  module: string | null;
  entityType: string | null;
  entityId: string | null;
  confidence: unknown;
  evidence: Prisma.JsonValue;
  recommendedActions: Prisma.JsonValue;
  aiExplanation: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  actionedAt: Date | null;
  actions?: Array<{ id: string; actionKey: string; label: string; createdAt: Date; notes: string | null }>;
  attributions?: Array<{
    id: string;
    kind: string;
    label: string;
    amount: unknown;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }>;
}) {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    title: row.title,
    description: row.description,
    whyDetected: row.whyDetected,
    status: row.status,
    priority: row.priority,
    estimatedValue: asMoney(row.estimatedValue),
    actionedValue: asMoney(row.actionedValue),
    realizedValue: asMoney(row.realizedValue),
    currencyCode: row.currencyCode,
    module: row.module,
    entityType: row.entityType,
    entityId: row.entityId,
    confidence: asMoney(row.confidence),
    evidence: row.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence) ? row.evidence : {},
    recommendedActions: Array.isArray(row.recommendedActions) ? row.recommendedActions : [],
    aiExplanation: row.aiExplanation,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    actionedAt: row.actionedAt?.toISOString() ?? null,
    actions: row.actions?.map((a) => ({
      id: a.id,
      actionKey: a.actionKey,
      label: a.label,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
    })),
    attributions: row.attributions?.map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.label,
      amount: asMoney(a.amount),
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

const CATEGORY_POTENTIAL: Record<string, 'revenue' | 'cash' | 'inventory' | 'savings'> = {
  REVENUE: 'revenue',
  CUSTOMERS: 'revenue',
  CASH_RECOVERY: 'cash',
  INVENTORY: 'inventory',
  SAVINGS: 'savings',
  PRICING: 'savings',
  COSTS: 'savings',
};

export class GrowthEngineService {
  async refresh(companyId: string) {
    const asOf = new Date();
    const detected: DetectedOpportunity[] = [];
    const gaps: string[] = [];

    for (const detector of GROWTH_DETECTORS) {
      try {
        const found = await detector.detect({ companyId, asOf });
        if (!found.length) gaps.push(detector.key);
        detected.push(...found);
      } catch (error) {
        logger.error({ error, detector: detector.key, companyId }, 'Growth detector failed');
        gaps.push(detector.key);
      }
    }

    const fingerprints = detected.map((d) => d.fingerprint);
    for (const item of detected) {
      const existing = await prisma.growthOpportunity.findUnique({
        where: { companyId_fingerprint: { companyId, fingerprint: item.fingerprint } },
      });
      if (existing && TERMINAL.includes(existing.status)) continue;

      const payload = {
        type: item.type,
        category: item.category as GrowthOpportunityCategory,
        title: item.title,
        description: item.description,
        whyDetected: item.whyDetected,
        priority: item.priority as GrowthOpportunityPriority,
        estimatedValue: item.estimatedValue,
        currencyCode: item.currencyCode,
        module: item.module,
        entityType: item.entityType,
        entityId: item.entityId,
        confidence: item.confidence,
        evidence: item.evidence as Prisma.InputJsonValue,
        recommendedActions: item.recommendedActions as Prisma.InputJsonValue,
        metadata: (item.metadata ?? {}) as Prisma.InputJsonValue,
        generatedBy: 'growth-engine',
        status: existing?.status === 'EXPIRED' ? 'NEW' : existing?.status ?? 'NEW',
      };

      await prisma.growthOpportunity.upsert({
        where: { companyId_fingerprint: { companyId, fingerprint: item.fingerprint } },
        create: { companyId, fingerprint: item.fingerprint, ...payload },
        update: payload,
      });
    }

    if (fingerprints.length) {
      await prisma.growthOpportunity.updateMany({
        where: {
          companyId,
          status: 'NEW',
          fingerprint: { notIn: fingerprints },
        },
        data: { status: 'EXPIRED' },
      });
    }

    await logGrowthActivity({
      companyId,
      kind: 'growth.detected',
      subjectId: companyId,
      reason: `تشغيل محرك النمو: ${detected.length} فرصة`,
      metadata: { count: detected.length, detectorGaps: gaps },
    });
    void explainMissingOpportunities(companyId).catch((error) =>
      logger.warn({ error, companyId }, 'Growth explanation batch failed')
    );

    return this.getOverview(companyId, { refreshed: true, detectorGaps: gaps });
  }

  async getOverview(
    companyId: string,
    extras?: { refreshed?: boolean; detectorGaps?: string[] }
  ) {
    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const rows = (
      await prisma.growthOpportunity.findMany({
        where: { companyId, status: { notIn: ['EXPIRED'] } },
      })
    ).sort(
      (a, b) =>
        (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) ||
        asMoney(b.estimatedValue) - asMoney(a.estimatedValue)
    );

    const open = rows.filter((r) => !['DISMISSED', 'WON', 'LOST'].includes(r.status));
    const buckets = { revenue: 0, cash: 0, inventory: 0, savings: 0 };
    for (const row of open) {
      const key = CATEGORY_POTENTIAL[row.category] ?? 'revenue';
      buckets[key] += asMoney(row.estimatedValue);
    }

    const salesCount = await prisma.invoice.count({
      where: { companyId, invoiceKind: 'SALE', isPosted: true, isCancelled: false },
    });
    const customerCount = await prisma.customer.count({ where: { companyId } });
    const stockCount = await prisma.itemWarehouseBalance.count({
      where: { companyId, quantityOnHand: { gt: 0 } },
    });

    const missing: string[] = [];
    if (salesCount < 3) missing.push('سجل مبيعات مرحّل غير كافٍ');
    if (customerCount < 2) missing.push('عدد العملاء قليل جداً لاستنتاج الأنماط');
    if (stockCount < 1) missing.push('لا توجد أرصدة مخزنية يمكن تقييمها');

    return {
      currencyCode: 'EGP',
      potentialValue: asMoney(Object.values(buckets).reduce((s, v) => s + v, 0)),
      breakdown: {
        revenue: asMoney(buckets.revenue),
        cashRecovery: asMoney(buckets.cash),
        inventory: asMoney(buckets.inventory),
        savings: asMoney(buckets.savings),
      },
      counts: {
        open: open.length,
        actioned: rows.filter((r) => r.status === 'ACTION_TAKEN').length,
        completed: rows.filter((r) => r.status === 'WON').length,
        dismissed: rows.filter((r) => r.status === 'DISMISSED').length,
      },
      empty: open.length === 0,
      emptyReason:
        open.length === 0
          ? missing.length
            ? 'Gates يحتاج نشاطاً تشغيلياً أكثر قبل أن يحدد فرص نمو موثوقة.'
            : 'لا توجد فرص مفتوحة حالياً. حدّث التحليل بعد المزيد من الحركات.'
          : null,
      missingData: missing,
      opportunities: rows.map((row) => serialize(row)),
      refreshed: extras?.refreshed ?? false,
      detectorGaps: extras?.detectorGaps ?? [],
    };
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.growthOpportunity.findFirst({
      where: { id, companyId },
      include: {
        actions: { orderBy: { createdAt: 'desc' }, take: 30 },
        attributions: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!row) return null;
    return serialize(row);
  }

  async review(companyId: string, id: string, userId?: string) {
    const existing = await prisma.growthOpportunity.findFirst({ where: { id, companyId } });
    if (!existing) return null;
    const row = await prisma.growthOpportunity.update({
      where: { id },
      data: {
        status: existing.status === 'NEW' ? 'REVIEWED' : existing.status,
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
    });
    await logGrowthActivity({
      companyId,
      kind: 'growth.reviewed',
      subjectId: id,
      reason: row.title,
      userId,
    });
    return serialize(row);
  }

  async dismiss(companyId: string, id: string, userId?: string, notes?: string) {
    const existing = await prisma.growthOpportunity.findFirst({ where: { id, companyId } });
    if (!existing) return null;
    const [row] = await prisma.$transaction([
      prisma.growthOpportunity.update({
        where: { id },
        data: { status: 'DISMISSED', dismissedAt: new Date(), dismissedBy: userId },
      }),
      prisma.growthOpportunityAction.create({
        data: {
          companyId,
          opportunityId: id,
          actionKey: 'dismiss',
          label: 'استبعاد الفرصة',
          userId,
          notes,
        },
      }),
    ]);
    await logGrowthActivity({
      companyId,
      kind: 'growth.dismissed',
      subjectId: id,
      reason: existing.title,
      userId,
      metadata: { notes },
    });
    return serialize(row);
  }

  async recordAction(
    companyId: string,
    id: string,
    actionKey: string,
    label: string,
    userId?: string,
    notes?: string
  ) {
    const existing = await prisma.growthOpportunity.findFirst({ where: { id, companyId } });
    if (!existing) return null;
    const nextStatus: GrowthOpportunityStatus =
      actionKey === 'won' ? 'WON' : actionKey === 'lost' ? 'LOST' : 'ACTION_TAKEN';
    let followupId: string | undefined;
    if (
      existing.entityType === 'customer' &&
      existing.entityId &&
      (actionKey === 'mark-followup' || actionKey === 'mark-collection' || actionKey === 'mark-offer' || actionKey === 'mark-upsell')
    ) {
      try {
        const followup = await customerFollowupService.createFollowup(companyId, {
          customerId: existing.entityId,
          followupDate: new Date(),
          followupType: actionKey === 'mark-collection' ? 'collection' : 'growth',
          notes: notes || `متابعة من محرك النمو: ${existing.title}`,
          status: 'active',
        });
        followupId = followup.id;
      } catch (error) {
        logger.warn({ error, companyId, opportunityId: id }, 'Growth follow-up create skipped');
      }
    }

    const [row] = await prisma.$transaction([
      prisma.growthOpportunity.update({
        where: { id },
        data: {
          status: nextStatus,
          actionedAt: new Date(),
          actionedBy: userId,
          actionedValue: existing.estimatedValue,
          resolvedAt: nextStatus === 'WON' || nextStatus === 'LOST' ? new Date() : existing.resolvedAt,
        },
      }),
      prisma.growthOpportunityAction.create({
        data: {
          companyId,
          opportunityId: id,
          actionKey,
          label,
          userId,
          notes: followupId ? `${notes ?? ''} [followup:${followupId}]`.trim() : notes,
        },
      }),
    ]);
    await logGrowthActivity({
      companyId,
      kind:
        nextStatus === 'WON'
          ? 'growth.won'
          : nextStatus === 'LOST'
            ? 'growth.lost'
            : 'growth.actioned',
      subjectId: id,
      reason: `${label} — ${existing.title}`,
      userId,
      metadata: { actionKey, followupId },
    });
    return serialize(row);
  }
}

export const growthEngineService = new GrowthEngineService();
