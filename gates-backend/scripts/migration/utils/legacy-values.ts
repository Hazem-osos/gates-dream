export function legacyBool(value: unknown, defaultValue = false): boolean {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value).trim().toUpperCase();
  if (['T', 'Y', '1', 'TRUE', 'YES'].includes(s)) return true;
  if (['F', 'N', '0', 'FALSE', 'NO'].includes(s)) return false;
  return defaultValue;
}

export function legacyTrim(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function legacyDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function legacyDecimal(value: unknown, decimals = 4): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export function padGlNum(value: unknown): string {
  const raw = legacyTrim(value).replace(/\D/g, '');
  if (!raw) return '';
  return raw.padStart(8, '0').slice(-8);
}

export function companyFilter(row: Record<string, unknown>, companyCode?: string): boolean {
  if (!companyCode) return true;
  const c = legacyTrim(row.CompanyCode ?? row.companyCode);
  return c === companyCode;
}
