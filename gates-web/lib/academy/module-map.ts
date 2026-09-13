import type { AcademyMissionCard } from './types';

export const ACADEMY_MISSIONS: AcademyMissionCard[] = [
  {
    slug: 'sales-invoice',
    titleAr: 'مبيعات صالة المعرض',
    descriptionAr: 'فاتورة المبيعات: النمط، عرض السعر، حراسات التكلفة، وقائمة الإجراءات.',
    href: '/sales/invoices/new',
  },
  {
    slug: 'cheque-endorsement',
    titleAr: 'تظهير الشيكات',
    descriptionAr: 'اختيار شيك وارد من المحفظة وتظهيره لمورد دون المساس برصيد البنك.',
    href: '/accounting/cheques/incoming',
  },
  {
    slug: 'purchase-landed-cost',
    titleAr: 'تسوية تكلفة الشحن',
    descriptionAr: 'إضافات فاتورة المشتريات، التكلفة الفعلية، وخصم المنبع.',
    href: '/purchases/invoices/new',
  },
  {
    slug: 'document-settings',
    titleAr: 'إعدادات الحركات',
    descriptionAr: 'أنماط المستندات ومسلسلات الترقيم والمخزن الافتراضي.',
    href: '/settings/document-profiles',
  },
];

const ROUTE_SLUGS: Array<{ test: RegExp; slug: string }> = [
  { test: /sales-invoice|\/sales\/invoices/i, slug: 'sales-invoice' },
  { test: /securities\/reciept|cheques\/incoming|cheque-endors/i, slug: 'cheque-endorsement' },
  { test: /final-purchase-invoice|purchases\/invoices|landed-cost/i, slug: 'purchase-landed-cost' },
  { test: /document-profiles|settings\/transactions/i, slug: 'document-settings' },
];

export function academySlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  return ROUTE_SLUGS.find((row) => row.test.test(pathname))?.slug ?? null;
}

export function academyMissionBySlug(slug: string): AcademyMissionCard | undefined {
  return ACADEMY_MISSIONS.find((row) => row.slug === slug);
}

export function academyLaunchHref(slug: string): string {
  const mission = academyMissionBySlug(slug);
  const href = mission?.href ?? '/';
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}academyMission=${encodeURIComponent(slug)}`;
}
