'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Tags, Trash2 } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  AppTable,
  FilterToolbar,
  compactControlClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { ItemSelect } from '@/components/form/ItemSelect';
import {
  PriceListsListSection,
  type PriceListRow,
} from '@/components/inventory/PriceListsListSection';
import { BarcodePrintModal } from '@/app/components/print/BarcodePrintModal';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type PriceMode = 'value' | 'cost' | 'last';

type FormState = {
  code: string;
  arabicName: string;
  englishName: string;
  description: string;
  discountPercentage: string;
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
  wholesale: string;
  semiWholesale: string;
  exportPrice: string;
  representativePrice: string;
  retailPrice: string;
  consumerPrice: string;
  [key: string]: unknown;
};

type ApiPrice = {
  id: string;
  itemId: string;
  unitId: string;
  price?: number | string | null;
  discount?: number | string | null;
  wholesale?: number | string | null;
  semiWholesale?: number | string | null;
  exportPrice?: number | string | null;
  representativePrice?: number | string | null;
  retailPrice?: number | string | null;
  consumerPrice?: number | string | null;
  item?: {
    id?: string;
    code?: string | null;
    arabicName?: string;
    categoryId?: string | null;
    priceWholesale?: number | string | null;
    priceSemiWholesale?: number | string | null;
    exportPrice?: number | string | null;
    representativePrice?: number | string | null;
    priceRetail?: number | string | null;
    consumerPrice?: number | string | null;
  };
  unit?: { id?: string; arabicName?: string };
};

type CatalogItem = ItemOption & {
  categoryId?: string | null;
  priceWholesale?: number | string | null;
  priceSemiWholesale?: number | string | null;
  exportPrice?: number | string | null;
  representativePrice?: number | string | null;
  priceRetail?: number | string | null;
  consumerPrice?: number | string | null;
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
  currencyCode: '',
  priceMode: 'value',
});

const emptyLine = (): PriceLine => ({
  key: crypto.randomUUID(),
  itemId: '',
  itemCode: '',
  itemName: '',
  categoryId: '',
  unitId: '',
  unitName: '',
  discount: '',
  wholesale: '',
  semiWholesale: '',
  exportPrice: '',
  representativePrice: '',
  retailPrice: '',
  consumerPrice: '',
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

function pickUnit(item?: CatalogItem | ItemOption | null): { unitId: string; unitName: string } {
  const units = item?.units ?? [];
  const base = units.find((u) => u.isBaseUnit) ?? units[0];
  return {
    unitId: base?.unitId || base?.unit?.id || '',
    unitName: base?.unit?.arabicName || '',
  };
}

function lineFromApi(row: ApiPrice): PriceLine {
  const item = row.item;
  return {
    key: row.id,
    id: row.id,
    itemId: row.itemId || item?.id || '',
    itemCode: item?.code ?? '',
    itemName: item?.arabicName ?? '',
    categoryId: item?.categoryId ?? '',
    unitId: row.unitId || row.unit?.id || '',
    unitName: row.unit?.arabicName ?? '',
    discount: asText(row.discount),
    wholesale: asText(row.wholesale ?? row.price ?? item?.priceWholesale),
    semiWholesale: asText(row.semiWholesale ?? item?.priceSemiWholesale),
    exportPrice: asText(row.exportPrice ?? item?.exportPrice),
    representativePrice: asText(row.representativePrice ?? item?.representativePrice),
    retailPrice: asText(row.retailPrice ?? item?.priceRetail),
    consumerPrice: asText(row.consumerPrice ?? item?.consumerPrice),
  };
}

function lineFromItem(item: CatalogItem, discount = ''): PriceLine {
  const unit = pickUnit(item);
  return {
    ...emptyLine(),
    itemId: item.id,
    itemCode: item.code ?? '',
    itemName: item.arabicName ?? '',
    categoryId: item.categoryId ?? '',
    unitId: unit.unitId,
    unitName: unit.unitName,
    discount,
    wholesale: asText(item.priceWholesale ?? item.salesPrice),
    semiWholesale: asText(item.priceSemiWholesale),
    exportPrice: asText(item.exportPrice),
    representativePrice: asText(item.representativePrice),
    retailPrice: asText(item.priceRetail),
    consumerPrice: asText(item.consumerPrice),
  };
}

export default function PriceListsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<PriceLine[]>([emptyLine()]);
  const [applyDiscountToAll, setApplyDiscountToAll] = useState(false);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterItemId, setFilterItemId] = useState('');
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [applied, setApplied] = useState({ groupId: '', itemId: '', unpriced: false, search: '' });
  const [search, setSearch] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    queryKeys.currencies,
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data ?? [];

  const { data: groupsResponse } = useApiQuery<{ id: string; arabicName: string }[]>(
    queryKeys.itemCategories({ limit: 200 }),
    '/inventory/item-categories',
    { limit: 200, isActive: true }
  );
  const groups = groupsResponse?.data ?? [];

  const { data: listsResponse } = useApiQuery<PriceListRow[]>(
    queryKeys.priceLists({ picker: true }),
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const allLists = listsResponse?.data ?? [];

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));
  const patchLine = (key: string, next: Partial<PriceLine>) => {
    setLines((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
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
      currencyCode: detail.currencyCode ?? '',
      priceMode:
        detail.priceMode === 'cost' || detail.priceMode === 'last' ? detail.priceMode : 'value',
    });
    const next = (detail.prices ?? []).map(lineFromApi);
    setLines(next.length ? next : [emptyLine()]);
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
    setLines([emptyLine()]);
    setApplyDiscountToAll(false);
    setFilterGroupId('');
    setFilterItemId('');
    setUnpricedOnly(false);
    setApplied({ groupId: '', itemId: '', unpriced: false, search: '' });
    setError('');
    setSuccess('');
  };

  const visible = useMemo(() => {
    return lines.filter((row) => {
      if (applied.groupId && row.itemId && row.categoryId && row.categoryId !== applied.groupId) {
        return false;
      }
      if (applied.itemId && row.itemId && row.itemId !== applied.itemId) return false;
      if (applied.unpriced) {
        const priced = Boolean(row.wholesale.trim() || row.retailPrice.trim() || row.consumerPrice.trim());
        if (priced) return false;
      }
      if (applied.search.trim()) {
        const q = applied.search.trim();
        const hay = `${row.itemCode} ${row.itemName}`.includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [lines, applied]);

  const applyFilters = () => {
    setApplied({
      groupId: filterGroupId,
      itemId: filterItemId,
      unpriced: unpricedOnly,
      search,
    });
  };

  const showAll = () => {
    setFilterGroupId('');
    setFilterItemId('');
    setUnpricedOnly(false);
    setSearch('');
    setApplied({ groupId: '', itemId: '', unpriced: false, search: '' });
  };

  const addItemRow = () => setLines((prev) => [...prev, emptyLine()]);

  const applyDiscountAll = () => {
    const pct = form.discountPercentage.trim();
    setLines((prev) => prev.map((row) => ({ ...row, discount: pct })));
    setApplyDiscountToAll(true);
    setSuccess('تم تطبيق نسبة الخصم على كل الأصناف');
  };

  const fillUnpricedFromCatalog = async () => {
    setError('');
    try {
      const params: Record<string, string | number | boolean> = { limit: 300, isActive: true };
      if (filterGroupId) params.categoryId = filterGroupId;
      const res = await apiClient.get<CatalogItem[]>('/inventory/items', params);
      const existing = new Set(lines.map((r) => r.itemId).filter(Boolean));
      const extra = (res.data ?? [])
        .filter((item) => !existing.has(item.id))
        .map((item) => lineFromItem(item, applyDiscountToAll ? form.discountPercentage : ''));
      if (!extra.length) {
        setSuccess('لا توجد أصناف غير مسعّرة ضمن التصفية');
        return;
      }
      setLines((prev) => {
        const kept = prev.filter((r) => r.itemId);
        return [...kept, ...extra];
      });
      setSuccess(`أُضيف ${extra.length} صنفاً غير مسعّر`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر جلب الأصناف غير المسعّرة');
    }
  };

  const handleApply = () => {
    applyFilters();
    if (unpricedOnly) void fillUnpricedFromCatalog();
  };

  const resolveItemOnLine = (key: string, item?: ItemOption | CatalogItem) => {
    if (!item) return;
    const built = lineFromItem(item as CatalogItem, applyDiscountToAll ? form.discountPercentage : '');
    patchLine(key, {
      itemId: built.itemId,
      itemCode: built.itemCode,
      itemName: built.itemName,
      categoryId: built.categoryId,
      unitId: built.unitId || lines.find((r) => r.key === key)?.unitId || '',
      unitName: built.unitName,
      wholesale: built.wholesale,
      semiWholesale: built.semiWholesale,
      exportPrice: built.exportPrice,
      representativePrice: built.representativePrice,
      retailPrice: built.retailPrice,
      consumerPrice: built.consumerPrice,
    });
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
      const incoming = (res.data?.prices ?? []).map(lineFromApi);
      setLines((prev) => {
        const byItem = new Map(prev.filter((r) => r.itemId).map((r) => [`${r.itemId}:${r.unitId}`, r]));
        for (const row of incoming) {
          const key = `${row.itemId}:${row.unitId}`;
          const existing = byItem.get(key);
          if (!existing) {
            byItem.set(key, { ...row, key: crypto.randomUUID(), id: undefined });
            continue;
          }
          byItem.set(key, {
            ...existing,
            discount: existing.discount || row.discount,
            wholesale: existing.wholesale || row.wholesale,
            semiWholesale: existing.semiWholesale || row.semiWholesale,
            exportPrice: existing.exportPrice || row.exportPrice,
            representativePrice: existing.representativePrice || row.representativePrice,
            retailPrice: existing.retailPrice || row.retailPrice,
            consumerPrice: existing.consumerPrice || row.consumerPrice,
          });
        }
        const next = [...byItem.values()];
        return next.length ? next : [emptyLine()];
      });
      setShowCopy(false);
      setSuccess('تم نسخ الأسعار — احفظ لتثبيت القائمة');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر النسخ من القائمة');
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!form.arabicName.trim()) {
      setError('يرجى إدخال الاسم العربي');
      return;
    }
    const priced = lines.filter((row) => row.itemId && row.unitId);
    const missingUnit = lines.find((row) => row.itemId && !row.unitId);
    if (missingUnit) {
      setError(`الصنف «${missingUnit.itemName || missingUnit.itemCode}» بلا وحدة`);
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
      const wholesale = num(row.wholesale) ?? 0;
      return {
        id: row.id,
        itemId: row.itemId,
        unitId: row.unitId,
        price: wholesale,
        discount: applyDiscountToAll ? num(form.discountPercentage) : num(row.discount),
        wholesale,
        semiWholesale: num(row.semiWholesale),
        exportPrice: num(row.exportPrice),
        representativePrice: num(row.representativePrice),
        retailPrice: num(row.retailPrice),
        consumerPrice: num(row.consumerPrice),
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
      const saved = await apiClient.put<PriceListRow & { prices?: ApiPrice[] }>(
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
      statusLabel={selectedId ? 'تعديل' : 'جديد'}
      onSave={() => void handleSave()}
      savePending={saving}
      canSave={!saving}
      onNew={handleNew}
      onDelete={selectedId ? () => void handleDelete() : undefined}
      currentId={selectedId}
      favoriteHref="/inventory/creations/price-lists"
      moreMenuItems={[
        { id: 'pick-items', label: 'اختيار الأصناف', onClick: addItemRow },
        {
          id: 'print-barcode',
          label: 'طباعة الباركود',
          onClick: () => setShowPrint(true),
          disabled: barcodeItemIds.length === 0,
        },
        { id: 'copy-list', label: 'نسخ من قائمة أسعار', onClick: () => setShowCopy(true) },
      ]}
    >
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PriceListsListSection onSelect={applyRow} selectedId={selectedId} />

      <FormSectionCard title="بيانات القائمة" subtitle="الكود والأسماء ونسبة الخصم والعملة" icon={Tags}>
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
        <CompactFormField
          label="نسبة الخصم"
          type="number"
          step="0.01"
          min="0"
          value={form.discountPercentage}
          onChange={(e) => patch({ discountPercentage: e.target.value })}
          suffix="%"
        />
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
        <label className="mr-auto flex items-center gap-2 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={applyDiscountToAll}
            onChange={(e) => setApplyDiscountToAll(e.target.checked)}
          />
          تطبيق على جميع الأصناف
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={applyDiscountAll}>
          تطبيق الخصم
        </Button>
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
        <div className="min-w-[220px]">
          <ItemSelect
            value={filterItemId}
            emptyLabel="كل الأصناف"
            enableQuickCreate={false}
            menuPlacement="bottom"
            onChange={setFilterItemId}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={unpricedOnly}
            onChange={(e) => setUnpricedOnly(e.target.checked)}
          />
          الأصناف غير المسعّرة
        </label>
        <Button type="button" variant="secondary" size="sm" onClick={handleApply}>
          تطبيق
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={showAll}>
          عرض الكل
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={addItemRow}>
          <Plus className="h-4 w-4" />
          صنف
        </Button>
      </FilterToolbar>

      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<PriceLine>
          isLoading={loadingDetail}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle="لا توجد أصناف في القائمة"
          emptyDescription="اختر قائمة محفوظة أو أضف صنفاً من الثلاث نقاط."
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
              cell: (row) => (
                <ItemSelect
                  value={row.itemId}
                  emptyLabel="اختر الصنف"
                  menuPlacement="bottom"
                  onChange={(itemId) => patchLine(row.key, { itemId })}
                  onItemResolved={(item) => resolveItemOnLine(row.key, item as ItemOption)}
                />
              ),
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
              id: 'wholesale',
              header: 'الجملة',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.wholesale}
                  onChange={(e) => patchLine(row.key, { wholesale: e.target.value })}
                />
              ),
            },
            {
              id: 'semi',
              header: 'نصف',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.semiWholesale}
                  onChange={(e) => patchLine(row.key, { semiWholesale: e.target.value })}
                />
              ),
            },
            {
              id: 'export',
              header: 'التصدير',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.exportPrice}
                  onChange={(e) => patchLine(row.key, { exportPrice: e.target.value })}
                />
              ),
            },
            {
              id: 'rep',
              header: 'المندوب',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.representativePrice}
                  onChange={(e) => patchLine(row.key, { representativePrice: e.target.value })}
                />
              ),
            },
            {
              id: 'retail',
              header: 'القطاعي',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.retailPrice}
                  onChange={(e) => patchLine(row.key, { retailPrice: e.target.value })}
                />
              ),
            },
            {
              id: 'consumer',
              header: 'المستهلك',
              className: `${cellCls} min-w-[100px]`,
              cell: (row) => (
                <input
                  className={compactControlClass}
                  type="number"
                  min={0}
                  value={row.consumerPrice}
                  onChange={(e) => patchLine(row.key, { consumerPrice: e.target.value })}
                />
              ),
            },
            {
              id: 'remove',
              header: '',
              align: 'center',
              className: cellCls,
              cell: (row) => (
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() =>
                    setLines((prev) =>
                      prev.length > 1 ? prev.filter((t) => t.key !== row.key) : [emptyLine()]
                    )
                  }
                  aria-label="حذف السطر"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
            },
          ]}
        />
      </section>

      <BarcodePrintModal
        open={showPrint}
        onClose={() => setShowPrint(false)}
        initialItemIds={barcodeItemIds}
      />

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
