export type ReportFilterBadge = {
  icon: string;
  label: string;
};

const FILTER_LABELS: Record<string, string> = {
  customerId: 'العميل',
  supplierId: 'المورد',
  customerCategoryId: 'مجموعة العميل',
  supplierCategoryId: 'مجموعة المورد',
  warehouseId: 'المخزن',
  branchId: 'الفرع',
  delegateId: 'المندوب',
  representativeId: 'المندوب',
  sellerId: 'البائع',
  itemId: 'الصنف',
  accountId: 'الحساب',
  costCenterId: 'مركز التكلفة',
  currencyId: 'العملة',
};

function formatDateParam(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function buildReportFilterBadges(
  params: Record<string, string>,
  resolvedNames?: Record<string, string>
): ReportFilterBadge[] {
  const badges: ReportFilterBadge[] = [];

  if (params.date && !params.fromDate && !params.toDate && !params.startDate && !params.endDate) {
    badges.push({ icon: '📅', label: `التاريخ: ${formatDateParam(params.date)}` });
  }

  const from = params.fromDate ?? params.startDate;
  const to = params.toDate ?? params.endDate;
  if (from || to) {
    const fromTxt = from ? formatDateParam(from) : '…';
    const toTxt = to ? formatDateParam(to) : '…';
    badges.push({ icon: '📅', label: `من: ${fromTxt} إلى: ${toTxt}` });
  }

  for (const [key, fieldLabel] of Object.entries(FILTER_LABELS)) {
    const val = params[key];
    if (!val) continue;
    const name = resolvedNames?.[key];
    badges.push({
      icon: key.includes('customer') ? '👤' : key.includes('warehouse') ? '🏬' : '🔎',
      label: `${fieldLabel}: ${name ?? 'محدد'}`,
    });
  }

  if (!badges.length) {
    badges.push({ icon: '📋', label: 'جميع المرشحات الافتراضية' });
  }

  return badges;
}
