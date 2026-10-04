export function parseEnabledSalesProfileIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((id) => String(id ?? '').trim()).filter(Boolean);
}
