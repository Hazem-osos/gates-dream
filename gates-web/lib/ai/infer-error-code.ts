/** Infer a diagnose-error code from a localized API message or numeric HTTP code. */

export function inferBusinessErrorCode(message: string, code?: string): string {
  const blob = `${code ?? ''} ${message}`;
  if (/PRICE_BELOW_COST|BELOW_COST|أقل من(?: سعر)? التكلفة|بيع بخسارة|البيع بأقل/i.test(blob)) {
    return 'PRICE_BELOW_COST';
  }
  if (/NEGATIVE_STOCK|رصيد سالب|غير متوفر|لا يكفي/i.test(blob)) {
    return 'NEGATIVE_STOCK_ERROR';
  }
  if (/DOCUMENT_IS_POSTED|IS_POSTED|مرحّل|مرحل/i.test(blob)) {
    return 'DOCUMENT_IS_POSTED';
  }
  if (/READ_ONLY|عرض فقط/i.test(blob)) {
    return 'DOCUMENT_READ_ONLY';
  }
  if (/SAVE_DISABLED|REQUIRED|إلزام|الحفظ معطل/i.test(blob)) {
    return 'SAVE_DISABLED';
  }
  if (code && !/^\d+$/.test(code)) {
    return code.trim().toUpperCase();
  }
  return 'UNKNOWN';
}

export function extractFormValuesFromMessage(message: string): Record<string, unknown> {
  const nums = [...message.matchAll(/(\d+(?:[.,]\d+)?)/g)].map((match) =>
    Number(match[1].replace(',', '.'))
  );
  const finite = nums.filter((n) => Number.isFinite(n));
  if (finite.length >= 2) {
    return { itemPrice: finite[0], cost: finite[1] };
  }
  if (finite.length === 1 && /تكلفة|cost/i.test(message)) {
    return { cost: finite[0] };
  }
  return {};
}

export function problemHeadline(pageTitle: string, code: string, fallback: string): string {
  const screen = pageTitle.trim() || 'المستند';
  if (code === 'PRICE_BELOW_COST') {
    return `تعذر حفظ ${screen}: محاولة بيع بأقل من التكلفة`;
  }
  if (code === 'NEGATIVE_STOCK_ERROR') {
    return `تعذر حفظ ${screen}: الكمية غير متاحة في المخزن`;
  }
  if (code === 'DOCUMENT_IS_POSTED') {
    return `تعذر تعديل ${screen}: المستند مرحّل`;
  }
  return fallback;
}
