'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { ItemAssemblyHeader } from '@/components/inventory/assembly/ItemAssemblyHeader';
import { AssemblyLinesTable } from '@/components/inventory/assembly/AssemblyLinesTable';
import { AssemblyStickyFooter } from '@/components/inventory/assembly/AssemblyStickyFooter';
import {
  assemblyLineTotal,
  emptyAssemblyComponentLine,
  isEnteredAssemblyLine,
  type AssemblyComponentLine,
} from '@/components/inventory/assembly/assembly-line-types';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { printPageContent } from '@/lib/print/printHtml';

type AssemblyParentItem = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
};

type BomExplosionResponse = {
  components: Array<{
    itemId: string;
    itemCode: string;
    itemNameAr: string;
    unit: { id: string; name: string } | null;
    availableQuantity: number;
    requiredQuantity: number;
    unitCost: number;
  }>;
};

type AssemblyRecord = {
  id: string;
  serial?: string | null;
  description?: string | null;
  date?: string;
  hijriDate?: string | null;
  warehouseId?: string;
  toWarehouseId?: string | null;
  costCenterId?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  journalEntryId?: string | null;
  record?: string | null;
  lines?: Array<{
    assembledItemId: string;
    assembledQuantity?: number | string;
    assembledItem?: { serial?: string | null; arabicName?: string };
    components?: Array<{
      componentItemId: string;
      quantity?: number | string;
      unitPrice?: number | string;
      componentItem?: { serial?: string | null; arabicName?: string };
    }>;
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function AssemblyPageInner() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [explodePending, setExplodePending] = useState(false);

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [parentItemId, setParentItemId] = useState('');
  const [assemblyQuantity, setAssemblyQuantity] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [lines, setLines] = useState<AssemblyComponentLine[]>([emptyAssemblyComponentLine()]);

  const { data: itemsResponse } = useApiQuery<AssemblyParentItem[]>(
    ['items', 'assembly-parents'],
    '/inventory/items',
    { limit: 200, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const { data: loadedResponse } = useApiQuery<AssemblyRecord>(
    ['assembly', selectedId ?? ''],
    selectedId ? `/inventory/assemblies/${selectedId}` : '/inventory/assemblies',
    undefined,
    { enabled: Boolean(selectedId) }
  );
  const loaded = loadedResponse?.data ?? null;

  useEffect(() => {
    const id = searchParams.get('id')?.trim();
    if (id && id !== selectedId) setSelectedId(id);
  }, [searchParams, selectedId]);

  useEffect(() => {
    if (!loaded || !selectedId) return;
    const first = loaded.lines?.[0];
    setSerial(loaded.serial || '');
    setDescription(loaded.description || '');
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setParentItemId(first?.assembledItemId || '');
    setAssemblyQuantity(Number(first?.assembledQuantity) || 1);
    setSourceWarehouseId(loaded.warehouseId || '');
    setTargetWarehouseId(loaded.toWarehouseId || loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setIsPosted(Boolean(loaded.isPosted));
    setIsCancelled(Boolean(loaded.isCancelled));
    setJournalEntryId(loaded.journalEntryId || null);
    setLines(
      (first?.components ?? []).map((comp) => ({
        itemId: comp.componentItemId,
        itemCode: comp.componentItem?.serial || '',
        itemName: comp.componentItem?.arabicName || '',
        unitId: '',
        unitName: '',
        availableQuantity: 0,
        quantity: Number(comp.quantity) || 0,
        unitCost: Number(comp.unitPrice) || 0,
        notes: '',
      }))
    );
  }, [loaded, selectedId]);

  const entered = useMemo(() => lines.filter(isEnteredAssemblyLine), [lines]);
  const totalComponentsCost = useMemo(
    () => entered.reduce((sum, line) => sum + assemblyLineTotal(line), 0),
    [entered]
  );
  const readOnly = isPosted || isCancelled;

  const createMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['assemblies']);
        resetNew();
        setSuccess('تم حفظ أمر التجميع');
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ أمر التجميع'),
    }
  );

  const updateMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    selectedId ? `/inventory/assemblies/${selectedId}` : '/inventory/assemblies',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['assemblies']);
        resetNew();
        setSuccess('تم تحديث أمر التجميع');
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث أمر التجميع'),
    }
  );

  const postMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/assemblies/${selectedId}/post` : '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsPosted(true);
        setSuccess('تم ترحيل أمر التجميع');
        invalidateQuery(['assemblies']);
        invalidateQuery(['assembly', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'فشل ترحيل التجميع'),
    }
  );

  const unpostMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/assemblies/${selectedId}/unpost` : '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsPosted(false);
        setSuccess('تم فك ترحيل التجميع');
        invalidateQuery(['assemblies']);
        invalidateQuery(['assembly', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'فشل فك الترحيل'),
    }
  );

  const cancelMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/assemblies/${selectedId}/cancel` : '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsCancelled(true);
        setSuccess('تم إلغاء أمر التجميع');
        invalidateQuery(['assemblies']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء التجميع'),
    }
  );

  const buildPayload = () => {
    if (!parentItemId) throw new Error('يرجى اختيار الصنف التجميعي');
    if (!sourceWarehouseId) throw new Error('يرجى اختيار مخزن صرف المكونات');
    if (entered.length === 0) throw new Error('أضف مكوناً واحداً على الأقل أو اضغط تحليل');
    return {
      serial: serial || undefined,
      description: description || undefined,
      date: new Date(`${date}T12:00:00`).toISOString(),
      hijriDate: toHijriDate(date),
      warehouseId: sourceWarehouseId,
      toWarehouseId: targetWarehouseId || sourceWarehouseId,
      costCenterId: costCenterId || undefined,
      lines: [
        {
          assembledItemId: parentItemId,
          assembledQuantity: assemblyQuantity,
          assembledTotal: totalComponentsCost,
          components: entered.map((line) => ({
            componentItemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitCost,
            total: assemblyLineTotal(line),
          })),
        },
      ],
    };
  };

  const handleSave = () => {
    if (readOnly) return;
    setError('');
    try {
      const body = buildPayload();
      if (selectedId) updateMutation.mutate(body);
      else createMutation.mutate(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تحقق من البيانات');
    }
  };

  const handleExplodeBOM = async () => {
    if (!parentItemId) {
      setError('اختر الصنف التجميعي أولاً');
      return;
    }
    if (entered.length > 0) {
      const ok = await confirmAction(
        'سيتم إعادة احتساب وتعبئة مكونات الصنف وفقاً لشجرة المنتجات والكمية المحددة، متابعة؟'
      );
      if (!ok) return;
    }
    setExplodePending(true);
    setError('');
    try {
      const res = await apiClient.get<BomExplosionResponse>(
        `/inventory/items/${parentItemId}/bom-explosion`,
        { quantity: assemblyQuantity, warehouseId: sourceWarehouseId || undefined }
      );
      const components = res.data?.components ?? [];
      if (!components.length) {
        setError('لا توجد مكونات في شجرة هذا الصنف');
        return;
      }
      setLines(
        components.map((comp) => ({
          itemId: comp.itemId,
          itemCode: comp.itemCode || '',
          itemName: comp.itemNameAr || '',
          unitId: comp.unit?.id || '',
          unitName: comp.unit?.name || '',
          availableQuantity: Number(comp.availableQuantity) || 0,
          quantity: Number(comp.requiredQuantity) || 0,
          unitCost: Number(comp.unitCost) || 0,
          notes: '',
        }))
      );
      setSuccess('تم تحليل شجرة المكونات وتعبئة الجدول');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحليل شجرة المكونات');
    } finally {
      setExplodePending(false);
    }
  };

  const resetNew = () => {
    setSelectedId(null);
    setSerial('');
    setDescription('');
    setDate(todayIso());
    setParentItemId('');
    setAssemblyQuantity(1);
    setSourceWarehouseId('');
    setTargetWarehouseId('');
    setCostCenterId('');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setLines([emptyAssemblyComponentLine()]);
    setError('');
    setSuccess('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleDuplicate = () => {
    setSelectedId(null);
    setSerial('');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setSuccess('تم تجهيز نسخة جديدة من أمر التجميع');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <ItemAssemblyHeader
          docNumber={serial}
          isPosted={isPosted}
          isCancelled={isCancelled}
          parentItemId={parentItemId}
          onParentItemId={setParentItemId}
          parentItems={items}
          assemblyQuantity={assemblyQuantity}
          onAssemblyQuantity={setAssemblyQuantity}
          description={description}
          onDescription={setDescription}
          date={date}
          onDate={setDate}
          sourceWarehouseId={sourceWarehouseId}
          onSourceWarehouseId={setSourceWarehouseId}
          targetWarehouseId={targetWarehouseId}
          onTargetWarehouseId={setTargetWarehouseId}
          costCenterId={costCenterId}
          onCostCenterId={setCostCenterId}
          disabled={readOnly}
          explodePending={explodePending}
          canExplode={Boolean(parentItemId) && assemblyQuantity > 0 && !readOnly}
          onExplode={() => void handleExplodeBOM()}
          onSaveDraft={handleSave}
          onCancel={resetNew}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onBrowseList={() => setBrowseOpen(true)}
          moreMenuItems={[
            {
              id: 'edit',
              label: 'تعديل',
              disabled: !selectedId || isPosted || isCancelled,
              onClick: () => {
                if (isPosted) setError('يجب فك الترحيل أولاً للتعديل');
              },
            },
            {
              id: 'post',
              label: 'ترحيل أمر التجميع',
              disabled: !selectedId || isPosted || isCancelled || savePending,
              onClick: () => {
                if (!selectedId) setError('احفظ أمر التجميع أولاً');
                else postMutation.mutate({});
              },
            },
            {
              id: 'unpost',
              label: 'فك ترحيل التجميع',
              disabled: !selectedId || !isPosted,
              onClick: () => {
                if (selectedId) unpostMutation.mutate({});
              },
            },
            { id: 'print', label: 'طباعة أمر التجميع', onClick: () => void printPageContent('أمر التجميع') },
            { id: 'duplicate', label: 'تكرار التجميع', onClick: handleDuplicate },
            {
              id: 'cancel',
              label: 'إلغاء التجميع',
              disabled: !selectedId || isPosted || isCancelled,
              destructive: true,
              onClick: () => {
                if (selectedId) cancelMutation.mutate({});
              },
            },
            { id: 'new', label: 'أمر جديد', onClick: resetNew },
          ]}
        />

        <AssemblyLinesTable
          lines={lines}
          onChange={setLines}
          warehouseId={sourceWarehouseId}
          disabled={readOnly}
          headerDescription={description}
        />

        <AssemblyStickyFooter
          componentCount={entered.length}
          totalComponentsCost={totalComponentsCost}
          assemblyQuantity={assemblyQuantity}
          journalEntryId={journalEntryId}
          isPosted={isPosted}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onSave={handleSave}
          onCancel={resetNew}
        />

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر التجميع السابقة">
          <GenericRecordsList
            apiPath="/inventory/assemblies"
            listKey="assemblies-browse"
            paging="skip"
            selectedId={selectedId}
            columns={[
              { id: 'num', header: 'المسلسل', getValue: (r) => String(r.serial ?? r.id.slice(0, 8)) },
              {
                id: 'date',
                header: 'التاريخ',
                getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
              },
              {
                id: 'net',
                header: 'الإجمالي',
                getValue: (r) => Number(r.totalAmount ?? 0).toLocaleString('ar-EG'),
              },
            ]}
            resolveStatus={(r) =>
              r.isCancelled
                ? { variant: 'danger', label: 'ملغي' }
                : r.isPosted
                  ? { variant: 'success', label: 'مرحّل' }
                  : { variant: 'warning', label: 'مسودة' }
            }
            onSelect={(id) => {
              setSelectedId(id);
              setBrowseOpen(false);
              window.history.replaceState(null, '', `?id=${id}`);
            }}
          />
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}

export default function AssemblyPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح شاشة التجميع…</p>}>
      <AssemblyPageInner />
    </Suspense>
  );
}
