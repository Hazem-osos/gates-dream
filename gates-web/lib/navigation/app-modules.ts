/** Top-level ERP modules — shared by Navbar module row and sidebar module switcher. */

export type AppModuleSection = {
  key: string;
  icon: string;
  label: string;
  color: string;
};

export const APP_MODULE_SECTIONS: AppModuleSection[] = [
  { key: 'automation', icon: '⚡', label: 'أتمتة Gates', color: '#0E79AA' },
  { key: 'electronic-invoices', icon: '🧾', label: 'الفواتير الإلكترونية', color: '#0E79AA' },
  { key: 'statements', icon: '📄', label: 'المستخلصات', color: '#CB5B53' },
  { key: 'hr', icon: '👨‍💼', label: 'الموارد البشرية', color: '#0E79AA' },
  { key: 'importexport', icon: '🚚', label: 'الاستيراد والتصدير', color: '#9747FF' },
  { key: 'manufacturing', icon: '🏭', label: 'التصنيع والانتاج', color: '#0E79AA' },
  { key: 'realestate', icon: '🏢', label: 'الاستثمار العقاري', color: '#9747FF' },
  { key: 'pos', icon: '🛒', label: 'نقاط البيع', color: '#CB5B53' },
  { key: 'inventory', icon: '📦', label: 'المخازن', color: '#FFD600' },
  { key: 'accounts', icon: '📊', label: 'الحسابات العامة', color: '#E7A8AA' },
  { key: 'settings', icon: '⚙️', label: 'الإعدادات المحاسبية', color: '#CB5B53' },
];

export const SECTION_PATH_PREFIX: Record<string, string> = {
  automation: '/automation',
  'electronic-invoices': '/electronic-invoices',
  statements: '/extracts',
  hr: '/hr',
  importexport: '/importexport',
  manufacturing: '/manufacturing',
  realestate: '/real-estate-investment',
  pos: '/pos',
  inventory: '/inventory',
  accounts: '/accounting',
  settings: '/accounting-settings',
};

export function getAppModulePath(sectionKey: string): string | undefined {
  return SECTION_PATH_PREFIX[sectionKey];
}

export function activeAppModuleKeyFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  if (
    pathname === '/subcontracts' ||
    pathname.startsWith('/subcontracts/') ||
    pathname === '/contracting' ||
    pathname.startsWith('/contracting/')
  ) {
    return 'statements';
  }
  if (pathname === '/real-estate' || pathname.startsWith('/real-estate/')) {
    return 'realestate';
  }
  for (const [key, prefix] of Object.entries(SECTION_PATH_PREFIX)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }
  return null;
}

export function appModuleNavItems(): (AppModuleSection & { href: string })[] {
  return APP_MODULE_SECTIONS.map((section) => ({
    ...section,
    href: SECTION_PATH_PREFIX[section.key] ?? `/${section.key}`,
  }));
}
