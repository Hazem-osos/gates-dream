import { logger } from '../../../shared/logger';
import { isAiConfigured } from '../../ai/config/ai.config';
import { OpenAIProvider } from '../../ai/providers/openai.provider';
import prisma from '../../../shared/database/prisma';

const provider = new OpenAIProvider();

type Explainable = {
  id: string;
  title: string;
  type: string;
  category: string;
  description: string;
  whyDetected: string;
  estimatedValue: unknown;
  evidence: unknown;
};

function compactEvidence(evidence: unknown): Record<string, unknown> {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(evidence as Record<string, unknown>)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      out[key] = value.slice(0, 6);
      continue;
    }
    if (typeof value === 'object') continue;
    out[key] = value;
  }
  return out;
}

export async function explainOpportunity(row: Explainable): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const payload = {
    title: row.title,
    type: row.type,
    category: row.category,
    description: row.description,
    whyDetected: row.whyDetected,
    estimatedValue: Number(row.estimatedValue) || 0,
    evidence: compactEvidence(row.evidence),
  };
  try {
    const result = await provider.complete({
      temperature: 0.2,
      maxTokens: 280,
      messages: [
        {
          role: 'system',
          content:
            'أنت محلل مالي في Gates ERP. اكتب بالعربية فقرة واحدة (3-5 جمل) تفسر الفرصة وتقترح الخطوة التالية. استخدم الأرقام الواردة فقط. ممنوع اختراع مبالغ أو نسب أو عملاء أو أصناف. لا تصف الأمر كاحتيال. ابدأ بجملة عملية لا بعموميات.',
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    const text = result.content?.trim() ?? '';
    if (text.length < 20) return null;
    return text.slice(0, 1200);
  } catch (error) {
    logger.warn({ error, opportunityId: row.id }, 'Growth AI explanation failed');
    return null;
  }
}

export async function explainMissingOpportunities(companyId: string, limit = 6): Promise<void> {
  const rows = await prisma.growthOpportunity.findMany({
    where: {
      companyId,
      aiExplanation: null,
      status: { in: ['NEW', 'REVIEWED', 'ACTION_TAKEN'] },
    },
    orderBy: { estimatedValue: 'desc' },
    take: limit,
  });
  for (const row of rows) {
    const text = await explainOpportunity(row);
    if (!text) continue;
    await prisma.growthOpportunity.update({
      where: { id: row.id },
      data: { aiExplanation: text },
    });
  }
}
