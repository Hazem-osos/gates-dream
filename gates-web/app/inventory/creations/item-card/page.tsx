'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ImagePlus, Package, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormStickyFooter,
  FormSectionCard,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { ErpDocumentLayout, MasterCardPageHeader } from '@/components/erp';
import { itemCardFormSchema } from '@/lib/validation/inventory.schema';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useItemCostAsOf } from '@/lib/hooks/useItemCostAsOf';
import { ItemSelect } from '@/components/form/ItemSelect';
import { ItemGroupSelect } from '@/components/form/ItemGroupSelect';
import { QuickCreateItemModal, type QuickCreatedItem } from '@/app/components/form/QuickCreateItemModal';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { UnitSelect } from '@/components/form/UnitSelect';
import { useCompanyGlDefaults } from '@/lib/hooks/useCompanyGlDefaults';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoneyAr } from '@/lib/formatMoney';
import { useItemCardTourPrepare } from '@/lib/onboarding/useItemCardTourPrepare';
import { queryKeys } from '@/lib/query/query-keys';
import { BarcodePrintModal } from '@/app/components/print/BarcodePrintModal';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ItemsCatalogListSection } from '@/components/inventory/ItemsCatalogListSection';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { bumpTrailingCode, isCodeAfter, nextNumericSerial } from '@/lib/masters/nextNumericSerial';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import { readImageFileAsDataUrl } from '@/lib/images/read-image-file';
import {
  applyItemToForm,
  assemblyRowsTotal,
  assemblyUnitFromItem,
  compactAssemblyRows,
  compactSupplierRows,
  EMPTY_ASSEMBLY_ROW,
  EMPTY_ITEM_FORM,
  EMPTY_SUPPLIER_ROW,
  moneyToInput,
  optionalMoney,
  parseAssemblyRows,
  parseSupplierRows,
  type AssemblyRow,
  type ItemCardForm,
  type ItemDetail,
  type ItemUnitRow,
  type SupplierRow,
} from './itemCard.model';

type CategoryRow = {
  id: string;
  arabicName: string;
  code?: string | null;
  parentCategoryId?: string | null;
  groupType?: string | null;
};

function categoryOptionLabel(row: CategoryRow, all: CategoryRow[]): string {
  const self = row.code ? `${row.code} — ${row.arabicName}` : row.arabicName;
  const parent = all.find((item) => item.id === row.parentCategoryId);
  if (!parent) return self;
  return `${parent.arabicName} / ${self}`;
}

type LocalUnitRow = {
  key: string;
  id?: string;
  unitId: string;
  conversionFactor: string;
  isFactorFixed: boolean;
  isBaseUnit: boolean;
};

function toLocalUnitRows(rows: ItemUnitRow[]): LocalUnitRow[] {
  return rows.map((row, idx) => ({
    key: row.id ?? `unit-${idx}`,
    unitId: row.unitId ?? row.unit?.id ?? '',
    conversionFactor: String(row.conversionFactor ?? 1),
    isFactorFixed: row.isFactorFixed !== false,
    isBaseUnit: Boolean(row.isBaseUnit),
    id: row.id,
  }));
}

function emptyBaseUnitRow(unitId = ''): LocalUnitRow {
  return {
    key: 'base',
    unitId,
    conversionFactor: '1',
    isFactorFixed: true,
    isBaseUnit: true,
  };
}

const TABS = [
  { id: 'general', label: 'عام', hint: 'المواصفات والوزن وخصائص الصنف' },
  { id: 'units-prices', label: 'الوحدات والأسعار', hint: 'الوحدة الأساسية من هنا وتتقفل بعد الحفظ. الأسعار من قائمة الأسعار.' },
  { id: 'options', label: 'خيارات', hint: 'الضريبة، القيود، والصورة' },
  { id: 'quantities', label: 'الكميات', hint: 'حدود المخزون والرصيد الافتتاحي' },
  { id: 'assembly', label: 'تجميعي', hint: 'عادي أو تجميعي، ثم المكونات لو تجميعي' },
  { id: 'order-plan', label: 'نقطة إعادة الطلب', hint: 'الموردون ومدة التوريد' },
] as const;

const OPTION_FLAGS = [
  ['useExpirationDate', 'استخدام تاريخ الصلاحية'],
  ['inactiveItem', 'صنف غير نشط'],
  ['notSubjectToTerms', 'لا يخضع للعروض والخصومات'],
  ['cannotBeReturned', 'لا يمكن إرجاعه'],
  ['noSellBelowCost', 'عدم السماح بالبيع أقل من سعر التكلفة'],
  ['useSerialNumber', 'استخدام سيريال'],
  ['clothingItem', 'ألوان ومقاسات'],
] as const;

const inputCls = compactControlClass;
const labelCls = 'mb-1 flex items-center gap-1 text-xs font-semibold text-slate-600';
const checkboxCls =
  'h-4 w-4 rounded border-[#0E78AA] text-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/20';

function ChoicePills<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={`${
            value === opt.value
              ? 'border-[#0E78AA] bg-[#0E78AA] text-white'
              : 'border-[#D6EAF3] bg-white text-[#0A3D5E]'
          } inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={disabled}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

function ItemImageUploader({
  value,
  onChange,
  onError,
}: {
  value: string;
  onChange: (url: string) => void;
  onError: (message: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlValue = value.startsWith('data:') ? '' : value;

  const readFile = (file: File | undefined) => {
    if (!file) return;
    void readImageFileAsDataUrl(file)
      .then(onChange)
      .catch((error) => {
        onError(error instanceof Error ? error.message : 'تعذر رفع الصورة');
      });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          readFile(e.dataTransfer.files?.[0]);
        }}
        className={`group relative flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
          dragOver
            ? 'border-[#0E78AA] bg-[#E8F4FA]'
            : value
              ? 'border-[#D6EAF3] bg-white'
              : 'border-[#D6EAF3] bg-[#F6FBFD] hover:border-[#0E78AA] hover:bg-[#EEF7FB]'
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="صورة الصنف" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            <span className="relative z-10 mt-auto mb-3 hidden rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#0A3D5E] shadow-sm group-hover:inline-flex">
              تغيير الصورة
            </span>
          </>
        ) : (
          <>
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0E78AA] shadow-sm">
              <ImagePlus className="h-7 w-7" />
            </span>
            <p className="text-sm font-bold text-[#0A3D5E]">اسحب الصورة هنا</p>
            <p className="mt-1 text-xs text-slate-500">أو اضغط للاختيار · JPG / PNG — تتصغّر تلقائيًا</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => readFile(e.target.files?.[0])}
        />
      </button>
      <div className="flex flex-col justify-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            رفع صورة
          </Button>
          {value ? (
            <Button type="button" variant="secondary" onClick={() => onChange('')}>
              <X className="h-4 w-4" />
              حذف
            </Button>
          ) : null}
        </div>
        <CompactFormField
          label="أو الصق رابط الصورة"
          value={urlValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
        <p className="text-xs text-slate-500">المعاينة تظهر فوراً. الصورة تتصغّر قبل الحفظ عشان JPG العادي يعدي.</p>
      </div>
    </div>
  );
}

function TabPanel({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4">
        <h2 className="text-sm font-bold text-zinc-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </header>
      {children}
    </section>
  );
}

function ItemCardPageInner() {
  const invalidateQuery = useInvalidateQuery();
  const router = useRouter();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const quickCreate = useQuickCreateHost('item');
  const [activeTab, setActiveTab] = useState('general');
  useItemCardTourPrepare(setActiveTab);
  const [itemType, setItemType] = useState('normal');
  const [showPrint, setShowPrint] = useState(false);
  const [showFinder, setShowFinder] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParentId, setNewGroupParentId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [lookup, setLookup] = useState('');
  const [plainItemModal, setPlainItemModal] = useState<{ open: boolean; name: string; rowIdx: number }>({
    open: false,
    name: '',
    rowIdx: 0,
  });
  const hydratedIdRef = useRef<string | null>(null);

  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;
  const companyPriceSource =
    settingsRes?.data?.general?.itemPriceSource === 'item_card' ? 'item_card' : 'price_list';
  const itemRecordCount = settingsRes?.data?.general?.numberingRecordCounts?.items ?? 0;
  const [formData, setFormData] = useState<ItemCardForm>({ ...EMPTY_ITEM_FORM });
  const [assemblyRows, setAssemblyRows] = useState<AssemblyRow[]>(
    parseAssemblyRows(undefined)
  );
  const [supplierRows, setSupplierRows] = useState<SupplierRow[]>(
    parseSupplierRows(undefined)
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedItemId, setSavedItemId] = useState<string | null>(null);
  const searchParams = useOwnTabSearchParams();
  const itemIdFromUrl = searchParams.get('id');
  const activeItemId = savedItemId ?? itemIdFromUrl;

  const { data: itemDetailResponse } = useApiQuery<ItemDetail>(
    ['item', activeItemId],
    activeItemId ? `/inventory/items/${activeItemId}` : '/inventory/items',
    undefined,
    { enabled: !!activeItemId }
  );
  const itemDetail = itemDetailResponse?.data;

  const { data: categoriesResponse } = useApiQuery<CategoryRow[]>(
    queryKeys.itemCategories({ limit: 200 }),
    '/inventory/item-categories',
    { limit: 200, isActive: true }
  );
  const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];
  const { data: unitsResponse } = useApiQuery<{ id: string; arabicName: string; code?: string | null }[]>(
    ['units', 'item-card'],
    '/inventory/units',
    { limit: 500, isActive: true }
  );
  const units = unitsResponse?.data ?? [];

  const { data: itemsSerialRes } = useApiQuery<{ serial?: string | null }[]>(
    ['items', 'serials'],
    '/inventory/items',
    { limit: 500, isActive: true },
    { enabled: itemAuto && !activeItemId }
  );
  const nextItemSerial = nextNumericSerial((itemsSerialRes?.data ?? []).map((row) => row.serial));

  useEffect(() => {
    if (!itemAuto || activeItemId) return;
    setFormData((prev) => {
      if (prev.serial && isCodeAfter(prev.serial, nextItemSerial)) return prev;
      return prev.serial === nextItemSerial ? prev : { ...prev, serial: nextItemSerial };
    });
  }, [activeItemId, itemAuto, nextItemSerial]);

  useEffect(() => {
    if (!quickCreate.prefillName || activeItemId) return;
    setFormData((prev) => (prev.arabicName ? prev : { ...prev, arabicName: quickCreate.prefillName }));
  }, [activeItemId, quickCreate.prefillName]);

  const [localUnits, setLocalUnits] = useState<LocalUnitRow[]>([emptyBaseUnitRow()]);
  const [unitsHydratedFor, setUnitsHydratedFor] = useState<string | null>(null);
  const [unitBusyKey, setUnitBusyKey] = useState<string | null>(null);

  type ItemCardDraft = {
    formData: ItemCardForm;
    assemblyRows: AssemblyRow[];
    supplierRows: SupplierRow[];
    localUnits: LocalUnitRow[];
    itemType: string;
    activeTab: string;
  };

  const itemCardDraft = useMemo<ItemCardDraft>(
    () => ({ formData, assemblyRows, supplierRows, localUnits, itemType, activeTab }),
    [activeTab, assemblyRows, formData, itemType, localUnits, supplierRows]
  );

  const applyItemCardDraft = useCallback((payload: ItemCardDraft) => {
    setFormData(payload.formData);
    setAssemblyRows(payload.assemblyRows?.length ? payload.assemblyRows : parseAssemblyRows(undefined));
    setSupplierRows(payload.supplierRows?.length ? payload.supplierRows : parseSupplierRows(undefined));
    setLocalUnits(payload.localUnits?.length ? payload.localUnits : [emptyBaseUnitRow()]);
    setItemType(payload.itemType || 'normal');
    if (payload.activeTab) setActiveTab(payload.activeTab);
    setMode('create');
  }, [setMode]);

  const { clearDraft } = useDraftAutosave({
    documentType: 'item-card',
    mode: 'new',
    value: itemCardDraft,
    enabled: !itemIdFromUrl,
    applyRestore: applyItemCardDraft,
    isEmpty: (payload) =>
      !payload.formData.arabicName.trim() &&
      !payload.formData.englishName.trim() &&
      !payload.formData.barcode.trim() &&
      !payload.formData.categoryId &&
      !payload.formData.specifications.trim(),
    restoreMessage: 'تم استعادة بيانات الصنف',
  });

  useEffect(() => {
    if (!activeItemId || !itemDetail?.id || itemDetail.id !== activeItemId) return;
    if (unitsHydratedFor === itemDetail.id) return;
    const mapped = toLocalUnitRows(itemDetail.units ?? []);
    setLocalUnits(mapped.length ? mapped : [emptyBaseUnitRow(formData.baseUnitId)]);
    setUnitsHydratedFor(itemDetail.id);
  }, [activeItemId, formData.baseUnitId, itemDetail, unitsHydratedFor]);

  const refreshItemUnits = () => {
    if (activeItemId) invalidateQuery(['item', activeItemId]);
  };

  const persistExtraUnits = async (itemId: string, rows: LocalUnitRow[]) => {
    for (const row of rows) {
      if (row.isBaseUnit || !row.unitId || row.id) continue;
      await apiClient.post('/inventory/item-units', {
        itemId,
        unitId: row.unitId,
        conversionFactor: Number(row.conversionFactor) || 1,
        isFactorFixed: row.isFactorFixed,
        isBaseUnit: false,
      });
    }
  };

  const setLocalUnit = (key: string, next: Partial<LocalUnitRow>) => {
    setLocalUnits((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const chooseUnit = async (row: LocalUnitRow, unitId: string) => {
    if (row.isBaseUnit && activeItemId) {
      setError('الوحدة الأساسية ثابتة بعد الحفظ ولا يمكن تغييرها');
      return;
    }
    setLocalUnit(row.key, { unitId });
    if (row.isBaseUnit) patch({ baseUnitId: unitId });
    if (!unitId || !activeItemId) return;
    setUnitBusyKey(row.key);
    setError('');
    try {
      if (row.id) {
        await apiClient.put(`/inventory/item-units/${row.id}`, { unitId });
      } else if (!row.isBaseUnit) {
        await apiClient.post('/inventory/item-units', {
          itemId: activeItemId,
          unitId,
          conversionFactor: Number(row.conversionFactor) || 1,
          isFactorFixed: row.isFactorFixed,
          isBaseUnit: false,
        });
      }
      refreshItemUnits();
      setUnitsHydratedFor(null);
      setSuccess('تم ربط الوحدة بالصنف');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ربط الوحدة');
    } finally {
      setUnitBusyKey(null);
    }
  };

  const saveUnitFactor = async (row: LocalUnitRow, conversionFactor: string) => {
    setLocalUnit(row.key, { conversionFactor });
    if (!row.id || !activeItemId) return;
    const n = Number(conversionFactor);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await apiClient.put(`/inventory/item-units/${row.id}`, { conversionFactor: n });
      refreshItemUnits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث المعامل');
    }
  };

  const setUnitFactorFixed = async (row: LocalUnitRow, isFactorFixed: boolean) => {
    setLocalUnit(row.key, { isFactorFixed });
    if (!row.id || !activeItemId) return;
    setUnitBusyKey(row.key);
    setError('');
    try {
      await apiClient.put(`/inventory/item-units/${row.id}`, { isFactorFixed });
      refreshItemUnits();
      setSuccess(isFactorFixed ? 'تم ضبط المعامل كثابت' : 'تم ضبط المعامل كمتغير لكل حركة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث معامل التحويل');
    } finally {
      setUnitBusyKey(null);
    }
  };

  const addUnitRow = () => {
    setLocalUnits((prev) => [
      ...prev,
      {
        key: `extra-${Date.now()}`,
        unitId: '',
        conversionFactor: '1',
        isFactorFixed: true,
        isBaseUnit: false,
      },
    ]);
  };

  const removeUnitRow = async (row: LocalUnitRow) => {
    if (row.isBaseUnit) return;
    if (row.id && activeItemId) {
      setUnitBusyKey(row.key);
      try {
        await apiClient.delete(`/inventory/item-units/${row.id}`);
        refreshItemUnits();
        setUnitsHydratedFor(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذر حذف الوحدة');
        setUnitBusyKey(null);
        return;
      }
      setUnitBusyKey(null);
    }
    setLocalUnits((prev) => prev.filter((item) => item.key !== row.key));
  };

  const priceByUnitId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of itemDetail?.prices ?? []) {
      if (p.unitId) {
        const n = typeof p.price === 'string' ? parseFloat(p.price) : Number(p.price);
        if (!Number.isNaN(n)) map.set(p.unitId, n);
      }
    }
    return map;
  }, [itemDetail?.prices]);

  const hydrateFromItem = (item: ItemDetail) => {
    setFormData(applyItemToForm(item));
    setAssemblyRows(parseAssemblyRows(item.assemblyComponents));
    setSupplierRows(parseSupplierRows(item.preferredSuppliers));
    const mapped = toLocalUnitRows(item.units ?? []);
    setLocalUnits(mapped.length ? mapped : [emptyBaseUnitRow()]);
    setUnitsHydratedFor(item.id);
    if (item.itemType) setItemType(item.itemType);
  };

  useEffect(() => {
    if (!activeItemId || !itemDetail?.id || itemDetail.id !== activeItemId) return;
    if (hydratedIdRef.current === itemDetail.id) return;
    hydratedIdRef.current = itemDetail.id;
    setSavedItemId(itemDetail.id);
    hydrateFromItem(itemDetail);
    lockToView();
  }, [activeItemId, itemDetail, lockToView]);

  const { data: glDefaultsResponse } = useCompanyGlDefaults();
  const glDefaults = glDefaultsResponse?.data;

  useEffect(() => {
    const inventoryId = glDefaults?.inventoryAccountId;
    if (!inventoryId) return;
    setFormData((prev) => (prev.mainAccountId ? prev : { ...prev, mainAccountId: inventoryId }));
  }, [glDefaults?.inventoryAccountId]);

  const { data: costAsOfResponse } = useItemCostAsOf(savedItemId);
  const movingCost =
    costAsOfResponse?.data &&
    typeof costAsOfResponse.data === 'object' &&
    'unitCost' in (costAsOfResponse.data as object)
      ? Number((costAsOfResponse.data as { unitCost?: number }).unitCost)
      : null;

  const persistItem = async (requestBody: Record<string, unknown>) => {
    if (activeItemId) {
      await apiClient.put<ItemDetail>(`/inventory/items/${activeItemId}`, requestBody);
      const hasBaseUnit = (itemDetail?.units ?? []).some(
        (row) => row.isBaseUnit || row.unitId === formData.baseUnitId || row.unit?.id === formData.baseUnitId
      );
      if (formData.baseUnitId && !hasBaseUnit) {
        await apiClient.post('/inventory/item-units', {
          itemId: activeItemId,
          unitId: formData.baseUnitId,
          conversionFactor: 1,
          isFactorFixed: true,
          isBaseUnit: true,
        });
      }
      invalidateQuery(['item', activeItemId]);
      invalidateQuery(['items']);
      setSavedItemId(activeItemId);
      clearDraft();
      lockToView();
      setSuccess('تم تحديث الصنف');
      return;
    }
    const res = await apiClient.post<ItemDetail>('/inventory/items', requestBody);
    const saved = res.data;
    const id = saved?.id;
    if (id) {
      await persistExtraUnits(id, localUnits);
      invalidateQuery(['item', id]);
    }
    if (quickCreate.isQuickCreate) {
      clearDraft();
      if (saved) hydrateFromItem(saved);
      if (id) {
        setSavedItemId(id);
        hydratedIdRef.current = id;
        quickCreate.complete({
          id,
          label: entityLabel(saved?.code ?? formData.serial, saved?.arabicName ?? formData.arabicName),
          arabicName: saved?.arabicName ?? formData.arabicName,
          code: saved?.code ?? formData.serial,
        });
      }
    } else {
      const keepCategory = formData.categoryId;
      const keepUnit = formData.baseUnitId;
      clearDraft();
      hydratedIdRef.current = null;
      setSavedItemId(null);
      setFormData({
        ...EMPTY_ITEM_FORM,
        categoryId: keepCategory,
        baseUnitId: keepUnit,
        serial: bumpTrailingCode(formData.serial || saved?.serial || ''),
      });
      setMode('create');
      setAssemblyRows(parseAssemblyRows(undefined));
      setSupplierRows(parseSupplierRows(undefined));
      setLocalUnits([emptyBaseUnitRow(keepUnit)]);
      setUnitsHydratedFor(null);
    }
    setSuccess(quickCreate.isQuickCreate ? 'تم حفظ الصنف' : 'تم حفظ الصنف — تقدر تضيف التالي');
    invalidateQuery(['items']);
    invalidateQuery(['items', 'serials']);
    if (id) invalidateQuery(['item', id]);
  };

  const [saving, setSaving] = useState(false);
  const loading = saving;
  const patch = (next: Partial<ItemCardForm>) => setFormData((prev) => ({ ...prev, ...next }));

  const handleSave = async () => {
    setError('');
    setSuccess('');

    const parsed = itemCardFormSchema.safeParse({
      serial: formData.serial,
      arabicName: formData.arabicName,
      englishName: formData.englishName,
      isService: formData.isService,
      isAssembly: formData.isAssembly,
      isTaxExempt: formData.isTaxExempt,
      beginningCostPrice: formData.beginningCostPrice,
      priceRetail: formData.priceRetail,
      consumerPrice: formData.consumerPrice,
      retailPrice: formData.retailPrice,
      representativePrice: formData.representativePrice,
      exportPrice: formData.exportPrice,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'يرجى مراجعة بيانات الصنف');
      return;
    }
    if (!itemAuto && !formData.serial.trim() && !activeItemId) {
      setError('رقم الصنف مطلوب — الترقيم يدوي');
      return;
    }
    if (!formData.categoryId) {
      setError('اختَر مجموعة الصنف قبل الحفظ');
      return;
    }
    const baseUnitId = formData.baseUnitId || localUnits.find((row) => row.isBaseUnit)?.unitId || '';
    if (!baseUnitId) {
      setError('اختَر الوحدة الأساسية من تاب الوحدات والأسعار قبل الحفظ');
      return;
    }

    const retailTier = optionalMoney(formData.retailPrice) ?? optionalMoney(formData.priceRetail);

    const requestBody = {
      serial: formData.serial || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      categoryId: formData.categoryId || null,
      baseUnitId,
      barcode: formData.barcode || null,
      defaultTaxPercent: formData.isTaxExempt ? 0 : optionalMoney(formData.defaultTaxPercent) ?? null,
      mainAccountId: formData.mainAccountId || undefined,
      specifications: formData.specifications || undefined,
      itemType: (itemType || 'normal') as 'normal' | 'pack-sheet' | 'pack-kilo' | 'roll',
      priceSource: companyPriceSource,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      manufacturerId: formData.manufacturerId || undefined,
      colorId: formData.colorId || undefined,
      countryOfOrigin: formData.countryOfOrigin || undefined,
      quality: formData.quality || undefined,
      size: formData.size || undefined,
      property1: formData.property1 || undefined,
      property2: formData.property2 || undefined,
      property3: formData.property3 || undefined,
      property4: formData.property4 || undefined,
      property5: formData.property5 || undefined,
      useExpirationDate: formData.useExpirationDate,
      inactiveItem: formData.inactiveItem,
      notSubjectToTerms: formData.notSubjectToTerms,
      cannotBeReturned: formData.cannotBeReturned,
      noSellBelowCost: formData.noSellBelowCost,
      useSerialNumber: formData.useSerialNumber,
      clothingItem: formData.clothingItem,
      upperLimit: formData.upperLimit ? parseFloat(formData.upperLimit) : undefined,
      orderLimit: formData.orderLimit ? parseFloat(formData.orderLimit) : undefined,
      orderLimitPercentage: formData.orderLimitPercentage
        ? parseFloat(formData.orderLimitPercentage)
        : undefined,
      lowerLimit: formData.lowerLimit ? parseFloat(formData.lowerLimit) : undefined,
      beginningBalance: formData.beginningBalance ? parseFloat(formData.beginningBalance) : undefined,
      beginningCostPrice: optionalMoney(formData.beginningCostPrice),
      lastPurchasePrice:
        companyPriceSource === 'item_card' ? optionalMoney(formData.purchasePrice) ?? 0 : undefined,
      priceRetail: optionalMoney(formData.priceRetail) ?? retailTier,
      priceSemiWholesale: formData.priceSemiWholesale
        ? parseFloat(formData.priceSemiWholesale)
        : undefined,
      priceWholesale: formData.priceWholesale ? parseFloat(formData.priceWholesale) : undefined,
      priceProjects: formData.priceProjects ? parseFloat(formData.priceProjects) : undefined,
      isService: formData.isService,
      isAssembly: formData.isAssembly,
      isTaxExempt: formData.isTaxExempt,
      consumerPrice: optionalMoney(formData.consumerPrice) ?? 0,
      retailPrice: retailTier ?? 0,
      representativePrice: optionalMoney(formData.representativePrice) ?? 0,
      exportPrice: optionalMoney(formData.exportPrice) ?? 0,
      priceMode: formData.priceMode,
      priceCurrency: formData.priceCurrency || null,
      extraAssemblyCost: optionalMoney(formData.extraAssemblyCost) ?? null,
      extraAssemblyCostPct: optionalMoney(formData.extraAssemblyCostPct) ?? null,
      purchaseCount: formData.purchaseCount ? parseInt(formData.purchaseCount, 10) : null,
      minPurchaseQty: optionalMoney(formData.minPurchaseQty) ?? null,
      assemblyComponents: compactAssemblyRows(assemblyRows),
      preferredSuppliers: compactSupplierRows(supplierRows),
      imageUrl: formData.imageUrl || null,
    };

    setSaving(true);
    try {
      await persistItem(requestBody);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!activeItemId) {
      setError('احفظ الصنف قبل الأرشفة');
      return;
    }
    setError('');
    try {
      await apiClient.put(`/inventory/items/${activeItemId}`, { isActive: false, inactiveItem: true });
      setSuccess('تم أرشفة الصنف');
      patch({ inactiveItem: true });
      invalidateQuery(['items']);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر أرشفة الصنف');
    }
  };

  const startNewItem = () => {
    clearDraft();
    hydratedIdRef.current = null;
    setSavedItemId(null);
    setError('');
    setSuccess('');
    setFormData({ ...EMPTY_ITEM_FORM });
    setAssemblyRows(parseAssemblyRows(undefined));
    setSupplierRows(parseSupplierRows(undefined));
    setLocalUnits([emptyBaseUnitRow()]);
    setUnitsHydratedFor(null);
    setItemType('normal');
    setActiveTab('general');
    setLookup('');
    setMode('create');
    router.replace('/inventory/creations/item-card');
  };

  const handleCancel = () => {
    setError('');
    if (activeItemId && itemDetail?.id === activeItemId) {
      hydrateFromItem(itemDetail);
      lockToView();
      setSuccess('تم التراجع عن التعديلات');
      return;
    }
    startNewItem();
    setSuccess('تم تفريغ البطاقة');
  };

  const currentStockQty = (itemDetail?.quantities ?? []).reduce((sum, row) => {
    const n = typeof row.quantity === 'string' ? parseFloat(row.quantity) : Number(row.quantity ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const componentsTotal = assemblyRowsTotal(assemblyRows);
  const extraCost = optionalMoney(formData.extraAssemblyCost) ?? 0;
  const extraPct = optionalMoney(formData.extraAssemblyCostPct) ?? 0;
  const assemblyGrand = componentsTotal + extraCost + (componentsTotal * extraPct) / 100;
  const activeHint = TABS.find((tab) => tab.id === activeTab)?.hint ?? '';

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <MasterCardPageHeader
        title="بطاقة الصنف"
        breadcrumbs={[
          { label: 'المخزون', href: '/inventory' },
          { label: 'التعريفات' },
          { label: 'بطاقة الصنف' },
        ]}
        docNumber={formData.serial || (activeItemId ? 'تعديل' : 'جديد')}
        statusLabel={
          formData.inactiveItem
            ? 'مؤرشف'
            : activeItemId
              ? isReadOnly
                ? 'عرض — اضغط تعديل'
                : 'تعديل'
              : 'جديد'
        }
        onSave={() => void handleSave()}
        savePending={loading}
        canSave={!isReadOnly && !loading}
        onCancel={handleCancel}
        onEdit={() => {
          if (!activeItemId) return;
          unlockForEdit();
        }}
        editDisabled={!activeItemId}
        onNew={startNewItem}
        currentId={activeItemId}
        onBrowseList={() => setShowFinder(true)}
        extraActions={
          <NumberingModeControl
            kind="items"
            auto={itemAuto}
            recordCount={itemRecordCount}
            settingKey="itemAutoNumbering"
          />
        }
        moreMenuItems={[
          {
            id: 'archive',
            label: 'أرشفة',
            onClick: () => void handleArchive(),
            disabled: !activeItemId,
            destructive: true,
          },
          { id: 'barcode', label: 'طباعة باركود', onClick: () => setShowPrint(true) },
          { id: 'guide', label: 'دليل الأصناف', onClick: () => router.push('/inventory/guide/items') },
        ]}
        favoriteHref="/inventory/creations/item-card"
      />

      <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
      <FormSectionCard
        title="بيانات الصنف"
        subtitle="الاسم والكود والمجموعة هنا. باقي التفاصيل في التبويبات تحت حسب الحاجة."
        icon={Package}
      >
        <CompactFormField
          label="المسلسل"
          value={formData.serial}
          disabled={isReadOnly || itemAuto}
          onChange={(e) => patch({ serial: e.target.value })}
          placeholder={itemAuto ? 'تلقائي' : 'أدخل رقم الصنف'}
        />
        <CompactFormField
          label="الاسم العربي"
          required
          disabled={isReadOnly}
          value={formData.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="اسم يظهر في الفواتير"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          disabled={isReadOnly}
          value={formData.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
        />
        <CompactFormField label="المجموعة الرئيسية" required>
          <div className="flex gap-2">
            <ItemGroupSelect
              value={formData.categoryId}
              onChange={(id) => patch({ categoryId: id })}
              groups={Array.isArray(categories) ? categories : []}
              disabled={isReadOnly}
              emptyLabel="اختَر المجموعة"
              labelFor={(row) => categoryOptionLabel(row, categories)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={isReadOnly}
              onClick={() => {
                setNewGroupName('');
                setNewGroupParentId('');
                setShowGroupModal(true);
              }}
            >
              + مجموعة
            </Button>
          </div>
        </CompactFormField>
        <CompactFormField
          label="الباركود"
          disabled={isReadOnly}
          value={formData.barcode}
          onChange={(e) => patch({ barcode: e.target.value })}
          placeholder="اختياري"
        />
        <div>
          <p className={labelCls}>نوع الصنف</p>
          <ChoicePills
            name="itemKind"
            value={formData.isService ? 'service' : 'stock'}
            options={[
              { value: 'stock', label: 'مخزني' },
              { value: 'service', label: 'خدمي' },
            ]}
            disabled={isReadOnly}
            onChange={(v) => patch({ isService: v === 'service' })}
          />
        </div>
        <div>
          <p className={labelCls}>الرصيد الحالي</p>
          <p className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm font-semibold leading-9 text-[#094C6B]">
            {activeItemId ? currentStockQty.toLocaleString('ar-EG') : '— بعد الحفظ'}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className={labelCls}>فتح صنف بالكود أو الباركود</p>
          <div className="flex gap-2">
            <input
              className={inputCls}
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setShowFinder(true);
                }
              }}
              placeholder="اكتب المسلسل أو الباركود ثم Enter"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowFinder(true)}
            >
              بحث
            </Button>
          </div>
        </div>
      </FormSectionCard>
      </fieldset>

      {savedItemId && movingCost != null && !Number.isNaN(movingCost) ? (
        <p className="mb-4 rounded-lg border border-[#D6EAF3] bg-[#EAF6FB] px-4 py-2 text-sm text-[#094C6B]">
          متوسط التكلفة الحالي: {formatMoneyAr(movingCost)}
        </p>
      ) : null}

      <div className="mb-3 rounded-xl border border-[#D6EAF3] bg-white p-2">
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'assembly') unlockForEdit();
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-[#E8F4FA] text-[#0E78AA] shadow-sm ring-1 ring-[#B7E0F2]'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 text-xs text-slate-500">{activeHint}</p>
      </div>

      <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
      {activeTab === 'general' && (
        <TabPanel title="البيانات العامة" hint="المواصفات والوزن وخصائص الصنف. نوع الصنف فوق مع الهوية.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className={labelCls}>المواصفات</p>
                <textarea
                  className={`${inputCls} min-h-[120px]`}
                  value={formData.specifications}
                  onChange={(e) => patch({ specifications: e.target.value })}
                  placeholder="وصف مختصر للصنف"
                />
              </div>
              <CompactFormField
                label="الوزن"
                type="number"
                value={formData.weight}
                onChange={(e) => patch({ weight: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ['manufacturerId', 'المصنع'],
                  ['colorId', 'اللون'],
                  ['countryOfOrigin', 'بلد المنشأ'],
                  ['quality', 'النوعية'],
                  ['size', 'المقاس'],
                  ['property1', 'خاصية 1'],
                  ['property2', 'خاصية 2'],
                  ['property3', 'خاصية 3'],
                  ['property4', 'خاصية 4'],
                  ['property5', 'خاصية 5'],
                ] as const
              ).map(([key, label]) => (
                <CompactFormField
                  key={key}
                  label={label}
                  value={formData[key]}
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
              ))}
            </div>
          </div>
        </TabPanel>
      )}

      {activeTab === 'units-prices' && (
        <TabPanel title="الوحدات والأسعار" hint="الوحدة الأساسية من هنا. بعد الحفظ تتقفل. باقي الوحدات تحويل. الأسعار من قائمة الأسعار.">
          <p className="mb-4 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-sm text-[#094C6B]">
            {companyPriceSource === 'item_card'
              ? 'مصدر السعر من إعدادات الشركة: قراءة من بطاقة الصنف. ادخل أسعار الشراء والبيع هنا.'
              : 'مصدر السعر من إعدادات الشركة: قراءة من قوائم الأسعار. هنا تربط وحدات الصنف من دليل الوحدات.'}
          </p>

          {companyPriceSource === 'item_card' ? (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CompactFormField
                label="سعر الشراء"
                type="number"
                min="0"
                step="0.0001"
                suffix="ج.م"
                value={formData.purchasePrice}
                onChange={(e) => patch({ purchasePrice: e.target.value })}
              />
              <CompactFormField
                label="سعر البيع"
                type="number"
                min="0"
                step="0.0001"
                suffix="ج.م"
                value={formData.priceRetail}
                onChange={(e) =>
                  patch({ priceRetail: e.target.value, retailPrice: e.target.value })
                }
              />
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={addUnitRow} disabled={isReadOnly}>
              + إضافة وحدة
            </Button>
            <Link href="/inventory/creations/unit">
              <Button type="button" variant="ghost" size="sm">
                تعريف الوحدات
              </Button>
            </Link>
          </div>

          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>الوحدة</th>
                  <th className={denseThClass}>النوع</th>
                  <th className={denseThClass}>المعامل</th>
                  <th className={denseThClass}>ثابت</th>
                  <th className={denseThClass}>سعر القائمة</th>
                  <th className={denseThClass} />
                </tr>
              </thead>
              <tbody>
                {localUnits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6">
                      <EmptyState
                        title="لا توجد وحدات"
                        description="أضف وحدة أساسية من دليل الوحدات، أو عرّف وحدة جديدة."
                        action={
                          <Button type="button" variant="primary" size="sm" onClick={addUnitRow}>
                            إضافة وحدة
                          </Button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  localUnits.map((row) => {
                    const listedPrice = row.unitId ? priceByUnitId.get(row.unitId) : undefined;
                    const taken = localUnits
                      .filter((item) => item.key !== row.key)
                      .map((item) => item.unitId);
                    return (
                      <tr key={row.key} className={denseTrClass}>
                        <td className={`${denseTdClass} min-w-[14rem]`}>
                          <UnitSelect
                            value={row.unitId}
                            units={units}
                            excludeIds={taken}
                            disabled={
                              isReadOnly ||
                              unitBusyKey === row.key ||
                              Boolean(row.isBaseUnit && activeItemId)
                            }
                            placeholder="اختَر الوحدة"
                            onChange={(unitId) => void chooseUnit(row, unitId)}
                          />
                        </td>
                        <td className={`${denseTdClass} text-[#0A3D5E]`}>
                          {row.isBaseUnit ? (activeItemId ? 'أساسية — ثابتة' : 'أساسية') : 'تحويل'}
                        </td>
                        <td className={denseTdClass}>
                          <input
                            className="w-24 rounded-lg border border-[#D6EAF3] bg-white px-2 py-1 text-sm text-[#0A3D5E]"
                            type="number"
                            min="0.000001"
                            step="0.0001"
                            disabled={isReadOnly || row.isBaseUnit}
                            value={row.isBaseUnit ? '1' : row.conversionFactor}
                            onChange={(e) => setLocalUnit(row.key, { conversionFactor: e.target.value })}
                            onBlur={(e) => void saveUnitFactor(row, e.target.value)}
                          />
                        </td>
                        <td className={denseTdClass}>
                          <select
                            className="rounded-lg border border-[#D6EAF3] bg-white px-2 py-1 text-sm text-[#0A3D5E]"
                            disabled={isReadOnly || unitBusyKey === row.key}
                            value={row.isFactorFixed ? 'fixed' : 'variable'}
                            onChange={(e) => void setUnitFactorFixed(row, e.target.value === 'fixed')}
                          >
                            <option value="fixed">ثابت</option>
                            <option value="variable">متغير</option>
                          </select>
                        </td>
                        <td className={denseTdClass}>
                          {listedPrice != null ? formatMoneyAr(listedPrice) : '—'}
                        </td>
                        <td className={denseTdClass}>
                          {row.isBaseUnit ? null : (
                            <button
                              type="button"
                              title="حذف الوحدة"
                              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                              disabled={isReadOnly || unitBusyKey === row.key}
                              onClick={() => void removeUnitRow(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabPanel>
      )}

      {activeTab === 'options' && (
        <TabPanel title="خيارات الصنف" hint="الضريبة والقيود والصورة. نوع الصنف فوق، والتجميع من تاب تجميعي.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-5 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex h-9 items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={formData.isTaxExempt}
                    onChange={(e) => {
                      const isTaxExempt = e.target.checked;
                      patch({
                        isTaxExempt,
                        defaultTaxPercent: isTaxExempt ? '0' : formData.defaultTaxPercent,
                      });
                    }}
                  />
                  <span className="text-sm font-semibold text-[#0A3D5E]">معفي من الضريبة</span>
                </label>
                <CompactFormField
                  label="ضريبة"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  suffix="%"
                  value={formData.isTaxExempt ? '0' : formData.defaultTaxPercent}
                  disabled={formData.isTaxExempt}
                  readOnly={formData.isTaxExempt}
                  onChange={(e) => {
                    if (formData.isTaxExempt) return;
                    patch({ defaultTaxPercent: e.target.value });
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-[#D6EAF3] p-4">
              {OPTION_FLAGS.map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#0A3D5E]">{label}</span>
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={formData[key]}
                    onChange={(e) => patch({ [key]: e.target.checked })}
                  />
                </label>
              ))}
              {formData.clothingItem ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/inventory/creations/color-size-matrix')}
                >
                  تركيب الألوان والمقاسات
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <p className={`${labelCls} mb-2`}>صورة الصنف</p>
            <ItemImageUploader
              value={formData.imageUrl}
              onChange={(imageUrl) => patch({ imageUrl })}
              onError={setError}
            />
          </div>
        </TabPanel>
      )}

      {activeTab === 'quantities' && (
        <TabPanel title="حدود المخزون والكميات" hint="الرصيد الحالي فوق. هنا حدود التنبيه والرصيد الافتتاحي.">
          <div
            data-tour="warehouse-stock-matrix"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <CompactFormField
              label="الحد الأعلى"
              type="number"
              value={formData.upperLimit}
              onChange={(e) => patch({ upperLimit: e.target.value })}
            />
            <CompactFormField
              label="حد الطلب"
              type="number"
              value={formData.orderLimit}
              onChange={(e) => patch({ orderLimit: e.target.value })}
            />
            <CompactFormField
              label="حد الطلب من آخر فاتورة"
              type="number"
              suffix="%"
              value={formData.orderLimitPercentage}
              onChange={(e) => patch({ orderLimitPercentage: e.target.value })}
            />
            <CompactFormField
              label="الحد الأدنى"
              type="number"
              value={formData.lowerLimit}
              onChange={(e) => patch({ lowerLimit: e.target.value })}
            />
            <CompactFormField
              label="رصيد أول المدة"
              type="number"
              value={formData.beginningBalance}
              onChange={(e) => patch({ beginningBalance: e.target.value })}
            />
            <CompactFormField
              label="سعر تكلفة أول المدة"
              type="number"
              suffix="ج.م"
              value={formData.beginningCostPrice}
              onChange={(e) => patch({ beginningCostPrice: e.target.value })}
            />
          </div>
        </TabPanel>
      )}
      </fieldset>

      {activeTab === 'assembly' && (
        <TabPanel title="صنف تجميعي" hint="اختَر النوع عند إنشاء الصنف. بعد أول حفظ النوع يثبت. المكوّنات من الأصناف العادية مع وحدتها.">
          <div className="mb-5">
            <p className={labelCls}>نوع التركيب</p>
            {activeItemId ? (
              <p className="text-sm font-semibold text-[#0A3D5E]">
                {formData.isAssembly ? 'تجميعي' : 'عادي'}
                <span className="mr-2 text-xs font-medium text-slate-500">— ثابت بعد أول حفظ</span>
              </p>
            ) : (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: false, label: 'عادي' },
                  { value: true, label: 'تجميعي' },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    patch({ isAssembly: opt.value });
                    if (opt.value && assemblyRows.every((row) => !row.itemId && !row.itemName)) {
                      setAssemblyRows(parseAssemblyRows(undefined));
                    }
                  }}
                  className={`${
                    formData.isAssembly === opt.value
                      ? 'border-[#0E78AA] bg-[#0E78AA] text-white'
                      : 'border-[#D6EAF3] bg-white text-[#0A3D5E]'
                  } inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            )}
          </div>
          {!formData.isAssembly ? (
            <EmptyState title={activeItemId ? 'الصنف عادي. النوع ثابت بعد الحفظ.' : 'الصنف عادي. اختَر «تجميعي» قبل الحفظ عشان تضيف مكونات.'} />
          ) : (
          <>
          <div className="space-y-3">
            {assemblyRows.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(8rem,0.85fr)_6.5rem_6.5rem_auto]"
              >
                <div className="min-w-0">
                  <p className={labelCls}>اسم المكوّن — صنف عادي</p>
                  <ItemSelect
                    value={row.itemId}
                    fallbackLabel={row.itemName}
                    emptyLabel="اختَر صنف عادي أو أضِف واحد"
                    excludeAssembly
                    excludeIds={[
                      ...(activeItemId ? [activeItemId] : []),
                      ...assemblyRows.map((r) => r.itemId).filter((id, i) => id && i !== idx),
                    ]}
                    enableQuickCreate
                    menuPlacement="auto"
                    onQuickCreateClick={(q) => {
                      unlockForEdit();
                      setPlainItemModal({ open: true, name: q, rowIdx: idx });
                    }}
                    onChange={(id) => {
                      unlockForEdit();
                      setAssemblyRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? id
                              ? { ...r, itemId: id }
                              : { ...EMPTY_ASSEMBLY_ROW }
                            : r
                        )
                      );
                    }}
                    onItemResolved={(item) => {
                      if (!item) return;
                      unlockForEdit();
                      const picked = item as ItemOption;
                      const cost =
                        picked.averageCost ?? picked.lastPurchasePrice ?? picked.salesPrice ?? '';
                      const unit = assemblyUnitFromItem(picked);
                      setAssemblyRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                itemId: picked.id,
                                itemName: picked.arabicName,
                                ...unit,
                                cost: r.cost || moneyToInput(cost),
                              }
                            : r
                        )
                      );
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <p className={labelCls}>الوحدة</p>
                  <UnitSelect
                    value={row.unitId}
                    units={
                      row.units?.length
                        ? row.units
                        : row.unitId
                          ? [{ id: row.unitId, arabicName: row.unitName || 'وحدة' }]
                          : []
                    }
                    disabled={!row.itemId}
                    placeholder={row.itemId ? 'اختَر وحدة المكوّن' : 'اختَر الصنف أولاً'}
                    onChange={(unitId) => {
                      unlockForEdit();
                      const picked = row.units?.find((unit) => unit.id === unitId);
                      setAssemblyRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                unitId,
                                unitName: picked?.arabicName || r.unitName,
                                conversionFactor: picked?.conversionFactor || (unitId ? '1' : ''),
                              }
                            : r
                        )
                      );
                    }}
                  />
                  {row.itemId ? (
                    <p className="mt-1 text-[11px] font-medium text-slate-500">
                      معامل الوحدة الأساسية: {row.conversionFactor || '1'}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className={labelCls}>الكمية</p>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={row.quantity}
                    onChange={(e) => {
                      unlockForEdit();
                      setAssemblyRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                      );
                    }}
                  />
                </div>
                <div>
                  <p className={labelCls}>التكلفة</p>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={row.cost}
                    onChange={(e) => {
                      unlockForEdit();
                      setAssemblyRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, cost: e.target.value } : r))
                      );
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="mb-1 text-slate-400 hover:text-red-500"
                    onClick={() => {
                      unlockForEdit();
                      setAssemblyRows((prev) =>
                        prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...EMPTY_ASSEMBLY_ROW }]
                      );
                    }}
                    aria-label="حذف السطر"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                unlockForEdit();
                setAssemblyRows((prev) => [...prev, { ...EMPTY_ASSEMBLY_ROW }]);
              }}
            >
              <Plus className="h-4 w-4" />
              سطر مكوّن
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                unlockForEdit();
                const emptyIdx = assemblyRows.findIndex((row) => !row.itemId && !row.itemName);
                const rowIdx = emptyIdx >= 0 ? emptyIdx : assemblyRows.length;
                if (emptyIdx < 0) setAssemblyRows((prev) => [...prev, { ...EMPTY_ASSEMBLY_ROW }]);
                setPlainItemModal({ open: true, name: '', rowIdx });
              }}
            >
              <Plus className="h-4 w-4" />
              إضافة صنف عادي
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className={labelCls}>إجمالي التكلفة</p>
              <p className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm font-semibold leading-9">
                {formatMoneyAr(assemblyGrand)}
              </p>
            </div>
            <CompactFormField
              label="تكلفة مضافة"
              type="number"
              value={formData.extraAssemblyCost}
              onChange={(e) => {
                unlockForEdit();
                patch({ extraAssemblyCost: e.target.value });
              }}
            />
            <CompactFormField
              label="نسبة من التكلفة"
              type="number"
              suffix="%"
              value={formData.extraAssemblyCostPct}
              onChange={(e) => {
                unlockForEdit();
                patch({ extraAssemblyCostPct: e.target.value });
              }}
            />
          </div>
          </>
          )}
        </TabPanel>
      )}

      <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
      {activeTab === 'order-plan' && (
        <TabPanel title="نقطة إعادة الطلب" hint="الموردون المفضلون والسعر ومدة التوريد. حد الطلب نفسه في تبويب الكميات.">
          <div className={denseTableWrapClass}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>المورد</th>
                  <th className={denseThClass}>السعر</th>
                  <th className={denseThClass}>مدة التوريد</th>
                  <th className={`${denseThClass} w-12`} />
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((row, idx) => (
                  <tr key={idx} className={denseTrClass}>
                    <td className={denseTdClass}>
                      <input
                        className={inputCls}
                        value={row.supplierName}
                        onChange={(e) =>
                          setSupplierRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, supplierName: e.target.value } : r))
                          )
                        }
                        placeholder="اسم المورد"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        className={inputCls}
                        type="number"
                        min={0}
                        value={row.price}
                        onChange={(e) =>
                          setSupplierRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r))
                          )
                        }
                      />
                    </td>
                    <td className={denseTdClass}>
                      <input
                        className={inputCls}
                        value={row.leadTimeDays}
                        onChange={(e) =>
                          setSupplierRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, leadTimeDays: e.target.value } : r))
                          )
                        }
                        placeholder="بالأيام"
                      />
                    </td>
                    <td className={denseTdClass}>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() =>
                          setSupplierRows((prev) =>
                            prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...EMPTY_SUPPLIER_ROW }]
                          )
                        }
                        aria-label="حذف السطر"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => setSupplierRows((prev) => [...prev, { ...EMPTY_SUPPLIER_ROW }])}
          >
            <Plus className="h-4 w-4" />
            مورد
          </Button>
          <div data-tour="reorder-level-alert" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="عدد مرات الشراء"
              type="number"
              value={formData.purchaseCount}
              onChange={(e) => patch({ purchaseCount: e.target.value })}
            />
            <CompactFormField
              label="الحد الأدنى للطلبية"
              type="number"
              value={formData.minPurchaseQty}
              onChange={(e) => patch({ minPurchaseQty: e.target.value })}
            />
          </div>
        </TabPanel>
      )}
      </fieldset>

      {activeTab === 'units-prices' ? (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowPrint(true)}
            disabled={!activeItemId}
          >
            طباعة الباركود
          </Button>
        </div>
      ) : null}

      <FormStickyFooter
        onSave={() => void handleSave()}
        saveLoading={loading}
        saveDisabled={loading || isReadOnly}
        status={
          isReadOnly
            ? 'عرض — اضغط تعديل قبل التغيير'
            : savedItemId
              ? formData.inactiveItem
                ? 'مؤرشف'
                : 'صنف محفوظ'
              : 'مسودة'
        }
      />

      {showPrint ? (
        <BarcodePrintModal
          open
          onClose={() => setShowPrint(false)}
          initialItemId={activeItemId ?? undefined}
        />
      ) : null}

      <QuickCreateItemModal
        open={plainItemModal.open}
        initialName={plainItemModal.name}
        onClose={() => setPlainItemModal((prev) => ({ ...prev, open: false }))}
        onCreated={(item: QuickCreatedItem) => {
          unlockForEdit();
          const idx = plainItemModal.rowIdx;
          setAssemblyRows((prev) => {
            const next = prev.slice();
            while (next.length <= idx) next.push({ ...EMPTY_ASSEMBLY_ROW });
            next[idx] = {
              ...next[idx],
              itemId: item.id,
              itemName: item.arabicName,
              ...assemblyUnitFromItem(),
              cost: next[idx].cost || moneyToInput(item.salesPrice ?? ''),
            };
            return next;
          });
          patch({ isAssembly: true });
          setPlainItemModal((prev) => ({ ...prev, open: false }));
          setSuccess('تم إضافة صنف عادي للمكوّنات');
        }}
      />

      <DocumentBrowseDrawer open={showFinder} onClose={() => setShowFinder(false)} title="الأصناف السابقة">
        <ItemsCatalogListSection
          key={`${lookup}-${showFinder ? 'open' : 'closed'}`}
          initialSearch={lookup}
          onSelectItem={(itemId) => {
            hydratedIdRef.current = null;
            setUnitsHydratedFor(null);
            setSavedItemId(itemId);
            lockToView();
            setShowFinder(false);
            router.replace(`/inventory/creations/item-card?id=${itemId}`);
            setSuccess('تم فتح الصنف');
          }}
        />
      </DocumentBrowseDrawer>

      <GuideEntityModal
        open={showGroupModal}
        title="إضافة مجموعة أصناف"
        hint="المجموعة هتظهر في دليل الأصناف وتقدر تختارها هنا مباشرة."
        saving={savingGroup}
        saveText="حفظ المجموعة"
        onClose={() => setShowGroupModal(false)}
        onSave={() => {
          void (async () => {
            if (!newGroupName.trim()) {
              setError('أدخل اسم المجموعة');
              return;
            }
            setSavingGroup(true);
            try {
              const created = await apiClient.post<{ id?: string }>('/inventory/item-categories', {
                arabicName: newGroupName.trim(),
                groupType: newGroupParentId ? 'SUB' : 'MAIN',
                parentCategoryId: newGroupParentId || null,
              });
              const id = created.data?.id;
              invalidateQuery(['item-categories']);
              invalidateQuery(['items']);
              if (id) patch({ categoryId: id });
              setShowGroupModal(false);
              setNewGroupName('');
              setNewGroupParentId('');
              setSuccess('تم حفظ المجموعة — هتظهر في دليل الأصناف');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'تعذر حفظ المجموعة');
            } finally {
              setSavingGroup(false);
            }
          })();
        }}
      >
        <CompactFormField
          label="اسم المجموعة"
          required
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="مثال: أجهزة"
        />
        <CompactFormField label="المجموعة الرئيسية">
          <ItemGroupSelect
            value={newGroupParentId}
            onChange={setNewGroupParentId}
            groups={Array.isArray(categories) ? categories : []}
            labelFor={(row) => categoryOptionLabel(row, categories)}
          />
        </CompactFormField>
      </GuideEntityModal>
    </ErpDocumentLayout>
  );
}

export default function ItemCardPage() {
  return (
    <DocumentModeProvider initialMode="create">
      <ItemCardPageInner />
    </DocumentModeProvider>
  );
}
