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

export function padGlNum(value: unknown): string {
  const raw = legacyTrim(value).replace(/\D/g, '');
  if (!raw) return '';
  return raw.padStart(8, '0').slice(-8);
}

export function legacyBool(value: unknown, defaultValue = false): boolean {
  if (value == null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toUpperCase();
  if (['T', 'Y', '1', 'TRUE', 'YES'].includes(s)) return true;
  if (['F', 'N', '0', 'FALSE', 'NO'].includes(s)) return false;
  return defaultValue;
}
