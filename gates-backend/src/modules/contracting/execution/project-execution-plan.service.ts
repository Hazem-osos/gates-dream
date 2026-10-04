import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { ContractingProjectNotFoundError } from '../cost-control/errors/cost-control-domain.errors';
import { money } from '../utils/money-decimal';
import {
  loadApprovedOwnerVariationLinesInTx,
  resolveEffectiveOwnerBoqQuantityFromBase,
} from '../variation/contract-variation-effective.service';
import { rateAnalysisCalculationService } from '../technical-office/services/rate-analysis-calculation.service';

type Db = Prisma.TransactionClient | typeof prisma;

export class ProjectExecutionPlanService {
  async getActivePlan(companyId: string, projectId: string) {
    return prisma.projectExecutionPlan.findFirst({
      where: { companyId, projectId, status: 'ACTIVE' },
      include: {
        activities: { include: { boqAllocations: true }, orderBy: { sortOrder: 'asc' } },
        milestones: true,
      },
    });
  }

  async listPlans(companyId: string, projectId: string) {
    return prisma.projectExecutionPlan.findMany({
      where: { companyId, projectId },
      orderBy: [{ versionNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createPlan(
    companyId: string,
    projectId: string,
    input: {
      planName: string;
      plannedStart: Date;
      plannedFinish: Date;
      createdBy?: string;
      revisionOfPlanId?: string;
    }
  ) {
    await this.assertProject(companyId, projectId);
    const versionNumber =
      (await prisma.projectExecutionPlan.count({ where: { companyId, projectId } })) + 1;
    const baselineKind = 'DRAFT_REVISION';
    return prisma.projectExecutionPlan.create({
      data: {
        id: randomUUID(),
        companyId,
        projectId,
        planName: input.planName,
        versionNumber,
        revisionOfPlanId: input.revisionOfPlanId ?? null,
        baselineKind,
        plannedStart: input.plannedStart,
        plannedFinish: input.plannedFinish,
        status: 'DRAFT',
        createdBy: input.createdBy ?? null,
      },
    });
  }

  async upsertActivity(
    companyId: string,
    planId: string,
    input: {
      activityId?: string;
      code: string;
      nameAr: string;
      plannedStart: Date;
      plannedFinish: Date;
      weight?: number;
      sortOrder?: number;
    }
  ) {
    const plan = await prisma.projectExecutionPlan.findFirst({ where: { id: planId, companyId } });
    if (!plan) throw new AppError(404, 'مخطط التنفيذ غير موجود');
    if (plan.status !== 'DRAFT') throw new AppError(422, 'لا يمكن تعديل نشاط في مخطط غير مسودة');
    if (input.plannedFinish < input.plannedStart) {
      throw new AppError(422, 'تاريخ النهاية قبل البداية');
    }
    if (input.activityId) {
      return prisma.projectExecutionActivity.update({
        where: { id: input.activityId },
        data: {
          code: input.code,
          nameAr: input.nameAr,
          plannedStart: input.plannedStart,
          plannedFinish: input.plannedFinish,
          weight: input.weight != null ? money(input.weight) : null,
          sortOrder: input.sortOrder ?? 0,
        },
      });
    }
    return prisma.projectExecutionActivity.create({
      data: {
        id: randomUUID(),
        companyId,
        projectId: plan.projectId,
        executionPlanId: planId,
        code: input.code,
        nameAr: input.nameAr,
        plannedStart: input.plannedStart,
        plannedFinish: input.plannedFinish,
        weight: input.weight != null ? money(input.weight) : null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async setBoqAllocation(
    companyId: string,
    activityId: string,
    input: { projectBOQItemId: string; plannedQuantity: number }
  ) {
    const activity = await prisma.projectExecutionActivity.findFirst({
      where: { id: activityId, companyId },
      include: { executionPlan: true },
    });
    if (!activity) throw new AppError(404, 'النشاط غير موجود');
    if (activity.executionPlan.status !== 'DRAFT') {
      throw new AppError(422, 'التوزيع مسموح في مخطط مسودة فقط');
    }
    if (input.plannedQuantity <= 0) throw new AppError(422, 'الكمية يجب أن تكون أكبر من صفر');

    const effectiveQty = await this.effectiveBoqQuantity(
      companyId,
      activity.projectId,
      input.projectBOQItemId
    );
    const others = await prisma.executionActivityBoqAllocation.aggregate({
      where: {
        executionPlanId: activity.executionPlanId,
        projectBOQItemId: input.projectBOQItemId,
        executionActivityId: { not: activityId },
      },
      _sum: { plannedQuantity: true },
    });
    const total = Number(others._sum.plannedQuantity ?? 0) + input.plannedQuantity;
    if (total > effectiveQty + 0.0001) {
      throw new AppError(
        422,
        `توزيع BOQ يتجاوز الكمية الفعالة (${effectiveQty}) — المجموع ${total}`
      );
    }

    return prisma.executionActivityBoqAllocation.upsert({
      where: {
        executionActivityId_projectBOQItemId: {
          executionActivityId: activityId,
          projectBOQItemId: input.projectBOQItemId,
        },
      },
      create: {
        id: randomUUID(),
        companyId,
        executionPlanId: activity.executionPlanId,
        executionActivityId: activityId,
        projectBOQItemId: input.projectBOQItemId,
        plannedQuantity: money(input.plannedQuantity),
      },
      update: { plannedQuantity: money(input.plannedQuantity) },
    });
  }

  async approvePlan(companyId: string, planId: string, userId?: string) {
    const plan = await prisma.projectExecutionPlan.findFirst({
      where: { id: planId, companyId },
      include: { activities: { include: { boqAllocations: true } } },
    });
    if (!plan) throw new AppError(404, 'مخطط التنفيذ غير موجود');
    if (plan.status !== 'DRAFT') throw new AppError(422, 'المخطط ليس مسودة');

    const snapshot = {
      planName: plan.planName,
      versionNumber: plan.versionNumber,
      plannedStart: plan.plannedStart,
      plannedFinish: plan.plannedFinish,
      activities: plan.activities.map((a) => ({
        code: a.code,
        nameAr: a.nameAr,
        plannedStart: a.plannedStart,
        plannedFinish: a.plannedFinish,
        allocations: a.boqAllocations.map((x) => ({
          projectBOQItemId: x.projectBOQItemId,
          plannedQuantity: Number(x.plannedQuantity),
        })),
      })),
      approvedAt: new Date().toISOString(),
    };

    const isFirst = !(await prisma.projectExecutionPlan.findFirst({
      where: {
        companyId,
        projectId: plan.projectId,
        baselineKind: 'ORIGINAL_BASELINE',
        id: { not: planId },
      },
    }));

    return prisma.projectExecutionPlan.update({
      where: { id: planId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: userId ?? null,
        baselineSnapshot: snapshot,
        baselineKind: isFirst ? 'ORIGINAL_BASELINE' : plan.baselineKind,
      },
    });
  }

  async activatePlan(companyId: string, planId: string) {
    const plan = await prisma.projectExecutionPlan.findFirst({ where: { id: planId, companyId } });
    if (!plan) throw new AppError(404, 'مخطط التنفيذ غير موجود');
    if (plan.status !== 'APPROVED') throw new AppError(422, 'يجب اعتماد المخطط قبل التفعيل');

    await prisma.$transaction(async (tx) => {
      await tx.projectExecutionPlan.updateMany({
        where: { companyId, projectId: plan.projectId, status: 'ACTIVE' },
        data: { status: 'SUPERSEDED' },
      });
      await tx.projectExecutionPlan.update({
        where: { id: planId },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          baselineKind:
            plan.baselineKind === 'ORIGINAL_BASELINE' ? 'ORIGINAL_BASELINE' : 'CURRENT_APPROVED',
        },
      });
    });
    return this.getActivePlan(companyId, plan.projectId);
  }

  async getDraftPlan(companyId: string, projectId: string) {
    return prisma.projectExecutionPlan.findFirst({
      where: { companyId, projectId, status: 'DRAFT' },
      include: {
        activities: { include: { boqAllocations: true }, orderBy: { sortOrder: 'asc' } },
        milestones: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlanById(companyId: string, planId: string) {
    return prisma.projectExecutionPlan.findFirst({
      where: { id: planId, companyId },
      include: {
        activities: { include: { boqAllocations: true }, orderBy: { sortOrder: 'asc' } },
        milestones: true,
      },
    });
  }

  async updateDraftPlan(
    companyId: string,
    planId: string,
    input: { planName?: string; plannedStart?: Date; plannedFinish?: Date }
  ) {
    const plan = await prisma.projectExecutionPlan.findFirst({ where: { id: planId, companyId } });
    if (!plan) throw new AppError(404, 'مخطط التنفيذ غير موجود');
    if (plan.status !== 'DRAFT') throw new AppError(422, 'لا يمكن تعديل مخطط غير مسودة');
    return prisma.projectExecutionPlan.update({
      where: { id: planId },
      data: {
        planName: input.planName ?? plan.planName,
        plannedStart: input.plannedStart ?? plan.plannedStart,
        plannedFinish: input.plannedFinish ?? plan.plannedFinish,
      },
    });
  }

  async deleteActivity(companyId: string, activityId: string) {
    const activity = await prisma.projectExecutionActivity.findFirst({
      where: { id: activityId, companyId },
      include: { executionPlan: true },
    });
    if (!activity) throw new AppError(404, 'النشاط غير موجود');
    if (activity.executionPlan.status !== 'DRAFT') {
      throw new AppError(422, 'لا يمكن حذف نشاط خارج المسودة');
    }
    await prisma.executionActivityBoqAllocation.deleteMany({ where: { executionActivityId: activityId } });
    await prisma.projectExecutionActivity.delete({ where: { id: activityId } });
    return { deleted: true };
  }

  async deleteBoqAllocation(companyId: string, activityId: string, projectBOQItemId: string) {
    const activity = await prisma.projectExecutionActivity.findFirst({
      where: { id: activityId, companyId },
      include: { executionPlan: true },
    });
    if (!activity) throw new AppError(404, 'النشاط غير موجود');
    if (activity.executionPlan.status !== 'DRAFT') {
      throw new AppError(422, 'لا يمكن حذف توزيع خارج المسودة');
    }
    await prisma.executionActivityBoqAllocation.deleteMany({
      where: { executionActivityId: activityId, projectBOQItemId },
    });
    return { deleted: true };
  }

  async createRevisionFromActive(companyId: string, projectId: string, userId?: string) {
    const active = await this.getActivePlan(companyId, projectId);
    if (!active) throw new AppError(422, 'لا يوجد مخطط نشط لإنشاء مراجعة');
    const rev = await this.createPlan(companyId, projectId, {
      planName: `${active.planName} — مراجعة`,
      plannedStart: active.plannedStart,
      plannedFinish: active.plannedFinish,
      revisionOfPlanId: active.id,
      createdBy: userId,
    });
    for (const act of active.activities) {
      const copy = await this.upsertActivity(companyId, rev.id, {
        code: act.code,
        nameAr: act.nameAr,
        plannedStart: act.plannedStart,
        plannedFinish: act.plannedFinish,
        weight: act.weight != null ? Number(act.weight) : undefined,
        sortOrder: act.sortOrder,
      });
      for (const alloc of act.boqAllocations) {
        await this.setBoqAllocation(companyId, copy.id, {
          projectBOQItemId: alloc.projectBOQItemId,
          plannedQuantity: Number(alloc.plannedQuantity),
        });
      }
    }
    return this.getPlanById(companyId, rev.id);
  }

  async deleteMilestone(companyId: string, milestoneId: string) {
    const ms = await prisma.projectExecutionMilestone.findFirst({ where: { id: milestoneId, companyId } });
    if (!ms) throw new AppError(404, 'المعلم غير موجود');
    if (ms.executionPlanId) {
      const plan = await prisma.projectExecutionPlan.findFirst({ where: { id: ms.executionPlanId, companyId } });
      if (plan && plan.status !== 'DRAFT') throw new AppError(422, 'لا يمكن حذف معلم مخطط معتمد');
    }
    await prisma.projectExecutionMilestone.delete({ where: { id: milestoneId } });
    return { deleted: true };
  }

  async upsertMilestone(
    companyId: string,
    projectId: string,
    input: {
      milestoneId?: string;
      executionPlanId?: string;
      nameAr: string;
      plannedDate: Date;
      actualDate?: Date | null;
    }
  ) {
    await this.assertProject(companyId, projectId);
    const status =
      input.actualDate != null
        ? 'COMPLETED'
        : input.plannedDate < new Date()
          ? 'DELAYED'
          : 'PENDING';
    if (input.milestoneId) {
      return prisma.projectExecutionMilestone.update({
        where: { id: input.milestoneId },
        data: {
          nameAr: input.nameAr,
          plannedDate: input.plannedDate,
          actualDate: input.actualDate ?? null,
          status,
        },
      });
    }
    return prisma.projectExecutionMilestone.create({
      data: {
        id: randomUUID(),
        companyId,
        projectId,
        executionPlanId: input.executionPlanId ?? null,
        nameAr: input.nameAr,
        plannedDate: input.plannedDate,
        actualDate: input.actualDate ?? null,
        status,
      },
    });
  }

  async effectiveBoqQuantity(companyId: string, projectId: string, projectBOQItemId: string) {
    const boq = await prisma.projectBOQItem.findFirst({
      where: { id: projectBOQItemId, companyId, projectId },
    });
    if (!boq) return 0;
    const contract = await prisma.clientContract.findFirst({ where: { companyId, projectId } });
    const voLines = contract
      ? await loadApprovedOwnerVariationLinesInTx(prisma, companyId, contract.id)
      : [];
    return Number(
      resolveEffectiveOwnerBoqQuantityFromBase(boq.contractQuantity, voLines, boq.id)
    );
  }

  async plannedBoqUnitCost(companyId: string, projectBOQItemId: string) {
    const boq = await prisma.projectBOQItem.findFirst({
      where: { id: projectBOQItemId, companyId },
      include: { rateAnalysisItems: true },
    });
    if (!boq) return null;
    if (boq.rateAnalysisItems.length) {
      const direct = rateAnalysisCalculationService.calculateDirectUnitCost(
        boq.id,
        boq.rateAnalysisItems
      );
      return Number(direct.totalDirectCost.toString());
    }
    if (Number(boq.directCostEstimated) > 0) return Number(boq.directCostEstimated);
    return null;
  }

  private async assertProject(companyId: string, projectId: string) {
    const p = await prisma.contractingProject.findFirst({ where: { id: projectId, companyId } });
    if (!p) throw new ContractingProjectNotFoundError(companyId, projectId);
  }
}

export const projectExecutionPlanService = new ProjectExecutionPlanService();
