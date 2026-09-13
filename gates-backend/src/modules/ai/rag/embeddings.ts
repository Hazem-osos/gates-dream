import { AppError } from '../../../shared/middleware/error-handler';
import { getAiRuntimeConfig, isAiConfigured } from '../config/ai.config';
import { recordAiUsageFromResponse } from '../security/ai-quota.guard';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 32;

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  if (!isAiConfigured()) {
    throw new AppError(503, 'Gates Intelligence غير مُعد. أضف OPENAI_API_KEY في إعدادات الخادم.');
  }
  const cfg = getAiRuntimeConfig();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await fetch(`${cfg.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: batch }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new AppError(502, `Embedding request failed (${response.status}) ${detail}`.trim());
    }
    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
      usage?: { total_tokens?: number };
    };
    await recordAiUsageFromResponse(json.usage);
    const rows = [...(json.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const row of rows) {
      if (!row.embedding || row.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new AppError(502, 'Unexpected embedding dimensions');
      }
      out.push(row.embedding);
    }
  }
  if (out.length !== texts.length) {
    throw new AppError(502, 'Embedding batch size mismatch');
  }
  return out;
}
