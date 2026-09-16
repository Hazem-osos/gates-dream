'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Truck, UserRound } from 'lucide-react';
import UserPermissionsBar from '@/components/UserPermissionsBar';
import {
  CompactFormField,
  FormSectionCard,
  AppTable,
} from '@/components/ui';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { apiClient } from '@/lib/api/client';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { bumpTrailingCode, isCodeAfter, nextNumericSerial } from '@/lib/masters/nextNumericSerial';

export type DelegateKind = 'DISTRIBUTOR' | 'DRIVER';

type CardForm = {
  serial: string;
  groupId: string;
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
  groupId: '',
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
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const groupIdFromUrl = searchParams.get('groupId');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CardForm>(EMPTY);
  const stayOpenRef = useRef({ serial: '' });
  stayOpenRef.current = { serial: formData.serial };
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
    if (selectedId) return;
    setFormData((prev) => {
      const nextGroup = groupIdFromUrl || prev.groupId;
      if (prev.serial && isCodeAfter(prev.serial, nextSerial)) {
        return nextGroup !== prev.groupId ? { ...prev, groupId: nextGroup } : prev;
      }
      if (prev.serial === nextSerial) {
        return nextGroup !== prev.groupId ? { ...prev, groupId: nextGroup } : prev;
      }
      return { ...prev, serial: nextSerial, groupId: nextGroup };
    });
  }, [nextSerial, selectedId, groupIdFromUrl]);

  useEffect(() => {
    if (!idFromUrl) return;
    const row = rows.find((item) => item.id === idFromUrl);
    if (row) {
      setSelectedId(row.id);
      setFormData((prev) => ({
        ...prev,
        serial: row.serial || '',
        arabicName: row.arabicName,
        phone1: row.phone1 || '',
        mobile: row.mobile || '',
      }));
      return;
    }
    let cancelled = false;
    void apiClient.get<SavedRow & Partial<CardForm>>(`/accounting/delegates/${idFromUrl}`).then((res) => {
      if (cancelled || !res.data) return;
      setSelectedId(res.data.id);
      setFormData((prev) => ({
        ...prev,
        serial: res.data.serial || '',
        arabicName: res.data.arabicName,
        phone1: res.data.phone1 || '',
        mobile: res.data.mobile || '',
        nationality: res.data.nationality || prev.nationality,
        barcode: res.data.barcode || '',
        phone2: res.data.phone2 || '',
        fax: res.data.fax || '',
        email: res.data.email || '',
        website: res.data.website || '',
        country: res.data.country || prev.country,
        city: res.data.city || prev.city,
        area: res.data.area || prev.area,
        street: res.data.street || '',
        postalCode: res.data.postalCode || '',
        poBox: res.data.poBox || '',
      }));
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر فتح البطاقة');
    });
    return () => {
      cancelled = true;
    };
  }, [idFromUrl, rows]);

  const mutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/delegates',
    'POST',
    {
      onSuccess: () => {
        setSuccess(`${copy.success} — تقدر تضيف التالي`);
        invalidateQuery(listKey);
        invalidateQuery(['delegates']);
        setSelectedId(null);
        setFormData({ ...EMPTY, serial: bumpTrailingCode(stayOpenRef.current.serial) });
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
    const payload = {
        role: kind,
        serial: formData.serial.trim() || undefined,
        groupId: formData.groupId || groupIdFromUrl || undefined,
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
    };
    try {
      if (selectedId) {
        await apiClient.put(`/accounting/delegates/${selectedId}`, payload);
        setSuccess(copy.success);
        invalidateQuery(listKey);
        invalidateQuery(['delegates']);
        return;
      }
      await mutation.mutateAsync(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setFormData(EMPTY);
    setError('');
    setSuccess('');
  };

  return (
    <MasterCardShell
      title={copy.title}
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: copy.crumb },
      ]}
      docNumber={formData.serial || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={mutation.isPending}
      canSave={!mutation.isPending}
      onNew={handleCancel}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref={kind === 'DISTRIBUTOR' ? '/accounting/cards/distributor' : '/accounting/cards/driver'}
    >
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

        <FormSectionCard title="الاتصال والعنوان" subtitle="باقي بيانات التواصل" icon={KindIcon}>
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
        </FormSectionCard>

      </form>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title={`${copy.title} — السابق`}>
        <AppTable<SavedRow>
          data={rows}
          getRowKey={(r) => r.id}
          emptyTitle={copy.emptyList}
          onRowClick={(row) => {
            setSelectedId(row.id);
            setFormData((prev) => ({
              ...prev,
              serial: row.serial || '',
              arabicName: row.arabicName,
              phone1: row.phone1 || '',
              mobile: row.mobile || '',
            }));
            setShowGuide(false);
          }}
          columns={[
            { id: 'serial', header: 'المسلسل', cell: (r) => r.serial || '—' },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
            { id: 'phone', header: 'الهاتف', cell: (r) => r.mobile || r.phone1 || '—' },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
