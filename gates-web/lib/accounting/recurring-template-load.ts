/** A recurring voucher/journal is a real document. Loading it as a template must not reuse its serial. */
export function fieldsForRecurringTemplateLoad(input: {
  asTemplate: boolean;
  voucherNumber?: string | null;
  date?: string | null;
  hijriDate?: string | null;
  today: string;
  toHijri: (iso: string) => string;
}) {
  if (!input.asTemplate) {
    const date = input.date?.slice(0, 10) || input.today;
    return {
      voucherNumber: input.voucherNumber ?? '',
      date,
      hijriDate: input.hijriDate || input.toHijri(date),
    };
  }
  return {
    voucherNumber: '',
    date: input.today,
    hijriDate: input.toHijri(input.today),
  };
}

export function recurringTemplateLabel(row: {
  description?: string | null;
  voucherNumber?: string | null;
  amount?: number | string | null;
}) {
  const description = String(row.description ?? '').trim();
  if (description) return description;
  const amount = Number(row.amount);
  if (Number.isFinite(amount) && amount !== 0) {
    return `سند دوري — ${amount.toLocaleString('ar-EG')}`;
  }
  return 'سند دوري';
}
