export type FiscalYearOption = {
  id: string;
  arabicName?: string | null;
  startDate: string;
  endDate: string;
};

export function fiscalYearLabel(year: FiscalYearOption): string {
  const name = year.arabicName?.trim();
  if (name) return name;
  const yearNumber = year.startDate.slice(0, 4);
  return yearNumber ? `سنة ${yearNumber}` : 'السنة';
}

export function yearCovering(years: FiscalYearOption[], iso: string | undefined): FiscalYearOption | undefined {
  const day = iso?.slice(0, 10);
  if (!day) return undefined;
  return years.find((year) => year.startDate.slice(0, 10) <= day && day <= year.endDate.slice(0, 10));
}

export function periodYearLabel(years: FiscalYearOption[], from?: string, to?: string): string {
  const hit = yearCovering(years, to) ?? yearCovering(years, from);
  if (hit) return fiscalYearLabel(hit);
  const year = (to || from || '').slice(0, 4);
  return year ? `سنة ${year}` : 'الفترة';
}

export function stripCompareParam(query: Record<string, string>): Record<string, string> {
  const next = { ...query };
  delete next.compareFiscalYearId;
  return next;
}

export function comparisonQuery(
  query: Record<string, string>,
  year: FiscalYearOption
): Record<string, string> {
  const fromDate = year.startDate.slice(0, 10);
  const toDate = year.endDate.slice(0, 10);
  const next = stripCompareParam(query);
  next.fromDate = fromDate;
  next.toDate = toDate;
  next.startDate = fromDate;
  next.endDate = toDate;
  next.asOfDate = toDate;
  return next;
}
