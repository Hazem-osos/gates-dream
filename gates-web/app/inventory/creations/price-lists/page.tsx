'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { ItemGroupSelect } from '@/app/components/form/ItemGroupSelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { fetchAllPages } from '@/lib/api/fetch-all-pages';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCompanyContextReady } from '@/lib/hooks/useTenantContextReady';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/query-keys';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { asItemList } from '@/lib/inventory/guide-visible-items';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { exportRowsToExcel } from '@/lib/export/export-utils';

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
  categoryName: string;
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

type ItemGroup = {
  id: string;
  arabicName: string;
  code?: string | null;
  parentCategoryId?: string | null;
};

type CatalogItem = ItemOption & {
  categoryId?: string | null;
  category?: { id?: string; arabicName?: string | null } | null;
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

function priceColumnTitle(base: 'سعر الشراء' | 'سعر البيع', mode: PriceMode): string {
  if (mode === 'cost') return `${base} (% من التكلفة)`;
  if (mode === 'last') return `${base} (% من آخر شراء)`;
  return base;
}

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

const PRICE_SHEET_HEADERS = ['كود الصنف', 'اسم الصنف', 'المجموعة', 'الوحدة', 'الخصم', 'سعر الشراء', 'سعر البيع'];

const PRICE_SHEET_FIELDS: Record<string, 'code' | 'name' | 'discount' | 'purchase' | 'sale'> = {
  'كود الصنف': 'code',
  'رقم الصنف': 'code',
  الكود: 'code',
  code: 'code',
  serial: 'code',
  'اسم الصنف': 'name',
  'الإسم العربي': 'name',
  'الاسم العربي': 'name',
  الخصم: 'discount',
  discount: 'discount',
  'سعر الشراء': 'purchase',
  purchasePrice: 'purchase',
  'سعر البيع': 'sale',
  السعر: 'sale',
  price: 'sale',
  salesPrice: 'sale',
};

type SheetPricePatch = {
  discount?: string;
  purchasePrice?: string;
  salePrice?: string;
};

function sheetCell(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function parsePriceSheet(matrix: unknown[][]): Array<Record<'code' | 'name' | 'discount' | 'purchase' | 'sale', string>> {
  if (matrix.length < 2) return [];
  const headers = (matrix[0] as unknown[]).map((cell) => sheetCell(cell));
  return matrix.slice(1).flatMap((raw) => {
    const values = raw as unknown[];
    const row = { code: '', name: '', discount: '', purchase: '', sale: '' };
    let touched = false;
    headers.forEach((header, index) => {
      const field = PRICE_SHEET_FIELDS[header];
      if (!field) return;
      const text = sheetCell(values[index]);
      if (!text) return;
      row[field] = text;
      touched = true;
    });
    return touched ? [row] : [];
  });
}

function applyPriceSheet(lines: PriceLine[], rows: ReturnType<typeof parsePriceSheet>) {
  const byCode = new Map<string, string[]>();
  const byName = new Map<string, string[]>();
  for (const line of lines) {
    const code = line.itemCode.trim().toLowerCase();
    const name = line.itemName.trim();
    if (code) byCode.set(code, [...(byCode.get(code) ?? []), line.key]);
    if (name) byName.set(name, [...(byName.get(name) ?? []), line.key]);
  }
  const updates = new Map<string, SheetPricePatch>();
  let missed = 0;
  for (const row of rows) {
    const hits =
      (row.code && byCode.get(row.code.trim().toLowerCase())) ||
      (row.name && byName.get(row.name.trim())) ||
      [];
    if (!hits.length) {
      missed += 1;
      continue;
    }
    for (const key of hits) {
      const prev = updates.get(key) ?? {};
      updates.set(key, {
        discount: row.discount || prev.discount,
        purchasePrice: row.purchase || prev.purchasePrice,
        salePrice: row.sale || prev.salePrice,
      });
    }
  }
  const next = lines.map((line) => {
    const patch = updates.get(line.key);
    if (!patch) return line;
    return {
      ...line,
      discount: patch.discount ?? line.discount,
      purchasePrice: patch.purchasePrice ?? line.purchasePrice,
      salePrice: patch.salePrice ?? line.salePrice,
    };
  });
  return { next, matched: updates.size, missed };
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

function categoryIdsInGroup(rootId: string, groups: ItemGroup[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const group of groups) {
    if (!group.parentCategoryId) continue;
    const list = children.get(group.parentCategoryId) ?? [];
    list.push(group.id);
    children.set(group.parentCategoryId, list);
  }
  const ids = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    for (const child of children.get(id) ?? []) stack.push(child);
  }
  return ids;
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
    categoryName: item.category?.arabicName ?? '',
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
  return items
    .map((item) => {
      const unit = pickUnit(item);
      const match = byItemUnit.get(`${item.id}:${unit.unitId}`) ?? byItem.get(item.id);
      return lineFromCatalog(item, match, discount);
    })
    .sort((a, b) => {
      const byGroup = a.categoryName.localeCompare(b.categoryName, 'ar');
      if (byGroup) return byGroup;
      return a.itemName.localeCompare(b.itemName, 'ar');
    });
}

function PriceListsPageInner() {
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<PriceLine[]>([]);
  const [filterGroupId, setFilterGroupId] = useState('');
  const [filterItemId, setFilterItemId] = useState('');
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [applied, setApplied] = useState({ groupId: '', itemId: '', unpriced: false, search: '' });
  const [search, setSearch] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [markupPct, setMarkupPct] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [copySourceId, setCopySourceId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const catalogSeeded = useRef(false);
  const lastCatalogLen = useRef(0);
  const pendingPrices = useRef<ApiPrice[] | undefined>(undefined);
  const priceSheetRef = useRef<HTMLInputElement>(null);
  const [sheetBusy, setSheetBusy] = useState(false);

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    queryKeys.currencies,
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = currenciesResponse?.data ?? [];

  const { data: groupsResponse } = useApiQuery<ItemGroup[]>(
    queryKeys.itemCategories({ limit: 1000, guide: true }),
    '/inventory/item-categories',
    { limit: 1000, isActive: true }
  );
  const groups = asItemList<ItemGroup>(groupsResponse?.data);

  const { data: listsResponse } = useApiQuery<PriceListRow[]>(
    queryKeys.priceLists({ picker: true }),
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const allLists = listsResponse?.data ?? [];

  const companyReady = useCompanyContextReady();
  const catalogQuery = useQuery({
    queryKey: ['items', 'price-list-catalog', 'all'],
    enabled: companyReady,
    queryFn: ({ signal }) => fetchAllPages<CatalogItem>('/inventory/items', { isActive: true }, signal),
  });
  const catalog = catalogQuery.data ?? [];
  const catalogLoading = catalogQuery.isLoading;

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

  const loadList = async (id: string, afterLoad: 'view' | 'edit' = 'view') => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await apiClient.get<PriceListRow & { prices?: ApiPrice[] }>(
        `/inventory/price-lists/${id}`
      );
      if (res.data) {
        setSelectedId(res.data.id);
        hydrateFromDetail(res.data);
        if (afterLoad === 'view') lockToView();
        else unlockForEdit();
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
    setFilterItemId('');
    setUnpricedOnly(false);
    setApplied({ groupId: '', itemId: '', unpriced: false, search: '' });
    setError('');
    setSuccess('');
    setMode('create');
  };

  useEffect(() => {
    const loaded = catalogQuery.data;
    if (!loaded) return;
    const catalogJustArrived = lastCatalogLen.current === 0 && loaded.length > 0;
    lastCatalogLen.current = loaded.length;
    if (selectedId) {
      if (catalogJustArrived) seedFromCatalog(pendingPrices.current);
      return;
    }
    if (!catalogSeeded.current || catalogJustArrived) {
      seedFromCatalog();
      catalogSeeded.current = true;
    }
  }, [catalogQuery.data, selectedId, catalog]);

  const visible = useMemo(() => {
    const groupIds = applied.groupId ? categoryIdsInGroup(applied.groupId, groups) : null;
    return lines.filter((row) => {
      if (groupIds && !groupIds.has(row.categoryId)) return false;
      if (applied.itemId && row.itemId !== applied.itemId) return false;
      if (applied.unpriced) {
        const priced = Boolean(row.purchasePrice.trim() || row.salePrice.trim());
        if (priced) return false;
      }
      if (applied.search.trim()) {
        const q = applied.search.trim();
        if (!`${row.itemCode} ${row.itemName} ${row.categoryName}`.includes(q)) return false;
      }
      return true;
    });
  }, [lines, applied, groups]);

  const exportPriceSheet = async () => {
    setError('');
    setSheetBusy(true);
    try {
      const rows = visible.map((row) => [
        row.itemCode,
        row.itemName,
        row.categoryName || 'بدون مجموعة',
        row.unitName,
        row.discount,
        num(row.purchasePrice) ?? '',
        num(row.salePrice) ?? '',
      ]);
      const name = form.code.trim() || form.arabicName.trim() || 'prices';
      await exportRowsToExcel(`price-list-${name}.xlsx`, PRICE_SHEET_HEADERS, rows, 'الأسعار');
      setSuccess(`تم تنزيل ${rows.length} صنف من المعروض.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تنزيل الشيت');
    } finally {
      setSheetBusy(false);
    }
  };

  const importPriceSheet = async (file: File) => {
    if (selectedId && isReadOnly) {
      setError('اضغط تعديل أولاً قبل استيراد الأسعار');
      return;
    }
    setError('');
    setSheetBusy(true);
    try {
      const XLSX = await import(/* webpackChunkName: "xlsx" */ 'xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        setError('الملف لا يحتوي على ورقة عمل');
        return;
      }
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
      const parsed = parsePriceSheet(matrix);
      if (!parsed.length) {
        setError('الشيت فاضي أو الأعمدة مش كود الصنف واسم الصنف وسعر الشراء وسعر البيع');
        return;
      }
      const { next, matched, missed } = applyPriceSheet(lines, parsed);
      if (!matched) {
        setError('مفيش صنف في الشيت مطابق لكود أو اسم في القائمة');
        return;
      }
      setLines(next);
      setSuccess(
        missed
          ? `اتحطت أسعار ${matched} صنف. ${missed} صف في الشيت مش لاقي صنف مطابق.`
          : `اتحطت أسعار ${matched} صنف من الشيت. احفظ لتثبيت القائمة.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر قراءة شيت الأسعار');
    } finally {
      setSheetBusy(false);
    }
  };

  const showAll = () => {
    setFilterGroupId('');
    setFilterItemId('');
    setUnpricedOnly(false);
    setSearch('');
    setApplied({ groupId: '', itemId: '', unpriced: false, search: '' });
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
    if (direction === 'up') {
      setError('');
      setMarkupPct(pct);
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
    setSuccess(`تم خصم ${pct}% من أسعار كل الأصناف`);
  };

  const applyMarkup = (target: 'purchase' | 'sale') => {
    const pct = markupPct;
    if (pct == null) return;
    const factor = 1 + pct / 100;
    setLines((prev) =>
      prev.map((row) =>
        target === 'purchase'
          ? { ...row, purchasePrice: scalePrice(row.purchasePrice, factor) }
          : { ...row, salePrice: scalePrice(row.salePrice, factor) }
      )
    );
    setMarkupPct(null);
    setSuccess(
      target === 'purchase'
        ? `تم زيادة سعر الشراء بنسبة ${pct}%`
        : `تم زيادة سعر البيع بنسبة ${pct}%`
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
      const wasUpdate = Boolean(selectedId);
      let id = selectedId;
      if (id) {
        await apiClient.put(`/inventory/price-lists/${id}`, body);
      } else {
        const created = await apiClient.post<PriceListRow>('/inventory/price-lists', body);
        id = created.data?.id ?? null;
      }
      if (!id) throw new Error('تعذر حفظ قائمة الأسعار');
      await apiClient.put<PriceListRow & { prices?: ApiPrice[] }>(
        `/inventory/price-lists/${id}/prices`,
        { replace: true, prices }
      );
      invalidateStockViews(invalidateQuery);
      invalidateQuery(['price-lists']);
      invalidateQuery(['price-list']);
      if (wasUpdate) {
        finishDocumentSave({
          label: 'قائمة أسعار',
          number: form.code,
          savedId: id,
          onOpen: (saved) => {
            void loadList(saved, 'edit');
          },
          cleared: false,
          reset: () => undefined,
        });
      } else {
        finishDocumentSave({
          label: 'قائمة أسعار',
          number: form.code,
          savedId: id,
          onOpen: (saved) => void loadList(saved, 'edit'),
          reset: handleNew,
        });
      }
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
      onEdit={() => {
        if (!selectedId) return;
        unlockForEdit();
      }}
      editDisabled={!selectedId || !isReadOnly}
      onBrowseList={() => setShowGuide(true)}
      favoriteHref="/inventory/creations/price-lists"
      moreMenuItems={[
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

      {selectedId && isReadOnly ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          القائمة في وضع العرض. اضغط تعديل قبل تغيير الأسعار أو استيراد الشيت.
        </p>
      ) : null}

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
      </fieldset>

      <FilterToolbar searchPlaceholder="بحث بكود أو اسم الصنف أو المجموعة…" onSearchChange={setSearch}>
        <div className="w-52">
          <ItemGroupSelect
            value={filterGroupId}
            groups={groups}
            emptyLabel="كل المجموعات"
            onChange={(id) => {
              setFilterGroupId(id);
              setApplied((prev) => ({ ...prev, groupId: id }));
            }}
          />
        </div>
        <div className="w-56">
          <ItemSelect
            value={filterItemId}
            allowEmpty
            emptyLabel="كل الأصناف"
            enableQuickCreate={false}
            onChange={(id) => {
              setFilterItemId(id);
              setApplied((prev) => ({ ...prev, itemId: id }));
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={unpricedOnly}
            onChange={(e) => {
              const unpriced = e.target.checked;
              setUnpricedOnly(unpriced);
              setApplied((prev) => ({ ...prev, unpriced }));
            }}
          />
          الأصناف غير المسعّرة
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={showAll}>
          عرض الكل
        </Button>
        <Button type="button" variant="secondary" size="sm" isLoading={sheetBusy} onClick={() => void exportPriceSheet()}>
          تصدير إكسيل
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={sheetBusy}
          disabled={Boolean(selectedId && isReadOnly)}
          onClick={() => priceSheetRef.current?.click()}
        >
          استيراد إكسيل
        </Button>
        <input
          ref={priceSheetRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importPriceSheet(file);
          }}
        />
      </FilterToolbar>

      <fieldset disabled={Boolean(selectedId && isReadOnly)} className="min-w-0 border-0 p-0">
      <section className="mb-4 mt-4 overflow-visible rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm">
        <AppTable<PriceLine>
          isLoading={loadingDetail || catalogLoading}
          data={visible}
          getRowKey={(r) => r.key}
          emptyTitle={
            filterGroupId || filterItemId || unpricedOnly || search.trim()
              ? 'لا توجد أصناف مطابقة للتصنيف'
              : 'لا توجد أصناف في دليل الأصناف'
          }
          emptyDescription={
            filterGroupId || filterItemId || unpricedOnly || search.trim()
              ? 'غيّر المجموعة أو الصنف، أو اضغط «عرض الكل».'
              : 'أضف الأصناف من دليل الأصناف ثم ارجع لتسعيرها هنا.'
          }
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
              id: 'group',
              header: 'المجموعة',
              className: `${cellCls} min-w-[140px]`,
              cell: (row) => row.categoryName || 'بدون مجموعة',
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
              header: priceColumnTitle('سعر الشراء', form.priceMode),
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
              header: priceColumnTitle('سعر البيع', form.priceMode),
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

      {markupPct != null && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-bold text-[#0A3D5E]">تطبيق الزيادة {markupPct}%</h2>
            <p className="mb-5 text-sm text-[#0A3D5E]">الزيادة تتنزّل على سعر الشراء ولا سعر البيع؟</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setMarkupPct(null)}>
                تراجع
              </Button>
              <Button type="button" variant="secondary" onClick={() => applyMarkup('purchase')}>
                سعر الشراء
              </Button>
              <Button type="button" onClick={() => applyMarkup('sale')}>
                سعر البيع
              </Button>
            </div>
          </div>
        </div>
      )}

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
