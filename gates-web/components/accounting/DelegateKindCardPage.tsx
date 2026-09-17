'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';
import { useNextMasterSerial } from '@/lib/hooks/useNextMasterSerial';

export type DelegateKind = 'DISTRIBUTOR' | 'DRIVER';

type CardForm = {
  serial: string;
  code: string;
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
  code?: string | null;
  arabicName: string;
  phone1?: string | null;
  mobile?: string | null;
};

const EMPTY: CardForm = {
  serial: '',
  code: '',
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
  return (
    <DocumentModeProvider initialMode="create">
      <DelegateKindCardInner kind={kind} />
    </DocumentModeProvider>
  );
}

function DelegateKindCardInner({ kind }: { kind: DelegateKind }) {
  const copy = KIND_COPY[kind];
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const modeFromUrl = searchParams.get('mode');
  const groupIdFromUrl = searchParams.get('groupId');
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CardForm>(EMPTY);
  const KindIcon = kind === 'DISTRIBUTOR' ? Truck : UserRound;

  const listKey = useMemo(() => ['delegates', kind] as const, [kind]);
  const { data: listResponse } = useApiQuery<SavedRow[]>(listKey, '/accounting/delegates', {
    limit: 200,
    isActive: true,
    role: kind,
  });
  const rows = listResponse?.data ?? [];

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

  useEffect(() => {
    if (!idFromUrl) return;
    const row = rows.find((item) => item.id === idFromUrl);
    if (row) {
      setSelectedId(row.id);
      if (modeFromUrl === 'edit') unlockForEdit();
      else lockToView();
      setFormData((prev) => ({
        ...prev,
        serial: row.serial || '',
        code: row.code || row.serial || '',
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
      if (modeFromUrl === 'edit') unlockForEdit();
      else lockToView();
      setFormData((prev) => ({
        ...prev,
        serial: res.data.serial || '',
        code: res.data.code || res.data.serial || '',
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
  }, [idFromUrl, rows, modeFromUrl, lockToView, unlockForEdit]);

  const mutation = useApiMutation<unknown, Record<string, unknown>>(
    '/accounting/delegates',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success(`${copy.success} — تقدر تضيف التالي`);
        invalidateQuery(listKey);
        invalidateQuery(['delegates']);
        invalidateQuery(['delegates', 'next-code']);
        setSelectedId(null);
        setFormData({ ...EMPTY, groupId: groupIdFromUrl || '' });
        setMode('create');
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
    if (!formData.code.trim()) {
      setError('يرجى إدخال الكود');
      return;
    }
    if (!formData.arabicName.trim()) {
      setError(copy.required);
      return;
    }
    const payload = {
        role: kind,
        serial: formData.serial.trim() || formData.code.trim() || undefined,
        code: formData.code.trim() || undefined,
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
        toast.success(copy.success);
        lockToView();
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
    setMode('create');
  };

  return (
    <MasterCardShell
      title={copy.title}
      breadcrumbs={[
        { label: 'الحسابات', href: '/accounting' },
        { label: 'البطاقات' },
        { label: copy.crumb },
      ]}
      docNumber={formData.serial || (selectedId ? (isReadOnly ? 'عرض' : 'تعديل') : 'جديد')}
      statusLabel={selectedId ? (isReadOnly ? 'عرض' : 'تعديل') : 'جديد'}
      onSave={() => void handleSave()}
      savePending={mutation.isPending}
      canSave={!isReadOnly && !mutation.isPending}
      onNew={handleCancel}
      onEdit={() => {
        if (!selectedId) return;
        unlockForEdit();
      }}
      editDisabled={!selectedId}
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
          if (!isReadOnly) void handleSave();
        }}
      >
        <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
        <FormSectionCard title="البيانات الأساسية" subtitle={copy.subtitle} icon={KindIcon}>
          <CompactFormField
            label="المسلسل"
            value={formData.serial}
            disabled
            readOnly
            placeholder="تلقائي"
          />
          <CompactFormField
            label="الكود"
            required
            value={formData.code}
            onChange={(e) => patch('code', e.target.value)}
            placeholder="إدخل الكود"
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
        </fieldset>
      </form>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title={`${copy.title} — السابق`}>
        <AppTable<SavedRow>
          data={rows}
          getRowKey={(r) => r.id}
          emptyTitle={copy.emptyList}
          onRowClick={(row) => {
            setSelectedId(row.id);
            lockToView();
            setFormData((prev) => ({
              ...prev,
              serial: row.serial || '',
              code: row.code || row.serial || '',
              arabicName: row.arabicName,
              phone1: row.phone1 || '',
              mobile: row.mobile || '',
            }));
            setShowGuide(false);
          }}
          columns={[
            { id: 'code', header: 'الكود', cell: (r) => r.code || r.serial || '—' },
            { id: 'name', header: 'الاسم', accessor: 'arabicName' },
            { id: 'phone', header: 'الهاتف', cell: (r) => r.mobile || r.phone1 || '—' },
          ]}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}
