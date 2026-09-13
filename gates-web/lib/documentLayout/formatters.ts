export function escapeHtml(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wraps Latin/numeric fragments (amounts, dates, IBANs) so they stay LTR inside an RTL document. */
export function ltrSpan(value: unknown): string {
  return `<span class="gdl-ltr">${escapeHtml(value)}</span>`;
}

export function formatMoney(amount: number, currency = 'EGP'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${formatted} ${currency}`;
}

export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Substitutes `{invoice_no}`, `{due_date}`, `{amount}`, etc. placeholders in footer/legal text. */
export function renderPlaceholders(template: string | null | undefined, placeholders: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (match, key: string) => placeholders[key] ?? match);
}
