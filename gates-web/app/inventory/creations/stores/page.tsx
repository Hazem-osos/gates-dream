'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { Warehouse } from 'lucide-react';
import {
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { WarehousesListSection, asWarehouseRows, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { WarehouseParentField } from '@/components/inventory/WarehouseParentField';
import { AccountSelect } from '@/components/form/AccountSelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { isCodeAfter } from '@/lib/masters/nextNumericSerial';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';

type WarehouseForm = {
  code: string;
  arabicName: string;
  englishName: string;
  storeType: 'MAIN' | 'SUB';
  warehouseKind: 'HEADER' | 'POSTING';
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
  warehouseKind: 'HEADER',
  parentWarehouseId: '',
  inventoryAccountId: '',
  costAccountId: '',
  giftAccountId: '',
  address: '',
  keeperName: '',
});

function StoresPageInner() {
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('warehouse');
  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [formData, setFormData] = useState<WarehouseForm>(emptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const { data: warehousesRes } = useApiQuery<WarehouseRow[]>(
    ['warehouses', { page: 1, pageSize: 1000 }],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = useMemo(() => asWarehouseRows(warehousesRes?.data), [warehousesRes?.data]);
  const blockedParentIds = useMemo(() => {
    if (!selectedId) return [] as string[];
    const blocked = new Set<string>([selectedId]);
    const stack = [selectedId];
    while (stack.length) {
      const current = stack.pop()!;
      for (const row of warehouses) {
        if (row.parentWarehouseId === current && !blocked.has(row.id)) {
          blocked.add(row.id);
          stack.push(row.id);
        }
      }
    }
    return [...blocked];
  }, [selectedId, warehouses]);
  const { data: settingsRes } = useAccountingSettingsQuery();
  const warehouseAuto = settingsRes?.data?.general?.warehouseAutoNumbering !== false;
  const applyParent = (parentWarehouseId: string) => {
    patch({
      parentWarehouseId,
      storeType: parentWarehouseId ? 'SUB' : 'MAIN',
      warehouseKind: parentWarehouseId ? formData.warehouseKind || 'POSTING' : 'HEADER',
    });
  };
  const parentForCode = formData.parentWarehouseId;
  const { data: nextCodeResponse } = useApiQuery<{ code?: string }>(
    ['warehouses', 'next-code', parentForCode || 'root'],
    '/inventory/warehouses/next-code',
    parentForCode ? { parentWarehouseId: parentForCode } : undefined,
    { enabled: !selectedId && warehouseAuto && (formData.storeType === 'MAIN' || Boolean(parentForCode)) }
  );

  useEffect(() => {
    if (selectedId || !warehouseAuto) return;
    const suggested = nextCodeResponse?.data?.code;
    if (!suggested) return;
    setFormData((prev) => {
      if (prev.code && isCodeAfter(prev.code, suggested)) return prev;
      return prev.code === suggested ? prev : { ...prev, code: suggested };
    });
  }, [selectedId, warehouseAuto, nextCodeResponse?.data?.code]);

  useEffect(() => {
    if (!quickCreate.prefillName || selectedId) return;
    setFormData((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [quickCreate.prefillName, selectedId]);

  useEffect(() => {
    if (!idFromUrl) return;
    const row = warehouses.find((item) => item.id === idFromUrl);
    if (!row) return;
    lockToView();
    setSelectedId(row.id);
    setFormData({
      code: row.code ?? '',
      arabicName: row.arabicName ?? '',
      englishName: row.englishName ?? '',
      storeType: row.storeType === 'SUB' || row.parentWarehouseId ? 'SUB' : 'MAIN',
      warehouseKind: row.warehouseKind === 'POSTING' ? 'POSTING' : 'HEADER',
      parentWarehouseId: row.parentWarehouseId ?? '',
      inventoryAccountId: row.inventoryAccountId ?? '',
      costAccountId: row.costAccountId ?? '',
      giftAccountId: row.giftAccountId ?? '',
      address: row.address ?? '',
      keeperName: row.keeperName ?? '',
    });
  }, [idFromUrl, warehouses, lockToView]);

  const createMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/inventory/warehouses',
    'POST',
    {
      onSuccess: (res) => {
        const created = res?.data as { id?: string; arabicName?: string; code?: string | null } | undefined;
        if (created?.id) {
          quickCreate.complete({
            id: created.id,
            label: entityLabel(created.code, created.arabicName),
            arabicName: created.arabicName,
            code: created.code,
          });
        }
        invalidateQuery(['warehouses']);
        invalidateQuery(['warehouses', 'next-code']);
        setSelectedId(null);
        setFormData((prev) => ({
          ...emptyForm(),
          storeType: prev.storeType,
          warehouseKind: prev.warehouseKind,
          parentWarehouseId: prev.parentWarehouseId,
          inventoryAccountId: prev.inventoryAccountId,
          costAccountId: prev.costAccountId,
          giftAccountId: prev.giftAccountId,
        }));
        setMode('create');
        setSuccess('تم حفظ المخزن — تقدر تضيف التالي');
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
    code: formData.code.trim() || undefined,
    arabicName: formData.arabicName,
    englishName: formData.englishName || undefined,
    storeType: formData.parentWarehouseId ? 'SUB' : 'MAIN',
    warehouseKind: formData.parentWarehouseId
      ? formData.warehouseKind
      : formData.warehouseKind || 'HEADER',
    parentWarehouseId: formData.parentWarehouseId || null,
    inventoryAccountId: formData.inventoryAccountId || null,
    costAccountId: formData.costAccountId || null,
    giftAccountId: formData.giftAccountId || null,
    address: formData.address || null,
    keeperName: formData.keeperName || null,
  });

  const resetNew = () => {
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
    setMode('create');
  };

  const handleSave = async () => {
    setError('');
    if (!formData.arabicName.trim()) {
      setError('يرجى إدخال اسم المخزن');
      return;
    }
    if (!warehouseAuto && !selectedId && !formData.code.trim()) {
      setError('رقم المخزن مطلوب — الترقيم يدوي');
      return;
    }
    if (formData.storeType === 'SUB' && !formData.parentWarehouseId) {
      setError('المخزن الفرعي لازم يكون تحت مخزن رئيسي.');
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
      storeType: row.storeType === 'SUB' || row.parentWarehouseId ? 'SUB' : 'MAIN',
      warehouseKind: row.warehouseKind === 'POSTING' ? 'POSTING' : 'HEADER',
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
          { label: 'البطاقات' },
          { label: 'بطاقة المخزن' },
        ]}
        title="بطاقة المخزن"
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
        favoriteHref="/inventory/creations/stores"
      />

      <FormSectionCard
        title="بيانات المخزن"
        subtitle="المسلسل والاسم والحسابات"
        icon={Warehouse}
        className="mb-3 p-3 sm:p-4"
      >
        <CompactFormField
          label="رقم المخزن"
          required={!warehouseAuto}
          value={formData.code}
          disabled={isReadOnly || (warehouseAuto && !selectedId)}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder={warehouseAuto ? 'تلقائي — 1 ثم 11' : 'مثال: 1 أو 11'}
        />
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
            onChange={(e) => {
              const storeType = e.target.value as 'MAIN' | 'SUB';
              if (storeType === 'MAIN') {
                applyParent('');
                return;
              }
              patch({
                storeType,
                warehouseKind: formData.warehouseKind || 'POSTING',
              });
            }}
          >
            <option value="MAIN">مخزن رئيسي</option>
            <option value="SUB">فرعي</option>
          </select>
        </CompactFormField>
        {formData.storeType === 'SUB' ? (
          <CompactFormField label="نوع الفرعي">
            <select
              className={compactControlClass}
              disabled={isReadOnly}
              value={formData.warehouseKind}
              onChange={(e) => patch({ warehouseKind: e.target.value as 'HEADER' | 'POSTING' })}
            >
              <option value="HEADER">رئيسي فرعي</option>
              <option value="POSTING">عمليات</option>
            </select>
          </CompactFormField>
        ) : (
          <CompactFormField label="نوع المخزن">
            <input className={compactControlClass} value="رئيسي" readOnly disabled />
          </CompactFormField>
        )}
        <CompactFormField label="المخزن الأب">
          <WarehouseParentField
            value={formData.parentWarehouseId}
            onChange={applyParent}
            excludeIds={blockedParentIds}
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField label="حساب المخزون">
          <AccountSelect
            value={formData.inventoryAccountId}
            onChange={(inventoryAccountId) => patch({ inventoryAccountId })}
            leafOnly={false}
            placeholder="كل الحسابات"
            emptyLabel="كل الحسابات"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField label="حساب تكلفة البضاعة المباعة">
          <AccountSelect
            value={formData.costAccountId}
            onChange={(costAccountId) => patch({ costAccountId })}
            leafOnly={false}
            placeholder="كل الحسابات"
            emptyLabel="كل الحسابات"
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
      <Suspense fallback={null}>
        <StoresPageInner />
      </Suspense>
    </DocumentModeProvider>
  );
}
