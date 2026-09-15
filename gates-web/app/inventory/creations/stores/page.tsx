'use client';

import { useEffect, useMemo, useState } from 'react';
import { Warehouse } from 'lucide-react';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { WarehousesListSection, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { AccountSelect } from '@/components/form/AccountSelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { nextNumericSerial } from '@/lib/masters/nextNumericSerial';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

type WarehouseForm = {
  code: string;
  arabicName: string;
  englishName: string;
  storeType: 'MAIN' | 'SUB';
  parentWarehouseId: string;
  inventoryAccountId: string;
  costAccountId: string;
  giftAccountId: string;
  address: string;
  keeperName: string;
};

const emptyForm = (code = ''): WarehouseForm => ({
  code,
  arabicName: '',
  englishName: '',
  storeType: 'MAIN',
  parentWarehouseId: '',
  inventoryAccountId: '',
  costAccountId: '',
  giftAccountId: '',
  address: '',
  keeperName: '',
});

function StoresPageInner() {
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<WarehouseForm>(emptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const { data: warehousesRes } = useApiQuery<WarehouseRow[]>(
    ['warehouses', { page: 1, pageSize: 1000 }],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = useMemo(() => warehousesRes?.data ?? [], [warehousesRes?.data]);
  const nextWarehouseCode = useMemo(
    () => nextNumericSerial(warehouses.map((row) => row.code)),
    [warehouses]
  );

  useEffect(() => {
    if (selectedId) return;
    setFormData((prev) => (prev.code === nextWarehouseCode ? prev : { ...prev, code: nextWarehouseCode }));
  }, [nextWarehouseCode, selectedId]);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/warehouses',
    'POST',
    {
      onSuccess: () => {
        invalidateQuery(['warehouses']);
        resetNew();
        setSuccess('تم حفظ المخزن');
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/inventory/warehouses/${selectedId}` : '/inventory/warehouses',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['warehouses']);
        resetNew();
        setSuccess('تم تحديث المخزن');
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const patch = (next: Partial<WarehouseForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const requestBody = () => ({
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    storeType: formData.storeType,
    parentWarehouseId: formData.parentWarehouseId || null,
    inventoryAccountId: formData.inventoryAccountId || null,
    costAccountId: formData.costAccountId || null,
    giftAccountId: formData.giftAccountId || null,
    address: formData.address || null,
    keeperName: formData.keeperName || null,
  });

  const resetNew = () => {
    setSelectedId(null);
    setFormData(emptyForm(nextWarehouseCode));
    setError('');
    setMode('create');
  };

  const handleSave = async () => {
    setError('');
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال اسم المخزن');
      return;
    }
    if (selectedId && formData.parentWarehouseId === selectedId) {
      setError('لا يمكن أن يكون المخزن رئيسيًا لنفسه');
      return;
    }
    if (selectedId) {
      updateMutation.mutate(requestBody());
      return;
    }
    createMutation.mutate(requestBody());
  };

  const handleSelect = (row: WarehouseRow) => {
    lockToView();
    setSelectedId(row.id);
    setFormData({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      storeType: row.storeType === 'SUB' ? 'SUB' : 'MAIN',
      parentWarehouseId: row.parentWarehouseId ?? '',
      inventoryAccountId: row.inventoryAccountId ?? '',
      costAccountId: row.costAccountId ?? '',
      giftAccountId: row.giftAccountId ?? '',
      address: row.address ?? '',
      keeperName: row.keeperName ?? '',
    });
    setError('');
    setSuccess('');
    setShowGuide(false);
  };

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { href: '/inventory', label: 'المخازن' },
          { label: 'التعريفات' },
          { label: 'دليل المخازن' },
        ]}
        title="دليل المخازن"
        docNumber={formData.code || (selectedId ? 'تعديل' : 'جديد')}
        statusTone="info"
        statusLabel={selectedId ? 'تعديل' : 'جديد'}
        saveLabel="حفظ"
        onSaveDraft={() => void handleSave()}
        savePending={loading}
        canSave={!isReadOnly && !loading}
        hideStandalonePost
        onEdit={() => {
          if (!selectedId) return;
          unlockForEdit();
        }}
        editDisabled={!selectedId}
        moreMenuItems={[
          { id: 'new', label: 'جديد', onClick: resetNew },
        ]}
        onBrowseList={() => setShowGuide(true)}
        browseListLabel="السابق"
        currentId={selectedId}
      />

      <FormSectionCard
        title="بيانات المخزن"
        subtitle="المسلسل والاسم والحسابات"
        icon={Warehouse}
        className="mb-3 p-3 sm:p-4"
      >
        <CompactFormField label="رقم المخزن" value={formData.code} disabled placeholder="تلقائي" />
        <CompactFormField
          label="اسم المخزن"
          required
          value={formData.arabicName}
          disabled={isReadOnly}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="إدخل الإسم"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          disabled={isReadOnly}
          onChange={(e) => patch({ englishName: e.target.value })}
          placeholder="إدخل الإسم بالإنجليزي"
        />
        <CompactFormField label="نوع المخزن">
          <select
            className={compactControlClass}
            disabled={isReadOnly}
            value={formData.storeType}
            onChange={(e) => patch({ storeType: e.target.value as 'MAIN' | 'SUB' })}
          >
            <option value="MAIN">مخزن رئيسي</option>
            <option value="SUB">فرعي</option>
          </select>
        </CompactFormField>
        <CompactFormField label="م/رئيسي">
          <WarehouseSelect
            value={formData.parentWarehouseId}
            onChange={(parentWarehouseId) => patch({ parentWarehouseId })}
            emptyLabel="—"
            disabled={isReadOnly || formData.storeType === 'MAIN'}
          />
        </CompactFormField>
        <CompactFormField label="ح/المخزون">
          <AccountSelect
            value={formData.inventoryAccountId}
            onChange={(inventoryAccountId) => patch({ inventoryAccountId })}
            leafOnly
            placeholder="حساب المخزون"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField label="ح/التكلفة">
          <AccountSelect
            value={formData.costAccountId}
            onChange={(costAccountId) => patch({ costAccountId })}
            leafOnly
            placeholder="حساب التكلفة"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField label="ح/الهدايا">
          <AccountSelect
            value={formData.giftAccountId}
            onChange={(giftAccountId) => patch({ giftAccountId })}
            leafOnly
            placeholder="حساب الهدايا"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField
          label="العنوان"
          value={formData.address}
          disabled={isReadOnly}
          onChange={(e) => patch({ address: e.target.value })}
          placeholder="إدخل العنوان"
        />
        <CompactFormField
          label="أمين المخزن"
          value={formData.keeperName}
          disabled={isReadOnly}
          onChange={(e) => patch({ keeperName: e.target.value })}
          placeholder="أمين المخزن"
        />
      </FormSectionCard>

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="دليل المخازن السابق">
        <WarehousesListSection onSelect={handleSelect} selectedId={selectedId} />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}

export default function StoreCardPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <StoresPageInner />
    </DocumentModeProvider>
  );
}
