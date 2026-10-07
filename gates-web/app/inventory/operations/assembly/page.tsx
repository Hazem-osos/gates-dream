'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { useRepostAfterUnpost } from '@/lib/accounting/ensure-posted-after-save';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  extractStockPostResult,
  postSuccessMessage,
  useDocumentPostMutation,
} from '@/lib/inventory/use-document-post-mutation';
import type { ApiResponse } from '@/lib/api/types';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { printManufacturingVoucher } from '@/lib/print/printManufacturingVoucher';
import { useStoreDocumentSerial } from '@/lib/inventory/use-store-document-serial';
import { StockMovementBottomSplit } from '@/components/inventory/stock/StockMovementBottomSplit';
import type { AssemblyPricingMethod } from '@/lib/inventory/assembly-pricing';

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
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get('id')?.trim() || null
  );
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [explodePending, setExplodePending] = useState(false);
  const postAfterSaveRef = useRef(false);

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
  const [glSkipped, setGlSkipped] = useState(false);
  const [lines, setLines] = useState<AssemblyComponentLine[]>([emptyAssemblyComponentLine()]);
  const [pricingMethod, setPricingMethod] = useState<AssemblyPricingMethod>('AVERAGE_COST');
  const [viewLocked, setViewLocked] = useState(false);

  const { serialAutomatic, invalidateNextSerial } = useStoreDocumentSerial({
    kind: 'assembly',
    enabled: !selectedId,
    setSerial,
  });

  const { data: itemsResponse } = useApiQuery<AssemblyParentItem[]>(
    ['items', 'assembly-parents'],
    '/inventory/items',
    { limit: 200, isActive: true, isAssembly: true }
  );
  const items = Array.isArray(itemsResponse?.data) ? itemsResponse.data : [];

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
    setIsPosted(resolvePostedFlag(loaded));
    setIsCancelled(Boolean(loaded.isCancelled));
    const je = loaded.journalEntryId || null;
    setJournalEntryId(je);
    setGlSkipped(resolvePostedFlag(loaded) && !je);
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
    setViewLocked(true);
  }, [loaded, selectedId]);

  const entered = useMemo(() => lines.filter(isEnteredAssemblyLine), [lines]);
  const totalComponentsCost = useMemo(
    () => entered.reduce((sum, line) => sum + assemblyLineTotal(line), 0),
    [entered]
  );
  const readOnly = isPosted || isCancelled || viewLocked;

  const stayOnAssembly = (id?: string | null, serialNumber?: string | null) => {
    if (!id) return;
    setSelectedId(id);
    if (serialNumber) setSerial(serialNumber);
    window.history.replaceState(null, '', `?id=${id}`);
    invalidateStockViews(invalidateQuery);
  };

  const openAssembly = (id: string) => {
    setSelectedId(id);
    window.history.replaceState(null, '', `?id=${id}`);
  };

  const applyPostResponse = (res: ApiResponse<unknown>) => {
    const { journalEntryId: je, glSkipped: skipped } = extractStockPostResult(res);
    setJournalEntryId(je);
    setGlSkipped(skipped);
  };

  const postAssemblyAfterSave = (id: string, number?: string | null) => {
    void apiClient
      .post(`/inventory/assemblies/${id}/post`)
      .then((res) => {
        setIsPosted(true);
        applyPostResponse(res);
        setSuccess(postSuccessMessage(res));
        stayOnAssembly(id, number);
        invalidateQuery(['assembly', id]);
        invalidateStockViews(invalidateQuery);
      })
      .catch((err: unknown) => {
        stayOnAssembly(id, number);
        setError(err instanceof Error ? err.message : 'تم الحفظ وتعذر ترحيل التجميع');
        invalidateStockViews(invalidateQuery);
      });
  };

  const createMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    '/inventory/assemblies',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        invalidateStockViews(invalidateQuery);
        invalidateNextSerial();
        const id = res.data?.id;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        if (id) invalidateQuery(['assembly', id]);
        if (shouldPost && id) {
          postAssemblyAfterSave(id, res.data?.serial);
          return;
        }
        finishDocumentSave({
          label: 'تجميع',
          number: res.data?.serial,
          savedId: id,
          cleared: false,
          onOpen: openAssembly,
          onSavedOpen: (saved) => invalidateQuery(['assembly', saved]),
          reset: () => {
            if (id) {
              openAssembly(id);
              setViewLocked(true);
            } else {
              resetNew();
            }
          },
        });
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر حفظ أمر التجميع');
      },
    }
  );

  const updateMutation = useApiMutation<AssemblyRecord, Record<string, unknown>>(
    selectedId ? `/inventory/assemblies/${selectedId}` : '/inventory/assemblies',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const id = res.data?.id || selectedId;
        const number = res.data?.serial || serial;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        invalidateStockViews(invalidateQuery);
        if (consumeShouldRepost() && id) {
          void apiClient
            .post(`/inventory/assemblies/${id}/post`, {}, { skipSuccessNotify: true })
            .then((postRes) => {
              setIsPosted(true);
              applyPostResponse(postRes);
              setSuccess(postSuccessMessage(postRes));
              finishDocumentSave({
                label: 'تجميع',
                number,
                posted: true,
                savedId: id,
                cleared: false,
                onOpen: openAssembly,
                reset: () => {
                  stayOnAssembly(id, number);
                  setViewLocked(true);
                },
              });
              invalidateQuery(['assembly', id]);
              invalidateStockViews(invalidateQuery);
            })
            .catch((err: ApiError) => {
              stayOnAssembly(id, res.data?.serial);
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل التجميع');
            });
          return;
        }
        if (shouldPost && id) {
          postAssemblyAfterSave(id, number);
          return;
        }
        finishDocumentSave({
          label: 'تجميع',
          number,
          savedId: id,
          cleared: false,
          onOpen: openAssembly,
          onSavedOpen: (saved) => invalidateQuery(['assembly', saved]),
          reset: () => {
            stayOnAssembly(id, number);
            setViewLocked(true);
          },
        });
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر تحديث أمر التجميع');
      },
    }
  );

  const unpostMutation = useDocumentPostMutation('/inventory/assemblies', selectedId, 'unpost');

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
    if (entered.length === 0) throw new Error('أضف مكوناً واحداً على الأقل أو اضغط تحميل');
    return {
      serial: serial || undefined,
      description: description || undefined,
      date: new Date(`${date}T12:00:00`).toISOString(),
      hijriDate: toHijriDate(date),
      warehouseId: sourceWarehouseId,
      toWarehouseId: targetWarehouseId || sourceWarehouseId,
      costCenterId: costCenterId.trim() ? costCenterId.trim() : undefined,
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
    if (readOnly && !postAfterSaveRef.current) return;
    setError('');
    try {
      const body = buildPayload();
      if (selectedId) updateMutation.mutate(body);
      else createMutation.mutate(body);
    } catch (err) {
      postAfterSaveRef.current = false;
      setError(err instanceof Error ? err.message : 'تحقق من البيانات');
    }
  };

  const handleSaveAndPost = () => {
    if (isPosted || isCancelled) return;
    postAfterSaveRef.current = true;
    handleSave();
  };

  const handleExplodeBOM = async () => {
    if (!parentItemId) {
      setError('اختر الصنف التجميعي أولاً');
      return;
    }
    if (entered.length > 0) {
      const ok = await confirmAction(
        'سيتم تحميل مكونات الصنف من بطاقة الصنف حسب الكمية المحددة، متابعة؟'
      );
      if (!ok) return;
    }
    setExplodePending(true);
    setError('');
    try {
      const res = await apiClient.get<BomExplosionResponse>(
        `/inventory/items/${parentItemId}/bom-explosion`,
        {
          quantity: assemblyQuantity,
          warehouseId: sourceWarehouseId || undefined,
          pricingMethod,
        }
      );
      const components = res.data?.components ?? [];
      if (!components.length) {
        setError('لا توجد مكونات في بطاقة هذا الصنف');
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
      setSuccess('تم تحميل مكونات الصنف من البطاقة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مكونات الصنف');
    } finally {
      setExplodePending(false);
    }
  };

  const resetNew = () => {
    resetKeepPosted();
    setViewLocked(false);
    setSelectedId(null);
    setSerial('');
    void invalidateNextSerial();
    setDescription('');
    setDate(todayIso());
    setParentItemId('');
    setAssemblyQuantity(1);
    setSourceWarehouseId('');
    setTargetWarehouseId('');
    setCostCenterId('');
    setPricingMethod('AVERAGE_COST');
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setGlSkipped(false);
    setLines([emptyAssemblyComponentLine()]);
    setError('');
    setSuccess('');
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleDuplicate = () => {
    setViewLocked(false);
    setSelectedId(null);
    setSerial('');
    void invalidateNextSerial();
    setIsPosted(false);
    setIsCancelled(false);
    setJournalEntryId(null);
    setGlSkipped(false);
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
          serialReadOnly={serialAutomatic || readOnly}
          serialPlaceholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل رقم المسلسل'}
          onSerialChange={setSerial}
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
          onSourceWarehouseId={(id) => {
            setSourceWarehouseId(id);
            if (!targetWarehouseId) setTargetWarehouseId(id);
          }}
          targetWarehouseId={targetWarehouseId}
          onTargetWarehouseId={setTargetWarehouseId}
          costCenterId={costCenterId}
          onCostCenterId={setCostCenterId}
          pricingMethod={pricingMethod}
          onPricingMethod={(method) => {
            setPricingMethod(method);
            if (method === 'MANUAL') {
              setLines((prev) =>
                prev.map((line) => (line.itemId ? { ...line, unitCost: 0 } : line))
              );
            }
          }}
          disabled={readOnly}
          explodePending={explodePending}
          canExplode={Boolean(parentItemId) && assemblyQuantity > 0 && !isPosted && !isCancelled}
          onExplode={() => void handleExplodeBOM()}
          onSaveDraft={handleSaveAndPost}
          onCancel={resetNew}
          savePending={savePending}
          canSave={!readOnly && !savePending}
          onBrowseList={() => setBrowseOpen(true)}
          moreMenuItems={[
            {
              id: 'edit',
              label: 'تعديل',
              disabled: !selectedId || isPosted || isCancelled || !viewLocked,
              onClick: () => {
                if (isPosted) {
                  setError('يجب فك الترحيل أولاً للتعديل');
                  return;
                }
                setViewLocked(false);
                setSuccess('');
              },
            },
            {
              id: 'post',
              label: 'ترحيل أمر التجميع',
              disabled: isPosted || isCancelled || savePending,
              onClick: () => handleSaveAndPost(),
            },
            {
              id: 'unpost',
              label: 'فك ترحيل التجميع',
              disabled: !selectedId || !isPosted || unpostMutation.isPending,
              onClick: () => {
                if (!selectedId) return;
                void confirmAction('فك ترحيل أمر التجميع؟ سيتم إرجاع الكميات للمخزن.').then((ok) => {
                  if (ok)
                    unpostMutation.mutate(
                      {},
                      {
                        onSuccess: () => {
                          setIsPosted(false);
                          setJournalEntryId(null);
                          setGlSkipped(false);
                          setViewLocked(false);
                          markUnpostedForEdit();
                          setSuccess('تم فك ترحيل التجميع');
                          stayOnAssembly(selectedId);
                          invalidateQuery(['assembly', selectedId]);
                        },
                        onError: (err: ApiError) => setError(err.message || 'فشل فك الترحيل'),
                      }
                    );
                });
              },
            },
            {
              id: 'print',
              label: 'طباعة أمر التجميع',
              onClick: () => {
                const parent = items.find((i) => i.id === parentItemId);
                printManufacturingVoucher({
                  title: 'أمر التجميع',
                  number: serial,
                  date,
                  description,
                  parentItemLabel: parent?.arabicName,
                  quantity: assemblyQuantity,
                  rows: entered.map((line) => ({
                    code: line.itemCode,
                    name: line.itemName,
                    quantity: line.quantity,
                    unitCost: line.unitCost,
                    total: assemblyLineTotal(line),
                  })),
                  totalAmount: totalComponentsCost,
                  totalsLabel: 'إجمالي تكلفة المكونات',
                });
              },
            },
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
          pricingMethod={pricingMethod}
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
          onSave={handleSaveAndPost}
          onCancel={resetNew}
        />

        <StockMovementBottomSplit
          totalAmount={totalComponentsCost}
          lineCount={entered.length}
          journalEntryId={journalEntryId}
          documentId={selectedId}
          isPosted={isPosted}
          glSkipped={glSkipped}
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
                  : { variant: 'warning', label: selectedId ? 'غير مرحّل' : 'جديد' }
            }
            onSelect={(id) => {
              setSelectedId(id);
              setViewLocked(true);
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
