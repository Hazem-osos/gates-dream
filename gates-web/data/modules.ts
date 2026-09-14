export type HeroModuleId =
  | 'accounting'
  | 'inventory'
  | 'sales'
  | 'crm'
  | 'hr'
  | 'manufacturing'
  | 'projects';

export type HeroModuleSide = 'left' | 'right' | 'top' | 'bottom';

export type HeroModule = {
  id: HeroModuleId;
  index: string;
  label: { en: string; ar: string };
  /** Edge of the Gates Engine this module docks into — also its mechanical travel axis. */
  side: HeroModuleSide;
  /**
   * Port marker position along the Engine edge (0–100). For `left`/`right` modules this
   * also drives the real dock Y (the engine is tall enough to space them safely). For
   * `top`/`bottom` modules the engine face is narrower than the module blocks, so the real
   * dock X is measured at runtime from `align` instead — `edgePosition` there only places
   * the decorative port tick.
   */
  edgePosition: number;
  /** Which side of the engine's center a `top`/`bottom` module docks on. */
  align: 'before' | 'center' | 'after';
  /** Fraction of the master hero timeline (0–1) this module travels + docks within. */
  phase: { start: number; end: number };
  /** Included in the reduced 4-module mobile choreography. */
  mobile?: boolean;
};

export const HERO_MODULES: HeroModule[] = [
  {
    id: 'accounting',
    index: '01',
    label: { en: 'ACCOUNTING', ar: 'المحاسبة' },
    side: 'left',
    edgePosition: 25,
    align: 'center',
    phase: { start: 0.12, end: 0.25 },
    mobile: true,
  },
  {
    id: 'inventory',
    index: '02',
    label: { en: 'INVENTORY', ar: 'المخزون' },
    side: 'right',
    edgePosition: 62,
    align: 'center',
    phase: { start: 0.25, end: 0.38 },
    mobile: true,
  },
  {
    id: 'sales',
    index: '03',
    label: { en: 'SALES', ar: 'المبيعات' },
    side: 'bottom',
    edgePosition: 30,
    align: 'before',
    phase: { start: 0.38, end: 0.44 },
    mobile: true,
  },
  {
    id: 'crm',
    index: '04',
    label: { en: 'CRM', ar: 'العلاقات' },
    side: 'right',
    edgePosition: 21,
    align: 'center',
    phase: { start: 0.44, end: 0.5 },
  },
  {
    id: 'hr',
    index: '05',
    label: { en: 'HR', ar: 'الموارد البشرية' },
    side: 'left',
    edgePosition: 73,
    align: 'center',
    phase: { start: 0.5, end: 0.543 },
    mobile: true,
  },
  {
    id: 'manufacturing',
    index: '06',
    label: { en: 'MANUFACTURING', ar: 'التصنيع' },
    side: 'bottom',
    edgePosition: 70,
    align: 'after',
    phase: { start: 0.543, end: 0.587 },
  },
  {
    id: 'projects',
    index: '07',
    label: { en: 'PROJECTS', ar: 'المشاريع' },
    side: 'top',
    edgePosition: 50,
    align: 'center',
    phase: { start: 0.587, end: 0.63 },
  },
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
