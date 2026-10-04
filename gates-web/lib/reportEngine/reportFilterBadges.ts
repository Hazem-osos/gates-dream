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
  fromWarehouseId: 'من مخزن',
  toWarehouseId: 'إلى مخزن',
  itemGroupId: 'المجموعة',
  priceListId: 'قائمة الأسعار',
  branchId: 'الفرع',
  userId: 'المستخدم',
  compareFiscalYearId: 'سنة المقارنة',
  delegateId: 'المندوب',
  representativeId: 'المندوب',
  sellerId: 'البائع',
  itemId: 'الصنف',
  accountId: 'الحساب',
  costCenterId: 'مركز التكلفة',
  currencyId: 'العملة',
  counterpartAccountId: 'الحساب المقابل',
  description: 'الشرح',
  level: 'المستوى',
  fromVoucher: 'من قيد',
  toVoucher: 'إلى قيد',
  fromInvoice: 'من فاتورة',
  toInvoice: 'إلى فاتورة',
  amount: 'المبلغ',
  amountTo: 'إلى مبلغ',
  minValue: 'الحد الأدنى',
  ageFromInvoiceFrom: 'عمر الدين للفاتورة من',
  ageFromInvoiceTo: 'عمر الدين للفاتورة إلى',
  ageFromLastPaymentFrom: 'عمر الدين لآخر سداد من',
  ageFromLastPaymentTo: 'عمر الدين لآخر سداد إلى',
};

const RAW_VALUE_FILTERS = new Set([
  'description',
  'level',
  'fromVoucher',
  'toVoucher',
  'fromInvoice',
  'toInvoice',
  'amount',
  'amountTo',
  'minValue',
  'ageFromInvoiceFrom',
  'ageFromInvoiceTo',
  'ageFromLastPaymentFrom',
  'ageFromLastPaymentTo',
]);

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
    const name = resolvedNames?.[key] ?? (RAW_VALUE_FILTERS.has(key) ? val : undefined);
    badges.push({
      icon: key.includes('customer') ? '👤' : key.includes('warehouse') ? '🏬' : '🔎',
      label: `${fieldLabel}: ${name ?? 'محدد'}`,
    });
  }

  if (params.accountView === 'main') {
    badges.push({ icon: '🔎', label: 'الحسابات: الرئيسية فقط' });
  } else if (params.accountView === 'ledger') {
    badges.push({ icon: '🔎', label: 'الحسابات: الأستاذ فقط' });
  } else if (params.accountView === 'both') {
    badges.push({ icon: '🔎', label: 'الحسابات: الرئيسية والأستاذ' });
  }

  const amountOps: Record<string, string> = {
    eq: 'يساوي',
    gt: 'أكبر من',
    gte: 'أكبر من أو يساوي',
    lt: 'أصغر من',
    lte: 'أصغر من أو يساوي',
    between: 'من إلى',
  };
  if (params.showUnposted === 'true') {
    badges.push({ icon: '🔎', label: 'قراءة القيود غير المرحلة' });
  }
  if (params.showIdleAccounts === 'true') {
    badges.push({ icon: '🔎', label: 'إظهار الحسابات بدون حركة' });
  }
  if (params.withBudgetOnly === 'true') {
    badges.push({ icon: '🔎', label: 'إظهار ما له موازنة فقط' });
  }
  if (params.includeDetails === 'false') {
    badges.push({ icon: '🔎', label: 'بدون تفاصيل القيود' });
  }
  if (params.allAccounts === 'true') {
    badges.push({ icon: '🔎', label: 'كل الحسابات' });
  }
  if (params.unpaidOnly === 'true') {
    badges.push({ icon: '🔎', label: 'الفواتير غير المسددة فقط' });
  }
  if (params.showGroups === 'true') {
    badges.push({ icon: '🔎', label: 'عرض بالمجموعات' });
  } else if (params.showWarehouse === 'true') {
    badges.push({ icon: '🔎', label: 'عرض بالمخازن' });
  }

  if (params.amountOp && amountOps[params.amountOp]) {
    badges.push({ icon: '🔎', label: `مبلغ القيد: ${amountOps[params.amountOp]}` });
  }

  if (!badges.length) {
    badges.push({ icon: '📋', label: 'جميع المرشحات الافتراضية' });
  }

  return badges;
}
