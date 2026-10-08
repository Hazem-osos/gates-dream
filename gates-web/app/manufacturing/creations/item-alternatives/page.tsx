'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import {
  ManufacturingPageChrome,
  MfgField,
  MfgFilterCard,
  MfgTableCard,
  mfgInputClass,
  mfgTableClass,
  mfgTdClass,
  mfgTdIdx,
  mfgThClass,
  mfgThIdx,
  mfgTheadClass,
  mfgTrClass,
} from '@/components/manufacturing/ManufacturingPageChrome';
import { Button, CompactFormField, compactControlClass } from '@/components/ui';
import { compactNumericControlClass } from '@/app/components/ui/forms/formTokens';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import {
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import { confirmAction } from '@/lib/feedback/confirm';
import { apiClient } from '@/lib/api/client';

type AlternativeRow = {
  id?: string;
  alternativeItemId: string;
  quantity: string;
  serial?: string;
  arabicName?: string;
  barcode?: string;
  unitName?: string;
};

type ApiLine = {
  id: string;
  alternativeItemId: string;
  quantity: number;
  alternativeItem: {
    arabicName: string;
    serial?: string | null;
    barcode?: string | null;
    baseUnitName?: string | null;
  };
};

type DefinitionRow = {
  itemId: string;
  alternativeCount: number;
  item: { id: string; serial?: string | null; arabicName: string; barcode?: string | null };
};

type ItemRow = {
  id: string;
  arabicName: string;
  serial?: string | null;
  barcode?: string | null;
  units?: Array<{ isBaseUnit?: boolean; unit?: { arabicName?: string } }>;
};

function emptyLine(): AlternativeRow {
  return { alternativeItemId: '', quantity: '1' };
}

function linesFromApi(apiLines: ApiLine[]): AlternativeRow[] {
  if (!apiLines.length) return [emptyLine()];
  return apiLines.map((row) => ({
    id: row.id,
    alternativeItemId: row.alternativeItemId,
    quantity: String(row.quantity),
    serial: row.alternativeItem.serial ?? '',
    arabicName: row.alternativeItem.arabicName,
    barcode: row.alternativeItem.barcode ?? '',
    unitName: row.alternativeItem.baseUnitName ?? '',
  }));
}

function ItemAlternativesDefinitionInner() {
  useBackendReachability();
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, lockToView, unlockForEdit } = useDocumentMode();

  const [itemId, setItemIdState] = useState(() => searchParams.get('itemId')?.trim() || '');
  useEffect(() => {
    const fromUrl = searchParams.get('itemId')?.trim() || '';
    if (fromUrl !== itemId) setItemIdState(fromUrl);
  }, [searchParams, itemId]);
  const [lines, setLines] = useState<AlternativeRow[]>([emptyLine()]);
  const savedSnapshotRef = useRef<AlternativeRow[]>([emptyLine()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browsePage, setBrowsePage] = useState(1);

  const setItemId = useCallback(
    (id: string) => {
      setItemIdState(id);
      const path = '/manufacturing/creations/item-alternatives';
      if (typeof window === 'undefined') return;
      if (id) router.replace(`${path}?itemId=${id}`, { scroll: false });
      else router.replace(path, { scroll: false });
    },
    [router]
  );

  const { data: itemsRes } = useApiQuery<ItemRow[]>(
    ['items', 'item-alternatives-pick'],
    '/inventory/items',
    { limit: 2000, isActive: true }
  );
  const itemCatalog = useMemo(() => {
    const map = new Map<string, ItemRow>();
    for (const row of itemsRes?.data ?? []) map.set(row.id, row);
    return map;
  }, [itemsRes?.data]);

  const { data: headerItemRes } = useApiQuery<ItemRow>(
    ['item-header', itemId],
    itemId ? `/inventory/items/${itemId}` : '/__noop__',
    undefined,
    { enabled: Boolean(itemId) }
  );
  const headerItem = headerItemRes?.data;

  const { data, isLoading, isFetching } = useApiQuery<ApiLine[]>(
    ['item-alternatives-def', itemId],
    itemId ? `/manufacturing/item-alternatives/by-item/${itemId}` : '',
    undefined,
    { enabled: Boolean(itemId) }
  );

  const { data: definitionIdsRes } = useApiQuery<string[]>(
    ['item-alternatives-definition-ids'],
    '/manufacturing/item-alternatives/definition-item-ids'
  );
  const definitionIds = definitionIdsRes?.data ?? [];

  const { data: definitionsRes, isLoading: definitionsLoading } = useApiQuery<DefinitionRow[]>(
    ['item-alternatives-definitions', browsePage, browseSearch],
    '/manufacturing/item-alternatives/definitions',
    { page: browsePage, limit: 50, search: browseSearch.trim() || undefined },
    { enabled: showBrowse }
  );
  const definitionRows = definitionsRes?.data ?? [];
  const definitionTotal = definitionsRes?.pagination?.total ?? definitionRows.length;

  const enrichLine = useCallback(
    (line: AlternativeRow, altId: string): AlternativeRow => {
      const item = itemCatalog.get(altId);
      if (!item) return { ...line, alternativeItemId: altId };
      const baseUnit = item.units?.find((u) => u.isBaseUnit)?.unit?.arabicName ?? '';
      return {
        ...line,
        alternativeItemId: altId,
        serial: item.serial ?? '',
        arabicName: item.arabicName,
        barcode: item.barcode ?? '',
        unitName: baseUnit,
      };
    },
    [itemCatalog]
  );

  useEffect(() => {
    if (!itemId) {
      setLines([emptyLine()]);
      savedSnapshotRef.current = [emptyLine()];
      lockToView();
      return;
    }
    const apiLines = data?.data;
    if (apiLines === undefined) return;
    const next = linesFromApi(apiLines);
    setLines(next);
    savedSnapshotRef.current = next.map((row) => ({ ...row }));
    if (apiLines.length > 0) lockToView();
    else unlockForEdit();
  }, [itemId, data?.data, lockToView, unlockForEdit]);

  const hasSavedDefinition = Boolean(itemId && (data?.data?.length ?? 0) > 0);

  const saveMutation = useApiMutation<ApiLine[], { lines: { alternativeItemId: string; quantity: number }[] }>(
    itemId ? `/manufacturing/item-alternatives/by-item/${itemId}` : '',
    'PUT'
  );

  const filledLines = useMemo(
    () => lines.filter((l) => l.alternativeItemId.trim() && Number(l.quantity) > 0),
    [lines]
  );

  const handleSave = async () => {
    if (!itemId) {
      setError('اختر الصنف أولاً');
      return;
    }
    setError('');
    setSuccess('');
    const payload = filledLines.map((line, index) => ({
      alternativeItemId: line.alternativeItemId,
      quantity: Number(line.quantity),
      lineOrder: index + 1,
    }));
    for (const line of payload) {
      if (line.alternativeItemId === itemId) {
        setError('لا يمكن أن يكون البديل هو نفس الصنف');
        return;
      }
    }
    try {
      await saveMutation.mutateAsync({ lines: payload });
      setSuccess('تم حفظ بدائل الصنف');
      void invalidateQuery(['item-alternatives', itemId]);
      void invalidateQuery(['item-alternatives-counts']);
      void invalidateQuery(['item-alternatives-def', itemId]);
      void invalidateQuery(['item-alternatives-definitions']);
      void invalidateQuery(['item-alternatives-definition-ids']);
      lockToView();
    } catch (err) {
      setError((err as ApiError).message || 'تعذر الحفظ');
    }
  };

  const handleNew = () => {
    setItemId('');
    setLines([emptyLine()]);
    savedSnapshotRef.current = [emptyLine()];
    setError('');
    setSuccess('');
    unlockForEdit();
  };

  const handleCancelEdit = () => {
    setLines(savedSnapshotRef.current.map((row) => ({ ...row })));
    lockToView();
  };

  const handleDeleteDefinition = async () => {
    if (!itemId || !hasSavedDefinition) return;
    if (!(await confirmAction('حذف كل بدائل هذا الصنف؟ لا يمكن التراجع.'))) return;
    setError('');
    try {
      await apiClient.delete(`/manufacturing/item-alternatives/by-item/${itemId}`);
      setSuccess('تم حذف بدائل الصنف');
      setLines([emptyLine()]);
      savedSnapshotRef.current = [emptyLine()];
      void invalidateQuery(['item-alternatives-def', itemId]);
      void invalidateQuery(['item-alternatives-counts']);
      void invalidateQuery(['item-alternatives-definitions']);
      void invalidateQuery(['item-alternatives-definition-ids']);
      lockToView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  const navIndex = itemId ? definitionIds.indexOf(itemId) : -1;
  const canNavPrev = navIndex > 0;
  const canNavNext = navIndex >= 0 && navIndex < definitionIds.length - 1;

  const openDefinition = (id: string) => {
    setShowBrowse(false);
    setItemId(id);
  };

  const docSerial = headerItem?.serial?.trim() || '—';
  const statusLabel = !itemId ? 'جديد' : isReadOnly ? 'عرض' : 'تعديل';

  return (
    <ManufacturingPageChrome
      title="تعريف البدائل"
      statusLabel={statusLabel}
      statusTone={!itemId ? 'info' : hasSavedDefinition ? 'success' : 'warning'}
      docNumber={itemId ? docSerial : undefined}
      currentId={itemId || null}
      favoriteHref="/manufacturing/creations/item-alternatives"
      onSave={() => void handleSave()}
      savePending={saveMutation.isPending}
      canSave={Boolean(itemId) && !isReadOnly && !saveMutation.isPending}
      saveLabel={hasSavedDefinition ? 'تحديث البدائل' : 'حفظ البدائل'}
      onBrowseList={() => setShowBrowse(true)}
      browseListLabel="السابق"
      standardActions={{
        hasDocument: Boolean(itemId),
        onNew: handleNew,
        newLabel: 'جديد',
        onEdit: isReadOnly ? unlockForEdit : undefined,
        onVoid: hasSavedDefinition ? () => void handleDeleteDefinition() : undefined,
        voidLabel: 'حذف التعريف',
        hidePostActions: true,
      }}
      extraActions={
        itemId && definitionIds.length > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canNavPrev}
              title="الصنف السابق"
              onClick={() => canNavPrev && setItemId(definitionIds[navIndex - 1])}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canNavNext}
              title="الصنف التالي"
              onClick={() => canNavNext && setItemId(definitionIds[navIndex + 1])}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : null
      }
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <DocumentReadOnlyBanner />
      {!isReadOnly && hasSavedDefinition ? (
        <div className="flex justify-end no-print">
          <Button type="button" variant="secondary" size="sm" onClick={handleCancelEdit}>
            إلغاء التعديل
          </Button>
        </div>
      ) : null}

      <DocumentBrowseDrawer open={showBrowse} onClose={() => setShowBrowse(false)} title="تعريفات البدائل السابقة">
        <div className="space-y-3">
          <CompactFormField
            label="بحث"
            placeholder="رقم أو اسم الصنف…"
            value={browseSearch}
            onChange={(e) => {
              setBrowseSearch(e.target.value);
              setBrowsePage(1);
            }}
          />
          {definitionsLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">جاري التحميل…</p>
          ) : definitionRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">لا توجد تعريفات محفوظة</p>
          ) : (
            definitionRows.map((row) => (
              <div
                key={row.itemId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D6EAF3] bg-white px-3 py-2"
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-[#0A3D5E]">
                    {row.item.serial || '—'}
                  </span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span className="text-sm text-slate-800">{row.item.arabicName}</span>
                  <p className="text-xs text-slate-500">{row.alternativeCount} بديل</p>
                </div>
                <Button type="button" size="sm" onClick={() => openDefinition(row.itemId)}>
                  فتح
                </Button>
              </div>
            ))
          )}
          {definitionTotal > 50 ? (
            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={browsePage <= 1}
                onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
              >
                السابق
              </Button>
              <span className="self-center text-xs text-slate-600">
                صفحة {browsePage} — {definitionTotal} صنف
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={browsePage * 50 >= definitionTotal}
                onClick={() => setBrowsePage((p) => p + 1)}
              >
                التالي
              </Button>
            </div>
          ) : null}
        </div>
      </DocumentBrowseDrawer>

      <MfgFilterCard>
        <MfgField label="مسلسل الصنف">
          <input
            readOnly
            className={cn(mfgInputClass, 'bg-slate-50 font-mono')}
            value={itemId ? docSerial : '—'}
          />
        </MfgField>
        <MfgField label="اسم الصنف">
          <input
            readOnly
            className={cn(mfgInputClass, 'bg-slate-50')}
            value={itemId ? headerItem?.arabicName ?? '…' : '—'}
          />
        </MfgField>
        <MfgField label="الصنف (للتعريف)" className="sm:col-span-2">
          <ItemSelect
            value={itemId}
            onChange={(id) => {
              setItemId(id);
              unlockForEdit();
            }}
            emptyLabel="اختر الصنف لتعريف بدائله…"
            className={compactControlClass}
            enableQuickCreate={false}
            disabled={isReadOnly}
          />
        </MfgField>
        <MfgField label="الباركود">
          <input
            readOnly
            className={cn(mfgInputClass, 'bg-slate-50 font-mono text-sm')}
            value={itemId ? headerItem?.barcode ?? '—' : '—'}
          />
        </MfgField>
      </MfgFilterCard>

      <MfgTableCard
        title={itemId ? 'بدائل الصنف' : 'اختر صنفاً أولاً'}
        toolbar={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!itemId || isReadOnly}
            className="gap-1.5"
            onClick={() => setLines((p) => [...p, emptyLine()])}
          >
            <Plus className="h-4 w-4" />
            إضافة بديل
          </Button>
        }
      >
        <table className={cn(mfgTableClass, 'table-fixed')}>
          <thead className={mfgTheadClass}>
            <tr>
              <th className={mfgThIdx}>م</th>
              <th className={cn(mfgThClass, 'w-28')}>رقم البديل</th>
              <th className={mfgThClass}>صنف البديل</th>
              <th className={cn(mfgThClass, 'w-28')}>الباركود</th>
              <th className={cn(mfgThClass, 'w-24 text-center')}>الوحدة</th>
              <th className={cn(mfgThClass, 'w-28 text-center')}>الكمية</th>
              <th className={cn(mfgThClass, 'w-12')} />
            </tr>
          </thead>
          <tbody>
            {!itemId ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  اختر الصنف ثم أضف البدائل مع الكميات.
                </td>
              </tr>
            ) : isLoading || isFetching ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  جاري التحميل…
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={line.id ?? `line-${index}`} className={mfgTrClass}>
                  <td className={mfgTdIdx}>{index + 1}</td>
                  <td className={mfgTdClass}>
                    <span className="font-mono text-xs text-slate-700">{line.serial || '—'}</span>
                  </td>
                  <td className={mfgTdClass}>
                    <ItemSelect
                      value={line.alternativeItemId}
                      onChange={(id) => {
                        const next = [...lines];
                        next[index] = enrichLine(next[index], id);
                        setLines(next);
                      }}
                      emptyLabel="اختر البديل"
                      className={cn(compactControlClass, 'h-8 text-sm')}
                      enableQuickCreate={false}
                      disabled={!itemId || isReadOnly}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <span className="font-mono text-xs text-slate-600">{line.barcode || '—'}</span>
                  </td>
                  <td className={cn(mfgTdClass, 'text-center text-xs text-slate-600')}>
                    {line.unitName || '—'}
                  </td>
                  <td className={mfgTdClass}>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      disabled={!itemId || isReadOnly}
                      className={cn(compactNumericControlClass, 'mx-auto max-w-[8rem] text-center')}
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = { ...next[index], quantity: e.target.value };
                        setLines(next);
                      }}
                    />
                  </td>
                  <td className={mfgTdClass}>
                    <button
                      type="button"
                      className="text-red-600 hover:text-red-700 disabled:opacity-40"
                      title="حذف السطر"
                      disabled={isReadOnly}
                      onClick={() => {
                        if (lines.length <= 1) setLines([emptyLine()]);
                        else setLines(lines.filter((_, i) => i !== index));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </MfgTableCard>
    </ManufacturingPageChrome>
  );
}

export default function ItemAlternativesDefinitionPage() {
  return (
    <DocumentModeProvider>
      <ItemAlternativesDefinitionInner />
    </DocumentModeProvider>
  );
}
