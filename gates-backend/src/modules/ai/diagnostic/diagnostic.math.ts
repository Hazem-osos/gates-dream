import type { LicenseModuleCode } from '../../platform/types/license-modules';
import {
  DIAGNOSTIC_PROBE_KEYS,
  PROBE_LABEL_AR,
  PROBE_LICENSE,
  STATUS_LABEL_AR,
  type DiagnosticProbeKey,
  type DiagnosticStatus,
} from './diagnostic.types';

export function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return money(numerator / denominator);
}

export function pct(numerator: number, denominator: number): number {
  return money(ratio(numerator, denominator) * 100);
}

export function healthStatus(score: number): DiagnosticStatus {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'stable';
  return 'critical';
}

export function healthStatusLabel(score: number): string {
  return STATUS_LABEL_AR[healthStatus(score)];
}

export function bandScore(value: number, bands: Array<{ max: number; score: number }>): number {
  for (const band of bands) {
    if (value <= band.max) return band.score;
  }
  return bands[bands.length - 1]?.score ?? 50;
}

export function invertBandScore(value: number, bands: Array<{ max: number; score: number }>): number {
  return bandScore(value, bands);
}

export function weightedHealthScore(probes: Array<{ score: number; weight: number }>): number {
  const totalWeight = probes.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  if (totalWeight <= 0) return 0;
  const raw = probes.reduce((sum, row) => sum + clampScore(row.score) * Math.max(0, row.weight), 0);
  return clampScore(raw / totalWeight);
}

export function resolveActiveProbes(input: {
  unrestricted: boolean;
  allowedModules: ReadonlyArray<string>;
}): { active: DiagnosticProbeKey[]; skipped: DiagnosticProbeKey[] } {
  const allowed = new Set(input.allowedModules);
  const active: DiagnosticProbeKey[] = [];
  const skipped: DiagnosticProbeKey[] = [];
  for (const key of DIAGNOSTIC_PROBE_KEYS) {
    const need = PROBE_LICENSE[key];
    if (need == null || input.unrestricted || allowed.has(need)) {
      active.push(key);
    } else {
      skipped.push(key);
    }
  }
  return { active, skipped };
}

export function moduleTag(key: DiagnosticProbeKey) {
  return { key, labelAr: PROBE_LABEL_AR[key] };
}

export function skippedReason(key: DiagnosticProbeKey): string {
  const code = PROBE_LICENSE[key];
  return code ? `الموديول ${code} غير مفعّل في رخصة الشركة` : 'غير مشمول';
}

export function isLicenseCode(value: string): value is LicenseModuleCode {
  return (
    value === 'ACCOUNTING' ||
    value === 'INVENTORY' ||
    value === 'POS' ||
    value === 'MANUFACTURING' ||
    value === 'CONTRACTING' ||
    value === 'REAL_ESTATE' ||
    value === 'SCHOOLS' ||
    value === 'PAYROLL' ||
    value === 'ETA'
  );
}

export function extractNumericTokens(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  return matches.map(canonicalizeNumber).filter(Boolean);
}

export function canonicalizeNumber(raw: string): string {
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 10000) / 10000);
}

export function collectAllowedNumbers(value: unknown, into = new Set<string>()): Set<string> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    into.add(canonicalizeNumber(String(value)));
    return into;
  }
  if (typeof value === 'string') {
    for (const token of extractNumericTokens(value)) into.add(token);
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAllowedNumbers(item, into);
    return into;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAllowedNumbers(item, into);
  }
  return into;
}

const STRUCTURAL = ['0', '1', '2', '3', '7', '10', '21', '30', '45', '60', '70', '84', '85', '90', '100'];

export function isNarrativeGrounded(narrative: string, payload: unknown): boolean {
  const allowed = collectAllowedNumbers(payload);
  for (const token of STRUCTURAL) allowed.add(token);
  return extractNumericTokens(narrative).every((token) => allowed.has(token));
}
