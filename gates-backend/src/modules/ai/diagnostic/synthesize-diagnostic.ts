import { logger } from '../../../shared/logger';
import { isAiConfigured } from '../config/ai.config';
import type { AIProvider } from '../interfaces/ai-provider';
import { isNarrativeGrounded } from './diagnostic.math';
import {
  DIAGNOSTIC_NARRATIVE_MODEL,
  STATUS_LABEL_AR,
  type DiagnosticDecision,
  type DiagnosticProbeResult,
  type DiagnosticReport,
} from './diagnostic.types';

export type DiagnosticCompactPayload = {
  asOf: string;
  companyHealthScore: number;
  statusLabel: string;
  modules: string[];
  probes: Array<{
    key: string;
    labelAr: string;
    score: number;
    findings: string[];
    metrics: Array<{ label: string; value: number }>;
    actionLabel: string;
    href: string;
  }>;
};

export function toCompactDiagnostic(report: Pick<
  DiagnosticReport,
  'asOf' | 'companyHealthScore' | 'statusLabel' | 'evaluatedModules' | 'probes'
>): DiagnosticCompactPayload {
  return {
    asOf: report.asOf,
    companyHealthScore: report.companyHealthScore,
    statusLabel: report.statusLabel,
    modules: report.evaluatedModules.map((row) => row.labelAr),
    probes: report.probes.map((probe) => ({
      key: probe.key,
      labelAr: probe.labelAr,
      score: probe.score,
      findings: probe.findings.slice(0, 2),
      metrics: probe.metrics.slice(0, 3).map((metric) => ({ label: metric.label, value: metric.value })),
      actionLabel: probe.actions[0]?.label ?? probe.labelAr,
      href: probe.actions[0]?.href ?? '/',
    })),
  };
}

export function buildFallbackNarrative(payload: DiagnosticCompactPayload): {
  briefing: string;
  decisions: DiagnosticDecision[];
} {
  const worst = [...payload.probes].sort((a, b) => a.score - b.score).slice(0, 3);
  const briefing = [
    `ملخص الموقف التنفيذي: الصحة المؤسسية ${payload.companyHealthScore}/100 — ${payload.statusLabel}.`,
    `الموديولات المفحوصة: ${payload.modules.join(' · ') || 'المحاسبة'}.`,
    ...payload.probes.slice(0, 4).map((probe) => `${probe.labelAr} ${probe.score}/100. ${probe.findings[0] ?? ''}`),
  ].join('\n');

  const decisions: DiagnosticDecision[] = worst.map((probe, index) => ({
    rank: index + 1,
    title: probe.findings[0] || `مراجعة ${probe.labelAr}`,
    detail: probe.findings[1] || `درجة ${probe.labelAr} ${probe.score}. ابدأ من الرابط التشغيلي المرتبط.`,
    href: probe.href,
    actionLabel: probe.actionLabel,
  }));

  while (decisions.length < 3 && payload.probes[decisions.length]) {
    const probe = payload.probes[decisions.length];
    decisions.push({
      rank: decisions.length + 1,
      title: `متابعة ${probe.labelAr}`,
      detail: `الدرجة ${probe.score}. ${probe.findings[0] ?? ''}`,
      href: probe.href,
      actionLabel: probe.actionLabel,
    });
  }

  return { briefing, decisions: decisions.slice(0, 3) };
}

function parseDecisions(content: string, fallback: DiagnosticDecision[]): DiagnosticDecision[] {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as {
      briefing?: string;
      decisions?: Array<{ title?: string; detail?: string; href?: string; actionLabel?: string }>;
    };
    const allowedHrefs = new Set(fallback.map((row) => row.href));
    const decisions = (parsed.decisions ?? [])
      .filter((row) => row.title && row.detail && row.href && allowedHrefs.has(row.href))
      .slice(0, 3)
      .map((row, index) => ({
        rank: index + 1,
        title: String(row.title),
        detail: String(row.detail),
        href: String(row.href),
        actionLabel: String(row.actionLabel || fallback[index]?.actionLabel || 'فتح'),
      }));
    if (decisions.length < 1) return fallback;
    return decisions.length >= 3 ? decisions : [...decisions, ...fallback].slice(0, 3);
  } catch {
    return fallback;
  }
}

export async function synthesizeDiagnosticNarrative(
  provider: AIProvider,
  payload: DiagnosticCompactPayload
): Promise<{ briefing: string; decisions: DiagnosticDecision[]; source: 'ai' | 'fallback'; model: string }> {
  const fallback = buildFallbackNarrative(payload);
  const model = process.env.DIAGNOSTIC_AI_MODEL?.trim() || DIAGNOSTIC_NARRATIVE_MODEL;
  if (!isAiConfigured()) {
    return { ...fallback, source: 'fallback', model };
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
            'أنت مستشار تنفيذي لـ Gates ERP. أعد JSON فقط بالشكل {"briefing":"...","decisions":[{"title":"...","detail":"...","href":"...","actionLabel":"..."}]} بالعربية الفصحى المختصرة. briefing = ملخص الموقف التنفيذي في 3-5 أسطر. decisions = 3 قرارات إدارية ملزمة فوراً. استخدم href وactionLabel من JSON المدخل فقط. ممنوع اختراع أرقام أو وحدات أو روابط غير موجودة.',
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    const content = result.content?.trim() ?? '';
    if (!content || !isNarrativeGrounded(content, payload)) {
      logger.warn('Diagnostic narrative rejected (empty or ungrounded); using fallback');
      return { ...fallback, source: 'fallback', model };
    }
    const match = content.match(/\{[\s\S]*\}/);
    const briefing = match ? (JSON.parse(match[0]) as { briefing?: string }).briefing : undefined;
    if (!briefing || !isNarrativeGrounded(briefing, payload)) {
      return { ...fallback, source: 'fallback', model };
    }
    return {
      briefing,
      decisions: parseDecisions(content, fallback.decisions),
      source: 'ai',
      model,
    };
  } catch (error) {
    logger.warn({ error }, 'Diagnostic narrative synthesis failed; using fallback');
    return { ...fallback, source: 'fallback', model };
  }
}

export { STATUS_LABEL_AR };
