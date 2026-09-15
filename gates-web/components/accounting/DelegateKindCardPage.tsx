'use client';

import { useEffect, useMemo, useState } from 'react';
import { Truck, UserRound } from 'lucide-react';
import UserPermissionsBar from '@/components/UserPermissionsBar';
import {
  PageHeader,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';

export type DelegateKind = 'DISTRIBUTOR' | 'DRIVER';

type CardForm = {
  serial: string;
  arabicName: string;
  nationality: string;
  barcode: string;
  phone1: string;
  phone2: string;
  mobile: string;
  fax: string;
  email: string;
  website: string;
  country: string;
  city: string;
  area: string;
  street: string;
  postalCode: string;
  poBox: string;
};

type SavedRow = {
  id: string;
  serial?: string | null;
  arabicName: string;
  phone1?: string | null;
  mobile?: string | null;
};

const EMPTY: CardForm = {
  serial: '',
  arabicName: '',
  nationality: 'مصري',
  barcode: '',
  phone1: '',
  phone2: '',
  mobile: '',
  fax: '',
  email: '',
  website: '',
  country: 'مصر',
  city: 'القاهرة',
  area: 'مدينة نصر',
  street: '',
  postalCode: '',
  poBox: '',
};

const KIND_COPY: Record<
  DelegateKind,
  { title: string; success: string; required: string; emptyList: string; crumb: string; subtitle: string }
> = {
  DISTRIBUTOR: {
    title: 'بطاقة موزع',
    success: 'تم حفظ الموزع بنجاح',
    required: 'يرجى إدخال الاسم العربي للموزع',
    emptyList: 'لا يوجد موزعون محفوظون بعد.',
    crumb: 'موزع',
    subtitle: 'الحقول اللازمة لتعريف الموزع',
  },
  DRIVER: {
    title: 'بطاقة سائق',
    success: 'تم حفظ السائق بنجاح',
    required: 'يرجى إدخال الاسم العربي للسائق',
    emptyList: 'لا يوجد سائقون محفوظون بعد.',
    crumb: 'سائق',
    subtitle: 'الحقول اللازمة لتعريف السائق',
  },
};

export function DelegateKindCardPage({ kind }: { kind: DelegateKind }) {
  const copy = KIND_COPY[kind];
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<CardForm>(EMPTY);
  const KindIcon = kind === 'DISTRIBUTOR' ? Truck : UserRound;

  const listKey = useMemo(() => ['delegates', kind] as const, [kind]);
  const { data: listResponse } = useApiQuery<SavedRow[]>(listKey, '/accounting/delegates', {
    limit: 200,
    isActive: true,
    role: kind,
  });
  const rows = listResponse?.data ?? [];
  const nextSerial = useMemo(
    () => nextNumericSerial(rows.map((row) => row.serial)),
    [rows]
  );

  useEffect(() => {
    setFormData((prev) => (prev.serial ? prev : { ...prev, serial: nextSerial }));
  }, [nextSerial]);

  const mutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/delegates',
    'POST',
    {
      onSuccess: () => {
        setSuccess(copy.success);
        invalidateQuery(listKey);
        invalidateQuery(['delegates']);
        setFormData(EMPTY);
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const patch = (key: keyof CardForm, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!formData.arabicName.trim()) {
      setError(copy.required);
      return;
    }
    try {
      await mutation.mutateAsync({
        role: kind,
        serial: formData.serial.trim() || undefined,
        arabicName: formData.arabicName.trim(),
        nationality: formData.nationality.trim() || undefined,
        barcode: formData.barcode.trim() || undefined,
        phone1: formData.phone1.trim() || undefined,
        phone2: formData.phone2.trim() || undefined,
        mobile: formData.mobile.trim() || undefined,
        fax: formData.fax.trim() || undefined,
        email: formData.email.trim() || undefined,
        website: formData.website.trim() || undefined,
        country: formData.country.trim() || undefined,
        city: formData.city.trim() || undefined,
        area: formData.area.trim() || undefined,
        street: formData.street.trim() || undefined,
        postalCode: formData.postalCode.trim() || undefined,
        poBox: formData.poBox.trim() || undefined,
        address: [formData.street, formData.area, formData.city, formData.country]
          .filter(Boolean)
          .join(' — ') || undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY);
    setError('');
    setSuccess('');
  };

  const advancedFilledCount = [
    formData.barcode,
    formData.phone2,
    formData.fax,
    formData.email,
    formData.website,
    formData.country,
    formData.city,
    formData.area,
    formData.street,
    formData.postalCode,
    formData.poBox,
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <PageHeader
        title={copy.title}
        breadcrumbs={[
          { label: 'الحسابات', href: '/accounting' },
          { label: 'البطاقات' },
          { label: copy.crumb },
        ]}
        onBrowseList={() =>
          document.getElementById('card-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        onAdd={handleCancel}
      />

      <div className="mb-4">
        <UserPermissionsBar />
      </div>
      <form
        className="w-full text-base"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <FormSectionCard title="البيانات الأساسية" subtitle={copy.subtitle} icon={KindIcon}>
          <CompactFormField
            label="المسلسل"
            value={formData.serial}
            disabled
            placeholder="تلقائي"
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => patch('arabicName', e.target.value)}
            placeholder="إدخل الإسم بالعربي"
          />
          <CompactFormField
            label="الجنسية"
            value={formData.nationality}
            onChange={(e) => patch('nationality', e.target.value)}
          />
          <CompactFormField
            label="رقم الهاتف 1"
            value={formData.phone1}
            onChange={(e) => patch('phone1', e.target.value)}
            placeholder="إدخل رقم الهاتف"
          />
          <CompactFormField
            label="رقم الموبايل"
            value={formData.mobile}
            onChange={(e) => patch('mobile', e.target.value)}
            placeholder="إدخل رقم الموبايل"
          />
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="رقم الباركود"
              value={formData.barcode}
              onChange={(e) => patch('barcode', e.target.value)}
              placeholder="إدخل رقم الباركود"
            />
            <CompactFormField
              label="رقم الهاتف 2"
              value={formData.phone2}
              onChange={(e) => patch('phone2', e.target.value)}
              placeholder="إدخل رقم الهاتف"
            />
            <CompactFormField
              label="فاكس"
              value={formData.fax}
              onChange={(e) => patch('fax', e.target.value)}
              placeholder="إدخل رقم الفاكس"
            />
            <CompactFormField
              label="الإيميل"
              type="email"
              value={formData.email}
              onChange={(e) => patch('email', e.target.value)}
              placeholder="إدخل الإيميل"
            />
            <CompactFormField
              label="موقع"
              value={formData.website}
              onChange={(e) => patch('website', e.target.value)}
              placeholder="إدخل الموقع"
            />
            <CompactFormField
              label="الدولة"
              value={formData.country}
              onChange={(e) => patch('country', e.target.value)}
            />
            <CompactFormField
              label="المدينة"
              value={formData.city}
              onChange={(e) => patch('city', e.target.value)}
            />
            <CompactFormField
              label="المنطقة"
              value={formData.area}
              onChange={(e) => patch('area', e.target.value)}
            />
            <CompactFormField
              label="الشارع"
              value={formData.street}
              onChange={(e) => patch('street', e.target.value)}
              placeholder="إدخل إسم الشارع"
            />
            <CompactFormField
              label="الرمز البريدي"
              value={formData.postalCode}
              onChange={(e) => patch('postalCode', e.target.value)}
              placeholder="إدخل الرمز البريدي"
            />
            <CompactFormField
              label="صندوق البريد"
              value={formData.poBox}
              onChange={(e) => patch('poBox', e.target.value)}
              placeholder="إدخل صندوق البريد"
            />
          </div>
        </AdvancedFieldsSection>

        <FormStickyFooter
          onCancel={handleCancel}
          onSave={() => void handleSave()}
          saveLoading={mutation.isPending}
          saveDisabled={mutation.isPending}
          status="مسودة"
        />
      </form>

      <div id="card-records" className="mt-6 overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white">
        <table className="min-w-full text-sm text-right">
          <thead className="bg-[#F0F7FB] text-[#094C6B]">
            <tr>
              <th className="px-3 py-2 font-semibold">المسلسل</th>
              <th className="px-3 py-2 font-semibold">الاسم</th>
              <th className="px-3 py-2 font-semibold">الهاتف</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                  {copy.emptyList}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-[#E6F0F7]">
                  <td className="px-3 py-2">{row.serial || '—'}</td>
                  <td className="px-3 py-2">{row.arabicName}</td>
                  <td className="px-3 py-2">{row.mobile || row.phone1 || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
