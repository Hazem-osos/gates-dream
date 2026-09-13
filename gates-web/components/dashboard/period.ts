import type { DashboardPeriod, DashboardPeriodBounds } from './types';

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'fy', label: 'السنة المالية' },
];

export function periodBounds(period: DashboardPeriod, now = new Date()): DashboardPeriodBounds {
  const endDate = iso(now);
  if (period === 'today') {
    return { startDate: endDate, endDate, label: 'اليوم' };
  }
  if (period === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { startDate: iso(start), endDate, label: 'هذا الأسبوع' };
  }
  if (period === 'month') {
    return { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate, label: 'هذا الشهر' };
  }
  return { startDate: iso(new Date(now.getFullYear(), 0, 1)), endDate, label: 'السنة المالية' };
}

export function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function relativeUpdatedLabel(asOf?: string | null, now = Date.now()): string {
  if (!asOf) return 'محدّث الآن';
  const parsed = Date.parse(asOf);
  if (!Number.isFinite(parsed)) return 'محدّث الآن';
  const mins = Math.max(0, Math.floor((now - parsed) / 60_000));
  if (mins < 1) return 'آخر تحديث الآن';
  if (mins < 60) return `آخر تحديث منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `آخر تحديث منذ ${hours} ساعة`;
  return `آخر تحديث منذ ${Math.floor(hours / 24)} يوم`;
}

export function inPeriod(date: string | undefined, startDate: string, endDate: string): boolean {
  if (!date) return true;
  const day = date.slice(0, 10);
  return day >= startDate && day <= endDate;
}
