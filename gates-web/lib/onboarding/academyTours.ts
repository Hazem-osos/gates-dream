/**
 * @deprecated Static/video Gates Academy catalogs. Use GET /api/v1/ai/academy/tour
 * and UserTourProgress instead of these driver.js programs.
 */
import type { DriveStep } from 'driver.js';
import type { AcademyTriggerKind } from '@/lib/onboarding/tourCheckpoints';
import {
  richStepsToDrive,
  richStepsToMeta,
  RICH_TOUR_STEPS_BY_PROGRAM,
} from '@/lib/onboarding/toursData';
import {
  EXTENDED_ACADEMY_PROGRAMS,
  type ExtendedAcademyProgramId,
} from '@/lib/onboarding/academyToursExtended';

export type AcademyProgramId =
  | 'foundation-8'
  | 'inventory-mastery'
  | 'sales-cycle'
  | 'contracting-extracts'
  | 'executive-dashboard'
  | ExtendedAcademyProgramId;

export type TourCheckpointKind = 'cmd-k-open' | 'privacy-toggle';

/** Generic, declarative step trigger (additive to the legacy `checkpoint` field above). */
export type AcademyStepTrigger = {
  kind: AcademyTriggerKind;
  /** Matches the `data-academy-trigger-id` attribute (or the id passed to dispatchAcademyTrigger for API_SUCCESS). */
  id: string;
  /** Shown in the same amber checkpoint-prompt slot as legacy `checkpointPrompt`. */
  prompt?: string;
};

export type AcademyStepMeta = {
  id: string;
  route: string;
  checkpoint?: TourCheckpointKind;
  checkpointPrompt?: string;
  trigger?: AcademyStepTrigger;
  stationTitle: string;
};

/** Role-based category buckets used by the reorganized Academy hub. */
export type AcademyCategory =
  | 'foundation'
  | 'sales-cashier'
  | 'inventory-warehouse'
  | 'general-accounting'
  | 'treasury-cheques'
  | 'other';

export type AcademyProgram = {
  id: AcademyProgramId;
  title: string;
  emoji: string;
  description: string;
  category: AcademyCategory;
  /** Recommended for tours whose final step performs a real POST/mutation. */
  sandboxRecommended?: boolean;
  steps: DriveStep[];
  meta: AcademyStepMeta[];
};

export const ACADEMY_RESUME_STORAGE_KEY = 'gates:academy-tour-resume';

export const FOUNDATION_8_META: AcademyStepMeta[] = [
  {
    id: 'search',
    route: '/dashboard',
    checkpoint: 'cmd-k-open',
    checkpointPrompt: 'اضغط الآن `Cmd + K` (أو انقر شريط البحث) لفتح محرك البحث وتجربته بنفسك!',
    stationTitle: 'المحطة 1: محرك البحث الفوري والمفضلة',
  },
  {
    id: 'module-nav',
    route: '/dashboard',
    stationTitle: 'المحطة 2: بوابة الموديولات من الهيدر',
  },
  {
    id: 'coa',
    route: '/accounting/chart-of-accounts',
    stationTitle: 'المحطة 3: شجرة الحسابات والدليل المحاسبي',
  },
  {
    id: 'invoice-grid',
    route: '/inventory/operations/sales-invoice',
    stationTitle: 'المحطة 4: الإدخال السريع بالكيبورد في الفاتورة',
  },
  {
    id: 'jit-modals',
    route: '/inventory/operations/sales-invoice',
    stationTitle: 'المحطة 5: الإنشاء في سياق العمل (JIT)',
  },
  {
    id: 'impact-tabs',
    route: '/inventory/operations/sales-invoice',
    stationTitle: 'المحطة 6: المعاينة المحاسبية والأثر المخزني',
  },
  {
    id: 'privacy',
    route: '/dashboard',
    checkpoint: 'privacy-toggle',
    checkpointPrompt: 'اضغط على أيقونة العين 👁️ (أو `Cmd + Shift + H`) لتجربة إخفاء الأرقام.',
    stationTitle: 'المحطة 7: وضع خصوصية المدير',
  },
  {
    id: 'sentinel',
    route: '/dashboard',
    stationTitle: 'المحطة 8: رادار الأمان ومكافحة التلاعب',
  },
];

export const FOUNDATION_8_STEPS: DriveStep[] = [
  {
    element: '[data-tour="global-search"]',
    popover: {
      title: 'محرك البحث الفوري والمفضلة (Cmd + K & ⭐)',
      description:
        'ابحث عن أي فاتورة أو عميل أو تقرير في ثوانٍ. ثبّت الصفحات الأكثر استخداماً بزر ⭐ في لوحة الأوامر لتظهر في الصدارة.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="module-nav"]',
    popover: {
      title: 'بوابة الموديولات (أيقونة الشبكة)',
      description:
        'من هنا تفتح كل الموديولات: الحسابات، المخازن، المقاولات، وغيرها — ثم تختار الشاشة من صف التبويبات أو من Cmd + K.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="coa-tree"]',
    popover: {
      title: 'شجرة الحسابات الذكية (Smart COA)',
      description:
        'الهيكل اللوني يميز الأصول، الالتزامات، الإيرادات، والمصروفات. الأكواد تُولَّد تلقائياً، وكشف الحساب اللحظي متاح من أي عقدة.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="invoice-items-grid"]',
    popover: {
      title: 'جدول أصناف الفاتورة — Keyboard First',
      description:
        'Tab و Enter للانتقال وإضافة سطر جديد، Cmd + V للصق من Excel، والبحث السريع داخل خانة الصنف.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '#gates-tour-invoice-customer',
    popover: {
      title: 'العميل — إضافة سريعة (JIT)',
      description:
        'في خانة «العميل» ابحث بالاسم؛ إن لم يوجد العميل اختر «+ إضافة سريع» لإنشاء بطاقة عميل دون مغادرة الفاتورة.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '[data-tour="invoice-impact-tabs"]',
    popover: {
      title: 'تبويبات الأثر المحاسبي والمخزني الحي',
      description:
        'راجع القيد المتولد تلقائياً قبل وبعد الترحيل، وتابع أرصدة المخازن ومتوسط التكلفة اللحظي من الأسفل.',
      side: 'top',
      align: 'center',
    },
  },
  {
    element: '[data-tour="privacy-eye"]',
    popover: {
      title: 'وضع خصوصية المدير (Cmd + Shift + H 👁️)',
      description:
        'أخِف أرقام السيولة والأرباح فوراً عند وجود زوار — اختصار أو أيقونة العين في الهيدر.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '[data-tour="sentinel-radar"]',
    popover: {
      title: 'رادار الأمان — Profit Leakage & Sentinel',
      description:
        'تنبيهات فورية: بيع بأقل من التكلفة، خصومات غير مصرح بها، أو تعديل حركات بعد ساعات العمل.',
      side: 'bottom',
      align: 'center',
    },
  },
];

function programFromRichSteps(
  id: 'sales-cycle' | 'inventory-mastery' | 'contracting-extracts' | 'executive-dashboard',
  title: string,
  emoji: string,
  description: string,
  category: AcademyCategory
): AcademyProgram {
  const rich = RICH_TOUR_STEPS_BY_PROGRAM[id];
  return {
    id,
    title,
    emoji,
    description,
    category,
    steps: richStepsToDrive(rich),
    meta: richStepsToMeta(rich),
  };
}

export const ACADEMY_PROGRAMS: Record<AcademyProgramId, AcademyProgram> = {
  'foundation-8': {
    id: 'foundation-8',
    title: 'الجولة التأسيسية الشاملة للسيستم (8 محطات)',
    emoji: '⚡',
    description: 'رحلة كاملة عبر البحث، الموديولات، COA، الفاتورة، والخصوصية.',
    category: 'foundation',
    steps: FOUNDATION_8_STEPS,
    meta: FOUNDATION_8_META,
  },
  'inventory-mastery': programFromRichSteps(
    'inventory-mastery',
    'إتقان إدارة المخازن وحركات الصرف والإضافة',
    '📦',
    'جولة مركّزة على المخزون والحركات.',
    'inventory-warehouse'
  ),
  'sales-cycle': programFromRichSteps(
    'sales-cycle',
    'دورة المبيعات والفاتورة الإلكترونية والتحصيل السريع',
    '🧾',
    'إتقان فاتورة المبيعات والأثر المحاسبي.',
    'sales-cashier'
  ),
  'contracting-extracts': programFromRichSteps(
    'contracting-extracts',
    'إدارة مستخلصات المقاولات وبنود المقايسة',
    '🏗️',
    'مشاريع، مقايسة، ومستخلصات.',
    'other'
  ),
  'executive-dashboard': programFromRichSteps(
    'executive-dashboard',
    'قراءة الداشبورد التنفيذي وتقارير الأرباح للمدير',
    '📊',
    'KPIs ورادار الرقابة.',
    'other'
  ),
  ...EXTENDED_ACADEMY_PROGRAMS,
};

export function getAcademyProgram(id: AcademyProgramId): AcademyProgram {
  return ACADEMY_PROGRAMS[id];
}

export function pathnameMatchesRoute(pathname: string | null, route: string): boolean {
  if (!pathname) return false;
  const n = pathname.replace(/\/$/, '') || '/';
  const r = route.replace(/\/$/, '') || '/';
  if (r === '/dashboard') return n === '/' || n === '/dashboard';
  return n === r || n.startsWith(`${r}/`);
}
