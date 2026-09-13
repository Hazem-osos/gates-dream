'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { Settings2 } from 'lucide-react';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import type { AccountingSettingsUiState } from '@/lib/accounting-settings/mapCompanySettingsUi';
import {
  ACCOUNT_SLOT_LABELS,
  TAX_SLOT_LABELS,
  defaultAccountingSettingsForm,
  formToPutPayload,
  mapFacadeToForm,
  type AccountingSettingsFormState,
} from '@/lib/accounting-settings/mapAccountingSettingsFacade';
import {
  useAccountingSettingsMutation,
  useAccountingSettingsQuery,
} from '@/lib/hooks/useAccountingSettings';
import { AccountSlotField } from './AccountSlotField';
import type { AccountingAccountSlotKey } from '@/lib/accounting-settings/accounting-settings.types';

export default function CompanyAccountingSettingsPage() {
  useBackendReachability();

  const router = useRouter();
  const { companyId } = useFirstCompany();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const tabs = useMemo(() => [
    'إعدادات عامة',
    'تعريف الحسابات',
    'سند قيد يومية',
    'سند صرف نقدية',
    'سند قبض نقدية',
    'سند خصم بنكي',
    'سند إضافة بنكية',
    'أوراق الدفع',
    'أوراق القبض',
    'إيصالات مؤقتة',
    'إعتمادات مستندية',
    'فاتورة مبيعات',
    'فاتورة مردودات مبيعات',
    'فاتورة مشتريات',
    'فاتورة مردودات مشتريات',
    'النقل المخزني',
    'الجرد المخزني',
    'تجميع الأصناف',
    'تفكيك الأصناف'
  ], []);
  const [activeTab, setActiveTab] = useState<string>('إعدادات عامة');
  const [settings, setSettings] = useState<AccountingSettingsFormState>(() =>
    defaultAccountingSettingsForm()
  );
  const [savedSnapshot, setSavedSnapshot] = useState('');

  const { data: settingsRes, isLoading: settingsLoading } = useAccountingSettingsQuery();
  const saveMutation = useAccountingSettingsMutation();

  useEffect(() => {
    const row = settingsRes?.data;
    if (!row) return;
    const next = mapFacadeToForm(row);
    setSettings(next);
    setSavedSnapshot(JSON.stringify(next));
  }, [settingsRes?.data]);

  const isDirty = useMemo(
    () => Boolean(savedSnapshot) && JSON.stringify(settings) !== savedSnapshot,
    [savedSnapshot, settings]
  );

  const update = (field: keyof AccountingSettingsFormState, value: unknown) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const updateAccount = (key: AccountingAccountSlotKey, accountId: string) => {
    setSettings((prev) => ({
      ...prev,
      accounts: { ...prev.accounts, [key]: accountId },
    }));
  };

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!companyId) {
      setError('لم يتم العثور على شركة نشطة');
      return;
    }
    saveMutation.mutate(formToPutPayload(settings), {
      onSuccess: () => {
        setSavedSnapshot(JSON.stringify(settings));
        setSuccess('تم حفظ إعدادات المحاسبة بنجاح');
        setError('');
      },
      onError: (err: unknown) => {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err
            ? String((err as ApiError).message)
            : 'حدث خطأ أثناء الحفظ';
        setError(msg);
        setSuccess('');
      },
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      {settingsLoading && companyId && (
        <p className="mb-4 text-sm text-[#094C6B]">جاري تحميل إعدادات الشركة…</p>
      )}
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">الإعدادات المحاسبية للشركة</h1>
          <p className="text-sm text-[#094C6B] mb-3">
            لإدارة كل مفاتيح الشركة الـ 81 والأنماط الملحقة بكود الشاشة وتجاوزات الفروع، راجع{' '}
            <Link href="/accounting-settings/company-settings/legacy-catalog" className="text-[#0E78AA] underline font-semibold">
              كتالوج إعدادات الشركة
            </Link>
            .
          </p>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        {/* Tabs - compact, fancy chips (no scroll, wraps as needed) */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2 bg-white/70 border border-[#D6EAF3] rounded-xl p-2">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`relative px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  activeTab === t
                    ? 'text-white bg-gradient-to-r from-[#0E78AA] to-[#094C6B] shadow-md'
                    : 'text-[#094C6B] bg-white border border-[#D6EAF3] hover:border-[#0E78AA]/60 hover:text-[#0E78AA]'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeTab === t ? 'bg-white' : 'bg-[#0E78AA]'}`}></span>
                  {t}
                </span>
                {activeTab === t && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2/3 h-[2px] rounded bg-white/70"></span>
                )}
              </button>
            ))}
          </div>
        </div>

        <InnerCard>
          <div className="flex flex-row w-full justify-end gap-2 mb-6">
            <button className="flex items-center justify-center w-9 h-9 bg-[#0E78AA] rounded-lg hover:bg-[#094C6B] transition-colors shadow-sm">
              <img src="/magnifying-glass-1.svg" alt="بحث" className="w-5 h-5" />
            </button>
            <button className="flex items-center justify-center w-9 h-9 bg-[#0E78AA] rounded-lg hover:bg-[#094C6B] transition-colors shadow-sm">
              <img src="/ooui_help-ltr.svg" alt="مساعدة" className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          {activeTab === 'تعريف الحسابات' || 
           activeTab === 'سند قيد يومية' || 
           activeTab === 'سند صرف نقدية' || 
           activeTab === 'سند قبض نقدية' || 
           activeTab === 'سند خصم بنكي' || 
           activeTab === 'سند إضافة بنكية' || 
           activeTab === 'أوراق الدفع' || 
           activeTab === 'أوراق القبض' ||
           activeTab === 'إيصالات مؤقتة' ||
           activeTab === 'إعتمادات مستندية' ||
           activeTab === 'فاتورة مبيعات' ||
           activeTab === 'فاتورة مردودات مبيعات' ||
           activeTab === 'فاتورة مشتريات' ||
           activeTab === 'فاتورة مردودات مشتريات' ? (
            /* Full Width Layout for Account Definition and Journal Entry */
            <InnerCard>
              <div className="p-6">
                <form className="space-y-6">
                  {/* Search heading and titles */}
                  <div className="text-right text-[#094C6B] font-semibold">البحث...</div>
                  <div>
                    <h2 className="text-xl font-bold text-[#0E78AA]">{activeTab}</h2>
                  </div>

                  {/* Account Definition Content - Full Width */}
                  {activeTab === 'تعريف الحسابات' && (
                    <div className="mt-6 space-y-6">
                      <p className="text-sm text-[#094C6B]">
                        اختر حسابات تفصيلية فقط (بدون حسابات أب). يظهر الرمز والاسم العربي في القائمة.
                      </p>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {ACCOUNT_SLOT_LABELS.map((slot) => (
                          <AccountSlotField
                            key={slot.key}
                            label={slot.label}
                            value={settings.accounts[slot.key]}
                            onChange={(id) => updateAccount(slot.key, id)}
                            accountDetails={settings.accountDetails}
                          />
                        ))}
                        {TAX_SLOT_LABELS.map((slot) => (
                          <AccountSlotField
                            key={slot.key}
                            label={slot.label}
                            value={settings.taxAccounts[slot.key]}
                            onChange={(id) =>
                              setSettings((prev) => ({
                                ...prev,
                                taxAccounts: { ...prev.taxAccounts, [slot.key]: id },
                              }))
                            }
                            accountDetails={settings.accountDetails}
                          />
                        ))}
                        <AccountSlotField
                          label="الأرباح المرحلة"
                          value={settings.retainedEarningsAccountId}
                          onChange={(id) => update('retainedEarningsAccountId', id)}
                          accountDetails={settings.accountDetails}
                        />
                      </div>
                    </div>
                  )}

                  {/* Document Settings Content - Full Width */}
                  {(activeTab === 'سند قيد يومية' || 
                    activeTab === 'سند صرف نقدية' || 
                    activeTab === 'سند قبض نقدية' || 
                    activeTab === 'سند خصم بنكي' || 
                    activeTab === 'سند إضافة بنكية' || 
                    activeTab === 'أوراق الدفع' || 
                    activeTab === 'أوراق القبض' ||
                    activeTab === 'إيصالات مؤقتة' ||
                    activeTab === 'إعتمادات مستندية' ||
                    activeTab === 'فاتورة مبيعات' ||
                    activeTab === 'فاتورة مردودات مبيعات' ||
                    activeTab === 'فاتورة مشتريات' ||
                    activeTab === 'فاتورة مردودات مشتريات') && (
                    <>
                      {/* السند Select Field - For all document tabs except فاتورة مبيعات, فاتورة مشتريات, فاتورة مردودات مبيعات, and فاتورة مردودات مشتريات */}
                      {activeTab !== 'فاتورة مبيعات' && activeTab !== 'فاتورة مشتريات' && activeTab !== 'فاتورة مردودات مبيعات' && activeTab !== 'فاتورة مردودات مشتريات' && (
                        <div className="flex items-center gap-4 mb-6">
                          <span className="text-[#094C6B] font-medium min-w-[100px] text-base">السند</span>
                          <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                            <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                              <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                            </button>
                            <select 
                              className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>اختر نوع السند</option>
                              <option value="journal-entry">سند قيد يومية</option>
                              <option value="cash-payment">سند صرف نقدية</option>
                              <option value="cash-receipt">سند قبض نقدية</option>
                              <option value="bank-discount">سند خصم بنكي</option>
                              <option value="bank-addition">سند إضافة بنكية</option>
                              <option value="payment-voucher">أوراق الدفع</option>
                              <option value="receipt-voucher">أوراق القبض</option>
                              <option value="temporary-receipt">إيصالات مؤقتة</option>
                              <option value="documentary-credit">إعتمادات مستندية</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* فاتورة مردودات مشتريات Section - Only for purchase returns invoice tab */}
                      {activeTab === 'فاتورة مردودات مشتريات' && (
                        <>
                          {/* Pattern Selection */}
                          <div className="flex items-center gap-4 mb-6">
                            <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue="general-product-return-receipt"
                              >
                                <option value="general-product-return-receipt">إذن إرجاع إستلام عام</option>
                                <option value="service-purchase-return">فاتورة مردودات مشتريات خدمية</option>
                              </select>
                            </div>
                          </div>

                          {/* Main Content Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Invoice Settings */}
                            <div className="space-y-6">
                              <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات الفاتورة</h3>
                              <div className="space-y-4">
                                {Array.from({ length: 4 }, (_, groupIndex) => (
                                  <div key={groupIndex} className="space-y-3">
                                    {[
                                      'إظهار صلاحيات الشاشة',
                                      'تطبيق ضريبة خصم المنبع',
                                      'تطبيق مؤيد أو غير مؤيد',
                                      'إستخدام التاريخ الميلادي',
                                      'إظهار كلا التاريخين',
                                      'التأثير المباشر على السندات و الأوراق'
                                    ].map((label, index) => (
                                      <label key={`${groupIndex}-${index}`} className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                        <span className="text-xs font-medium text-[#094C6B]">{label}</span>
                                        <input
                                          type="checkbox"
                                          defaultChecked
                                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ))}
                                
                                <label className="flex items-center justify-between bg-white/70 border border-[#D6EAF3] rounded-xl px-4 py-3">
                                  <span className="text-[#094C6B] font-medium">إظهار كل الحسابات في عدسة المورد</span>
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Right Column - Invoice Type and Settings */}
                            <div className="space-y-6">
                              {/* Invoice Type Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">نوع الفاتورة</h3>
                                <div className="space-y-3">
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة مردودات مشتريات خدمية</span>
                                  </label>
                                </div>
                              </div>

                              {/* Select Inputs Section */}
                              <div className="space-y-4">
                                {[
                                  { label: 'المشتريات', value: 'المشتريات' },
                                  { label: 'مردودات مشتريات', value: 'مردودات مشتريات' },
                                  { label: 'سند قبض نقدية', value: 'سند قبض نقدية' },
                                  { label: 'نمط سند القبض', value: 'نمط سند القبض' },
                                  { label: 'ورقة مقبوضات', value: 'ورقة مقبوضات' },
                                  { label: 'نمط ورقة القبض', value: 'نمط ورقة القبض' },
                                  { label: 'مركز التكلفة', value: 'مركز التكلفة' },
                                  { label: 'المخزن الإفتراضي', value: 'المخزن الإفتراضي' },
                                  { label: 'المستهلك', value: 'المستهلك' },
                                  { label: 'سياسة التسعير', value: 'سياسة التسعير' }
                                ].map((field, index) => (
                                  <div key={index} className="flex items-center gap-4">
                                    <span className="text-[#094C6B] font-medium min-w-[140px] text-sm">{field.label}</span>
                                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                                      <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                        <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                                      </button>
                                      <select 
                                        className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                        defaultValue={field.value}
                                      >
                                        <option value={field.value}>{field.value}</option>
                                        <option value="option1">خيار 1</option>
                                        <option value="option2">خيار 2</option>
                                      </select>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Table Colors Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                                <div className="space-y-4">
                                  {[
                                    { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                                    { color: 'bg-gray-200', label: 'سطر رقم 2' }
                                  ].map((row, index) => (
                                    <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                                      <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">
                                        ✏️
                                      </button>
                                      <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                                      <span className="text-[#094C6B] font-medium">{row.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Cost Center Radio Buttons */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">مركز التكلفة</h3>
                                <div className="space-y-3">
                                  <div className="flex gap-6">
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditPurchaseReturn" 
                                        value="debit"
                                        defaultChecked
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>مدين</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditPurchaseReturn" 
                                        value="credit"
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>دائن</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {/* فاتورة مشتريات Section - Only for purchase invoice tab */}
                      {activeTab === 'فاتورة مشتريات' && (
                        <>
                          {/* Pattern Selection */}
                          <div className="flex items-center gap-4 mb-6">
                            <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue="general-product-receipt"
                              >
                                <option value="general-product-receipt">إذن إستلام منتج عام</option>
                                <option value="service-purchase">فاتورة مشتريات خدمية</option>
                                
                                <option value="standard-purchase">فاتورة مشتريات عادية</option>
                              </select>
                            </div>
                          </div>

                          {/* Main Content Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Invoice Settings */}
                            <div className="space-y-6">
                              <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات الفاتورة</h3>
                              <div className="space-y-4">
                                {Array.from({ length: 4 }, (_, groupIndex) => (
                                  <div key={groupIndex} className="space-y-3">
                                    {[
                                      'إظهار صلاحيات الشاشة',
                                      'تطبيق ضريبة خصم المنبع',
                                      'تطبيق مؤيد أو غير مؤيد',
                                      'إستخدام التاريخ الميلادي',
                                      'إظهار كلا التاريخين',
                                      'التأثير المباشر على السندات و الأوراق'
                                    ].map((label, index) => (
                                      <label key={`${groupIndex}-${index}`} className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                        <span className="text-xs font-medium text-[#094C6B]">{label}</span>
                                        <input
                                          type="checkbox"
                                          defaultChecked
                                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ))}
                                
                                <label className="flex items-center justify-between bg-white/70 border border-[#D6EAF3] rounded-xl px-4 py-3">
                                  <span className="text-[#094C6B] font-medium">إظهار كل الحسابات في عدسة المورد</span>
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Right Column - Invoice Type and Settings */}
                            <div className="space-y-6">
                              {/* Invoice Type Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">نوع الفاتورة</h3>
                                <div className="space-y-3">
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة مشتريات خدمية</span>
                                  </label>
                                  
                                  
                                </div>
                              </div>

                              <div className="space-y-4">
                                <AccountSlotField
                                  label="حساب المشتريات الافتراضي"
                                  value={settings.accounts.purchaseAccountId}
                                  onChange={(id) => updateAccount('purchaseAccountId', id)}
                                  accountDetails={settings.accountDetails}
                                />
                                <AccountSlotField
                                  label="حساب خصم مكتسب"
                                  value={settings.accounts.purchaseDiscountAccountId}
                                  onChange={(id) => updateAccount('purchaseDiscountAccountId', id)}
                                  accountDetails={settings.accountDetails}
                                />
                                <AccountSlotField
                                  label="حساب ضريبة مدخلات"
                                  value={settings.taxAccounts.vatInputAccountId}
                                  onChange={(id) =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      taxAccounts: { ...prev.taxAccounts, vatInputAccountId: id },
                                    }))
                                  }
                                  accountDetails={settings.accountDetails}
                                />
                              </div>

                              {/* Table Colors Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                                <div className="space-y-4">
                                  {[
                                    { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                                    { color: 'bg-gray-200', label: 'سطر رقم 2' }
                                  ].map((row, index) => (
                                    <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                                      <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">
                                        ✏️
                                      </button>
                                      <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                                      <span className="text-[#094C6B] font-medium">{row.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Cost Center Radio Buttons */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">مركز التكلفة</h3>
                                <div className="space-y-3">
                                  <div className="flex gap-6">
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditPurchase" 
                                        value="debit"
                                        defaultChecked
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>مدين</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditPurchase" 
                                        value="credit"
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>دائن</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {(activeTab === 'سند صرف نقدية' || activeTab === 'سند قبض نقدية') && (
                        <FormSectionCard title="الصندوق" subtitle="صندوق الفرع والصناديق الأخرى" bodyClassName="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <CompactFormField label="الصندوق">
                            <select className={compactControlClass} defaultValue="">
                              <option value="" disabled>اختر الصندوق</option>
                              <option value="main-cash">الصندوق الرئيسي</option>
                              <option value="branch-cash">صندوق الفرع</option>
                              <option value="petty-cash">صندوق المصروفات</option>
                              <option value="sales-cash">صندوق المبيعات</option>
                            </select>
                          </CompactFormField>
                          <CompactFormField label="صندوق الفرع">
                            <select className={compactControlClass} defaultValue="">
                              <option value="" disabled>اختر الصندوق</option>
                              <option value="main-cash">الصندوق الرئيسي</option>
                              <option value="branch-cash">صندوق الفرع</option>
                              <option value="petty-cash">صندوق المصروفات</option>
                              <option value="sales-cash">صندوق المبيعات</option>
                            </select>
                          </CompactFormField>
                        </FormSectionCard>
                      )}

                      {/* البنك Section - Only for bank discount and bank addition tabs */}
                      {(activeTab === 'سند خصم بنكي' || activeTab === 'سند إضافة بنكية') && (
                        <div className="flex items-center gap-4 mb-6">
                          <span className="text-[#094C6B] font-medium min-w-[100px] text-base">البنك</span>
                          <div className="flex gap-4 flex-1">
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>اختر البنك</option>
                                <option value="nbe">البنك الأهلي المصري</option>
                                <option value="cib">البنك التجاري الدولي</option>
                                <option value="hsbc">بنك HSBC</option>
                                <option value="qnb">بنك QNB</option>
                                <option value="adcb">بنك أبوظبي التجاري</option>
                                <option value="mashreq">بنك المشرق</option>
                              </select>
                            </div>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>اختر البنك</option>
                                <option value="nbe">البنك الأهلي المصري</option>
                                <option value="cib">البنك التجاري الدولي</option>
                                <option value="hsbc">بنك HSBC</option>
                                <option value="qnb">بنك QNB</option>
                                <option value="adcb">بنك أبوظبي التجاري</option>
                                <option value="mashreq">بنك المشرق</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* الحساب Section - Only for payment and receipt vouchers tabs */}
                      {(activeTab === 'أوراق الدفع' || activeTab === 'أوراق القبض') && (
                        <div className="flex items-center gap-4 mb-6">
                          <span className="text-[#094C6B] font-medium min-w-[100px] text-base">الحساب</span>
                          <div className="flex gap-4 flex-1">
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>اختر الحساب</option>
                                <option value="cash-account">حساب النقدية</option>
                                <option value="bank-account">حساب البنك</option>
                                <option value="customer-account">حساب العميل</option>
                                <option value="supplier-account">حساب المورد</option>
                                <option value="expense-account">حساب المصروفات</option>
                                <option value="revenue-account">حساب الإيرادات</option>
                                <option value="asset-account">حساب الأصول</option>
                                <option value="liability-account">حساب الخصوم</option>
                              </select>
                            </div>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue=""
                              >
                                <option value="" disabled>اختر الحساب</option>
                                <option value="cash-account">حساب النقدية</option>
                                <option value="bank-account">حساب البنك</option>
                                <option value="customer-account">حساب العميل</option>
                                <option value="supplier-account">حساب المورد</option>
                                <option value="expense-account">حساب المصروفات</option>
                                <option value="revenue-account">حساب الإيرادات</option>
                                <option value="asset-account">حساب الأصول</option>
                                <option value="liability-account">حساب الخصوم</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* م التكلفة Section - Only for receipt vouchers tab */}
                      {activeTab === 'أوراق القبض' && (
                        <div className="flex items-center gap-4 mb-6">
                          <span className="text-[#094C6B] font-medium min-w-[100px] text-base">م التكلفة</span>
                          <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                            <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                              <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                            </button>
                            <select 
                              className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>اختر طريقة التكلفة</option>
                              <option value="average-cost">متوسط التكلفة</option>
                              <option value="fifo">الوارد أولاً يصرف أولاً</option>
                              <option value="lifo">الوارد أخيراً يصرف أولاً</option>
                              <option value="standard-cost">التكلفة المعيارية</option>
                              <option value="actual-cost">التكلفة الفعلية</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* إيصالات مؤقتة Section - Only for temporary receipts tab */}
                      {activeTab === 'إيصالات مؤقتة' && (
                        <>
                          {/* الصندوق Section */}
                          <div className="flex items-center gap-4 mb-6">
                            <span className="text-[#094C6B] font-medium min-w-[100px] text-base">الصندوق</span>
                            <div className="flex gap-4 flex-1">
                              <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                                <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                  <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                                </button>
                                <input 
                                  type="text" 
                                  value="1212378971212"
                                  className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2"
                                  readOnly
                                />
                              </div>
                             
                            </div>
                          </div>
                        </>
                      )}

                      {/* إعتمادات مستندية Section - Only for documentary credits tab */}
                      {activeTab === 'إعتمادات مستندية' && (
                        <>
         

                          {/* Search Inputs Section */}
                          <div className="space-y-4 mb-6">
                            {/* المشتريات Input */}
                            <div className="flex items-center gap-4">
                              <span className="text-[#094C6B] font-medium min-w-[100px] text-base">المشتريات</span>
                              <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                                <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                  <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                                </button>
                                <input 
                                  type="text" 
                                  value="مشتريات"
                                  className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2"
                                  readOnly
                                />
                              </div>
                            </div>

                            {/* المخزون Input */}
                            <div className="flex items-center gap-4">
                              <span className="text-[#094C6B] font-medium min-w-[100px] text-base">المخزون</span>
                              <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                                <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                  <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                                </button>
                                <input 
                                  type="text" 
                                  value="مخزون 1"
                                  className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2"
                                  readOnly
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* فاتورة مبيعات Section - Only for sales invoice tab */}
                      {activeTab === 'فاتورة مبيعات' && (
                        <>
                          {/* Pattern Selection */}
                          <div className="flex items-center gap-4 mb-6">
                            <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue="general-product-release"
                              >
                                <option value="general-product-release">إذن صرف منتج عام</option>
                                <option value="service-invoice">فاتورة مبيعات خدمية</option>
                                <option value="sample-invoice">فاتورة عينات</option>
                                <option value="standard-invoice">فاتورة مبيعات عادية</option>
                              </select>
                            </div>
                          </div>

                          {/* Main Content Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Invoice Settings */}
                            <div className="space-y-6">
                              <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات الفاتورة</h3>
                              <div className="space-y-4">
                                {/* Repeat the checkbox group 4 times */}
                                {Array.from({ length: 4 }, (_, groupIndex) => (
                                  <div key={groupIndex} className="space-y-3">
                                    {[
                                      'إظهار صلاحيات الشاشة',
                                      'تطبيق ضريبة خصم المنبع',
                                      'تطبيق مؤيد أو غير مؤيد',
                                      'إستخدام التاريخ الميلادي',
                                      'إظهار كلا التاريخين',
                                      'التأثير المباشر على السندات و الأوراق'
                                    ].map((label, index) => (
                                      <label key={`${groupIndex}-${index}`} className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                        <span className="text-xs font-medium text-[#094C6B]">{label}</span>
                                        <input
                                          type="checkbox"
                                          defaultChecked
                                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ))}
                                
                                {/* Final checkbox */}
                                <label className="flex items-center justify-between bg-white/70 border border-[#D6EAF3] rounded-xl px-4 py-3">
                                  <span className="text-[#094C6B] font-medium">إظهار كل الحسابات في عدسة العميل</span>
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Right Column - Invoice Type and Settings */}
                            <div className="space-y-6">
                              {/* Invoice Type Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">نوع الفاتورة</h3>
                                <div className="space-y-3">
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة مبيعات خدمية</span>
                                  </label>
                                  
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة عينات</span>
                                  </label>
                                </div>
                              </div>

                              {/* Select Inputs Section */}
                              <div className="space-y-4">
                                <AccountSlotField
                                  label="حساب المبيعات الافتراضي"
                                  value={settings.accounts.salesAccountId}
                                  onChange={(id) => updateAccount('salesAccountId', id)}
                                  accountDetails={settings.accountDetails}
                                />
                                <AccountSlotField
                                  label="حساب خصم مسموح به"
                                  value={settings.accounts.salesDiscountAccountId}
                                  onChange={(id) => updateAccount('salesDiscountAccountId', id)}
                                  accountDetails={settings.accountDetails}
                                />
                                <AccountSlotField
                                  label="حساب ضريبة المبيعات"
                                  value={settings.taxAccounts.salesTaxAccountId}
                                  onChange={(id) =>
                                    setSettings((prev) => ({
                                      ...prev,
                                      taxAccounts: { ...prev.taxAccounts, salesTaxAccountId: id },
                                    }))
                                  }
                                  accountDetails={settings.accountDetails}
                                />
                              </div>


                              {/* Cost Center Radio Buttons */}
                              <div className="space-y-4">
                                <div className="bg-white rounded-xl shadow-lg p-6">
                                  <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">مركز التكلفة</h3>
                                  <div className="space-y-3">
                                    <div className="flex gap-6">
                                      <label className="flex items-center gap-2 text-[#094C6B]">
                                        <input 
                                          type="radio" 
                                          name="costCenterDebitCredit" 
                                          value="debit"
                                          defaultChecked
                                          className="w-4 h-4 text-[#0E78AA]"
                                        />
                                        <span>مدين</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-[#094C6B]">
                                        <input 
                                          type="radio" 
                                          name="costCenterDebitCredit" 
                                          value="credit"
                                          className="w-4 h-4 text-[#0E78AA]"
                                        />
                                        <span>دائن</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-white rounded-xl shadow-lg p-6">
                                  <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">مركز التكلفة</h3>
                                  <div className="space-y-3">
                                    <div className="flex gap-6">
                                      <label className="flex items-center gap-2 text-[#094C6B]">
                                        <input 
                                          type="radio" 
                                          name="costCenterType" 
                                          value="cost"
                                          defaultChecked
                                          className="w-4 h-4 text-[#0E78AA]"
                                        />
                                        <span>تكلفة</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-[#094C6B]">
                                        <input 
                                          type="radio" 
                                          name="costCenterType" 
                                          value="sales"
                                          className="w-4 h-4 text-[#0E78AA]"
                                        />
                                        <span>مبيعات</span>
                                      </label>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* فاتورة مردودات مبيعات Section - Only for sales returns invoice tab */}
                      {activeTab === 'فاتورة مردودات مبيعات' && (
                        <>
                          {/* Pattern Selection */}
                          <div className="flex items-center gap-4 mb-6">
                            <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                            <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                              <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                              </button>
                              <select 
                                className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                defaultValue="general-product-return"
                              >
                                <option value="general-product-return">إذن إرجاع منتج عام</option>
                                <option value="service-return">فاتورة مردودات خدمية</option>
                                <option value="sample-return">فاتورة مردودات عينات</option>
                                <option value="standard-return">فاتورة مردودات عادية</option>
                              </select>
                            </div>
                          </div>

                          {/* Main Content Grid */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Invoice Settings */}
                            <div className="space-y-6">
                              <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات الفاتورة</h3>
                              <div className="space-y-4">
                                {/* Repeat the checkbox group 4 times */}
                                {Array.from({ length: 4 }, (_, groupIndex) => (
                                  <div key={groupIndex} className="space-y-3">
                                    {[
                                      'إظهار صلاحيات الشاشة',
                                      'تطبيق ضريبة خصم المنبع',
                                      'تطبيق مؤيد أو غير مؤيد',
                                      'إستخدام التاريخ الميلادي',
                                      'إظهار كلا التاريخين',
                                      'التأثير المباشر على السندات و الأوراق'
                                    ].map((label, index) => (
                                      <label key={`${groupIndex}-${index}`} className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                        <span className="text-xs font-medium text-[#094C6B]">{label}</span>
                                        <input
                                          type="checkbox"
                                          defaultChecked
                                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                ))}
                                
                                {/* Final checkbox */}
                                <label className="flex items-center justify-between bg-white/70 border border-[#D6EAF3] rounded-xl px-4 py-3">
                                  <span className="text-[#094C6B] font-medium">إظهار كل الحسابات في عدسة العميل</span>
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Right Column - Invoice Type and Settings */}
                            <div className="space-y-6">
                              {/* Invoice Type Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">نوع الفاتورة</h3>
                                <div className="space-y-3">
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة مردودات مبيعات خدمية</span>
                                  </label>
                                  
                                  <label className="flex items-center gap-3 p-3 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      defaultChecked
                                      className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                                    />
                                    <span className="text-[#094C6B] font-medium">فاتورة مردودات عينات</span>
                                  </label>
                                </div>
                              </div>

                              {/* Select Inputs Section */}
                              <div className="space-y-4">
                                {[
                                  { label: 'مردودات المبيعات', value: 'مردودات المبيعات' },
                                  { label: 'مردودات المبيعات', value: 'مردودات المبيعات' },
                                  { label: 'سند صرف نقدية', value: 'سند صرف نقدية' },
                                  { label: 'نمط سند الصرف', value: 'نمط سند الصرف' },
                                  { label: 'ورقة مدفوعات', value: 'ورقة مدفوعات' },
                                  { label: 'نمط ورقة الدفع', value: 'نمط ورقة الدفع' },
                                  { label: 'مركز التكلفة', value: 'مركز التكلفة' },
                                  { label: 'المخزن الإفتراضي', value: 'المخزن الإفتراضي' },
                                  { label: 'المستهلك', value: 'المستهلك' },
                                  { label: 'سياسة التسعير', value: 'سياسة التسعير' }
                                ].map((field, index) => (
                                  <div key={index} className="flex items-center gap-4">
                                    <span className="text-[#094C6B] font-medium min-w-[140px] text-sm">{field.label}</span>
                                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                                      <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                                        <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                                      </button>
                                      <select 
                                        className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer"
                                        defaultValue={field.value}
                                      >
                                        <option value={field.value}>{field.value}</option>
                                        <option value="option1">خيار 1</option>
                                        <option value="option2">خيار 2</option>
                                      </select>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Table Colors Section */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                                <div className="space-y-4">
                                  {[
                                    { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                                    { color: 'bg-gray-200', label: 'سطر رقم 2' }
                                  ].map((row, index) => (
                                    <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                                      <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">
                                        ✏️
                                      </button>
                                      <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                                      <span className="text-[#094C6B] font-medium">{row.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Cost Center Radio Buttons */}
                              <div className="bg-white rounded-xl shadow-lg p-6">
                                <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">مركز التكلفة</h3>
                                <div className="space-y-3">
                                  <div className="flex gap-6">
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditReturn" 
                                        value="debit"
                                        defaultChecked
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>مدين</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-[#094C6B]">
                                      <input 
                                        type="radio" 
                                        name="costCenterDebitCreditReturn" 
                                        value="credit"
                                        className="w-4 h-4 text-[#0E78AA]"
                                      />
                                      <span>دائن</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {/* إعدادات الإيصال Section - Only for temporary receipts tab */}
                      {activeTab === 'إيصالات مؤقتة' && (
                        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                          <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-6">إعدادات الإيصال</h3>
                          <div className="space-y-4">
                            <label className="flex items-center gap-4 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                              <input 
                                type="checkbox" 
                                defaultChecked
                                className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                              />
                              <span className="text-[#094C6B] font-medium text-base">ترقيم تلقائي للابصالات المؤقتة</span>
                            </label>
                            
                            <label className="flex items-center gap-4 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                              <input 
                                type="checkbox" 
                                defaultChecked
                                className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                              />
                              <span className="text-[#094C6B] font-medium text-base">ترقيم متصل للابصالات المؤقتة لعدة فترات محاسبية</span>
                            </label>
                            
                            <label className="flex items-center gap-4 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                              <input 
                                type="checkbox" 
                                defaultChecked
                                className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2"
                              />
                              <span className="text-[#094C6B] font-medium text-base">طباعة مؤقتة للإيصالات المؤقتة عند الحفظ</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* إعتمادات مستندية Table Colors and Credit Settings - Only for documentary credits tab */}
                      {activeTab === 'إعتمادات مستندية' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                          {/* Right Column - Table Colors (reversed) */}
                          <div className="order-2 lg:order-2 space-y-6">
                            <h3 className="text-xl font-bold text-[#0E78AA] text-center">ألوان الجدول</h3>
                            <div className="space-y-4">
                              {[
                                { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                                { color: 'bg-gray-200', label: 'سطر رقم 2' }
                              ].map((row, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                                  <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">
                                    ✏️
                                  </button>
                                  <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                                  <span className="text-[#094C6B] font-medium">{row.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column - Credit Settings */}
                          <div className="space-y-6">
                            <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات الإعتماد</h3>
                            <div className="space-y-4">
                              {[
                                'إظهار صلاحيات الشاشة',
                                'تطبيق ضريبة خصم المنبع'
                              ].map((setting, index) => (
                                <label key={index} className="flex items-center gap-2 rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                  />
                                  <span className="text-xs font-medium text-[#094C6B]">{setting}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Table Colors and Document Settings - Only for document tabs except إيصالات مؤقتة, إعتمادات مستندية, فاتورة مبيعات, فاتورة مشتريات, فاتورة مردودات مبيعات, and فاتورة مردودات مشتريات */}
                      {activeTab !== 'إيصالات مؤقتة' && activeTab !== 'إعتمادات مستندية' && activeTab !== 'فاتورة مبيعات' && activeTab !== 'فاتورة مشتريات' && activeTab !== 'فاتورة مردودات مبيعات' && activeTab !== 'فاتورة مردودات مشتريات' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                          {/* Left Column - Table Colors */}
                          <div className="space-y-6">
                            <h3 className="text-xl font-bold text-[#0E78AA] text-center">ألوان الجدول</h3>
                            <div className="space-y-4">
                              {[
                                { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                                { color: 'bg-gray-200', label: 'سطر رقم 2' },
                                { color: 'bg-green-300', label: 'سطر رقم 3' },
                                { color: 'bg-yellow-300', label: 'سطر رقم 4' }
                              ].map((row, index) => (
                                <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                                  <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">
                                    ✏️
                                  </button>
                                  <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                                  <span className="text-[#094C6B] font-medium">{row.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Left Column - Document Settings (reversed) */}
                          <div className="order-1 lg:order-1 space-y-6">
                            <h3 className="text-xl font-bold text-[#0E78AA] text-center">إعدادات السند</h3>
                            <div className="space-y-4">
                              {[
                                'إظهار صلاحيات الشاشة',
                                'تطبيق ضريبة خصم المنبع',
                                'تطبيق مؤيد أو غير مؤيد',
                                'إستخدام التاريخ الميلادي',
                                'إظهار كلا التاريخين',
                                'التأثير المباشر على السندات و الأوراق'
                              ].map((setting, index) => (
                                <label key={index} className="flex items-center gap-2 rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5">
                                  <input
                                    type="checkbox"
                                    defaultChecked
                                    className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                  />
                                  <span className="text-xs font-medium text-[#094C6B]">{setting}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </form>
              </div>
            </InnerCard>
          ) : activeTab === 'الجرد المخزني' ? (
            <InnerCard>
              <div className="p-6">
                {/* Pattern Selection */}
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                  <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                    <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                      <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                    </button>
                    <select className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer" defaultValue="stock-inventory-adjust">
                      <option value="stock-inventory-adjust">تسوية جرد المخزني</option>
                    </select>
                  </div>
                </div>

                {/* Top three rows: increase account, decrease account, increase valuation */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-[#094C6B] font-medium min-w-[120px] text-base">حساب الزيادة</span>
                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                      <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]"><img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/></button>
                      <input type="text" defaultValue="مشتريات" className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#094C6B] font-medium min-w-[120px] text-base">حساب العجز</span>
                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                      <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]"><img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/></button>
                      <input type="text" defaultValue="مخزون 1" className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[#094C6B] font-medium min-w-[120px] text-base">تقييم الزيادة</span>
                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                      <select className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer" defaultValue="">
                        <option value="" disabled>اختر تقييم</option>
                        <option value="average">متوسط التكلفة</option>
                        <option value="fifo">الوارد أولاً يصرف أولاً</option>
                        <option value="lifo">الوارد أخيراً يصرف أولاً</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Two columns: Table colors and Pattern settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Right: Table Colors (reversed) */}
                  <div className="bg-white rounded-xl shadow-lg p-6 order-2 lg:order-2">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                    <div className="space-y-4">
                      {[
                        { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                        { color: 'bg-gray-200', label: 'سطر رقم 2' }
                      ].map((row, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                          <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">✏️</button>
                          <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                          <span className="text-[#094C6B] font-medium">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Left: Pattern Settings (reversed) */}
                  <div className="bg-white rounded-xl shadow-lg p-6 order-1 lg:order-1">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">إعدادات النمط</h3>
                    <div className="space-y-4">
                      {[
                        'ترقيم متصل للجرد المخزني لعدة فترات محاسبية',
                        'طباعة تلقائية للجرد المخزني عند الحفظ'
                      ].map((label, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2" />
                          <span className="text-[#094C6B] font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </InnerCard>
          ) : activeTab === 'تجميع الأصناف' ? (
            <InnerCard>
              <div className="p-6">
                {/* Top bar: سند */}
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[#094C6B] font-medium min-w-[100px] text-base">السند</span>
                  <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden w-64">
                    <select className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer" defaultValue="items-assembly">
                      <option value="items-assembly">تجميع الأصناف</option>
                    </select>
                  </div>
                </div>

                <div className="mb-8 max-w-xl">
                  <AccountSlotField
                    label="حساب التكلفة الإضافية"
                    value={settings.accounts.assemblyExtraCostAccountId}
                    onChange={(id) => updateAccount('assemblyExtraCostAccountId', id)}
                    accountDetails={settings.accountDetails}
                  />
                </div>

                {/* Two columns: Table colors and Pattern settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Table Colors */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                    <div className="space-y-4">
                      {[
                        { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                        { color: 'bg-gray-200', label: 'سطر رقم 2' }
                      ].map((row, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                          <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">✏️</button>
                          <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                          <span className="text-[#094C6B] font-medium">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Pattern Settings */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">إعدادات النمط</h3>
                    <div className="space-y-4">
                      {[
                        'ترقيم متصل للجرد المخزني لعدة فترات محاسبية',
                        'طباعة تلقائية للجرد المخزني عند الحفظ',
                        'إلى ترحيل تلقائي عند الحفظ'
                      ].map((label, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2" />
                          <span className="text-[#094C6B] font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </InnerCard>
          ) : activeTab === 'تفكيك الأصناف' ? (
            <InnerCard>
              <div className="p-6">
                {/* Top bar: سند */}
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[#094C6B] font-medium min-w-[100px] text-base">السند</span>
                  <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden w-64">
                    <select className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer" defaultValue="items-disassembly">
                      <option value="items-disassembly">تفكيك الأصناف</option>
                    </select>
                  </div>
                </div>

                <div className="mb-8 max-w-xl">
                  <AccountSlotField
                    label="حساب التكلفة الإضافية"
                    value={settings.accounts.assemblyExtraCostAccountId}
                    onChange={(id) => updateAccount('assemblyExtraCostAccountId', id)}
                    accountDetails={settings.accountDetails}
                  />
                </div>

                {/* Two columns: Table colors and Pattern settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Table Colors */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                    <div className="space-y-4">
                      {[
                        { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                        { color: 'bg-gray-200', label: 'سطر رقم 2' }
                      ].map((row, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                          <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">✏️</button>
                          <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                          <span className="text-[#094C6B] font-medium">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Pattern Settings */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">إعدادات النمط</h3>
                    <div className="space-y-4">
                      {[
                        'ترقيم متصل للجرد المخزني لعدة فترات محاسبية',
                        'طباعة تلقائية للجرد المخزني عند الحفظ',
                        'إلى ترحيل تلقائي عند الحفظ'
                      ].map((label, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2" />
                          <span className="text-[#094C6B] font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </InnerCard>
          ) : activeTab === 'النقل المخزني' ? (
            <InnerCard>
              <div className="p-6">
                {/* Pattern Selection */}
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[#094C6B] font-medium min-w-[100px] text-base">النمط</span>
                  <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden flex-1">
                    <button className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]">
                      <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4"/>
                    </button>
                    <select className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 cursor-pointer" defaultValue="stock-transfer">
                      <option value="stock-transfer">النقل المخزني</option>
                    </select>
                  </div>
                </div>

                {/* Two columns: Table colors and Pattern settings */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Table Colors */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">ألوان الجدول</h3>
                    <div className="space-y-4">
                      {[
                        { color: 'bg-[#094C6B]', label: 'سطر رقم 1' },
                        { color: 'bg-gray-200', label: 'سطر رقم 2' }
                      ].map((row, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 bg-white/70 border border-[#D6EAF3] rounded-xl">
                          <button className="w-6 h-6 flex items-center justify-center text-[#0E78AA] hover:bg-[#F6FBFD] rounded">✏️</button>
                          <div className={`w-8 h-8 ${row.color} rounded border border-gray-300`}></div>
                          <span className="text-[#094C6B] font-medium">{row.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Pattern Settings */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-bold text-[#0E78AA] text-center mb-4">إعدادات النمط</h3>
                    <div className="space-y-4">
                      {[
                        'ترقيم متصل للجرد المخزني لعدة فترات محاسبية',
                        'طباعة تلقائية للجرد المخزني عند الحفظ',
                        'إلى ترحيل تلقائي عند الحفظ'
                      ].map((label, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-4 bg-[#F6FBFD] rounded-lg border border-[#D6EAF3] hover:bg-[#E6F3FF] transition-colors cursor-pointer">
                          <input type="checkbox" defaultChecked className="w-5 h-5 text-[#0E78AA] bg-[#F6FBFD] border-[#D6EAF3] rounded focus:ring-[#0E79AA] focus:ring-2" />
                          <span className="text-[#094C6B] font-medium">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </InnerCard>
          ) : (
            /* Regular 2-Column Layout for Other Tabs */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Column - Main Inputs */}
              <div>
                <InnerCard>
                  <div className="p-6">
                    <form className="space-y-6">
                      {/* Search heading and titles */}
                      <div className="text-right text-[#094C6B] font-semibold">البحث...</div>
                      <div>
                        <h2 className="text-xl font-bold text-[#0E78AA]">{activeTab}</h2>
                      </div>

                      <>
                        <FormSectionCard title="الإعدادات العامة" subtitle="أرقام الأدلة والتواريخ والتنبيهات" icon={Settings2}>
                          {([
                            { key: 'accountsGuideDigits', label: 'عدد الأرقام لدليل الحسابات' },
                            { key: 'costCentersGuideDigits', label: 'عدد الأرقام لدليل مراكز التكلفة' },
                            { key: 'storesGuideDigits', label: 'عدد الأرقام لدليل المخازن' },
                            { key: 'itemsGuideDigits', label: 'عدد الأرقام لدليل الأصناف' },
                            { key: 'dueSecuritiesWarningDays', label: 'عدد الأيام لإظهار تحذير إستحقاق الأوراق المالية' },
                          ] as { key: keyof AccountingSettingsUiState; label: string }[]).map((field) => (
                            <CompactFormField key={field.key} label={field.label}>
                              <div className="flex h-9 overflow-hidden rounded-lg border border-[#D6EAF3] bg-[#F6FBFD]">
                                <input
                                  type="number"
                                  value={Number(settings[field.key] ?? 1)}
                                  onChange={(e) => update(field.key, Number(e.target.value))}
                                  className="h-full w-full bg-transparent px-3 text-center text-xs font-medium text-[#094C6B] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:text-sm"
                                />
                                <div className="flex flex-col border-r border-[#D6EAF3] bg-white/80">
                                  <button
                                    type="button"
                                    onClick={() => update(field.key, Math.max(0, Number(settings[field.key] ?? 1) + 1))}
                                    className="h-4.5 w-7 leading-none text-[#0E78AA] hover:bg-gray-100"
                                  >
                                    ▴
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => update(field.key, Math.max(0, Number(settings[field.key] ?? 1) - 1))}
                                    className="h-4.5 w-7 leading-none text-[#0E78AA] hover:bg-gray-100"
                                  >
                                    ▾
                                  </button>
                                </div>
                              </div>
                            </CompactFormField>
                          ))}
                          <CompactFormField
                            label="من تاريخ"
                            type="date"
                            value={settings.operationsFromDate}
                            onChange={(e) => update('operationsFromDate', e.target.value)}
                            hint="تاريخ بداية عرض البيانات فى شاشات العمليات"
                          />
                          <FormSectionCard title="ضوابط الترحيل" subtitle="تُطبَّق فوراً على الفواتير والخزينة والمخزون">
                            {(
                              [
                                ['autoPostGl', 'ترحيل قيد تلقائي عند الحفظ'],
                                ['preventNegativeStock', 'منع المخزون السالب'],
                                ['preventCashOverdraft', 'منع السحب على المكشوف من الصندوق'],
                                ['preventSellingBelowCost', 'منع البيع بأقل من التكلفة'],
                                ['enforceCostCenterForPnl', 'إلزام مركز تكلفة لحسابات قائمة الدخل'],
                              ] as const
                            ).map(([key, label]) => (
                              <label
                                key={key}
                                className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5 text-xs font-medium text-[#094C6B]"
                              >
                                {label}
                                <input
                                  type="checkbox"
                                  checked={Boolean(settings[key])}
                                  onChange={(e) => update(key, e.target.checked)}
                                  className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                                />
                              </label>
                            ))}
                          </FormSectionCard>
                          <CompactFormField label="أساس احتساب سعر بند الفاتورة">
                            <select
                              className={compactControlClass}
                              value={settings.pricingCalculationBasis}
                              onChange={(e) =>
                                update(
                                  'pricingCalculationBasis',
                                  e.target.value === 'BASE_UNIT_QTY' ? 'BASE_UNIT_QTY' : 'SELECTED_UNIT_QTY'
                                )
                              }
                            >
                              <option value="SELECTED_UNIT_QTY">كمية الوحدة المختارة</option>
                              <option value="BASE_UNIT_QTY">كمية الوحدة الأساسية</option>
                            </select>
                          </CompactFormField>
                        </FormSectionCard>

                        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة">
                        <div className="space-y-3">
                          <div className="text-xs font-semibold text-[#094C6B]">إعدادات الموازنة</div>
                          
                          {/* Allow exceeding budget - Radio buttons */}
                          <div className="space-y-2">
                            <div className="text-[#094C6B] font-medium">السماح بتعدي قيمة الموازنة</div>
                            <div className="space-y-2">
                              {[
                                'السماح بتعدي قيمة الموازنة',
                                'عدم السماح و إعطاء رسالة فقط',
                                'إعطاء رسالة ووقف الحفظ للأستاذ فقط',
                                'إعطاء رسالة ووقف الحفظ للأصل فقط',
                                'إعطاء رسالة ووقف الحفظ للإثنين'
                              ].map((option, index) => (
                                <label key={index} className="flex items-center gap-2 text-[#094C6B]">
                                  <input 
                                    type="radio" 
                                    name="budgetAllowExceed" 
                                    value={index === 0 ? 'allow' : 'disallow'}
                                    defaultChecked={index === 0}
                                    className="w-4 h-4 text-[#0E78AA]"
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Budget quantity warnings - Radio buttons */}
                          <div className="space-y-2">
                            <div className="text-[#094C6B] font-medium">التحذير عند الوصل لنصف كمية الموازنة</div>
                            <div className="space-y-2">
                              {[
                                'التحذير عند الوصل لنصف كمية الموازنة',
                                'التحذير عند الوصل لنفس كمية الموازنة',
                                'التحذير عند التعدي على كمية الموازنة'
                              ].map((option, index) => (
                                <label key={index} className="flex items-center gap-2 text-[#094C6B]">
                                  <input 
                                    type="radio" 
                                    name="budgetQuantityWarning"
                                    value={index}
                                    defaultChecked={index === 0}
                                    className="w-4 h-4 text-[#0E78AA]"
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Saving behavior - Radio buttons */}
                          <div className="space-y-2">
                            <div className="text-[#094C6B] font-medium">إعطاء رسالة ووقف الحفظ</div>
                            <div className="space-y-2">
                              {[
                                'عدم السماح و إعطاء رسالة فقط',
                                'إعطاء رسالة ووقف الحفظ'
                              ].map((option, index) => (
                                <label key={index} className="flex items-center gap-2 text-[#094C6B]">
                                  <input 
                                    type="radio" 
                                    name="budgetStopBehavior" 
                                    value={index === 0 ? 'message' : 'stop'}
                                    defaultChecked={index === 0}
                                    className="w-4 h-4 text-[#0E78AA]"
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <CompactFormField
                            label="مسار النسخ الإحتياطي"
                            value={settings.backupPath}
                            onChange={(e) => update('backupPath', e.target.value)}
                            prefix={<img src="/bi_folder-fill.svg" alt="" className="h-4 w-4" />}
                          />
                          <CompactFormField label="حساب التكلفة">
                            {/* Only "average" is implemented — item-cost.service.ts always
                                computes a moving average. FIFO/LIFO used to be selectable
                                here but silently had no effect on COGS or inventory value. */}
                            <select
                              className={compactControlClass}
                              value="average"
                              disabled
                              title="طريقتا الوارد أولاً/أخيراً غير مطبقتين حالياً — النظام يستخدم متوسط التكلفة فقط"
                            >
                              <option value="average">متوسط التكلفة</option>
                            </select>
                          </CompactFormField>
                        </div>
                        </AdvancedFieldsSection>
                      </>
                    </form>
                  </div>
                </InnerCard>
              </div>

              {/* Right Column - Advanced Settings Checkboxes - Only show when not on document tabs */}
              {activeTab !== 'سند قيد يومية' && 
               activeTab !== 'سند صرف نقدية' && 
               activeTab !== 'سند قبض نقدية' && 
               activeTab !== 'سند خصم بنكي' && 
               activeTab !== 'سند إضافة بنكية' && 
               activeTab !== 'أوراق الدفع' && 
               activeTab !== 'أوراق القبض' && (
                <div>
                  <FormSectionCard title="الضرائب والإعدادات المتقدمة" bodyClassName="grid grid-cols-1 gap-2">
                    {(
                      [
                        ['adv_showPermissions', 'إظهار صلاحيات الشاشة'],
                        ['adv_applyWithholding', 'تطبيق ضريبة خصم المنبع'],
                        ['adv_applySupportedOrNot', 'تطبيق مؤيد أو غير مؤيد'],
                        ['adv_useGregorian', 'إستخدام التاريخ الميلادي'],
                        ['adv_showBothDates', 'إظهار كلا التاريخين'],
                        ['adv_directEffectOnVouchers', 'التأثير المباشر على السندات  و الأوراق'],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center justify-between rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5 text-xs font-medium text-[#094C6B]"
                      >
                        {label}
                        <input
                          type="checkbox"
                          checked={Boolean(settings[key])}
                          onChange={(e) => update(key, e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                        />
                      </label>
                    ))}
                  </FormSectionCard>
                </div>
              )}
            </div>
          )}

          <FormStickyFooter
            onSave={handleSave}
            onCancel={handleBack}
            saveLoading={saveMutation.isPending}
            saveDisabled={!isDirty || settingsLoading}
            status={
              settingsLoading
                ? 'جاري تحميل إعدادات الشركة…'
                : isDirty
                  ? 'تعديلات غير محفوظة'
                  : 'لا توجد تغييرات'
            }
          />
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}