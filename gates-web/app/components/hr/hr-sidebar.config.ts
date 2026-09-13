import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderOpen,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';

export type HrNavItem = {
  key: string;
  label: string;
  href?: string;
  icon?: LucideIcon;
  color?: string;
  children?: HrNavItem[];
};

const basicDataChildren: HrNavItem[] = [
  { key: 'nationalities', label: 'تعريف الجنسيات', href: '/hr/nationalities' },
  { key: 'religions', label: 'تعريف الديانات', href: '/hr/religions' },
  { key: 'marital-status', label: 'الحالة الإجتماعية', href: '/hr/marital-status' },
  { key: 'qualifications', label: 'المؤهلات الدراسية', href: '/hr/qualifications' },
  { key: 'document-types', label: 'أنواع المستندات', href: '/hr/document-types' },
  { key: 'job-cadres', label: 'الكادرات الوظيفية', href: '/hr/job-cadres' },
  { key: 'job-titles', label: 'المسميات الوظيفية', href: '/hr/job-titles' },
  { key: 'allowances', label: 'تعريف الإضافات', href: '/hr/allowances' },
  { key: 'deductions', label: 'تعريف الإستقطاعات', href: '/hr/deductions' },
  { key: 'departments', label: 'تعريف الأقسام', href: '/hr/departments' },
  { key: 'cities', label: 'تعريف المدن', href: '/hr/cities' },
  { key: 'tickets', label: 'تعريف التذاكر', href: '/hr/tickets' },
  { key: 'procedures', label: 'تعريف الإجراءات', href: '/hr/procedures' },
  { key: 'scientific-specializations', label: 'التخصصات العلمية', href: '/hr/scientific-specializations' },
  { key: 'managers', label: 'تعريف الإدارات', href: '/hr/managements' },
];

const employeeOpsChildren: HrNavItem[] = [
  { key: 'employee-data', label: 'بيانات موظف', href: '/hr/employee-data' },
  { key: 'employee-contract', label: 'تعاقد موظف', href: '/hr/employee-contract' },
  { key: 'employee-onboarding', label: 'مباشرة للعمل', href: '/hr/employee-onboarding' },
  { key: 'employee-penalty', label: 'جزاء', href: '/hr/employee-penalty' },
  { key: 'employee-reward', label: 'مكافأة', href: '/hr/employee-reward' },
  { key: 'employee-warning', label: 'إنذار', href: '/hr/employee-warning' },
  { key: 'employee-reminder', label: 'تذكية', href: '/hr/employee-reminder' },
  { key: 'employee-training-course', label: 'دورة تدريبية', href: '/hr/employee-training-course' },
  { key: 'employee-transfer', label: 'نقل موظف', href: '/hr/employee-transfer' },
  { key: 'employee-secondment', label: 'إنتداب', href: '/hr/employee-secondment' },
  { key: 'employee-promotion', label: 'ترقية', href: '/hr/employee-promotion' },
  { key: 'employee-checkout', label: 'إنهاء خدمة', href: '/hr/employee-checkout' },
  { key: 'employee-suspend', label: 'إيقاف خدمة', href: '/hr/employee-suspend' },
  { key: 'Employee-reinstatement', label: 'إعادة مباشرة', href: '/hr/Employee-reinstatement' },
  { key: 'employee-advance', label: 'سلفة', href: '/hr/employee-advance' },
  { key: 'annual-leave-registration', label: 'تسجيل إجازة سنوية', href: '/hr/annual-leave-registration' },
];

const attendanceChildren: HrNavItem[] = [
  { key: 'work-shifts', label: 'ورديات العمل', href: '/hr/work-shifts' },
  { key: 'employee-working-days', label: 'أيام عمل الموظفين', href: '/hr/employee-working-days' },
  { key: 'company-leave-days-definition', label: 'أيام الإجازات بالشركة', href: '/hr/company-leave-days-definition' },
  { key: 'absence-permission', label: 'إذن غياب', href: '/hr/absence-permission' },
  { key: 'delay-permission', label: 'إذن تأخير', href: '/hr/delay-permission' },
  { key: 'employee-attendance-preview', label: 'معاينة حضور وانصراف', href: '/hr/employee-attendance-preview' },
  { key: 'employee-absence-overtime', label: 'غياب وإضافي', href: '/hr/employee-absence-overtime' },
  { key: 'attendance-sheet-fingerprint', label: 'شيت البصمة', href: '/hr/attendance-sheet-fingerprint' },
];

const payrollChildren: HrNavItem[] = [
  { key: 'monthly-salaries', label: 'الرواتب الشهرية', href: '/hr/monthly-salaries' },
  { key: 'monthly-salaries-disbursement', label: 'صرف الرواتب', href: '/hr/monthly-salaries-disbursement' },
  { key: 'annual-leave-entitlements-clearance', label: 'تصفية مستحقات الإجازة', href: '/hr/annual-leave-entitlements-clearance' },
  { key: 'annual-leave-entitlements-disbursement', label: 'صرف مستحقات الإجازة', href: '/hr/annual-leave-entitlements-disbursement' },
  { key: 'end-of-service-entitlements-clearance', label: 'تصفية نهاية الخدمة', href: '/hr/end-of-service-entitlements-clearance' },
  { key: 'end-of-service-entitlements-disbursement', label: 'صرف نهاية الخدمة', href: '/hr/end-of-service-entitlements-disbursement' },
  { key: 'housing-allowance-clearance', label: 'تصفية بدل السكن', href: '/hr/housing-allowance-clearance' },
  { key: 'housing-allowance-entitlements-disbursement', label: 'صرف بدل السكن', href: '/hr/housing-allowance-entitlements-disbursement' },
];

const reportChildren: HrNavItem[] = [
  { key: 'reports-hub', label: 'كل التقارير', href: '/hr/reports' },
  { key: 'employee-data-report', label: 'بيانات الموظفين', href: '/hr/employee-data-report' },
  { key: 'employee-secondment-report', label: 'إنتداب الموظفين', href: '/hr/employee-secondment-report' },
  { key: 'employee-penalties-report', label: 'جزاءات الموظفين', href: '/hr/employee-penalties-report' },
  { key: 'employee-rewards-report', label: 'مكافآت الموظفين', href: '/hr/employee-rewards-report' },
  { key: 'employee-warnings-report', label: 'إنذارات الموظفين', href: '/hr/employee-warnings-report' },
  { key: 'employee-courses-report', label: 'دورات الموظفين', href: '/hr/employee-courses-report' },
  { key: 'employee-transfer-report', label: 'نقل الموظفين', href: '/hr/employee-transfer-report' },
  { key: 'employee-promotions-report', label: 'ترقيات الموظفين', href: '/hr/employee-promotions-report' },
  { key: 'employee-suspensions-report', label: 'إيقافات الموظفين', href: '/hr/employee-suspensions-report' },
  { key: 'employee-termination-report', label: 'إنهاء الخدمة', href: '/hr/employee-termination-report' },
  { key: 'employee-loans-report', label: 'سلف الموظفين', href: '/hr/employee-loans-report' },
  { key: 'housing-allowance-report', label: 'بدل السكن', href: '/hr/housing-allowance-report' },
  { key: 'leave-entitlements-report', label: 'مستحقات الإجازات', href: '/hr/leave-entitlements-report' },
  { key: 'end-of-service-report', label: 'نهاية الخدمة', href: '/hr/end-of-service-report' },
  { key: 'employee-recommendations-report', label: 'توصيات الموظفين', href: '/hr/employee-recommendations-report' },
];

/** HR sidebar navigation — grouped; Lucide icons only. */
export const hrModules: HrNavItem[] = [
  { key: 'hr-settings', label: 'إعدادات شؤون الموظفين', href: '/hr/settings', icon: Settings, color: '#0E79AA' },
  {
    key: 'basic-data',
    label: 'بيانات أساسية',
    icon: FolderOpen,
    children: basicDataChildren,
  },
  { key: 'payroll-policies', label: 'سياسات الرواتب', href: '/hr/payroll-policies', icon: Wallet },
  { key: 'wage-policy', label: 'سياسة الأجور', href: '/hr/wage-policy', icon: Briefcase },
  {
    key: 'employees',
    label: 'عمليات الموظفين',
    icon: Users,
    children: employeeOpsChildren,
  },
  {
    key: 'attendance',
    label: 'الحضور والانصراف',
    icon: CalendarClock,
    children: attendanceChildren,
  },
  {
    key: 'payroll',
    label: 'الرواتب والمستحقات',
    icon: Wallet,
    children: payrollChildren,
  },
  { key: 'employee-procedures', label: 'إجراءات الموظفين', href: '/hr/employee-procedures', icon: ClipboardList },
  { key: 'transaction-models', label: 'نماذج المعاملات', href: '/hr/transaction-models', icon: FileText },
  { key: 'transaction-tracking', label: 'متابعة المعاملات', href: '/hr/transaction-tracking', icon: Building2 },
  {
    key: 'hr-reports',
    label: 'تقارير الموظفين',
    icon: BarChart3,
    children: reportChildren,
  },
];

/** Flattened tree for AppTabs (string icons + color). */
export const hrModulesForTabs = hrModules.map((item) => ({
  key: item.key,
  label: item.label,
  href: item.href,
  icon: '',
  color: item.color ?? '#0E79AA',
  children: item.children?.map((child) => ({
    key: child.key,
    label: child.label,
    href: child.href,
    icon: '',
    color: '#0E79AA',
  })),
}));
