'use client';

import React, { useState, useEffect } from 'react';
import CrudButtons from '@/components/ui/CrudButtons';
import { UserPermissions } from '@/components/ui/UserPermissions';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { apiClient } from '@/lib/api/client';
import { Building2, GitBranch, Copy } from 'lucide-react';

type CompanyRow = {
  id: string;
  code?: string;
  createdAt?: string;
  entityTypeCode?: string;
  phone1?: string;
  phone2?: string;
  arabicName?: string;
  entityNumber?: string;
  address?: string;
  taxNumber1?: string;
  taxNumber2?: string;
  taxNumber3?: string;
  entityType?: string;
};

export default function CompanyDataPage() {
  const [activeSection, setActiveSection] = useState('company');
  const [formData, setFormData] = useState({
    serial: '',
    date: '',
    entityTypeCode: '',
    phone1: '',
    phone2: '',
    arabicName: '',
    entityNumber: '',
    address: '',
    taxNumber1: '',
    taxNumber2: '',
    taxNumber3: '',
    entityType: ''
  });

  const [branchData, setBranchData] = useState({
    serialNumber: '',
    arabicName: '',
    branchNumber: '',
    activationNumber: '',
    priceList: '',
    registrationNumber: '',
    barcodePrice: 'بالجملة',
    governorate: 'القاهرة',
    district: '',
    streetName: '',
    country: 'بالجملة',
    city: 'مدينة نصر',
    buildingNumber: '',
    postalCode: '',
    address: ''
  });

  const [copyData, setCopyData] = useState({
    fromCompanyId: '',
    toCompanyId: '',
    selectedItems: ['chartOfAccounts']
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load companies (first one as current)
  const { data: companiesResponse } = useApiQuery<CompanyRow[]>(
    ['companies'],
    '/companies',
    { page: 1, limit: 10, isActive: true }
  );
  const companies = companiesResponse?.data || [];

  const currentCompany = companies[0];

  // Initialize form from loaded company
  useEffect(() => {
    if (currentCompany) {
      setFormData(prev => ({
        ...prev,
        serial: currentCompany.code || '',
        date: currentCompany.createdAt ? currentCompany.createdAt.split('T')[0] : prev.date,
        entityTypeCode: currentCompany.entityTypeCode || '',
        phone1: currentCompany.phone1 || '',
        phone2: currentCompany.phone2 || '',
        arabicName: currentCompany.arabicName || '',
        entityNumber: currentCompany.entityNumber || '',
        address: currentCompany.address || '',
        taxNumber1: currentCompany.taxNumber1 || '',
        taxNumber2: currentCompany.taxNumber2 || '',
        taxNumber3: currentCompany.taxNumber3 || '',
        entityType: currentCompany.entityType || ''
      }));
    }
  }, [currentCompany]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleBranchDataChange = (field: string, value: string) => {
    setBranchData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCopyDataChange = (field: string, value: string | string[]) => {
    setCopyData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!currentCompany) {
      setError('لا توجد شركة لتحرير بياناتها');
      return;
    }

    if (activeSection === 'company') {
      const payload: Record<string, unknown> = {
        arabicName: formData.arabicName || undefined,
        address: formData.address || undefined,
        phone1: formData.phone1 || undefined,
        phone2: formData.phone2 || undefined,
        entityTypeCode: formData.entityTypeCode || undefined,
        entityNumber: formData.entityNumber || undefined,
        taxNumber1: formData.taxNumber1 || undefined,
        taxNumber2: formData.taxNumber2 || undefined,
        taxNumber3: formData.taxNumber3 || undefined,
        entityType: formData.entityType || undefined,
      };

      try {
        await apiClient.put(`/companies/${currentCompany.id}`, payload);
        setSuccess('تم حفظ بيانات الشركة بنجاح');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'فشل حفظ بيانات الشركة');
      }
    } else {
      // Placeholder: branchData wiring can be added when branch APIs are connected in the UI
      setSuccess('تم حفظ بيانات الفرع (محلياً فقط - لم يتم ربطها بعد بالواجهة الخلفية)');
    }
  };

  const handleBack = () => {
    // Handle back navigation
  };

  const companyAdvancedCount = [
    formData.entityTypeCode,
    formData.phone2,
    formData.entityType,
    formData.taxNumber1,
    formData.taxNumber2,
    formData.taxNumber3,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  const branchAdvancedCount = [
    branchData.barcodePrice,
    branchData.governorate,
    branchData.district,
    branchData.streetName,
    branchData.country,
    branchData.city,
    branchData.buildingNumber,
    branchData.postalCode,
    branchData.address,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="mx-auto max-w-7xl">
      <div className="mb-6 text-right">
            <h1 className="mb-1 text-lg font-bold text-[#0E78AA]">بيانات الشركة</h1>
            <div className="h-1 w-full rounded bg-sky-700" />
        </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <button type="button" className="rounded-lg bg-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#094C6B]">
          إنشاء شجرة الحسابات
        </button>
        <button type="button" className="rounded-lg bg-[#0E78AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#094C6B]">
          إعدادات الإيميل
        </button>
      </div>

          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1">
              {activeSection === 'branch' && (
                <div className="mb-3">
                  <UserPermissions />
                </div>
              )}

              {activeSection === 'company' ? (
                <>
                  <FormSectionCard title="بيانات الشركة" subtitle="الاسم والعنوان وبيانات التواصل" icon={Building2}>
                    <CompactFormField
                      label="المسلسل"
                      placeholder="إدخل رقم المسلسل"
                      value={formData.serial}
                      onChange={(e) => handleInputChange('serial', e.target.value)}
                    />
                    <CompactFormField
                      label="التاريخ"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                    <CompactFormField
                      label="الإسم العربي"
                      placeholder="إدخل الإسم"
                      value={formData.arabicName}
                      onChange={(e) => handleInputChange('arabicName', e.target.value)}
                    />
                    <CompactFormField
                      label="رقم الجهة"
                      value={formData.entityNumber}
                      onChange={(e) => handleInputChange('entityNumber', e.target.value)}
                    />
                    <CompactFormField
                      label="العنوان"
                      placeholder="إدخل العنوان"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                    />
                    <CompactFormField
                      label="رقم الهاتف 1"
                      placeholder="إدخل رقم الهاتف"
                      value={formData.phone1}
                      onChange={(e) => handleInputChange('phone1', e.target.value)}
                    />
                  </FormSectionCard>
                  <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={companyAdvancedCount}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <CompactFormField
                        label="كود نوع الجهة"
                        value={formData.entityTypeCode}
                        onChange={(e) => handleInputChange('entityTypeCode', e.target.value)}
                      />
                      <CompactFormField
                        label="رقم الهاتف 2"
                        placeholder="إدخل رقم الهاتف"
                        value={formData.phone2}
                        onChange={(e) => handleInputChange('phone2', e.target.value)}
                      />
                      <CompactFormField label="نوع الجهة">
                        <select
                          className={compactControlClass}
                          value={formData.entityType}
                          onChange={(e) => handleInputChange('entityType', e.target.value)}
                        >
                          <option value="جنية مصري">جنية مصري</option>
                          <option value="دولار أمريكي">دولار أمريكي</option>
                          <option value="يورو">يورو</option>
                        </select>
                      </CompactFormField>
                      <CompactFormField label="الرقم الضريبي" className="sm:col-span-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.taxNumber1}
                            onChange={(e) => handleInputChange('taxNumber1', e.target.value)}
                            className={compactControlClass}
                          />
                          <input
                            type="text"
                            value={formData.taxNumber2}
                            onChange={(e) => handleInputChange('taxNumber2', e.target.value)}
                            className={compactControlClass}
                          />
                          <input
                            type="text"
                            value={formData.taxNumber3}
                            onChange={(e) => handleInputChange('taxNumber3', e.target.value)}
                            className={compactControlClass}
                          />
                        </div>
                      </CompactFormField>
                    </div>
                  </AdvancedFieldsSection>
                </>
                ) : activeSection === 'branch' ? (
                  <>
                  <FormSectionCard title="بيانات الفرع" subtitle="الهوية والترقيم وقائمة الأسعار" icon={GitBranch}>
                    <CompactFormField
                      label="المسلسل"
                      placeholder="إدخل رقم المسلسل"
                      value={branchData.serialNumber}
                      onChange={(e) => handleBranchDataChange('serialNumber', e.target.value)}
                    />

                    <CompactFormField
                      label="الإسم العربي"
                      placeholder="إدخل الإسم"
                      value={branchData.arabicName}
                      onChange={(e) => handleBranchDataChange('arabicName', e.target.value)}
                    />
                    <CompactFormField
                      label="رقم الفرع"
                      value={branchData.branchNumber}
                      onChange={(e) => handleBranchDataChange('branchNumber', e.target.value)}
                    />
                    <CompactFormField
                      label="رقم التفعيل"
                      placeholder="أدخل الرقم"
                      value={branchData.activationNumber}
                      onChange={(e) => handleBranchDataChange('activationNumber', e.target.value)}
                    />
                    <CompactFormField label="قائمة الأسعار">
                      <select
                        className={compactControlClass}
                        value={branchData.priceList}
                        onChange={(e) => handleBranchDataChange('priceList', e.target.value)}
                      >
                        <option value="">اختر...</option>
                        <option value="retail">تجزئة</option>
                        <option value="wholesale">بالجملة</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField
                      label="رقم التسجيل"
                      placeholder="إدخل الرقم"
                      value={branchData.registrationNumber}
                      onChange={(e) => handleBranchDataChange('registrationNumber', e.target.value)}
                    />
                  </FormSectionCard>

                  <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={branchAdvancedCount}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <CompactFormField label="سعر الباركود">
                      <select
                        className={compactControlClass}
                        value={branchData.barcodePrice}
                        onChange={(e) => handleBranchDataChange('barcodePrice', e.target.value)}
                      >
                        <option value="retail">تجزئة</option>
                        <option value="wholesale">بالجملة</option>
                      </select>
                    </CompactFormField>

                    <CompactFormField label="المحافظة">
                      <select
                        className={compactControlClass}
                        value={branchData.governorate}
                        onChange={(e) => handleBranchDataChange('governorate', e.target.value)}
                      >
                        <option value="">اختر...</option>
                        <option value="cairo">القاهرة</option>
                        <option value="giza">الجيزة</option>
                        <option value="alexandria">الإسكندرية</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField
                      label="الحي"
                      placeholder="أدخل إسم الحي"
                      value={branchData.district}
                      onChange={(e) => handleBranchDataChange('district', e.target.value)}
                    />
                    <CompactFormField
                      label="إسم الشارع"
                      placeholder="أدخل إسم الشارع"
                      value={branchData.streetName}
                      onChange={(e) => handleBranchDataChange('streetName', e.target.value)}
                    />
                    <CompactFormField label="الدولة">
                      <select
                        className={compactControlClass}
                        value={branchData.country}
                        onChange={(e) => handleBranchDataChange('country', e.target.value)}
                      >
                        <option value="">اختر...</option>
                        <option value="egypt">مصر</option>
                        <option value="saudi">السعودية</option>
                        <option value="uae">الإمارات</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField label="المدينة">
                      <select
                        className={compactControlClass}
                        value={branchData.city}
                        onChange={(e) => handleBranchDataChange('city', e.target.value)}
                      >
                        <option value="">اختر...</option>
                        <option value="nasr-city">مدينة نصر</option>
                        <option value="heliopolis">هليوبوليس</option>
                        <option value="zamalek">الزمالك</option>
                      </select>
                    </CompactFormField>
                    <CompactFormField
                      label="رقم المبنى"
                      placeholder="إدخل الرقم"
                      value={branchData.buildingNumber}
                      onChange={(e) => handleBranchDataChange('buildingNumber', e.target.value)}
                    />
                    <CompactFormField
                      label="رقم البريدي"
                      placeholder="إدخل الرقم"
                      value={branchData.postalCode}
                      onChange={(e) => handleBranchDataChange('postalCode', e.target.value)}
                    />
                    <CompactFormField label="العنوان" className="sm:col-span-2 lg:col-span-3">
                      <textarea
                        value={branchData.address}
                        onChange={(e) => handleBranchDataChange('address', e.target.value)}
                        placeholder="إدخل العنوان"
                        rows={3}
                        className="min-h-[72px] w-full resize-none rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 sm:text-sm"
                      />
                    </CompactFormField>
                    </div>
                  </AdvancedFieldsSection>
                  </>
                ) : (
                  <>
                    <FormSectionCard title="نسخ البيانات" subtitle="من شركة إلى أخرى" icon={Copy}>
                      <CompactFormField label="من">
                        <select
                          className={compactControlClass}
                          value={copyData.fromCompanyId}
                          onChange={(e) => handleCopyDataChange('fromCompanyId', e.target.value)}
                        >
                          <option value="">اختر الشركة المصدر</option>
                          <option value="company1">شركة 1</option>
                          <option value="company2">شركة 2</option>
                          <option value="company3">شركة 3</option>
                        </select>
                      </CompactFormField>
                      <CompactFormField label="إلى">
                        <select
                          className={compactControlClass}
                          value={copyData.toCompanyId}
                          onChange={(e) => handleCopyDataChange('toCompanyId', e.target.value)}
                        >
                          <option value="">اختر الشركة الوجهة</option>
                          <option value="company1">شركة 1</option>
                          <option value="company2">شركة 2</option>
                          <option value="company3">شركة 3</option>
                        </select>
                      </CompactFormField>
                    </FormSectionCard>
                    <AdvancedFieldsSection title="ما سيتم نسخه" defaultOpen badgeCount={copyData.selectedItems.length}>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {[
                          { id: 'chartOfAccounts', label: 'دليل الحسابات' },
                          { id: 'customers', label: 'العملاء' },
                          { id: 'suppliers', label: 'الموردين' },
                          { id: 'items', label: 'الأصناف' },
                          { id: 'accounts', label: 'الحسابات' },
                          { id: 'costCenters', label: 'مراكز التكلفة' },
                          { id: 'branches', label: 'الفروع' },
                          { id: 'users', label: 'المستخدمين' },
                        ].map((item) => (
                          <label
                            key={item.id}
                            htmlFor={item.id}
                            className="flex items-center gap-2 rounded-lg border border-[#E6F0F7] bg-[#F6FBFD] px-3 py-1.5 text-xs font-medium text-[#094C6B]"
                          >
                            <input
                              type="checkbox"
                              id={item.id}
                              checked={copyData.selectedItems.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleCopyDataChange('selectedItems', [...copyData.selectedItems, item.id]);
                                } else {
                                  handleCopyDataChange('selectedItems', copyData.selectedItems.filter((id) => id !== item.id));
                                }
                              }}
                              className="h-3.5 w-3.5 rounded border-[#D6EAF3] text-[#0E78AA] focus:ring-[#0E79AA]"
                            />
                            {item.label}
                          </label>
                        ))}
                      </div>
                    </AdvancedFieldsSection>
                  </>
                )}
            </div>

            <div className="flex w-64 shrink-0 flex-col gap-4">
              <div className="flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-[#0E78AA] to-[#094C6B] text-white shadow-sm">
                <div className="text-center">
                  <div className="text-2xl font-black">G</div>
                  <div className="text-xs font-semibold">GATES SOFT</div>
                </div>
              </div>
              <div className="rounded-xl border border-[#E6F0F7] bg-white p-2 shadow-sm">
                <div className="space-y-1">
                  {([
                    { key: 'company', label: 'بيانات الشركة' },
                    { key: 'branch', label: 'بيانات الفرع' },
                    { key: 'copy', label: 'نسخ بيانات من شركة لأخرى' },
                  ] as const).map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setActiveSection(item.key)}
                      className={`w-full rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors ${
                        activeSection === item.key
                          ? 'bg-[#0E78AA] text-white'
                          : 'text-[#094C6B] hover:bg-[#F6FBFD]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <FormStickyFooter
            onSave={activeSection === 'copy' ? undefined : handleSave}
            onCancel={handleBack}
            extraActions={activeSection === 'copy' ? undefined : <CrudButtons />}
          />
          {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
          {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      </div>
    </div>
  );
}