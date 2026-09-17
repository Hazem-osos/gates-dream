'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { ItemDisassemblyHeader } from '@/components/inventory/disassembly/ItemDisassemblyHeader';
import { DisassemblyLinesTable } from '@/components/inventory/disassembly/DisassemblyLinesTable';
import { DisassemblyStickyFooter } from '@/components/inventory/disassembly/DisassemblyStickyFooter';
import {
  disassemblyLineTotal,
  emptyDisassemblyComponentLine,
  isEnteredDisassemblyLine,
  type DisassemblyComponentLine,
} from '@/components/inventory/disassembly/disassembly-line-types';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import {
  postNamedDocumentAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { printPageContent } from '@/lib/print/printHtml';

type ParentItem = {
  id: string;
  serial?: string | null;
  arabicName: string;
  isAssembly?: boolean;
  averageCost?: number | string | null;
};

type DisassemblyExplosionResponse = {
  parentItemUnitCost?: number;
  parentItemDisassemblyTotalCost?: number;
  components: Array<{
    itemId: string;
    itemCode: string;
    itemNameAr: string;
    unit: { id: string; name: string } | null;
    availableQuantity: number;
    resultingQuantity?: number;
    requiredQuantity?: number;
    unitCost: number;
  }>;
};

type DisassemblyRecord = {
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
  lines?: Array<{
    disassembledItemId: string;
    disassembledQuantity?: number | string;
    disassembledUnitPrice?: number | string;
    disassembledTotal?: number | string;
    disassembledItem?: { serial?: string | null; arabicName?: string };
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

function DisassemblyPageInner() {
  const searchParams = useOwnTabSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
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
  const [disassemblyQuantity, setDisassemblyQuantity] = useState(1);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [targetWarehouseId, setTargetWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [parentUnitCost, setParentUnitCost] = useState(0);
  const [lines, setLines] = useState<DisassemblyComponentLine[]>([emptyDisassemblyComponentLine()]);

  const { data: itemsResponse } = useApiQuery<ParentItem[]>(
    ['items', 'disassembly-parents'],
    '/inventory/items',
    { limit: 200, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const { data: loadedResponse } = useApiQuery<DisassemblyRecord>(
    ['disassembly', selectedId ?? ''],
    selectedId ? `/inventory/disassemblies/${selectedId}` : '/inventory/disassemblies',
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
    setParentItemId(first?.disassembledItemId || '');
    setDisassemblyQuantity(Number(first?.disassembledQuantity) || 1);
    setSourceWarehouseId(loaded.warehouseId || '');
    setTargetWarehouseId(loaded.toWarehouseId || loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setIsPosted(Boolean(loaded.isPosted));
    setIsCancelled(Boolean(loaded.isCancelled));
    setJournalEntryId(loaded.journalEntryId || null);
    setParentUnitCost(Number(first?.disassembledUnitPrice) || 0);
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

  const entered = useMemo(() => lines.filter(isEnteredDisassemblyLine), [lines]);
  const recoveredValue = useMemo(
    () => entered.reduce((sum, line) => sum + disassemblyLineTotal(line), 0),
    [entered]
  );
  const parentTotal = parentUnitCost * (disassemblyQuantity || 1);
  const readOnly = isPosted || isCancelled;

  const createMutation = useApiMutation<DisassemblyRecord, Record<string, unknown>>(
    '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['disassemblies']);
        resetNew();
        setSuccess('تم حفظ أمر التفكيك');
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر حفظ أمر التفكيك'),
    }
  );

  const updateMutation = useApiMutation<DisassemblyRecord, Record<string, unknown>>(
    selectedId ? `/inventory/disassemblies/${selectedId}` : '/inventory/disassemblies',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['disassemblies']);
        const id = selectedId;
        if (consumeShouldRepost() && id) {
          void postNamedDocumentAfterSave(`/inventory/disassemblies/${id}/post`)
            .then(() => {
              resetNew();
              setSuccess('تم حفظ التعديلات وترحيل أمر التفكيك');
            })
            .catch((err: ApiError) => {
              resetNew();
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل التفكيك');
            });
          return;
        }
        resetNew();
        setSuccess('تم تحديث أمر التفكيك');
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث أمر التفكيك'),
    }
  );

  const postMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/disassemblies/${selectedId}/post` : '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsPosted(true);
        setSuccess('تم ترحيل أمر التفكيك');
        invalidateQuery(['disassemblies']);
        invalidateQuery(['disassembly', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'فشل ترحيل التفكيك'),
    }
  );

  const unpostMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/disassemblies/${selectedId}/unpost` : '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsPosted(false);
        markUnpostedForEdit();
        setSuccess('تم فك ترحيل التفكيك');
        invalidateQuery(['disassemblies']);
        invalidateQuery(['disassembly', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'فشل فك الترحيل'),
    }
  );

  const cancelMutation = useApiMutation<unknown, Record<string, never>>(
    selectedId ? `/inventory/disassemblies/${selectedId}/cancel` : '/inventory/disassemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsCancelled(true);
        setSuccess('تم إلغاء أمر التفكيك');
        invalidateQuery(['disassemblies']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء التفكيك'),
    }
  );

  const buildPayload = () => {
    if (!parentItemId) throw new Error('يرجى اختيار الصنف المراد تفكيكه');
    if (!sourceWarehouseId) throw new Error('يرجى اختيار مخزن صرف الصنف المفكك');
    if (entered.length === 0) throw new Error('أضف مكوناً ناتجاً واحداً على الأقل أو اضغط تحليل');
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
          disassembledItemId: parentItemId,
          disassembledQuantity: disassemblyQuantity,
          disassembledUnitPrice: parentUnitCost,
          disassembledTotal: parentTotal || recoveredValue,
          components: entered.map((line) => ({
            componentItemId: line.itemId,
            quantity: line.quantity,
            unitPrice: line.unitCost,
            total: disassemblyLineTotal(line),
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
      setError('اختر الصنف المراد تفكيكه أولاً');
      return;
    }
    if (entered.length > 0) {
      const ok = await confirmAction(
        'سيتم إعادة احتساب وتعبئة المكونات الناتجة وفقاً لشجرة المنتجات والكمية المحددة، متابعة؟'
      );
      if (!ok) return;
    }
    setExplodePending(true);
    setError('');
    try {
      const res = await apiClient.get<DisassemblyExplosionResponse>(
        `/inventory/items/${parentItemId}/disassembly-explosion`,
        {
          quantity: disassemblyQuantity,
          warehouseId: targetWarehouseId || undefined,
          sourceWarehouseId: sourceWarehouseId || undefined,
        }
      );
      const components = res.data?.components ?? [];
      if (!components.length) {
        setError('لا توجد مكونات في شجرة هذا الصنف');
        return;
      }
      if (res.data?.parentItemUnitCost != null) {
        setParentUnitCost(Number(res.data.parentItemUnitCost) || 0);
      }
      setLines(
        components.map((comp) => ({
          itemId: comp.itemId,
          itemCode: comp.itemCode || '',
          itemName: comp.itemNameAr || '',
          unitId: comp.unit?.id || '',
          unitName: comp.unit?.name || '',
          availableQuantity: Number(comp.availableQuantity) || 0,
          quantity: Number(comp.resultingQuantity ?? comp.requiredQuantity) || 0,
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
    resetKeepPosted();
    setSelectedId(null);
    setSerial('');
    setDescription('');
    setDate(todayIso());
    setParentItemId('');
    setDisassemblyQuantity(1);
    setSourceWarehouseId('');
    setTargetWarehouseId('');
    setCostCenterId('');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setParentUnitCost(0);
    setLines([emptyDisassemblyComponentLine()]);
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
    setSuccess('تم تجهيز نسخة جديدة من أمر التفكيك');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const savePending = createMutation.isPending || updateMutation.isPending;

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <ItemDisassemblyHeader
          docNumber={serial}
          isPosted={isPosted}
          isCancelled={isCancelled}
          parentItemId={parentItemId}
          onParentItemId={setParentItemId}
          parentItems={items}
          disassemblyQuantity={disassemblyQuantity}
          onDisassemblyQuantity={setDisassemblyQuantity}
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
          canExplode={Boolean(parentItemId) && disassemblyQuantity > 0 && !readOnly}
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
              label: 'ترحيل أمر التفكيك',
              disabled: !selectedId || isPosted || isCancelled || savePending,
              onClick: () => {
                if (!selectedId) setError('احفظ أمر التفكيك أولاً');
                else postMutation.mutate({});
              },
            },
            {
              id: 'unpost',
              label: 'فك ترحيل التفكيك',
              disabled: !selectedId || !isPosted,
              onClick: () => {
                if (selectedId) unpostMutation.mutate({});
              },
            },
            { id: 'print', label: 'طباعة أمر التفكيك', onClick: () => void printPageContent('أمر التفكيك') },
            { id: 'duplicate', label: 'تكرار التفكيك', onClick: handleDuplicate },
            {
              id: 'cancel',
              label: 'إلغاء التفكيك',
              disabled: !selectedId || isPosted || isCancelled,
              destructive: true,
              onClick: () => {
                if (selectedId) cancelMutation.mutate({});
              },
            },
            { id: 'new', label: 'أمر جديد', onClick: resetNew },
          ]}
        />

        <DisassemblyLinesTable
          headerDescription={description}
          lines={lines}
          onChange={setLines}
          warehouseId={targetWarehouseId}
          disabled={readOnly}
        />

        <DisassemblyStickyFooter
          componentCount={entered.length}
          recoveredComponentsValue={recoveredValue}
          parentItemDisassemblyTotalCost={parentTotal}
          journalEntryId={journalEntryId}
          isPosted={isPosted}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onSave={handleSave}
          onCancel={resetNew}
        />

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر التفكيك السابقة">
          <GenericRecordsList
            apiPath="/inventory/disassemblies"
            listKey="disassemblies-browse"
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

export default function DisassemblyPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">جاري فتح شاشة التفكيك…</p>}>
      <DisassemblyPageInner />
    </Suspense>
  );
}
