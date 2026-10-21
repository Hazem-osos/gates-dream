/** Calendar day `YYYY-MM-DD` from a document date field. */
export function parseAsOfDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * Screen MAC: live cost when no date / today; ItemCostHistory for a backdated screen.
 * Keep in sync with gates-backend `pickDisplayedAverageCost`.
 */
export function pickDisplayedAverageCost(params: {
  historical: number;
  current: number;
  asOfDay: string | null | undefined;
  today: string;
}): number {
  const historical = Number(params.historical);
  const current = Number(params.current);
  const hist = Number.isFinite(historical) && historical > 0 ? historical : 0;
  const curr = Number.isFinite(current) && current > 0 ? current : 0;
  const asOfDay = params.asOfDay?.trim() || '';
  if (!asOfDay) return curr;
  if (asOfDay === params.today) return hist > 0 ? hist : curr;
  return hist;
}
