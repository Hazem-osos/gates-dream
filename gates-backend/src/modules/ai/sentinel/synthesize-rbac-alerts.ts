import type { AIProvider } from '../interfaces/ai-provider';
import { isAiConfigured } from '../config/ai.config';
import { logger } from '../../../shared/logger';
import type { SentinelFinding } from './ai-notification.types';

export async function synthesizeRbacAlerts(
  provider: AIProvider,
  findings: SentinelFinding[]
): Promise<SentinelFinding[]> {
  if (!findings.length) return [];
  if (!isAiConfigured()) return findings;

  try {
    const result = await provider.complete({
      temperature: 0.2,
      maxTokens: 900,
      messages: [
        {
          role: 'system',
          content:
            'أنت Gates Intelligence. حوّل التنبيه الحتمي إلى جملة عربية مصرية واضحة قابلة للتنفيذ. لا تغيّر أي رقم. أرجع JSON فقط: [{"fingerprint":"...","messageAr":"..."}].',
        },
        {
          role: 'user',
          content: JSON.stringify(
            findings.map((finding) => ({
              fingerprint: finding.fingerprint,
              category: finding.category,
              titleAr: finding.titleAr,
              messageAr: finding.messageAr,
              metadata: finding.metadata,
            }))
          ),
        },
      ],
    });
    const parsed = parseMessages(result.content);
    return findings.map((finding) => ({
      ...finding,
      messageAr: parsed.get(finding.fingerprint) || finding.messageAr,
    }));
  } catch (error) {
    logger.warn({ error }, 'RBAC sentinel synthesis failed; using deterministic copy');
    return findings;
  }
}

function parseMessages(content: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!content?.trim()) return out;
  const match = content.match(/\[[\s\S]*\]/);
  if (!match) return out;
  try {
    const rows = JSON.parse(match[0]) as Array<{ fingerprint?: string; messageAr?: string }>;
    for (const row of rows) {
      if (row.fingerprint && row.messageAr?.trim()) out.set(row.fingerprint, row.messageAr.trim());
    }
  } catch {
    return out;
  }
  return out;
}
