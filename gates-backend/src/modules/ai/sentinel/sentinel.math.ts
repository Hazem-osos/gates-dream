import {
  BACKDATE_DAYS,
  REPLACEMENT_MARKUP,
  VOID_RATE_THRESHOLD,
} from './sentinel.types';

export function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function voidRate(cancelledVolume: number, totalVolume: number): number {
  if (totalVolume <= 0) return 0;
  return Math.round((cancelledVolume / totalVolume) * 10000) / 10000;
}

export function isHighVoidRate(rate: number, threshold = VOID_RATE_THRESHOLD): boolean {
  return rate > threshold;
}

export function calendarDayLag(createdAt: Date, invoiceDate: Date): number {
  const created = Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate());
  const invoiced = Date.UTC(invoiceDate.getUTCFullYear(), invoiceDate.getUTCMonth(), invoiceDate.getUTCDate());
  return Math.round((created - invoiced) / 86_400_000);
}

export function isBackdated(
  createdAt: Date,
  invoiceDate: Date,
  days = BACKDATE_DAYS
): boolean {
  return calendarDayLag(createdAt, invoiceDate) > days;
}

export function isBelowReplacement(salePrice: number, replacementCost: number): boolean {
  return replacementCost > 0 && salePrice < replacementCost;
}

export function suggestedSalePrice(
  replacementCost: number,
  markup = REPLACEMENT_MARKUP
): number {
  return money(replacementCost * (1 + markup));
}

export function projectLocalGap(subcontractorDue: number, ownerInflow: number): number {
  return money(subcontractorDue - ownerInflow);
}

export function companyCashGap(
  subcontractorDue: number,
  ownerInflow: number,
  liquid: number
): number {
  return money(subcontractorDue - ownerInflow - liquid);
}

export function shouldFlagProject(localGap: number, companyGap: number): boolean {
  return localGap > 0 && companyGap > 0;
}

export function displayUserName(input: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  id: string;
}): string {
  const full = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  return full || input.username?.trim() || input.id;
}

export function extractNumericTokens(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const out: string[] = [];
  for (const raw of matches) {
    const token = canonicalizeNumber(raw);
    if (token) out.push(token);
  }
  return out;
}

export function canonicalizeNumber(raw: string): string {
  const cleaned = raw.replace(/,/g, '');
  const n = Number(cleaned);
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

const STRUCTURAL_NUMBERS = ['0', '2', '3', '5', '7', '8', '18', '21', '30', '90', '100'];

export function isNarrativeGrounded(narrative: string, payload: unknown): boolean {
  const allowed = collectAllowedNumbers(payload);
  for (const token of STRUCTURAL_NUMBERS) allowed.add(token);
  for (const token of extractNumericTokens(narrative)) {
    if (!allowed.has(token)) return false;
  }
  return true;
}
