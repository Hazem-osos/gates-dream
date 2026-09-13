import type { AIProvider } from '../interfaces/ai-provider';
import { isAiConfigured } from '../config/ai.config';
import { logger } from '../../../shared/logger';
import type { DetectorFinding } from './detector.types';

export async function synthesizeInsightSummaries(
  provider: AIProvider,
  findings: DetectorFinding[]
): Promise<Array<DetectorFinding & { summary: string }>> {
  if (!findings.length) return [];
  if (!isAiConfigured()) {
    return findings.map((finding) => ({ ...finding, summary: finding.fallbackSummary }));
  }

  try {
    const result = await provider.complete({
      temperature: 0.2,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'You are a Gates ERP CFO advisor. Translate deterministic anomaly JSON into 2-3 concise Arabic bullet points with specific business advice. Do not invent or change any number. Return ONLY a JSON array: [{"fingerprint":"...","summary":"..."}].',
        },
        {
          role: 'user',
          content: JSON.stringify(
            findings.map((finding) => ({
              fingerprint: finding.fingerprint,
              category: finding.category,
              severity: finding.severity,
              title: finding.title,
              data: finding.deterministicData,
            }))
          ),
        },
      ],
    });

    const parsed = parseSummaries(result.content);
    return findings.map((finding) => ({
      ...finding,
      summary: parsed.get(finding.fingerprint) || finding.fallbackSummary,
    }));
  } catch (error) {
    logger.warn({ error }, 'Insight synthesis failed; using deterministic summaries');
    return findings.map((finding) => ({ ...finding, summary: finding.fallbackSummary }));
  }
}

function parseSummaries(content: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!content?.trim()) return out;
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return out;
  try {
    const rows = JSON.parse(match[0]) as Array<{ fingerprint?: string; summary?: string }>;
    for (const row of rows) {
      if (row.fingerprint && row.summary?.trim()) out.set(row.fingerprint, row.summary.trim());
    }
  } catch {
    return out;
  }
  return out;
}
