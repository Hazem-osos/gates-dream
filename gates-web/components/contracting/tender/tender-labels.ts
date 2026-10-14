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

export const CATALOG_KIND_AR: Record<string, string> = {
  SEASON: 'موسم',
  CHAPTER: 'فصل',
  OFFICIAL: 'بند رسمي',
  EXECUTABLE: 'بند تنفيذي',
};

export const CATALOG_KINDS = ['SEASON', 'CHAPTER', 'OFFICIAL', 'EXECUTABLE'] as const;

/** Matches backend rate-analysis: quota × (1 + waste) × unitCost */
export function analysisElementCost(quota: number, wasteRate: number, unitCost: number) {
  return quota * (1 + wasteRate) * unitCost;
}
