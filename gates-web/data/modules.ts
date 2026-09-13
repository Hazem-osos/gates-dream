export type HeroModuleId =
  | 'accounting'
  | 'inventory'
  | 'sales'
  | 'crm'
  | 'hr'
  | 'manufacturing'
  | 'projects';

export type HeroModule = {
  id: HeroModuleId;
  index: string;
  label: { en: string; ar: string };
  /** Offsets from the system-field center, as % of the field. */
  start: { x: number; y: number };
  via: { x: number; y: number };
  dock: { x: number; y: number };
};

export const HERO_MODULES: HeroModule[] = [
  { id: 'accounting', index: '01', label: { en: 'ACCOUNTING', ar: 'المحاسبة' }, start: { x: -48, y: 6 }, via: { x: -30, y: 24 }, dock: { x: -16, y: -11 } },
  { id: 'inventory', index: '02', label: { en: 'INVENTORY', ar: 'المخزون' }, start: { x: 46, y: -10 }, via: { x: 28, y: 14 }, dock: { x: 16, y: -11 } },
  { id: 'sales', index: '03', label: { en: 'SALES', ar: 'المبيعات' }, start: { x: -50, y: 32 }, via: { x: -22, y: 4 }, dock: { x: -19, y: 3 } },
  { id: 'crm', index: '04', label: { en: 'CRM', ar: 'العلاقات' }, start: { x: 48, y: 26 }, via: { x: 20, y: -8 }, dock: { x: 19, y: 3 } },
  { id: 'hr', index: '05', label: { en: 'HR', ar: 'الموارد البشرية' }, start: { x: -30, y: 46 }, via: { x: -6, y: 28 }, dock: { x: -11, y: 16 } },
  { id: 'manufacturing', index: '06', label: { en: 'MANUFACTURING', ar: 'التصنيع' }, start: { x: 34, y: 46 }, via: { x: 10, y: 26 }, dock: { x: 11, y: 16 } },
  { id: 'projects', index: '07', label: { en: 'PROJECTS', ar: 'المشاريع' }, start: { x: 22, y: -36 }, via: { x: 6, y: -16 }, dock: { x: 0, y: -19 } },
];

export const CONNECTED_MODULES = [
  { id: '01', key: 'accounting', en: 'Accounting', ar: 'المحاسبة' },
  { id: '02', key: 'inventory', en: 'Inventory', ar: 'المخزون' },
  { id: '03', key: 'sales', en: 'Sales & POS', ar: 'المبيعات ونقاط البيع' },
  { id: '04', key: 'crm', en: 'CRM', ar: 'إدارة العملاء' },
  { id: '05', key: 'hr', en: 'HR & Payroll', ar: 'الموارد البشرية والرواتب' },
  { id: '06', key: 'manufacturing', en: 'Manufacturing', ar: 'التصنيع' },
  { id: '07', key: 'projects', en: 'Projects', ar: 'المشاريع' },
] as const;

export type ConnectedModuleKey = (typeof CONNECTED_MODULES)[number]['key'];
