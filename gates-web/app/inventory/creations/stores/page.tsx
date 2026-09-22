'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useClearDocumentQuery, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { rememberTabHref, rememberTabSearch } from '@/lib/navigation/tab-memory';
import { normalizeAppPath } from '@/lib/navigation/app-module-root';
import { Warehouse } from 'lucide-react';
import {
  CompactFormField,
  FormSectionCard,
} from '@/components/ui';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { WarehousesListSection, asWarehouseRows, type WarehouseRow } from '@/components/inventory/WarehousesListSection';
import { WarehouseParentField } from '@/components/inventory/WarehouseParentField';
import { ChildWarehouseKindDialog } from '@/components/inventory/ChildWarehouseKindDialog';
import { inheritWarehouseAccounts, warehouseRoleLabel, type WarehouseKind } from '@/lib/inventory/warehouse-kind';
import { AccountSelect } from '@/components/form/AccountSelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
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
});

function pinWarehouseCardSearch(id: string | null) {
  if (typeof window === 'undefined') return;
  const path = normalizeAppPath(window.location.pathname);
  if (id) {
    const qs = `id=${id}`;
    window.history.replaceState(null, '', `?${qs}`);
    rememberTabSearch(path, qs);
    rememberTabHref(path, `${path}?${qs}`);
    return;
  }
  window.history.replaceState(null, '', path);
  rememberTabSearch(path, '');
  rememberTabHref(path, path);
}

function StoresPageInner() {
  const searchParams = useOwnTabSearchParams();
  const clearDocumentQuery = useClearDocumentQuery();
  const idFromUrl = searchParams.get('id');
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const hydratedUrlIdRef = useRef<string | null>(null);
  const invalidateQuery = useInvalidateQuery();
  const quickCreate = useQuickCreateHost('warehouse');
  const [selectedId, setSelectedId] = useState<string | null>(idFromUrl);
  const [formData, setFormData] = useState<WarehouseForm>(emptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [kindPickerParent, setKindPickerParent] = useState<{ id: string; label: string } | null>(null);

  const { data: warehousesRes } = useApiQuery<WarehouseRow[]>(
    ['warehouses', { page: 1, pageSize: 1000 }],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = useMemo(() => asWarehouseRows(warehousesRes?.data), [warehousesRes?.data]);
  const { data: settingsRes } = useAccountingSettingsQuery();
  const warehouseAuto = settingsRes?.data?.general?.warehouseAutoNumbering !== false;
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

  const fillFromRow = (row: WarehouseRow) => {
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
    });
  };

  const { data: warehouseByIdRes } = useApiQuery<WarehouseRow>(
    ['warehouse', idFromUrl || 'none'],
    idFromUrl ? `/inventory/warehouses/${idFromUrl}` : '/inventory/warehouses',
    undefined,
    { enabled: Boolean(idFromUrl) && !warehouses.some((row) => row.id === idFromUrl) }
  );

  useEffect(() => {
    if (!idFromUrl) {
      hydratedUrlIdRef.current = null;
      return;
    }
    const row = warehouses.find((item) => item.id === idFromUrl) ?? warehouseByIdRes?.data;
    if (!row) return;
    if (hydratedUrlIdRef.current === idFromUrl) return;
    hydratedUrlIdRef.current = idFromUrl;
    fillFromRow(row);
  }, [idFromUrl, warehouses, warehouseByIdRes?.data, lockToView]);

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
        hydratedUrlIdRef.current = idFromUrl || '__new__';
        setSelectedId(null);
        setFormData(emptyForm());
        setMode('create');
        clearDocumentQuery();
        pinWarehouseCardSearch(null);
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
        if (selectedId) invalidateQuery(['warehouse', selectedId]);
        lockToView();
        setSuccess('تم تحديث المخزن');
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const loading = createMutation.isPending || updateMutation.isPending;
  const patch = (next: Partial<WarehouseForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const applyParent = (parentId: string, warehouseKind?: WarehouseKind) => {
    const inherited = inheritWarehouseAccounts(warehouses, parentId);
    setFormData((prev) => ({
      ...prev,
      parentWarehouseId: parentId,
      storeType: parentId ? 'SUB' : 'MAIN',
      warehouseKind: parentId
        ? warehouseKind ?? (prev.warehouseKind === 'HEADER' ? 'HEADER' : 'POSTING')
        : warehouseKind ?? (prev.warehouseKind === 'POSTING' ? 'POSTING' : 'HEADER'),
      inventoryAccountId: parentId ? prev.inventoryAccountId || inherited.inventoryAccountId : prev.inventoryAccountId,
      costAccountId: parentId ? prev.costAccountId || inherited.costAccountId : prev.costAccountId,
    }));
  };

  const handleParentChange = (parentId: string) => {
    if (!parentId) {
      applyParent('');
      return;
    }
    if (!selectedId) {
      const parent = warehouses.find((row) => row.id === parentId);
      setKindPickerParent({
        id: parentId,
        label: parent
          ? parent.code
            ? `${parent.code} — ${parent.arabicName}`
            : parent.arabicName
          : 'المخزن الأب',
      });
      return;
    }
    applyParent(parentId);
  };

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
  });

  const resetNew = () => {
    hydratedUrlIdRef.current = idFromUrl || '__new__';
    setSelectedId(null);
    setFormData(emptyForm());
    setError('');
    setMode('create');
    clearDocumentQuery();
    pinWarehouseCardSearch(null);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف بطاقة المخزن؟'))) return;
    setError('');
    try {
      await apiClient.delete(`/inventory/warehouses/${selectedId}`);
      resetNew();
      setSuccess('تم حذف المخزن');
      invalidateQuery(['warehouses']);
      invalidateQuery(['warehouses', 'guide']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف المخزن');
    }
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
    hydratedUrlIdRef.current = row.id;
    fillFromRow(row);
    pinWarehouseCardSearch(row.id);
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
          {
            id: 'edit',
            label: 'تعديل',
            onClick: () => {
              if (!selectedId) return;
              unlockForEdit();
            },
            disabled: !selectedId || !isReadOnly,
          },
          {
            id: 'delete',
            label: 'حذف',
            onClick: () => void handleDelete(),
            disabled: !selectedId,
            destructive: true,
          },
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
        <CompactFormField label="المخزن الأب">
          <WarehouseParentField
            value={formData.parentWarehouseId}
            onChange={handleParentChange}
            excludeIds={selectedId ? [selectedId] : undefined}
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField
          label="نوع المخزن"
          value={warehouseRoleLabel(formData)}
          disabled
        />
        <CompactFormField
          label="حساب المخزون"
          hint={formData.parentWarehouseId ? 'متاخد من الأب — تقدر تغيّره' : undefined}
        >
          <AccountSelect
            value={formData.inventoryAccountId}
            onChange={(inventoryAccountId) => patch({ inventoryAccountId })}
            leafOnly
            placeholder="حساب حركة"
            emptyLabel="حساب حركة"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <CompactFormField
          label="حساب تكلفة البضاعة المباعة"
          hint={formData.parentWarehouseId ? 'متاخد من الأب — تقدر تغيّره' : undefined}
        >
          <AccountSelect
            value={formData.costAccountId}
            onChange={(costAccountId) => patch({ costAccountId })}
            leafOnly
            placeholder="حساب حركة"
            emptyLabel="حساب حركة"
            disabled={isReadOnly}
          />
        </CompactFormField>
      </FormSectionCard>

      <DocumentBrowseDrawer open={showGuide} onClose={() => setShowGuide(false)} title="دليل المخازن السابق">
        <WarehousesListSection onSelect={handleSelect} selectedId={selectedId} />
      </DocumentBrowseDrawer>

      <ChildWarehouseKindDialog
        open={Boolean(kindPickerParent)}
        parentLabel={kindPickerParent?.label ?? ''}
        onClose={() => setKindPickerParent(null)}
        onPick={(kind) => {
          if (!kindPickerParent) return;
          applyParent(kindPickerParent.id, kind);
          setKindPickerParent(null);
        }}
      />
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
