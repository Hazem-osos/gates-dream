import type { LicenseModuleCode } from '../../platform/types/license-modules';

export const DIAGNOSTIC_NARRATIVE_MODEL = 'gpt-5.6-luna';

export const DIAGNOSTIC_PROBE_KEYS = [
  'financial',
  'sales',
  'inventory',
  'contracting',
  'manufacturing',
  'real-estate',
  'hr',
] as const;

export type DiagnosticProbeKey = (typeof DIAGNOSTIC_PROBE_KEYS)[number];

export type DiagnosticStatus = 'excellent' | 'stable' | 'critical';

export type DiagnosticMetricUnit = 'money' | 'percent' | 'days' | 'ratio' | 'months' | 'count';

export type DiagnosticMetric = {
  id: string;
  label: string;
  value: number;
  unit: DiagnosticMetricUnit;
  score: number;
};

export type DiagnosticAction = {
  label: string;
  href: string;
};

export type DiagnosticProbeResult = {
  key: DiagnosticProbeKey;
  labelAr: string;
  licenseCode: LicenseModuleCode | null;
  score: number;
  weight: number;
  status: DiagnosticStatus;
  metrics: DiagnosticMetric[];
  findings: string[];
  actions: DiagnosticAction[];
};

export type DiagnosticDecision = {
  rank: number;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

export type DiagnosticModuleTag = {
  key: DiagnosticProbeKey;
  labelAr: string;
};

export type DiagnosticReport = {
  generatedAt: string;
  asOf: string;
  companyHealthScore: number;
  status: DiagnosticStatus;
  statusLabel: string;
  evaluatedModules: DiagnosticModuleTag[];
  skippedModules: Array<DiagnosticModuleTag & { reason: string }>;
  unrestricted: boolean;
  allowedModules: string[];
  probes: DiagnosticProbeResult[];
  briefing: string;
  decisions: DiagnosticDecision[];
  narrativeSource: 'ai' | 'fallback';
  model: string;
};

export const PROBE_LICENSE: Record<DiagnosticProbeKey, LicenseModuleCode | null> = {
  financial: null,
  sales: 'INVENTORY',
  inventory: 'INVENTORY',
  contracting: 'CONTRACTING',
  manufacturing: 'MANUFACTURING',
  'real-estate': 'REAL_ESTATE',
  hr: 'PAYROLL',
};

export const PROBE_WEIGHT: Record<DiagnosticProbeKey, number> = {
  financial: 25,
  sales: 15,
  inventory: 15,
  contracting: 15,
  manufacturing: 10,
  'real-estate': 10,
  hr: 10,
};

export const PROBE_LABEL_AR: Record<DiagnosticProbeKey, string> = {
  financial: 'المحاسبة',
  sales: 'المبيعات',
  inventory: 'المخزون',
  contracting: 'المقاولات',
  manufacturing: 'التصنيع',
  'real-estate': 'العقارات',
  hr: 'الموارد البشرية',
};

export const STATUS_LABEL_AR: Record<DiagnosticStatus, string> = {
  excellent: 'ممتاز',
  stable: 'مستقر مع ملاحظات',
  critical: 'يحتاج تدخل فوري',
};
