import type { LicenseState, PlanType, SubStatus } from './api';

const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const numFmt = new Intl.NumberFormat('en-US');

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
}

export function fmtNum(n: number | null | undefined): string {
  return numFmt.format(n ?? 0);
}

/** 135 → "2 س 15 د" */
export function fmtMinutes(min: number | null | undefined): string {
  const m = Math.max(0, Math.round(min ?? 0));
  if (m < 60) return `${m} د`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} س ${r} د` : `${h} س`;
}

export function fmtRelative(v: string | Date | null | undefined): string {
  if (!v) return 'لم يسجل نشاط';
  const diff = Date.now() - new Date(v).getTime();
  const min = Math.round(diff / 60000);
  if (min < 2) return 'الآن';
  if (min < 60) return `منذ ${min} دقيقة`;
  const h = Math.round(min / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.round(h / 24);
  if (d < 31) return `منذ ${d} يوم`;
  return fmtDate(v);
}

export function isOnline(v: string | null | undefined): boolean {
  return Boolean(v) && Date.now() - new Date(v!).getTime() < 5 * 60 * 1000;
}

export const LICENSE_STATE_LABEL: Record<LicenseState, string> = {
  UNLICENSED: 'بدون ترخيص',
  ACTIVE: 'مفعّل',
  TRIAL: 'تجريبي',
  SUSPENDED: 'موقوف',
  EXPIRED: 'منتهي',
  NOT_STARTED: 'لم يبدأ بعد',
};

export const LICENSE_STATE_TONE: Record<LicenseState, Tone> = {
  UNLICENSED: 'gray',
  ACTIVE: 'green',
  TRIAL: 'blue',
  SUSPENDED: 'red',
  EXPIRED: 'red',
  NOT_STARTED: 'amber',
};

export const PLAN_LABEL: Record<PlanType, string> = {
  LIFETIME: 'دائم (مدى الحياة)',
  SUBSCRIPTION: 'اشتراك بمدة محددة',
};

export const STATUS_LABEL: Record<SubStatus, string> = {
  ACTIVE: 'مفعّل',
  TRIAL: 'تجريبي',
  EXPIRED: 'منتهي',
  SUSPENDED: 'موقوف',
};

export const MODULE_LABEL: Record<string, string> = {
  ACCOUNTING: 'الحسابات',
  INVENTORY: 'المخازن',
  POS: 'نقاط البيع',
  MANUFACTURING: 'التصنيع',
  CONTRACTING: 'المقاولات',
  REAL_ESTATE: 'الاستثمار العقاري',
  SCHOOLS: 'المدارس',
  PAYROLL: 'الموارد البشرية والرواتب',
  ETA: 'الفاتورة الإلكترونية',
};

export type Tone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'brand';

export function daysUntil(v: string | null | undefined): number | null {
  if (!v) return null;
  return Math.ceil((new Date(v).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  'admin.login': 'دخول لوحة الإدارة',
  'admin.login_failed': 'محاولة دخول فاشلة',
  'admin.password_changed': 'تغيير كلمة مرور الإدارة',
  'admin.created': 'إضافة مدير منصة',
  'admin.enabled': 'تفعيل مدير منصة',
  'admin.disabled': 'إيقاف مدير منصة',
  'company.created': 'إنشاء شركة',
  'company.updated': 'تعديل بيانات شركة',
  'company.enabled': 'تفعيل شركة',
  'company.disabled': 'إيقاف شركة',
  'company.ai_updated': 'تعديل الذكاء الاصطناعي لشركة',
  'license.saved': 'حفظ ترخيص',
  'license.removed': 'إزالة ترخيص',
  'license.status_active': 'تفعيل ترخيص',
  'license.status_trial': 'تحويل ترخيص لتجريبي',
  'license.status_suspended': 'إيقاف ترخيص',
  'license.status_expired': 'إنهاء ترخيص',
  'user.created': 'إنشاء مستخدم',
  'user.updated': 'تعديل مستخدم',
  'user.enabled': 'تفعيل مستخدم',
  'user.disabled': 'إيقاف مستخدم',
  'user.deleted': 'حذف مستخدم',
  'user.password_reset': 'إعادة تعيين كلمة مرور',
  'user.force_logout': 'تسجيل خروج إجباري',
  'platform.settings_updated': 'تعديل إعدادات المنصة',
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
