/** Minimal legacy field helpers for migration-engine (no dependency on scripts/migration). */

export function legacyTrim(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function legacyDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? null : d;
}
