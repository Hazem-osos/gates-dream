"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiQuery } from '@/lib/hooks/useApi';

const SUB_ROUTE_COUNT = 24;

export default function AccountingSettingsPage() {
  useBackendReachability();

  const [activeSection, setActiveSection] = useState<string>('');

  const { data: companiesRes, isLoading: companiesLoading } = useApiQuery<
    { id: string }[]
  >(['companies', 'accounting-settings-hub'], '/companies', {
    page: 1,
    limit: 500,
    isActive: true,
  });

  const companyTotal = useMemo(() => {
    const p = companiesRes?.pagination ?? companiesRes?.meta;
    if (typeof p?.total === 'number') return p.total;
    return companiesRes?.data?.length ?? 0;
  }, [companiesRes]);

  const sections = [
    {
      key: 'company-data',
      title: 'بيانات الشركة',
      description: 'إدارة معلومات الشركة الأساسية',
      icon: '🏢',
      color: 'bg-blue-100 text-blue-800',
      href: '/settings/company',
    },
    {
      key: 'create-users',
      title: 'إنشاء المستخدمين',
      description: 'إدارة حسابات المستخدمين والصلاحيات',
      icon: '👥',
      color: 'bg-green-100 text-green-800',
      href: '/accounting-settings/create-user-groups',
    },
    {
      key: 'company-settings',
      title: 'إعدادات الشركة',
      description: 'الإعدادات المحاسبية والمالية للشركة',
      icon: '⚙️',
      color: 'bg-purple-100 text-purple-800',
      href: '/accounting-settings/company-settings/accounting-settings',
    },
    {
      key: 'operations-management',
      title: 'إدارة العمليات',
      description: 'إدارة العمليات المالية والمحاسبية',
      icon: '📊',
      color: 'bg-orange-100 text-orange-800',
      href: '/accounting-settings/operations-management/post-all',
    },
    {
      key: 'database-tools',
      title: 'أدوات قواعد البيانات',
      description: 'أدوات إدارة وصيانة قاعدة البيانات',
      icon: '🗄️',
      color: 'bg-red-100 text-red-800',
      href: '/accounting-settings/database-tools/database-backup',
    },
    {
      key: 'translation',
      title: 'الترجمة',
      description: 'إدارة ترجمة الرسائل والشاشات',
      icon: '🌐',
      color: 'bg-indigo-100 text-indigo-800',
      href: '/accounting-settings/translation/translate-messages',
    },
  ] as const;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#094C6B] mb-2">الإعدادات المحاسبية</h1>
        <p className="text-gray-600">إدارة الإعدادات المحاسبية والمالية للنظام</p>
      </div>

      {/* Quick Stats */}
      <OuterCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <InnerCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#0E79AA] mb-1">
                {companiesLoading ? '…' : companyTotal}
              </div>
              <div className="text-sm text-gray-600">شركات نشطة (من الخادم)</div>
            </div>
          </InnerCard>
          <InnerCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#0E79AA] mb-1">{sections.length}</div>
              <div className="text-sm text-gray-600">الأقسام الرئيسية</div>
            </div>
          </InnerCard>
          <InnerCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#0E79AA] mb-1">{SUB_ROUTE_COUNT}</div>
              <div className="text-sm text-gray-600">الإعدادات الفرعية (تقريباً)</div>
            </div>
          </InnerCard>
          <InnerCard>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#0E79AA] mb-1">100%</div>
              <div className="text-sm text-gray-600">متوافق مع المعايير</div>
            </div>
          </InnerCard>
        </div>
      </OuterCard>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
          <OuterCard key={section.key}>
            <div 
              className={`p-6 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg ${
                activeSection === section.key ? 'ring-2 ring-[#0E79AA]' : ''
              }`}
              onClick={() => setActiveSection(activeSection === section.key ? '' : section.key)}
            >
              <div className="flex items-center mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${section.color} ml-4`}>
                  {section.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#094C6B]">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              
              {activeSection === section.key && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 mb-3">
                    {section.key === 'company-data' && 'إدارة معلومات الشركة الأساسية مثل الاسم والعنوان والبيانات القانونية'}
                    {section.key === 'create-users' && 'إنشاء وإدارة حسابات المستخدمين مع تحديد الصلاحيات المناسبة'}
                    {section.key === 'company-settings' && 'الإعدادات المحاسبية والمالية المتقدمة للشركة'}
                    {section.key === 'operations-management' && 'إدارة العمليات المالية والمحاسبية اليومية'}
                    {section.key === 'database-tools' && 'أدوات صيانة وإدارة قاعدة البيانات'}
                    {section.key === 'translation' && 'إدارة ترجمة واجهة المستخدم والرسائل'}
                  </div>
                  <Link
                    href={section.href}
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full text-center bg-[#0E79AA] text-white py-2 px-4 rounded-lg hover:bg-[#094C6B] transition-colors"
                  >
                    الدخول إلى القسم
                  </Link>
                </div>
              )}
            </div>
          </OuterCard>
        ))}
      </div>

      {/* Quick Actions */}
      <OuterCard>
        <h2 className="text-xl font-semibold text-[#094C6B] mb-4">الإجراءات السريعة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/accounting-settings/company-settings/accounting-settings"
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="text-sm font-medium text-[#094C6B]">إعدادات الشركة المحاسبية</div>
          </Link>
          <Link
            href="/accounting-settings/database-tools/database-backup"
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">💾</div>
            <div className="text-sm font-medium text-[#094C6B]">نسخ احتياطي</div>
          </Link>
          <Link
            href="/accounting-settings/database-tools/export-import-data"
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">🔄</div>
            <div className="text-sm font-medium text-[#094C6B]">تصدير / استيراد</div>
          </Link>
          <Link
            href="/accounting-settings/translation/translate-screens"
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">⚙️</div>
            <div className="text-sm font-medium text-[#094C6B]">ترجمة الشاشات</div>
          </Link>
        </div>
      </OuterCard>
    </div>
  );
}
