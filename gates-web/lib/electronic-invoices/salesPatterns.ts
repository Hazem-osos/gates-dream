/** Default sales-invoice screen. Matches invoices that were not assigned a custom pattern. */
export const BUILTIN_SALES_INVOICE_PATTERN_ID = 'builtin:SALES_INVOICE';

export type SalesPatternOption = { id: string; label: string };

export function buildSalesInvoicePatternOptions(input: {
  profiles: { id: string; nameAr: string; isActive?: boolean }[];
  modules: {
    id: string;
    fullCode?: string | null;
    nameAr?: string | null;
    menuNameAr?: string | null;
    isActive?: boolean;
  }[];
}): SalesPatternOption[] {
  const modules = input.modules.filter((row) => row.isActive !== false);
  const hasDefaultModule = modules.some((row) => row.fullCode === 'SI01');
  const options: SalesPatternOption[] = [];
  if (!hasDefaultModule) {
    options.push({ id: BUILTIN_SALES_INVOICE_PATTERN_ID, label: 'فاتورة مبيعات' });
  }
  for (const row of modules) {
    const name = row.menuNameAr || row.nameAr || 'فاتورة مبيعات';
    options.push({
      id: row.id,
      label: row.fullCode ? `${row.fullCode} — ${name}` : name,
    });
  }
  for (const profile of input.profiles) {
    if (profile.isActive === false) continue;
    options.push({ id: profile.id, label: profile.nameAr });
  }
  return options;
}
