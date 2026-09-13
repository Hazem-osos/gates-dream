import { z } from 'zod';
import prisma from '../../../shared/database/prisma';
import { isAiConfigured } from '../config/ai.config';
import { GATES_ERP_CONSTITUTION } from '../constants/gates-constitution';
import type { AIProvider } from '../interfaces/ai-provider';
import { getBlueprint, resolveModuleSlug } from './academy-blueprints';
import type {
  AcademyProgressInput,
  AcademyStatus,
  ModuleTourPlan,
  TourExpectedAction,
  TourStep,
} from './academy.types';
import { MAX_TOUR_DISMISSES } from './academy.types';

const generatedPlanSchema = z.object({
  moduleSlug: z.string().trim().min(1).max(80).optional(),
  titleAr: z.string().trim().min(3).max(160),
  estimatedSeconds: z.number().int().min(20).max(300).optional(),
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive().optional(),
        targetSelector: z.string().trim().min(2).max(200),
        titleAr: z.string().trim().min(2).max(120),
        descriptionAr: z.string().trim().min(8).max(800),
        expectedAction: z.enum(['CLICK', 'TYPE', 'INFO_NEXT']),
        simulatedValue: z.string().trim().max(80).optional(),
      })
    )
    .min(2)
    .max(8),
});

function actorRole(role?: string): string {
  return role?.trim() || 'USER';
}

function toStatus(moduleSlug: string, row?: {
  isCompleted: boolean;
  lastStepIndex: number;
  dismissedCount: number;
} | null): AcademyStatus {
  const isCompleted = Boolean(row?.isCompleted);
  const dismissedCount = row?.dismissedCount ?? 0;
  return {
    moduleSlug,
    isCompleted,
    lastStepIndex: row?.lastStepIndex ?? 0,
    dismissedCount,
    shouldTrigger: !isCompleted && dismissedCount < MAX_TOUR_DISMISSES,
  };
}

function sanitizeSelector(value: string): string | null {
  const selector = value.trim();
  if (!/^[#.\[][\w\-='"[\]\s.#]+$/.test(selector)) return null;
  return selector;
}

function normalizeGeneratedPlan(moduleSlug: string, raw: unknown): ModuleTourPlan | null {
  const parsed = generatedPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const steps: TourStep[] = [];
  parsed.data.steps.forEach((step, index) => {
    const targetSelector = sanitizeSelector(step.targetSelector);
    if (!targetSelector) return;
    const expectedAction = step.expectedAction as TourExpectedAction;
    steps.push({
      stepNumber: index + 1,
      targetSelector,
      titleAr: step.titleAr,
      descriptionAr: step.descriptionAr,
      expectedAction,
      simulatedValue: step.simulatedValue,
    });
  });
  if (steps.length < 2) return null;
  return {
    moduleSlug,
    titleAr: parsed.data.titleAr,
    estimatedSeconds: parsed.data.estimatedSeconds ?? 80,
    steps,
    source: 'ai',
  };
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = (fenced?.[1] ?? text).trim();
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return JSON.parse(payload.slice(start, end + 1));
}

function genericScreenFallback(moduleSlug: string, currentPath?: string): ModuleTourPlan {
  return {
    moduleSlug,
    titleAr: 'جولة عناصر التحكم القياسية',
    estimatedSeconds: 60,
    source: 'blueprint',
    steps: [
      {
        stepNumber: 1,
        targetSelector: "[data-tour='document-header']",
        titleAr: 'ترويسة الحركة',
        descriptionAr: `راجع نوع المستند في ${currentPath || 'هذه الشاشة'} ثم أكمل البيانات الإلزامية قبل البنود. التزم بمسارات الدستور ولا تخمّن أرصدة أو أسعاراً.`,
        expectedAction: 'INFO_NEXT',
      },
      {
        stepNumber: 2,
        targetSelector: "[data-tour='three-dots-menu']",
        titleAr: 'قائمة الإجراءات (...) ',
        descriptionAr:
          'قائمة الثلاث نقاط تحتوي تعديل، ترحيل، إلغاء الترحيل، طباعة، إلغاء، وتكرار. زر السابق للعرض فقط. لا تُرحَّل الحركة إلا بفعل صريح منك.',
        expectedAction: 'CLICK',
      },
    ],
  };
}

export class AcademyTourService {
  constructor(private readonly provider: AIProvider) {}

  resolveSlug(input: { moduleSlug?: string; currentPath?: string; role?: string }): string {
    return resolveModuleSlug(input);
  }

  async checkStatus(input: {
    companyId: string;
    userId: string;
    moduleSlug?: string;
    currentPath?: string;
    role?: string;
  }): Promise<AcademyStatus> {
    const moduleSlug = this.resolveSlug(input);
    const row = await prisma.userTourProgress.findFirst({
      where: { companyId: input.companyId, userId: input.userId, moduleSlug },
    });
    return toStatus(moduleSlug, row);
  }

  async getTour(input: {
    companyId: string;
    userId: string;
    moduleSlug?: string;
    currentPath?: string;
    role?: string;
  }): Promise<ModuleTourPlan> {
    const moduleSlug = this.resolveSlug(input);
    const blueprint = getBlueprint(moduleSlug);
    if (blueprint) return this.tailorForRole(blueprint, input.role);
    const generated = await this.generateWithAi(moduleSlug, input);
    return generated ?? genericScreenFallback(moduleSlug, input.currentPath);
  }

  async recordProgress(input: {
    companyId: string;
    userId: string;
    progress: AcademyProgressInput;
    currentPath?: string;
    role?: string;
  }): Promise<AcademyStatus> {
    const moduleSlug = this.resolveSlug({
      moduleSlug: input.progress.moduleSlug,
      currentPath: input.currentPath,
      role: input.role,
    });
    const existing = await prisma.userTourProgress.findFirst({
      where: { companyId: input.companyId, userId: input.userId, moduleSlug },
    });

    const isCompleted = input.progress.isCompleted === true || Boolean(existing?.isCompleted);
    const dismissedCount =
      (existing?.dismissedCount ?? 0) + (input.progress.dismissed === true ? 1 : 0);
    const lastStepIndex = input.progress.lastStepIndex ?? existing?.lastStepIndex ?? 0;

    const row = await prisma.userTourProgress.upsert({
      where: { userId_moduleSlug: { userId: input.userId, moduleSlug } },
      create: {
        companyId: input.companyId,
        userId: input.userId,
        moduleSlug,
        isCompleted,
        lastStepIndex,
        dismissedCount,
        completedAt: isCompleted ? new Date() : null,
      },
      update: {
        isCompleted,
        lastStepIndex,
        dismissedCount,
        completedAt: isCompleted ? existing?.completedAt ?? new Date() : null,
      },
    });
    return toStatus(moduleSlug, row);
  }

  private tailorForRole(plan: ModuleTourPlan, role?: string): ModuleTourPlan {
    const label = actorRole(role);
    if (plan.moduleSlug !== 'sales-invoice') return plan;
    if (/cashier|كاشير|pos/i.test(label)) {
      return {
        ...plan,
        titleAr: 'فاتورة المبيعات السريعة — للكاشير',
        estimatedSeconds: 70,
      };
    }
    return plan;
  }

  private async generateWithAi(
    moduleSlug: string,
    input: { currentPath?: string; role?: string }
  ): Promise<ModuleTourPlan | null> {
    if (!isAiConfigured()) return null;
    try {
      const result = await this.provider.complete({
        temperature: 0.15,
        maxTokens: 900,
        messages: [
          {
            role: 'system',
            content: `أنت مولّد جولات أكاديمية تفاعلية لنظام Gates ERP.
أرجع JSON فقط بالشكل:
{"titleAr":"...","estimatedSeconds":80,"steps":[{"targetSelector":"[data-tour='...']","titleAr":"...","descriptionAr":"...","expectedAction":"CLICK|TYPE|INFO_NEXT","simulatedValue":"اختياري"}]}
القواعد:
- كل خطوة تستهدف عنصراً حقيقياً في الواجهة عبر data-tour أو id.
- النصوص عربية فصحى مختصرة وتطابق الدستور التالي حرفياً في الإجراءات المحاسبية.
- ممنوع اختراع أرصدة أو أرقام أو مسارات مخالفة للدستور.
- لا تذكر فيديوهات أو أكاديمية ثابتة قديمة.

الدستور:
${GATES_ERP_CONSTITUTION}`,
          },
          {
            role: 'user',
            content: `ولّد مهمة تعريفية للشاشة.
moduleSlug=${moduleSlug}
currentPath=${input.currentPath ?? ''}
role=${actorRole(input.role)}`,
          },
        ],
      });
      const raw = extractJsonObject(result.content ?? '');
      return normalizeGeneratedPlan(moduleSlug, raw);
    } catch {
      return null;
    }
  }
}
