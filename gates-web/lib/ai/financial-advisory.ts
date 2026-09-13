const FINANCIAL_HINT =
  /قائمة الدخل|قائمة المركز|الميزانية|ضريبة|خصم المنبع|القيمة المضافة|صافي الربح|إجمالي الربح|السيولة|سيولة|مصروفات|التدفقات|رأس المال|ربحية|هامش|WHT|VAT|income statement|balance sheet/i;

export const FINANCIAL_ADVISORY_DISCLAIMER_AR =
  'تنبيه امتثال: هذا الرد استشاري مبني على بيانات شركتكم في Gates ERP، وليس بديلاً عن رأي محاسب قانوني أو إقرار ضريبي رسمي.';

export function shouldShowFinancialDisclaimer(content: string, flagged?: boolean): boolean {
  if (flagged) return true;
  return FINANCIAL_HINT.test(content ?? '');
}
