'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ruler } from 'lucide-react';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import { UnitsListSection, type UnitRow } from '@/components/inventory/UnitsListSection';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { UNIT_CATALOG, findUnitCatalog } from '@/lib/inventory/unit-catalog';
import { confirmAction } from '@/lib/feedback/confirm';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type UnitForm = {
  code: string;
  arabicName: string;
  englishName: string;
};

const emptyForm = (): UnitForm => ({
  code: '',
  arabicName: '',
  englishName: '',
});

function formFromRow(row: UnitRow): UnitForm {
  return {
    code: row.code ?? '',
    arabicName: row.arabicName ?? '',
    englishName: row.englishName ?? '',
  };
}

function UnitPageInner() {
  const invalidateQuery = useInvalidateQuery();
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const dismissedIdRef = useRef<string | null>(null);
  const { isReadOnly, isEditing, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [formData, setFormData] = useState<UnitForm>(emptyForm);
  const [snapshot, setSnapshot] = useState<UnitForm>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fieldsLocked = isReadOnly && Boolean(selectedId);
  const patch = (next: Partial<UnitForm>) => setFormData((prev) => ({ ...prev, ...next }));

  useEffect(() => {
    if (!idFromUrl) {
      dismissedIdRef.current = null;
      return;
    }
    if (idFromUrl === dismissedIdRef.current) return;
    let cancelled = false;
    void apiClient
      .get<UnitRow>(`/inventory/units/${idFromUrl}`)
      .then((res) => {
        const row = res.data;
        if (!row || cancelled) return;
        const next = formFromRow(row);
        setSelectedId(row.id);
        setFormData(next);
        setSnapshot(next);
        lockToView();
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message || 'تعذر فتح الوحدة');
      });
    return () => {
      cancelled = true;
    };
  }, [idFromUrl, lockToView]);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/units',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['units']);
        handleNew();
        setSuccess('تم حفظ الوحدة — تقدر تضيف التالي');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/units/${selectedId}` : '/inventory/units',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['units']);
        handleNew();
        setSuccess('تم تحديث الوحدة');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending || deleting;

  const applyCatalog = (code: string) => {
    const item = findUnitCatalog(code);
    if (!item) {
      patch({ code });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      code: item.code,
      arabicName: prev.arabicName || item.arabicName,
      englishName: prev.englishName || item.englishName,
    }));
  };

  const requestBody = () => ({
    code: formData.code.trim() || undefined,
    arabicName: formData.arabicName.trim(),
    englishName: formData.englishName.trim() || undefined,
  });

  const handleSave = () => {
    setError('');
    if (fieldsLocked) {
      setError('اضغط تعديل أولاً قبل حفظ التغييرات');
      return;
    }
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    if (selectedId) {
      updateMutation.mutate(requestBody());
      return;
    }
    createMutation.mutate(requestBody());
  };

  const handleNew = () => {
    const currentId = selectedId ?? idFromUrl;
    if (currentId) dismissedIdRef.current = currentId;
    setSelectedId(null);
    setFormData(emptyForm());
    setSnapshot(emptyForm());
    setError('');
    setSuccess('');
    setMode('create');
    router.replace('/inventory/creations/unit');
  };

  const handleSelect = (row: UnitRow) => {
    dismissedIdRef.current = null;
    const next = formFromRow(row);
    setSelectedId(row.id);
    setFormData(next);
    setSnapshot(next);
    setError('');
    setSuccess('');
    setShowGuide(false);
    lockToView();
  };

  const handleCancel = () => {
    setError('');
    if (isEditing && selectedId) {
      setFormData(snapshot);
      lockToView();
      setSuccess('تم التراجع عن التعديلات');
      return;
    }
    const hadRecord = Boolean(selectedId);
    handleNew();
    setSuccess(hadRecord ? 'تم التراجع — البطاقة جاهزة لوحدة جديدة' : 'تم تفريغ البطاقة');
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (
      !(await confirmAction({
        message: `حذف الوحدة «${formData.arabicName || formData.code || ''}»؟`,
      }))
    ) {
      return;
    }
    setError('');
    setDeleting(true);
    try {
      await apiClient.delete(`/inventory/units/${selectedId}`);
      invalidateQuery(['units']);
      handleNew();
      setSuccess('تم حذف الوحدة');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الوحدة');
    } finally {
      setDeleting(false);
    }
  };

  const advancedFilledCount = [formData.englishName].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <MasterCardShell
      title="تعريف الوحدة"
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'الوحدات' },
      ]}
      docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={selectedId ? (isReadOnly ? 'عرض — اضغط تعديل' : 'تعديل') : 'جديد'}
      onSave={handleSave}
      savePending={loading}
      canSave={!loading && !fieldsLocked}
      onEdit={() => {
        if (!selectedId) return;
        unlockForEdit();
      }}
      editDisabled={!selectedId}
      onCancel={handleCancel}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/inventory/creations/unit"
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      {selectedId && isReadOnly ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          البطاقة في وضع العرض. اضغط تعديل من القائمة قبل تغيير البيانات.
        </p>
      ) : null}

      <fieldset disabled={fieldsLocked} className="min-w-0 border-0 p-0">
        <FormSectionCard title="البيانات الأساسية" subtitle="اختَر وحدة من الدليل العالمي أو اكتب وحدة خاصة" icon={Ruler}>
          <CompactFormField label="الوحدة من الدليل العالمي">
            <SearchableCombobox
              value={UNIT_CATALOG.some((item) => item.code === formData.code) ? formData.code : ''}
              onChange={applyCatalog}
              className={compactControlClass}
              placeholder="ابحث بالحروف أو الكود — قطعة، KG، liter…"
              emptyMessage="لا توجد وحدة مطابقة"
              portaled
              menuPlacement="auto"
              options={UNIT_CATALOG.map((item) => ({
                value: item.code,
                label: `${item.arabicName} (${item.code})`,
                searchText: `${item.code} ${item.arabicName} ${item.englishName}`,
              }))}
            />
          </CompactFormField>
          <CompactFormField
            label="الكود"
            value={formData.code}
            onChange={(e) => patch({ code: e.target.value })}
            placeholder="PCS"
          />
          <CompactFormField
            label="الإسم العربي"
            required
            value={formData.arabicName}
            onChange={(e) => patch({ arabicName: e.target.value })}
            placeholder="قطعة"
          />
        </FormSectionCard>

        <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="الإسم الإنجليزي"
              value={formData.englishName}
              onChange={(e) => patch({ englishName: e.target.value })}
              placeholder="إدخل الاسم الإنجليزي"
            />
          </div>
        </AdvancedFieldsSection>
      </fieldset>

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="الوحدات السابقة">
        <UnitsListSection onSelect={handleSelect} selectedId={selectedId} />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}

export default function UnitPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <Suspense fallback={null}>
        <UnitPageInner />
      </Suspense>
    </DocumentModeProvider>
  );
}
