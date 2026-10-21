'use client';

import Link from 'next/link';
import {
  Building2,
  Database,
  Languages,
  Settings2,
  Shield,
  Wrench,
  ChevronLeft,
} from 'lucide-react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useMemo } from 'react';
import { useApiQuery } from '@/lib/hooks/useApi';
import { AccountingSettingsPageHeader } from '@/components/accounting-settings';
import { FormSectionCard } from '@/components/ui';

const sections = [
  {
    key: 'company-data',
    title: 'بيانات الشركة',
    description: 'الاسم، العنوان، والبيانات القانونية',
    icon: Building2,
    href: '/settings/company',
  },
  {
    key: 'create-users',
    title: 'المستخدمون والصلاحيات',
    description: 'مجموعات المستخدمين وحقوق الشاشات',
    icon: Shield,
    href: '/accounting-settings/create-user-groups',
  },
  {
    key: 'company-settings',
    title: 'إعدادات الشركة',
    description: 'الحسابات الافتراضية، القوائم المالية، البريد والواتساب',
    icon: Settings2,
    href: '/accounting-settings/company-settings/accounting-settings',
  },
  {
    key: 'operations-management',
    title: 'إدارة العمليات',
    description: 'ترحيل، إصلاح مخزون، حذف الملغى، وترقيم',
    icon: Wrench,
    href: '/accounting-settings/operations-management/post-all',
  },
  {
    key: 'database-tools',
    title: 'أدوات قواعد البيانات',
    description: 'نسخ احتياطي، تصدير، ترحيل، واعتماد',
    icon: Database,
    href: '/accounting-settings/database-tools/database-backup',
  },
  {
    key: 'translation',
    title: 'الترجمة',
    description: 'رسائل النظام ونصوص الشاشات',
    icon: Languages,
    href: '/accounting-settings/translation/translate-messages',
  },
] as const;

export default function AccountingSettingsPage() {
  useBackendReachability();

  const { data: companiesRes, isLoading: companiesLoading } = useApiQuery<{ id: string }[]>(
    ['companies', 'accounting-settings-hub'],
    '/companies',
    { page: 1, limit: 500, isActive: true },
    { requireFullTenant: false, skipErrorNotify: true }
  );

  const companyTotal = useMemo(() => {
    const p = companiesRes?.pagination ?? companiesRes?.meta;
    if (typeof p?.total === 'number') return p.total;
    return companiesRes?.data?.length ?? 0;
  }, [companiesRes]);

  return (
    <>
      <AccountingSettingsPageHeader title="الإعدادات المحاسبية" />
      <p className="mb-4 text-sm text-slate-600">
        إدارة الإعدادات المحاسبية والمالية للشركة الحالية —{' '}
        {companiesLoading ? '…' : `${companyTotal} شركة نشطة على المنصة`}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.key} href={section.href} className="group block min-w-0">
              <FormSectionCard className="mb-0 h-full transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EAF6FB] text-[#0E78AA]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-zinc-900">{section.title}</h2>
                      <ChevronLeft
                        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-1 text-xs leading-6 text-slate-500">{section.description}</p>
                  </div>
                </div>
              </FormSectionCard>
            </Link>
          );
        })}
      </div>

      <FormSectionCard title="إجراءات سريعة" className="mt-4" bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/accounting-settings/company-settings/accounting-settings', label: 'إعدادات محاسبية' },
          { href: '/accounting-settings/database-tools/database-backup', label: 'نسخ احتياطي' },
          { href: '/accounting-settings/database-tools/export-import-data', label: 'تصدير / استيراد' },
          { href: '/accounting-settings/database-tools/database-migration', label: 'ترحيل البيانات' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-[#E6F0F7] bg-slate-50 px-3 py-2.5 text-center text-sm font-semibold text-[#094C6B] hover:bg-[#EAF6FB]"
          >
            {item.label}
          </Link>
        ))}
      </FormSectionCard>
    </>
  );
}
