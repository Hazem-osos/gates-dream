'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';

export type DiagnosticStatus = 'excellent' | 'stable' | 'critical';

export type DiagnosticProbeKey =
  | 'financial'
  | 'sales'
  | 'inventory'
  | 'contracting'
  | 'manufacturing'
  | 'real-estate'
  | 'hr';

export type DiagnosticMetric = {
  id: string;
  label: string;
  value: number;
  unit: 'money' | 'percent' | 'days' | 'ratio' | 'months' | 'count';
  score: number;
};

export type DiagnosticProbeResult = {
  key: DiagnosticProbeKey;
  labelAr: string;
  licenseCode: string | null;
  score: number;
  weight: number;
  status: DiagnosticStatus;
  metrics: DiagnosticMetric[];
  findings: string[];
  actions: Array<{ label: string; href: string }>;
};

export type DiagnosticDecision = {
  rank: number;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

export type DiagnosticReport = {
  generatedAt: string;
  asOf: string;
  companyHealthScore: number;
  status: DiagnosticStatus;
  statusLabel: string;
  evaluatedModules: Array<{ key: DiagnosticProbeKey; labelAr: string }>;
  skippedModules: Array<{ key: DiagnosticProbeKey; labelAr: string; reason: string }>;
  unrestricted: boolean;
  allowedModules: string[];
  probes: DiagnosticProbeResult[];
  briefing: string;
  decisions: DiagnosticDecision[];
  narrativeSource: 'ai' | 'fallback';
  model: string;
};

export function useDiagnosticReport() {
  const q = useApiQuery<DiagnosticReport>(
    queryKeys.ai.diagnosticReport(),
    '/ai/diagnostic/report',
    undefined,
    { staleTime: 60_000, retry: 1 }
  );
  return { ...q, report: q.data?.data };
}
