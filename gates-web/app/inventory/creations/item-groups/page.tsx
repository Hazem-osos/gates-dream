'use client';

import { useEffect, useState } from 'react';
import { Boxes } from 'lucide-react';
import {
  CompactFormField,
  FormSectionCard,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { UserPermissions } from '@/components/ui/UserPermissions';
import {
  ItemGroupsListSection,
  type ItemGroupRow,
} from '@/components/inventory/ItemGroupsListSection';
import { ItemGroupSelect } from '@/components/form/ItemGroupSelect';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type GroupForm = {
  code: string;
  arabicName: string;
  englishName: string;
  groupType: 'MAIN' | 'SUB';
  parentCategoryId: string;
  isFeatured: boolean;
  isTaxExempt: boolean;
  taxRate: string;
};

const emptyForm = (): GroupForm => ({
  code: '',
  arabicName: '',
  englishName: '',
  groupType: 'MAIN',
  parentCategoryId: '',
  isFeatured: false,
  isTaxExempt: false,
  taxRate: '',
});

const checkboxCls =
  'w-4 h-4 text-[#0E78AA] bg-white border border-[#0E78AA] rounded focus:ring-2 focus:ring-[#0E78AA]/20';

function formFromRow(row: ItemGroupRow): GroupForm {
  return {
    code: row.code ?? '',
    arabicName: row.arabicName ?? '',
    englishName: row.englishName ?? '',
    groupType: row.groupType === 'SUB' ? 'SUB' : 'MAIN',
    parentCategoryId: row.parentCategoryId ?? '',
    isFeatured: Boolean(row.isFeatured),
    isTaxExempt: Boolean(row.isTaxExempt),
    taxRate: row.taxRate != null && row.taxRate !== '' ? String(row.taxRate) : '',
  };
}

function ItemGroupCardInner() {
  const invalidateQuery = useInvalidateQuery();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [formData, setFormData] = useState<GroupForm>(emptyForm);
  const [snapshot, setSnapshot] = useState<GroupForm>(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const { data: groupsResponse } = useApiQuery<ItemGroupRow[]>(
    ['item-categories', 'parents'],
    '/inventory/item-categories',
    { limit: 200, isActive: true }
  );
  const groups = Array.isArray(groupsResponse?.data) ? groupsResponse.data : [];
  const parentOptions = groups.filter((row) => row.id !== selectedId);

  useEffect(() => {
    if (!idFromUrl) return;
    const row = groups.find((item) => item.id === idFromUrl);
    if (!row) return;
    const next = formFromRow(row);
    setSelectedId(row.id);
    setFormData(next);
    setSnapshot(next);
    lockToView();
  }, [idFromUrl, groups, lockToView]);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/item-categories',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['item-categories']);
        invalidateQuery(['items']);
        handleNew();
        setSuccess('تم حفظ المجموعة — هتظهر في دليل الأصناف');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/item-categories/${selectedId}` : '/inventory/item-categories',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['item-categories']);
        invalidateQuery(['items']);
        handleNew();
        setSuccess('تم تحديث المجموعة');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const patch = (next: Partial<GroupForm>) => setFormData((prev) => ({ ...prev, ...next }));
  const fieldsLocked = isReadOnly && Boolean(selectedId);

  const requestBody = () => ({
    code: formData.code || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    groupType: formData.groupType,
    parentCategoryId: formData.parentCategoryId || null,
    isFeatured: formData.isFeatured,
    isTaxExempt: formData.isTaxExempt,
    taxRate: formData.isTaxExempt ? 0 : formData.taxRate === '' ? null : Number(formData.taxRate),
  });

  const handleSave = () => {
    setError('');
    if (fieldsLocked) {
      setError('اضغط تعديل أولاً قبل حفظ التغييرات');
      return;
    }
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال اسم المجموعة');
      return;
    }
    if (selectedId && formData.parentCategoryId === selectedId) {
      setError('لا يمكن أن تكون المجموعة رئيسية لنفسها');
      return;
    }
    if (selectedId) {
      updateMutation.mutate(requestBody());
      return;
    }
    createMutation.mutate(requestBody());
  };

  const handleNew = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setSnapshot(emptyForm());
    setError('');
    setMode('create');
  };

  const handleSelect = (row: ItemGroupRow) => {
    const next = formFromRow(row);
    setSelectedId(row.id);
    setFormData(next);
    setSnapshot(next);
    setError('');
    setSuccess('');
    lockToView();
  };

  const handleCancel = () => {
    setError('');
    if (selectedId) {
      setFormData(snapshot);
      lockToView();
      return;
    }
    handleNew();
  };

  return (
    <MasterCardShell
      title="بطاقة مجموعة أصناف"
      breadcrumbs={[
        { label: 'المخزون', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'مجموعة أصناف' },
      ]}
      docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
      statusLabel={
        selectedId ? (isReadOnly ? 'عرض — اضغط تعديل' : 'تعديل') : 'جديد'
      }
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
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/inventory/creations/item-groups"
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <div className="mb-4 flex justify-between">
        <UserPermissions />
      </div>

      {selectedId && isReadOnly ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          البطاقة في وضع العرض. اضغط تعديل من القائمة قبل تغيير البيانات.
        </p>
      ) : null}

      <fieldset disabled={fieldsLocked} className="min-w-0 border-0 p-0">
      <FormSectionCard title="البيانات الأساسية" subtitle="الحقول اللازمة لتعريف مجموعة الأصناف" icon={Boxes}>
        <CompactFormField
          label="رقم المجموعة"
          value={formData.code}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder="إدخل رقم المجموعة"
        />
        <CompactFormField
          label="اسم المجموعة"
          required
          value={formData.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="ادخل الإسم"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
          placeholder="إدخل الإسم بالإنجليزي"
        />
        <CompactFormField label="نوع المجموعة">
          <select
            className={compactControlClass}
            value={formData.groupType}
            onChange={(e) => patch({ groupType: e.target.value as 'MAIN' | 'SUB' })}
          >
            <option value="MAIN">مجموعة رئيسية</option>
            <option value="SUB">مجموعة فرعية</option>
          </select>
        </CompactFormField>
        <CompactFormField label="مميزة">
          <label className="flex h-9 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(e) => patch({ isFeatured: e.target.checked })}
              className={checkboxCls}
            />
            <span className="text-sm font-semibold text-[#0A3D5E]">مميزة</span>
          </label>
        </CompactFormField>
        <CompactFormField label="المجموعة الرئيسية">
          <ItemGroupSelect
            value={formData.parentCategoryId}
            onChange={(parentCategoryId) =>
              patch({
                parentCategoryId,
                groupType: parentCategoryId ? 'SUB' : 'MAIN',
              })
            }
            groups={parentOptions}
            excludeIds={selectedId ? [selectedId] : undefined}
          />
        </CompactFormField>
        <CompactFormField label="ضريبة المبيعات">
          <label className="flex h-9 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isTaxExempt}
              onChange={(e) => {
                const isTaxExempt = e.target.checked;
                patch({
                  isTaxExempt,
                  taxRate: isTaxExempt ? '0' : formData.taxRate,
                });
              }}
              className={checkboxCls}
            />
            <span className="text-sm font-semibold text-[#0A3D5E]">معفي</span>
          </label>
        </CompactFormField>
        <CompactFormField
          label="ضريبة"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={formData.isTaxExempt ? '0' : formData.taxRate}
          disabled={formData.isTaxExempt}
          readOnly={formData.isTaxExempt}
          onChange={(e) => {
            if (formData.isTaxExempt) return;
            patch({ taxRate: e.target.value });
          }}
          placeholder="0"
          suffix="%"
        />
      </FormSectionCard>
      </fieldset>

      <FormStickyFooter
        onCancel={handleCancel}
        onSave={handleSave}
        saveLoading={loading}
        saveDisabled={loading || fieldsLocked}
        status={selectedId ? (isReadOnly ? 'عرض — اضغط تعديل' : 'تعديل مفتوح') : 'جديد'}
      />

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="مجموعات الأصناف السابقة">
        <ItemGroupsListSection
          onSelect={(row) => {
            handleSelect(row);
            setShowGuide(false);
          }}
          selectedId={selectedId}
        />
      </DocumentBrowseDrawer>
    </MasterCardShell>
  );
}

export default function ItemGroupCardPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <ItemGroupCardInner />
    </DocumentModeProvider>
  );
}
