import { logger } from '../../../shared/logger';
import { isAiConfigured } from '../config/ai.config';
import type { AIProvider } from '../interfaces/ai-provider';
import { isNarrativeGrounded } from './sentinel.math';
import {
  SENTINEL_NARRATIVE_MODEL,
  type SentinelCompactPayload,
} from './sentinel.types';

export function buildFallbackNarrative(payload: SentinelCompactPayload): string {
  const lines: string[] = ['تقرير الرقابة الداخلية ودرع السيولة'];
  const { counts } = payload;

  if (counts.fraud + counts.replacement + counts.cashflow === 0) {
    lines.push('المسح الآلي لم يرصد شبهات إلغاء أو بيع دون تكلفة الإحلال أو فجوة سيولة مقاولات في النوافذ المحددة.');
    return lines.join('\n');
  }

  if (payload.voidPatterns.length) {
    const top = payload.voidPatterns[0];
    lines.push(
      `كشف الشبهات: ${payload.voidPatterns.length} مستخدم بنسبة إلغاء أعلى من 5٪. الأعلى ${top.userName} بمعدل ${top.voidRatePct}٪ على حجم ${top.totalVolume} (ملغى ${top.cancelledVolume}).`
    );
  } else {
    lines.push('كشف الشبهات: لا يوجد مستخدم يتجاوز حد الإلغاء 5٪.');
  }

  if (payload.backdated.length) {
    const top = payload.backdated[0];
    lines.push(
      `فواتير بتاريخ سابق: ${payload.backdated.length} حركة. أطول تأخير ${top.lagDays} يوماً على ${top.invoiceNumber} بواسطة ${top.userName}.`
    );
  }

  if (payload.shortages.length) {
    const top = payload.shortages[0];
    lines.push(
      `تسويات عجز متكررة خلال 30 يوماً: ${payload.shortages.length} صنف. الأعلى ${top.itemName} بعد ${top.eventCount} حركة بكمية ${top.totalShortageQty}.`
    );
  }

  if (payload.replacement.length) {
    const top = payload.replacement[0];
    lines.push(
      `درع التضخم: ${payload.replacement.length} صنف بيع بسعر دون تكلفة الإحلال. مثال ${top.itemName}: بيع ${top.salePrice} مقابل إحلال ${top.replacementCost} (متوسط تاريخي ${top.averageCost}). السعر المقترح ${top.suggestedSalePrice}.`
    );
  } else {
    lines.push('درع التضخم: لا توجد مبيعات دون تكلفة الإحلال خلال 7 أيام.');
  }

  const cash = payload.cashflow;
  if (cash.projects.length || cash.companyGap > 0) {
    lines.push(
      `رادار المقاولات خلال ${cash.horizonDays} يوماً: مستحقات مقاولين ${cash.totalSubcontractorDue21d} مقابل مستخلصات معتمدة ${cash.totalOwnerInflow21d} وسيولة ${cash.liquidTotal}. فجوة الشركة ${cash.companyGap}.`
    );
    if (cash.projects[0]) {
      const p = cash.projects[0];
      lines.push(`أخطر مشروع: ${p.projectName} (${p.projectCode}) بفجوة ${p.gap}.`);
    }
  } else {
    lines.push(`رادار المقاولات خلال ${cash.horizonDays} يوماً: لا فجوة بعد خصم السيولة والمستخلصات المعتمدة.`);
  }

  return lines.join('\n');
}

export function toCompactPayload(input: {
  asOf: string;
  fraud: {
    voidPatterns: Array<{
      userName: string;
      voidRate: number;
      cancelledVolume: number;
      totalVolume: number;
      cancelledCount: number;
    }>;
    backdated: Array<{ invoiceNumber: string; lagDays: number; userName: string }>;
    shortages: Array<{ itemName: string; eventCount: number; totalShortageQty: number }>;
  };
  replacement: Array<{
    itemName: string;
    salePrice: number;
    replacementCost: number;
    averageCost: number;
    suggestedSalePrice: number;
    soldAboveAverageCost: boolean;
  }>;
  cashflow: {
    liquidTotal: number;
    totalSubcontractorDue21d: number;
    totalOwnerInflow21d: number;
    companyGap: number;
    horizonDays: number;
    projects: Array<{
      projectName: string;
      projectCode: string;
      subcontractorDue21d: number;
      ownerInflow21d: number;
      gap: number;
    }>;
  };
}): SentinelCompactPayload {
  return {
    asOf: input.asOf,
    counts: {
      fraud:
        input.fraud.voidPatterns.length +
        input.fraud.backdated.length +
        input.fraud.shortages.length,
      replacement: input.replacement.length,
      cashflow: input.cashflow.projects.length,
    },
    voidPatterns: input.fraud.voidPatterns.map((row) => ({
      userName: row.userName,
      voidRatePct: Math.round(row.voidRate * 10000) / 100,
      cancelledVolume: row.cancelledVolume,
      totalVolume: row.totalVolume,
      cancelledCount: row.cancelledCount,
    })),
    backdated: input.fraud.backdated.map((row) => ({
      invoiceNumber: row.invoiceNumber,
      lagDays: row.lagDays,
      userName: row.userName,
    })),
    shortages: input.fraud.shortages.map((row) => ({
      itemName: row.itemName,
      eventCount: row.eventCount,
      totalShortageQty: row.totalShortageQty,
    })),
    replacement: input.replacement.map((row) => ({
      itemName: row.itemName,
      salePrice: row.salePrice,
      replacementCost: row.replacementCost,
      averageCost: row.averageCost,
      suggestedSalePrice: row.suggestedSalePrice,
      soldAboveAverageCost: row.soldAboveAverageCost,
    })),
    cashflow: {
      liquidTotal: input.cashflow.liquidTotal,
      totalSubcontractorDue21d: input.cashflow.totalSubcontractorDue21d,
      totalOwnerInflow21d: input.cashflow.totalOwnerInflow21d,
      companyGap: input.cashflow.companyGap,
      horizonDays: input.cashflow.horizonDays,
      projects: input.cashflow.projects.map((row) => ({
        projectName: row.projectName,
        projectCode: row.projectCode,
        subcontractorDue21d: row.subcontractorDue21d,
        ownerInflow21d: row.ownerInflow21d,
        gap: row.gap,
      })),
    },
  };
}

export async function synthesizeSentinelNarrative(
  provider: AIProvider,
  payload: SentinelCompactPayload
): Promise<{ narrative: string; source: 'ai' | 'fallback'; model: string }> {
  const fallback = buildFallbackNarrative(payload);
  const model = process.env.SENTINEL_AI_MODEL?.trim() || SENTINEL_NARRATIVE_MODEL;
  if (!isAiConfigured()) {
    return { narrative: fallback, source: 'fallback', model };
  }

  try {
    const result = await provider.complete({
      model,
      temperature: 0.15,
      maxTokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'أنت مراجع داخلي تنفيذي لنظام Gates ERP. اكتب «تقرير الرقابة الداخلية ودرع السيولة» بالعربية الفصحى المختصرة (6 إلى 10 أسطر). استخدم فقط الأرقام والأسماء والوقائع الموجودة في JSON. ممنوع اختراع مبالغ أو نسب أو أصناف أو مشاريع غير موجودة. لا تضف أسعار أو فجوات لم تُذكر. إن كانت القوائم فارغة فقل إن المسح لم يرصد شذوذاً.',
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    });

    const narrative = result.content?.trim() ?? '';
    if (!narrative || !isNarrativeGrounded(narrative, payload)) {
      logger.warn('Sentinel narrative rejected (empty or ungrounded); using fallback');
      return { narrative: fallback, source: 'fallback', model };
    }
    return { narrative, source: 'ai', model };
  } catch (error) {
    logger.warn({ error }, 'Sentinel narrative synthesis failed; using fallback');
    return { narrative: fallback, source: 'fallback', model };
  }
}
