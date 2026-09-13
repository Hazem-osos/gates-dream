import { activeAppModuleKeyFromPath } from '@/lib/navigation/app-modules';

export type ModuleSidebarTheme = {
  iconBg: string;
  iconText: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
};

export type ModuleSidebarMeta = {
  title: string;
  subtitle: string;
  emoji: string;
  theme: ModuleSidebarTheme;
};

const META_BY_KEY: Record<string, ModuleSidebarMeta> = {
  inventory: {
    title: 'المخازن',
    subtitle: 'إدارة المخازن والمبيعات',
    emoji: '📦',
    theme: {
      iconBg: 'bg-amber-100 dark:bg-amber-950/50',
      iconText: 'text-amber-700 dark:text-amber-300',
      accentBorder: 'border-amber-500',
      accentBg: 'bg-amber-50 dark:bg-amber-950/40',
      accentText: 'text-amber-800 dark:text-amber-300',
    },
  },
  accounts: {
    title: 'الحسابات العامة',
    subtitle: 'الدفاتر والقيود والخزينة',
    emoji: '📊',
    theme: {
      iconBg: 'bg-emerald-100 dark:bg-emerald-950/50',
      iconText: 'text-emerald-700 dark:text-emerald-300',
      accentBorder: 'border-emerald-600',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      accentText: 'text-emerald-800 dark:text-emerald-300',
    },
  },
  settings: {
    title: 'الإعدادات المحاسبية',
    subtitle: 'تهيئة الشركة والصلاحيات',
    emoji: '⚙️',
    theme: {
      iconBg: 'bg-rose-100 dark:bg-rose-950/50',
      iconText: 'text-rose-700 dark:text-rose-300',
      accentBorder: 'border-rose-500',
      accentBg: 'bg-rose-50 dark:bg-rose-950/40',
      accentText: 'text-rose-800 dark:text-rose-300',
    },
  },
  pos: {
    title: 'نقاط البيع',
    subtitle: 'البيع السريع واليومية',
    emoji: '🛒',
    theme: {
      iconBg: 'bg-orange-100 dark:bg-orange-950/50',
      iconText: 'text-orange-700 dark:text-orange-300',
      accentBorder: 'border-orange-500',
      accentBg: 'bg-orange-50 dark:bg-orange-950/40',
      accentText: 'text-orange-800 dark:text-orange-300',
    },
  },
  statements: {
    title: 'المستخلصات',
    subtitle: 'المقاولات والمشاريع',
    emoji: '🏗️',
    theme: {
      iconBg: 'bg-sky-100 dark:bg-sky-950/50',
      iconText: 'text-sky-700 dark:text-sky-300',
      accentBorder: 'border-sky-600',
      accentBg: 'bg-sky-50 dark:bg-sky-950/40',
      accentText: 'text-sky-700 dark:text-sky-400',
    },
  },
  hr: {
    title: 'الموارد البشرية',
    subtitle: 'الموظفون والرواتب',
    emoji: '👨‍💼',
    theme: {
      iconBg: 'bg-violet-100 dark:bg-violet-950/50',
      iconText: 'text-violet-700 dark:text-violet-300',
      accentBorder: 'border-violet-600',
      accentBg: 'bg-violet-50 dark:bg-violet-950/40',
      accentText: 'text-violet-800 dark:text-violet-300',
    },
  },
  manufacturing: {
    title: 'التصنيع',
    subtitle: 'الإنتاج والتكاليف',
    emoji: '🏭',
    theme: {
      iconBg: 'bg-cyan-100 dark:bg-cyan-950/50',
      iconText: 'text-cyan-700 dark:text-cyan-300',
      accentBorder: 'border-cyan-600',
      accentBg: 'bg-cyan-50 dark:bg-cyan-950/40',
      accentText: 'text-cyan-800 dark:text-cyan-300',
    },
  },
  importexport: {
    title: 'الاستيراد والتصدير',
    subtitle: 'الاعتمادات والضمانات',
    emoji: '🚚',
    theme: {
      iconBg: 'bg-purple-100 dark:bg-purple-950/50',
      iconText: 'text-purple-700 dark:text-purple-300',
      accentBorder: 'border-purple-600',
      accentBg: 'bg-purple-50 dark:bg-purple-950/40',
      accentText: 'text-purple-800 dark:text-purple-300',
    },
  },
  'electronic-invoices': {
    title: 'الفواتير الإلكترونية',
    subtitle: 'ETA والفوترة',
    emoji: '🧾',
    theme: {
      iconBg: 'bg-teal-100 dark:bg-teal-950/50',
      iconText: 'text-teal-700 dark:text-teal-300',
      accentBorder: 'border-teal-600',
      accentBg: 'bg-teal-50 dark:bg-teal-950/40',
      accentText: 'text-teal-800 dark:text-teal-300',
    },
  },
  realestate: {
    title: 'الاستثمار العقاري',
    subtitle: 'المشاريع والوحدات',
    emoji: '🏢',
    theme: {
      iconBg: 'bg-fuchsia-100 dark:bg-fuchsia-950/50',
      iconText: 'text-fuchsia-700 dark:text-fuchsia-300',
      accentBorder: 'border-fuchsia-600',
      accentBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
      accentText: 'text-fuchsia-800 dark:text-fuchsia-300',
    },
  },
};

const DEFAULT_META: ModuleSidebarMeta = {
  title: 'الوحدة',
  subtitle: 'التنقل داخل الموديول',
  emoji: '📁',
  theme: {
    iconBg: 'bg-sky-100 dark:bg-sky-950/50',
    iconText: 'text-sky-700 dark:text-sky-300',
    accentBorder: 'border-sky-600',
    accentBg: 'bg-sky-50 dark:bg-sky-950/40',
    accentText: 'text-sky-700 dark:text-sky-400',
  },
};

export function resolveModuleSidebarMeta(
  moduleKey: string | null | undefined
): ModuleSidebarMeta {
  if (!moduleKey) return DEFAULT_META;
  return META_BY_KEY[moduleKey] ?? DEFAULT_META;
}

export function resolveModuleKeyFromPathname(pathname: string | null | undefined): string | null {
  return activeAppModuleKeyFromPath(pathname);
}
