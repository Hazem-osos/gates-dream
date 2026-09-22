'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tags } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  FilterToolbar,
  compactControlClass,
} from '@/components/ui';
import { DocumentBrowseDrawer, MasterCardShell } from '@/components/erp';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  PriceListsListSection,
  type PriceListRow,
} from '@/components/inventory/PriceListsListSection';
import { BarcodePrintModal } from '@/app/components/print/BarcodePrintModal';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { asItemList, isUngroupedCategory, isVisibleInItemsGuide } from '@/lib/inventory/guide-visible-items';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type PriceMode = 'value' | 'cost' | 'last';

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  description: string;
  discountPercentage: string;
  markupPercentage: string;
  currencyCode: string;
  priceMode: PriceMode;
};

type PriceLine = {
  key: string;
  id?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryId: string;
  unitId: string;
  unitName: string;
  discount: string;
  purchasePrice: string;
  salePrice: string;
  [key: string]: unknown;
};

type ApiPrice = {
  id: string;
  itemId: string;
  unitId: string;
  price?: number | string | null;
  discount?: number | string | null;
  purchasePrice?: number | string | null;
  wholesale?: number | string | null;
  retailPrice?: number | string | null;
  item?: {
    id?: string;
    code?: string | null;
    serial?: string | null;
    arabicName?: string;
    categoryId?: string | null;
    lastPurchasePrice?: number | string | null;
    priceRetail?: number | string | null;
  };
  unit?: { id?: string; arabicName?: string };
};

type CatalogItem = ItemOption & {
  categoryId?: string | null;
  category?: { id?: string } | null;
  isActive?: boolean | null;
  inactiveItem?: boolean | null;
  purchasePrice?: number | string | null;
  lastPurchasePrice?: number | string | null;
  priceRetail?: number | string | null;
  retailPrice?: number | string | null;
};

type Currency = {
  id: string;
  code: string;
  arabicName: string;
};

const emptyForm = (): FormState => ({
  code: '',
  arabicName: '',
  englishName: '',
  description: '',
  discountPercentage: '',
  markupPercentage: '',
  currencyCode: '',
  priceMode: 'value',
});

const cellCls = '!max-w-none !overflow-visible !h-auto whitespace-normal py-1.5';

function asText(value: number | string | null | undefined): string {
  if (value == null || value === '') return '';
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n) || n === 0) return value === 0 || value === '0' ? '0' : String(value);
  return String(value);
}

function num(value: string): number | null {
  if (!value.trim()) return null;
  const n = parseFloat(value.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function scalePrice(value: string, factor: number): string {
  const n = num(value);
  if (n == null) return value;
  const next = Math.max(0, n * factor);
  return String(Number(next.toFixed(4)));
}

function pickUnit(item?: CatalogItem | ItemOption | null): { unitId: string; unitName: string } {
  const units = item?.units ?? [];
  const base = units.find((u) => u.isBaseUnit) ?? units[0];
  return {
    unitId: base?.unitId || base?.unit?.id || '',
    unitName: base?.unit?.arabicName || '',
  };
}

function lineFromCatalog(
  item: CatalogItem,
  saved?: ApiPrice,
  discount = ''
): PriceLine {
  const unit = pickUnit(item);
  return {
    key: item.id,
    id: saved?.id,
    itemId: item.id,
    itemCode: item.serial ?? item.code ?? '',
    itemName: item.arabicName ?? '',
    categoryId: item.categoryId ?? item.category?.id ?? '',
    unitId: saved?.unitId || unit.unitId,
    unitName: saved?.unit?.arabicName || unit.unitName,
    discount: asText(saved?.discount) || discount,
    purchasePrice: asText(
      saved?.purchasePrice ?? saved?.wholesale ?? item.lastPurchasePrice ?? item.purchasePrice
    ),
    salePrice: asText(
      saved?.retailPrice ?? saved?.price ?? item.salesPrice ?? item.priceRetail ?? item.retailPrice
    ),
  };
}

function mergeCatalog(
  items: CatalogItem[],
  saved: ApiPrice[] | undefined,
  discount = ''
): PriceLine[] {
  const byItemUnit = new Map(
    (saved ?? []).map((row) => [`${row.itemId}:${row.unitId}`, row] as const)
  );
  const byItem = new Map((saved ?? []).map((row) => [row.itemId, row] as const));
  return items.map((item) => {
    const unit = pickUnit(item);
    const match = byItemUnit.get(`${item.id}:${unit.unitId}`) ?? byItem.get(item.id);
    return lineFromCatalog(item, match, discount);
  });
}

function PriceListsPageInner() {
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<PriceLine[]>([]);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [applied, setApplied] = useState({ groupId: '', unpriced: false, search: '' });
  const [search, setSearch] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const catalogSeeded = useRef(false);
  const lastCatalogLen = useRef(0);
  const pendingPrices = useRef<ApiPrice[] | undefined>(undefined);

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    queryKeys.currencies,
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data ?? [];

  const { data: groupsResponse } = useApiQuery<{ id: string; arabicName: string }[]>(
    queryKeys.itemCategories({ limit: 1000, guide: true }),
    '/inventory/item-categories',
    { limit: 1000, isActive: true }
  );
  const groups = asItemList<{ id: string; arabicName: string }>(groupsResponse?.data);

  const { data: listsResponse } = useApiQuery<PriceListRow[]>(
    queryKeys.priceLists({ picker: true }),
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const allLists = listsResponse?.data ?? [];

  const { data: itemsResponse, isLoading: catalogLoading } = useApiQuery<CatalogItem[]>(
    queryKeys.items({ priceListCatalog: true }),
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const catalog = useMemo(() => {
    const raw = asItemList<CatalogItem>(itemsResponse?.data);
    if (!groupsResponse) return [];
    const activeGroupIds = new Set(groups.map((group) => group.id));
    const ungroupedCategoryIds = new Set(
      groups.filter((group) => isUngroupedCategory(group)).map((group) => group.id)
    );
    return raw.filter((item) => isVisibleInItemsGuide(item, activeGroupIds, ungroupedCategoryIds));
  }, [itemsResponse?.data, groups, groupsResponse]);

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchLine = (key: string, next: Partial<PriceLine>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const seedFromCatalog = (saved?: ApiPrice[], discount = '') => {
    setLines(mergeCatalog(catalog, saved, discount));
  };

  const hydrateFromDetail = (detail: PriceListRow & { prices?: ApiPrice[] }) => {
    setForm({
      code: detail.code ?? '',
      arabicName: detail.arabicName ?? '',
      englishName: detail.englishName ?? '',
      description: detail.description ?? '',
      discountPercentage:
        detail.discountPercentage != null && detail.discountPercentage !== ''
          ? String(detail.discountPercentage)
          : '',
      markupPercentage: '',
      currencyCode: detail.currencyCode ?? '',
      priceMode:
        detail.priceMode === 'cost' || detail.priceMode === 'last' ? detail.priceMode : 'value',
    });
    pendingPrices.current = detail.prices;
    seedFromCatalog(detail.prices);
  };

  const loadList = async (id: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await apiClient.get<PriceListRow & { prices?: ApiPrice[] }>(
        `/inventory/price-lists/${id}`
      );
      if (res.data) {
        setSelectedId(res.data.id);
        hydrateFromDetail(res.data);
        lockToView();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل القائمة');
    } finally {
      setLoadingDetail(false);
    }
  };

  const applyRow = (row: PriceListRow) => {
    void loadList(row.id);
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyForm());
    pendingPrices.current = undefined;
    seedFromCatalog();
    setFilterGroupId('');
    setUnpricedOnly(false);
    setApplied({ groupId: '', unpriced: false, search: '' });
    setError('');
    setSuccess('');
    setMode('create');
  };

  useEffect(() => {
    if (!itemsResponse || !groupsResponse) return;
    const catalogJustArrived = lastCatalogLen.current === 0 && catalog.length > 0;
    lastCatalogLen.current = catalog.length;
    if (selectedId) {
      if (catalogJustArrived) seedFromCatalog(pendingPrices.current);
      return;
    }
    if (!catalogSeeded.current || catalogJustArrived) {
      seedFromCatalog();
      catalogSeeded.current = true;
    }
  }, [itemsResponse, groupsResponse, selectedId, catalog]);

  const visible = useMemo(() => {
    return lines.filter((row) => {
      if (applied.groupId && row.categoryId && row.categoryId !== applied.groupId) {
        return false;
      }
      if (applied.unpriced) {
        const priced = Boolean(row.purchasePrice.trim() || row.salePrice.trim());
        if (priced) return false;
      }
      if (applied.search.trim()) {
        const q = applied.search.trim();
        if (!`${row.itemCode} ${row.itemName}`.includes(q)) return false;
      }
      return true;
    });
  }, [lines, applied]);

  const applyFilters = () => {
    setApplied({
      groupId: filterGroupId,
      unpriced: unpricedOnly,
      search,
    });
  };

  const showAll = () => {
    setFilterGroupId('');
    setUnpricedOnly(false);
    setSearch('');
    setApplied({ groupId: '', unpriced: false, search: '' });
  };

  const applyPercentToTable = (raw: string, direction: 'down' | 'up') => {
    const pct = num(raw);
    if (pct == null || pct < 0) {
      setError(direction === 'down' ? 'أدخل نسبة الخصم أولاً' : 'أدخل نسبة الزيادة أولاً');
      return;
    }
    const factor = direction === 'down' ? 1 - pct / 100 : 1 + pct / 100;
    if (!Number.isFinite(factor) || factor < 0) {
      setError('النسبة غير صالحة');
      return;
    }
    setError('');
    setLines((prev) =>
      prev.map((row) => ({
        ...row,
        purchasePrice: scalePrice(row.purchasePrice, factor),
        salePrice: scalePrice(row.salePrice, factor),
      }))
    );
    setSuccess(
      direction === 'down'
        ? `تم خصم ${pct}% من أسعار كل الأصناف`
        : `تم زيادة أسعار كل الأصناف بنسبة ${pct}%`
    );
  };

  const handleCopyFrom = async () => {
    if (!copySourceId) {
      setError('اختر قائمة للنسخ منها');
      return;
    }
    setError('');
    try {
      const res = await apiClient.get<PriceListRow & { prices?: ApiPrice[] }>(
        `/inventory/price-lists/${copySourceId}`
      );
      seedFromCatalog(
        (res.data?.prices ?? []).map((row) => ({ ...row, id: row.id }))
      );
      setShowCopy(false);
      setSuccess('تم نسخ الأسعار — احفظ لتثبيت القائمة');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر النسخ من القائمة');
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (selectedId && isReadOnly) {
      setError('اضغط تعديل أولاً قبل حفظ التغييرات');
      return;
    }
    if (!form.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    const priced = lines.filter(
      (row) =>
        row.itemId &&
        row.unitId &&
        (row.purchasePrice.trim() || row.salePrice.trim())
    );
    if (!priced.length) {
      setError('أدخل سعر شراء أو بيع لصنف واحد على الأقل قبل الحفظ.');
      return;
    }
    const body = {
      code: form.code || undefined,
      arabicName: form.arabicName.trim(),
      englishName: form.englishName || undefined,
      description: form.description || undefined,
      discountPercentage: num(form.discountPercentage),
      currencyCode: form.currencyCode || undefined,
      priceMode: form.priceMode,
    };
    const prices = priced.map((row) => {
      const sale = num(row.salePrice) ?? 0;
      return {
        id: row.id,
        itemId: row.itemId,
        unitId: row.unitId,
        price: sale,
        discount: num(row.discount),
        purchasePrice: num(row.purchasePrice),
        retailPrice: sale,
      };
    });
    setSaving(true);
    try {
      let id = selectedId;
      if (id) {
        await apiClient.put(`/inventory/price-lists/${id}`, body);
      } else {
        const created = await apiClient.post<PriceListRow>('/inventory/price-lists', body);
        id = created.data?.id ?? null;
        if (id) setSelectedId(id);
      }
      if (!id) throw new Error('تعذر حفظ قائمة الأسعار');
      await apiClient.put<PriceListRow & { prices?: ApiPrice[] }>(
        `/inventory/price-lists/${id}/prices`,
        { replace: true, prices }
      );
      invalidateQuery(['price-lists']);
      invalidateQuery(['price-list']);
      handleNew();
      setSuccess('تم حفظ قائمة الأسعار — تقدر تضيف التالي');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('حذف قائمة الأسعار؟'))) return;
    setError('');
    try {
      await apiClient.delete(`/inventory/price-lists/${selectedId}`);
      handleNew();
      setSuccess('تم حذف القائمة');
      invalidateQuery(['price-lists']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
    }
  };

  useEffect(() => {
    setApplied((prev) => ({ ...prev, search }));
  }, [search]);

  const barcodeItemIds = lines.map((r) => r.itemId).filter(Boolean);

  return (
    <MasterCardShell
      title="قوائم الأسعار"
      breadcrumbs={[
        { label: 'المخازن', href: '/inventory' },
        { label: 'التعريفات' },
        { label: 'قوائم الأسعار' },
      ]}
      docNumber={form.code || 'جديد'}
      statusLabel={
        selectedId ? (isReadOnly ? 'عرض — اضغط تعديل' : 'تعديل') : 'جديد'
      }
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving && !(selectedId && isReadOnly)}
      onNew={handleNew}
      currentId={selectedId}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/inventory/creations/price-lists"
      moreMenuItems={[
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
        {
          id: 'print-barcode',
          label: 'طباعة الباركود',
          onClick: () => setShowPrint(true),
          disabled: barcodeItemIds.length === 0,
        },
        {
          id: 'copy-list',
          label: 'نسخ من قائمة أسعار',
          onClick: () => setShowCopy(true),
          disabled: Boolean(selectedId && isReadOnly),
        },
      ]}
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <fieldset disabled={Boolean(selectedId && isReadOnly)} className="min-w-0 border-0 p-0">
      <FormSectionCard title="بيانات القائمة" subtitle="الكود والأسماء والعملة ونسب الخصم والزيادة" icon={Tags}>
        <CompactFormField label="الكود" value={form.code} onChange={(e) => patch({ code: e.target.value })} />
        <CompactFormField
          label="الاسم العربي"
          required
          value={form.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={form.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
        />
        <CompactFormField
          label="الوصف"
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
        <div className="flex min-w-0 items-end gap-2">
          <CompactFormField
            className="flex-1"
            label="نسبة الخصم"
            type="number"
            step="0.01"
            min="0"
            value={form.discountPercentage}
            onChange={(e) => patch({ discountPercentage: e.target.value })}
            suffix="%"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => applyPercentToTable(form.discountPercentage, 'down')}
          >
            تطبيق الخصم
          </Button>
        </div>
        <div className="flex min-w-0 items-end gap-2">
          <CompactFormField
            className="flex-1"
            label="نسبة الزيادة"
            type="number"
            step="0.01"
            min="0"
            value={form.markupPercentage}
            onChange={(e) => patch({ markupPercentage: e.target.value })}
            suffix="%"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => applyPercentToTable(form.markupPercentage, 'up')}
          >
            تطبيق الزيادة
          </Button>
        </div>
        <CompactFormField label="العملة">
          <select
            className={compactControlClass}
            value={form.currencyCode}
            onChange={(e) => patch({ currencyCode: e.target.value })}
          >
            <option value="">اختر العملة</option>
            {currencies.map((c) => (
              <option key={c.id} value={c.code}>
                {c.arabicName} ({c.code})
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#E6F0F7] bg-white p-3">
        <span className="text-sm font-semibold text-[#0A3D5E]">الأسعار</span>
        {(
          [
            ['value', 'قيمة'],
            ['cost', 'نسبة من التكلفة'],
            ['last', 'نسبة من آخر شراء'],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={form.priceMode === mode}
            onClick={() => patch({ priceMode: mode })}
            className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
              form.priceMode === mode
                ? 'border-[#0E78AA] bg-[#E8F4FA] text-[#0E78AA]'
                : 'border-[#D6EAF3] bg-white text-[#0A3D5E] hover:bg-[#F6FBFD]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <FilterToolbar searchPlaceholder="بحث بكود أو اسم الصنف…" onSearchChange={setSearch}>
        <select
          className={`${compactControlClass} w-44`}
          value={filterGroupId}
          onChange={(e) => setFilterGroupId(e.target.value)}
          aria-label="المجموعة"
        >
          <option value="">كل المجموعات</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.arabicName}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={unpricedOnly}
            onChange={(e) => setUnpricedOnly(e.target.checked)}
          />
          الأصناف غير المسعّرة
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={applyFilters}>
          تطبيق
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={showAll}>
          عرض الكل
        </Button>
      </FilterToolbar>

      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<PriceLine>
          isLoading={loadingDetail || catalogLoading}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد أصناف في دليل الأصناف"
          emptyDescription="أضف الأصناف من دليل الأصناف ثم ارجع لتسعيرها هنا."
          virtualizeThreshold={10_000}
          columns={[
            {
              id: 'n',
              header: 'م',
              align: 'center',
              className: cellCls,
              cell: (row) => visible.indexOf(row) + 1,
            },
            {
              id: 'code',
              header: 'كود الصنف',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => row.itemCode || '—',
            },
            {
              id: 'item',
              header: 'اسم الصنف',
              className: `${cellCls} min-w-[220px]`,
              cell: (row) => row.itemName || '—',
            },
            {
              id: 'unit',
              header: 'الوحدة',
              className: `${cellCls} min-w-[90px]`,
              cell: (row) => row.unitName || '—',
            },
            {
              id: 'discount',
              header: 'الخصم',
              className: `${cellCls} min-w-[90px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.discount}
                  onChange={(e) => patchLine(row.key, { discount: e.target.value })}
                />
              ),
            },
            {
              id: 'purchase',
              header: 'سعر الشراء',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.purchasePrice}
                  onChange={(e) => patchLine(row.key, { purchasePrice: e.target.value })}
                />
              ),
            },
            {
              id: 'sale',
              header:
                form.priceMode === 'cost'
                  ? 'سعر البيع (% من التكلفة)'
                  : form.priceMode === 'last'
                    ? 'سعر البيع (% من آخر شراء)'
                    : 'سعر البيع',
              className: `${cellCls} min-w-[110px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.salePrice}
                  onChange={(e) => patchLine(row.key, { salePrice: e.target.value })}
                />
              ),
            },
          ]}
        />
      </section>

      </fieldset>

      <BarcodePrintModal
        open={showPrint}
        onClose={() => setShowPrint(false)}
        initialItemIds={barcodeItemIds}
      />

      <DocumentBrowseDrawer
        open={showGuide}
        onClose={() => setShowGuide(false)}
        title="قوائم الأسعار السابقة"
      >
        <PriceListsListSection
          onSelect={(row) => {
            applyRow(row);
            setShowGuide(false);
          }}
          selectedId={selectedId}
        />
      </DocumentBrowseDrawer>

      {showCopy && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-[#0A3D5E]">نسخ من قائمة أسعار</h2>
            <select
              className={compactControlClass}
              value={copySourceId}
              onChange={(e) => setCopySourceId(e.target.value)}
            >
              <option value="">اختر القائمة المصدر</option>
              {allLists
                .filter((l) => l.id !== selectedId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code ? `${l.code} — ` : ''}
                    {l.arabicName}
                  </option>
                ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowCopy(false)}>
                تراجع
              </Button>
              <Button type="button" onClick={() => void handleCopyFrom()}>
                نسخ
              </Button>
            </div>
          </div>
        </div>
      )}
    </MasterCardShell>
  );
}

export default function PriceListsPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <PriceListsPageInner />
    </DocumentModeProvider>
  );
}
