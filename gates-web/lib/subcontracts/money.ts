export function toMoney(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatEgp(value: string | number | null | undefined): string {
  return `${toMoney(value).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`;
}

export function formatQty(value: string | number | null | undefined, digits = 3): string {
  return toMoney(value).toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: string | number | null | undefined, digits = 1): string {
  return `${toMoney(value).toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}٪`;
}

export function rateToPercentInput(rate: string | number | null | undefined): string {
  return String(Math.round(toMoney(rate) * 10000) / 100);
}

export function percentInputToRate(value: string): number {
  return toMoney(value) / 100;
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function formatDateAr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG');
}
