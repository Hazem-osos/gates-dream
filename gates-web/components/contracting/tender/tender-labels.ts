export const TENDER_STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  UNDER_STUDY: 'تحت الدراسة',
  PRICING: 'التسعير',
  READY_TO_SUBMIT: 'جاهز للتقديم',
  SUBMITTED: 'مُقدَّم',
  UNDER_NEGOTIATION: 'تحت التفاوض',
  AWARDED: 'مُرسى',
  LOST: 'غير فائز',
  CANCELLED: 'ملغى',
};

export const QUOTATION_STATUS_AR: Record<string, string> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'مُرسل',
  ACCEPTED: 'معتمد',
  REJECTED: 'مرفوض',
  EXPIRED: 'منتهي',
  CANCELLED: 'ملغى',
};

export function tenderIsLocked(status: string) {
  return status === 'AWARDED' || status === 'LOST' || status === 'CANCELLED';
}

export const BOQ_UNITS = ['M2', 'M3', 'TON', 'ITEM', 'LM', 'LS'] as const;

export const COST_ELEMENT_AR: Record<string, string> = {
  MATERIAL: 'مواد',
  LABOR: 'عمالة',
  EQUIPMENT: 'معدات',
  SUBCONTRACTOR: 'مقاول باطن',
  SITE_EXPENSE: 'مصروفات',
};
