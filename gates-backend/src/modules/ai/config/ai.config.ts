import { env } from '../../../shared/config/env';

export const DEFAULT_AI_MODEL = 'gpt-4o-mini';
export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export type AiRuntimeConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

export function getAiRuntimeConfig(): AiRuntimeConfig {
  return {
    apiKey: env.OPENAI_API_KEY?.trim() ?? '',
    model: env.OPENAI_MODEL?.trim() || DEFAULT_AI_MODEL,
    baseUrl: env.OPENAI_BASE_URL?.replace(/\/$/, '') || DEFAULT_OPENAI_BASE_URL,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY?.trim());
}

export function getPublicAiConfig() {
  const cfg = getAiRuntimeConfig();
  return {
    provider: 'openai' as const,
    model: cfg.model,
    configured: isAiConfigured(),
    embeddingModel: 'text-embedding-3-small',
    rag: {
      vectorStore: Boolean(env.VECTOR_DATABASE_URL?.trim()) ? 'pgvector' : 'mysql-json',
    },
    proactive: {
      cron: '0 6 * * *',
      timezone: 'Africa/Cairo',
    },
  };
}
