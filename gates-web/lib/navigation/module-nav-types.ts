export type NavCategoryId = 'operations' | 'master' | 'reports' | 'settings';

export type ModuleNavBadge = {
  text: string;
  tone?: 'neutral' | 'warning' | 'info' | 'success';
};

export type ModuleNavNode = {
  key: string;
  label: string;
  href?: string;
  icon?: string;
  color?: string;
  keywords?: string[];
  badge?: ModuleNavBadge;
  children?: ModuleNavNode[];
};

export type FlatModuleNavLink = {
  key: string;
  label: string;
  href: string;
  category: NavCategoryId;
  keywords: string[];
  badge?: ModuleNavBadge;
};

export type NavSubgroup = {
  id: string;
  title: string;
  items: FlatModuleNavLink[];
};

export type CategorizedNavGroup = {
  id: NavCategoryId;
  title: string;
  items: FlatModuleNavLink[];
  subgroups: NavSubgroup[];
};

export const NAV_CATEGORY_META: Record<
  NavCategoryId,
  { title: string; order: number }
> = {
  operations: {
    title: 'العمليات والحركات اليومية',
    order: 1,
  },
  master: {
    title: 'البطاقات والتعريفات',
    order: 2,
  },
  reports: {
    title: 'التقارير وكشوف الحساب',
    order: 3,
  },
  settings: {
    title: 'الإعدادات والتهيئات',
    order: 4,
  },
};
