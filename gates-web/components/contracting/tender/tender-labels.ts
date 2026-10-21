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

/** Document-screen labels (عرض سعر) — مبدئي / نهائي like the legacy costing sheet. */
export const QUOTATION_DOC_STATUS_AR: Record<string, string> = {
  DRAFT: 'مبدئي',
  SUBMITTED: 'نهائي',
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
  SEASON: 'رئيسي',
  CHAPTER: 'رئيسي فرعي',
  OFFICIAL: 'رئيسي فرعي',
  EXECUTABLE: 'تنفيذي',
};

export const CATALOG_KINDS = ['SEASON', 'CHAPTER', 'OFFICIAL', 'EXECUTABLE'] as const;

/** دليل بنود الأعمال — ثلاثة أنواع فقط في الواجهة */
export const WORK_ITEM_CATALOG_KINDS = ['SEASON', 'CHAPTER', 'EXECUTABLE'] as const;
export type WorkItemCatalogKindUi = (typeof WORK_ITEM_CATALOG_KINDS)[number];

export function normalizeWorkItemCatalogKind(kind?: string | null): WorkItemCatalogKindUi {
  if (kind === 'EXECUTABLE') return 'EXECUTABLE';
  if (kind === 'SEASON') return 'SEASON';
  return 'CHAPTER';
}

export function allowedWorkItemKindsForParent(parentKind?: string | null): WorkItemCatalogKindUi[] {
  if (!parentKind) return ['SEASON'];
  if (parentKind === 'EXECUTABLE') return [];
  return ['CHAPTER', 'EXECUTABLE'];
}

export const HEADER_KINDS = ['SEASON', 'CHAPTER', 'OFFICIAL'] as const;

export function isTenderHeaderKind(kind?: string | null) {
  return kind === 'SEASON' || kind === 'CHAPTER' || kind === 'OFFICIAL';
}

/** Quote screen shows header items only — executable BOQ lines stay hidden. */
export function isQuotationHeaderItem(kind?: string | null, _isExecutable?: boolean | null) {
  return isTenderHeaderKind(kind);
}

export function quotationLineKindLabel(kind?: string | null, isExecutable?: boolean | null) {
  if (kind === 'EXECUTABLE' || (isExecutable !== false && !kind)) return 'أساسي';
  if (kind && CATALOG_KIND_AR[kind]) return CATALOG_KIND_AR[kind];
  return isExecutable === false ? '—' : 'أساسي';
}

/** Matches backend rate-analysis: quota × (1 + waste) × unitCost */
export function analysisElementCost(quota: number, wasteRate: number, unitCost: number) {
  return quota * (1 + wasteRate) * unitCost;
}
