'use client';

import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import Image from 'next/image';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
  AppTable,
} from '@/components/ui';
import { useClearDocumentQuery, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { apiClient } from '@/lib/api/client';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';
import { useNextMasterSerial } from '@/lib/hooks/useNextMasterSerial';
import { DistributionGroupSelectField } from '@/components/accounting/DistributionGroupSelectField';

interface PriceList {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

const EMPTY_FORM = {
  serial: '',
  code: '',
  arabicName: '',
  englishName: '',
  nationality: '',
  barcode: '',
  phone1: '',
  phone2: '',
  mobile: '',
  fax: '',
  email: '',
  website: '',
  country: '',
  city: '',
  area: '',
  street: '',
  postalCode: '',
  poBox: '',
  address: '',
  commissionPercentage: '',
  commissionPolicyId: '',
  groupId: '',
  salesCommissionsId: '',
  priceListId: '',
};

type DelegateRecord = {
  id: string;
  serial?: string | null;
  code?: string | null;
  arabicName?: string | null;
  englishName?: string | null;
  nationality?: string | null;
  barcode?: string | null;
  phone1?: string | null;
  phone2?: string | null;
  mobile?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  postalCode?: string | null;
  poBox?: string | null;
  address?: string | null;
  commissionPercentage?: number | string | null;
  commissionPolicyId?: string | null;
  groupId?: string | null;
  salesCommissionsId?: string | null;
  priceListId?: string | null;
};

export default function DelegatePage() {
  return (
    <DocumentModeProvider initialMode="create">
      <DelegatePageInner />
    </DocumentModeProvider>
  );
}

function DelegatePageInner() {
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const searchParams = useOwnTabSearchParams();
  const clearDocumentQuery = useClearDocumentQuery();
  const idFromUrl = searchParams.get('id');
  const modeFromUrl = searchParams.get('mode');
  const groupIdFromUrl = searchParams.get('groupId');
  
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Fetch price lists
  const { data: priceListsResponse } = useApiQuery<PriceList[]>(
    ['price-lists'],
    '/accounting/price-lists',
    { limit: 1000, isActive: true }
  );
  const priceLists = priceListsResponse?.data || [];

  const { data: delegatesResponse } = useApiQuery<
    { id: string; serial?: string; code?: string; arabicName?: string }[]
  >(['delegates'], '/accounting/delegates', { limit: 1000, isActive: true });

  const { data: groupsResponse } = useApiQuery<
    { id: string; code?: string | null; serial?: string | null; arabicName: string }[]
  >(['delegates', 'groups', 'DELEGATE'], '/accounting/delegates', {
    limit: 1000,
    isActive: true,
    role: 'GROUP_DELEGATE',
  });
  const groups = groupsResponse?.data || [];

  const { data: nextSerialResponse } = useNextMasterSerial(
    ['delegates', 'next-code'],
    '/accounting/delegates/next-code',
    !selectedId
  );
  const nextSerial = nextSerialResponse?.data?.serial || '';

  useEffect(() => {
    if (selectedId || !nextSerial) return;
    setFormData((prev) => (prev.serial === nextSerial ? prev : { ...prev, serial: nextSerial }));
  }, [nextSerial, selectedId]);

  useEffect(() => {
    if (selectedId || !groupIdFromUrl) return;
    setFormData((prev) => (prev.groupId ? prev : { ...prev, groupId: groupIdFromUrl }));
  }, [selectedId, groupIdFromUrl]);

  const hydrate = (row: DelegateRecord) => {
    setSelectedId(row.id);
    if (modeFromUrl === 'edit') unlockForEdit();
    else lockToView();
    setFormData({
      serial: row.serial || row.code || '',
      code: row.code || row.serial || '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      nationality: row.nationality ?? '',
      barcode: row.barcode ?? '',
      phone1: row.phone1 ?? '',
      phone2: row.phone2 ?? '',
      mobile: row.mobile ?? '',
      fax: row.fax ?? '',
      email: row.email ?? '',
      website: row.website ?? '',
      country: row.country ?? '',
      city: row.city ?? '',
      area: row.area ?? '',
      street: row.street ?? '',
      postalCode: row.postalCode ?? '',
      poBox: row.poBox ?? '',
      address: row.address ?? '',
      commissionPercentage: row.commissionPercentage != null ? String(row.commissionPercentage) : '',
      commissionPolicyId: row.commissionPolicyId ?? '',
      groupId: row.groupId ?? '',
      salesCommissionsId: row.salesCommissionsId ?? '',
      priceListId: row.priceListId ?? '',
    });
    setError('');
  };

  useEffect(() => {
    if (!idFromUrl) return;
    let cancelled = false;
    void apiClient.get<DelegateRecord>(`/accounting/delegates/${idFromUrl}`).then((res) => {
      if (!cancelled && res.data) hydrate(res.data);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر فتح المندوب');
    });
    return () => {
      cancelled = true;
    };
  }, [idFromUrl]);

  // Delegate mutation
  const delegateMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/delegates',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم حفظ المندوب بنجاح — تقدر تضيف التالي');
        invalidateQuery(['delegates']);
        invalidateQuery(['delegates', 'groups', 'DELEGATE']);
        invalidateQuery(['delegates', 'guide']);
        invalidateQuery(['delegates', 'next-code']);
        setSelectedId(null);
        setFormData({
          ...EMPTY_FORM,
          groupId: groupIdFromUrl || '',
        });
        setMode('create');
        clearDocumentQuery();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const handleSave = async () => {
    if (!formData.arabicName) {
      setError('يرجى إدخال الإسم العربي');
      return;
    }

    const payload = {
        role: 'DELEGATE',
        serial: formData.serial || undefined,
        code: formData.code || undefined,
        arabicName: formData.arabicName,
        englishName: formData.englishName || undefined,
        nationality: formData.nationality || undefined,
        barcode: formData.barcode || undefined,
        phone1: formData.phone1 || undefined,
        phone2: formData.phone2 || undefined,
        mobile: formData.mobile || undefined,
        fax: formData.fax || undefined,
        email: formData.email || undefined,
        website: formData.website || undefined,
        country: formData.country || undefined,
        city: formData.city || undefined,
        area: formData.area || undefined,
        street: formData.street || undefined,
        postalCode: formData.postalCode || undefined,
        poBox: formData.poBox || undefined,
        address: formData.address || undefined,
        commissionPercentage: formData.commissionPercentage ? parseFloat(formData.commissionPercentage) : undefined,
        commissionPolicyId: formData.commissionPolicyId || undefined,
        groupId: formData.groupId || null,
        salesCommissionsId: formData.salesCommissionsId || undefined,
        priceListId: formData.priceListId || undefined,
    };

    try {
      if (selectedId) {
        await apiClient.put(`/accounting/delegates/${selectedId}`, payload, {
          skipSuccessNotify: true,
        });
        toast.success('تم حفظ المندوب بنجاح — تقدر تضيف التالي');
        invalidateQuery(['delegates']);
        invalidateQuery(['delegates', 'groups', 'DELEGATE']);
        invalidateQuery(['delegates', 'guide']);
        setSelectedId(null);
        setFormData({
          ...EMPTY_FORM,
          groupId: groupIdFromUrl || '',
        });
        setMode('create');
        clearDocumentQuery();
        return;
      }
      await delegateMutation.mutateAsync(payload);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setFormData({
      ...EMPTY_FORM,
      groupId: groupIdFromUrl || '',
    });
    setError('');
    setMode('create');
    clearDocumentQuery();
  };

  return (
    <MasterCardShell
      title="بطاقة مندوب"
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: 'مندوب' },
      ]}
      docNumber={formData.serial || (selectedId ? (isReadOnly ? 'عرض' : 'تعديل') : 'جديد')}
      statusLabel={selectedId ? (isReadOnly ? 'عرض' : 'تعديل') : 'جديد'}
      onSave={() => void handleSave()}
      savePending={delegateMutation.isPending}
      canSave={!isReadOnly && !delegateMutation.isPending}
      onNew={handleCancel}
      onEdit={() => {
        if (!selectedId) return;
        unlockForEdit();
      }}
      editDisabled={!selectedId}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/accounting/cards/delegate"
    >
      <form className="w-full text-base">
        <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
        <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف المندوب" icon={User}>
          <CompactFormField
            label="المسلسل"
            value={formData.serial}
            disabled
            readOnly
            placeholder="تلقائي"
          />
          <CompactFormField
            label="الكود"
            value={formData.code}
            onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="اختياري"
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => setFormData((prev) => ({ ...prev, arabicName: e.target.value }))}
            placeholder="إدخل الإسم بالعربي"
          />
          <DistributionGroupSelectField
            folderRole="DELEGATE"
            value={formData.groupId}
            options={groups}
            onChange={(id) => setFormData((prev) => ({ ...prev, groupId: id }))}
            onCreated={() => {
              invalidateQuery(['delegates', 'groups', 'DELEGATE']);
              invalidateQuery(['delegates']);
              invalidateQuery(['delegates', 'guide']);
            }}
          />
          <CompactFormField
            label="رقم الهاتف 1"
            value={formData.phone1}
            onChange={(e) => setFormData((prev) => ({ ...prev, phone1: e.target.value }))}
            placeholder="إدخل رقم الهاتف"
          />
        </FormSectionCard>

        <FormSectionCard title="الاتصال والعمولات" subtitle="العنوان وبيانات العمولة" icon={User}>
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => setFormData((prev) => ({ ...prev, englishName: e.target.value }))}
              placeholder="إدخل الإسم بالإنجليزي"
            />
            <CompactFormField
              label="الجنسية"
              value={formData.nationality}
              onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
              placeholder="إدخل الجنسية"
            />
            <CompactFormField
              label="رقم الباركود"
              value={formData.barcode}
              onChange={(e) => setFormData((prev) => ({ ...prev, barcode: e.target.value }))}
              placeholder="إدخل رقم الباركود"
            />
            <CompactFormField
              label="رقم الهاتف 2"
              value={formData.phone2}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone2: e.target.value }))}
              placeholder="إدخل رقم الهاتف"
            />
            <CompactFormField
              label="رقم الموبايل"
              value={formData.mobile}
              onChange={(e) => setFormData((prev) => ({ ...prev, mobile: e.target.value }))}
              placeholder="إدخل رقم الموبايل"
            />
            <CompactFormField
              label="فاكس"
              value={formData.fax}
              onChange={(e) => setFormData((prev) => ({ ...prev, fax: e.target.value }))}
              placeholder="إدخل رقم الفاكس"
            />
            <CompactFormField
              label="الإيميل"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="إدخل الإيميل"
            />
            <CompactFormField
              label="موقع"
              type="url"
              value={formData.website}
              onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
              placeholder="إدخل الموقع"
            />
            <CompactFormField
              label="الدولة"
              value={formData.country}
              onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              placeholder="إدخل الدولة"
            />
            <CompactFormField
              label="المدينة"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="إدخل المدينة"
            />
            <CompactFormField
              label="المنطقة"
              value={formData.area}
              onChange={(e) => setFormData((prev) => ({ ...prev, area: e.target.value }))}
              placeholder="إدخل المنطقة"
            />
            <CompactFormField
              label="الشارع"
              value={formData.street}
              onChange={(e) => setFormData((prev) => ({ ...prev, street: e.target.value }))}
              placeholder="إدخل إسم الشارع"
            />
            <CompactFormField
              label="الرمز البريدي"
              value={formData.postalCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
              placeholder="إدخل الرمز البريدي"
            />
            <CompactFormField
              label="صندوق البريد"
              value={formData.poBox}
              onChange={(e) => setFormData((prev) => ({ ...prev, poBox: e.target.value }))}
              placeholder="إدخل صندوق البريد"
            />
            <CompactFormField
              label="العنوان"
              value={formData.address}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="إدخل العنوان"
            />
            <CompactFormField label="سياسة العمولة">
              <div className="relative">
                <input
                  type="text"
                  placeholder="إدخل سياسة العمولة"
                  className={`${compactControlClass} pl-10`}
                  value={formData.commissionPolicyId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, commissionPolicyId: e.target.value }))}
                />
                <button
                  type="button"
                  className="absolute left-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-blue-200"
                >
                  <Image src="/magnifying-glass-1.svg" alt="search" width={16} height={16} />
                </button>
              </div>
            </CompactFormField>
            <CompactFormField
              label="عمولات المبيعات"
              value={formData.salesCommissionsId}
              onChange={(e) => setFormData((prev) => ({ ...prev, salesCommissionsId: e.target.value }))}
              placeholder="إدخل عمولات المبيعات"
            />
            <CompactFormField label="قائمة الأسعار">
              <select
                className={compactControlClass}
                value={formData.priceListId}
                onChange={(e) => setFormData((prev) => ({ ...prev, priceListId: e.target.value }))}
              >
                <option value="">اختر قائمة الأسعار</option>
                {priceLists.map((priceList) => (
                  <option key={priceList.id} value={priceList.id}>
                    {priceList.code} - {priceList.arabicName}
                  </option>
                ))}
              </select>
            </CompactFormField>
            <CompactFormField
              label="نسبة العمولة"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.commissionPercentage}
              onChange={(e) => setFormData((prev) => ({ ...prev, commissionPercentage: e.target.value }))}
              placeholder="إدخل نسبة العمولة"
            />
        </FormSectionCard>
        </fieldset>
      </form>

      {error && <ErrorToast message={error} onClose={() => setError('')} />}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="المندوبون السابقون">
        <AppTable
          data={delegatesResponse?.data ?? []}
          getRowKey={(r) => r.id}
          emptyTitle="لا يوجد مندوبون"
          onRowClick={(row) => {
            setSelectedId(row.id);
            lockToView();
            setFormData((prev) => ({
              ...prev,
              serial: row.serial || row.code || '',
              code: row.code || row.serial || '',
              arabicName: row.arabicName || '',
            }));
            setShowGuide(false);
          }}
          columns={[
            { id: 'code', header: 'المسلسل', cell: (r) => r.serial || r.code || '—' },
            { id: 'name', header: 'الاسم', cell: (r) => r.arabicName || '—' },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
