export type AiPeriodPreset = 'today' | 'this_month' | 'this_year';

export function periodRange(period: AiPeriodPreset): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { start, end, label: start.toISOString().slice(0, 10) };
  }
  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start, end, label: `${start.toISOString().slice(0, 7)}` };
  }
  const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  return { start, end, label: String(now.getFullYear()) };
}
