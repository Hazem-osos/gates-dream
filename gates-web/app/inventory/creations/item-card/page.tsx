'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { ImagePlus, Package, Plus, Trash2, X } from 'lucide-react';
import {
  Button,
  CompactFormField,
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
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
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
import { UnitDefinitionDialog } from '@/components/inventory/UnitDefinitionDialog';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ItemsCatalogListSection } from '@/components/inventory/ItemsCatalogListSection';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import { GuideEntityModal } from '@/components/accounting/guide/GuideEntityModal';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { bumpTrailingCode, isCodeAfter, nextNumericSerial } from '@/lib/masters/nextNumericSerial';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import { readImageFileAsDataUrl } from '@/lib/images/read-image-file';
import { findDefaultPieceUnitId } from '@/lib/inventory/item-units';
import { confirmAction } from '@/lib/feedback/confirm';
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

function isUngroupedCategory(row: CategoryRow) {
  return row.code === 'UNG' || row.arabicName === 'بدون مجموعة';
}

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
  purchasePrice: string;
  salePrice: string;
};

function toLocalUnitRows(rows: ItemUnitRow[]): LocalUnitRow[] {
  return rows.map((row, idx) => ({
    key: row.id ?? `unit-${idx}`,
    unitId: row.unitId ?? row.unit?.id ?? '',
    conversionFactor: String(row.conversionFactor ?? 1),
    isFactorFixed: row.isFactorFixed !== false,
    isBaseUnit: Boolean(row.isBaseUnit),
    purchasePrice: '',
    salePrice: '',
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
    purchasePrice: '',
    salePrice: '',
  };
}

const TABS = [
  { id: 'general', label: 'عام', hint: 'المواصفات وخصائص الصنف' },
  { id: 'units-prices', label: 'الوحدات والأسعار', hint: 'وحدات الصنف وأسعار الشراء والبيع' },
  { id: 'options', label: 'خيارات', hint: 'الضريبة، القيود، والصورة' },
  { id: 'quantities', label: 'الكميات', hint: 'حدود المخزون والرصيد الافتتاحي' },
  { id: 'assembly', label: 'تجميعي', hint: 'عادي أو تجميعي، ثم المكونات لو تجميعي' },
  { id: 'order-plan', label: 'إدارة الطلبيات', hint: 'الموردون ومدة التوريد' },
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
        className={`group relative flex min-h-[160px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
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
        {value ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
            حذف الصورة
          </Button>
        ) : null}
        <CompactFormField
          label="أو الصق رابط الصورة"
          value={urlValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…"
        />
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
  const [activeTab, setActiveTab] = useState<string | null>(null);
  useItemCardTourPrepare(setActiveTab);
  const [itemType, setItemType] = useState('normal');
  const [showPrint, setShowPrint] = useState(false);
  const [showUnitDefinition, setShowUnitDefinition] = useState(false);
  const [showFinder, setShowFinder] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupParentId, setNewGroupParentId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
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
  const categoryIdFromUrl = searchParams.get('categoryId');
  const dismissedItemIdRef = useRef<string | null>(null);
  const rawItemId = savedItemId ?? itemIdFromUrl;
  const activeItemId =
    rawItemId && rawItemId === dismissedItemIdRef.current ? null : rawItemId;

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
  const selectableCategories = categories.filter((row) => !isUngroupedCategory(row));
  const groupSelectValue = categories.some(
    (row) => row.id === formData.categoryId && isUngroupedCategory(row)
  )
    ? ''
    : formData.categoryId;
  const { data: unitsResponse } = useApiQuery<{ id: string; arabicName: string; code?: string | null }[]>(
    ['units', 'item-card'],
    '/inventory/units',
    { limit: 500, isActive: true }
  );
  const units = unitsResponse?.data ?? [];
  const defaultPieceUnitId = findDefaultPieceUnitId(units);

  useEffect(() => {
    if (activeItemId || !defaultPieceUnitId) return;
    setFormData((prev) => (prev.baseUnitId ? prev : { ...prev, baseUnitId: defaultPieceUnitId }));
    setLocalUnits((prev) => {
      const base = prev.find((row) => row.isBaseUnit);
      if (base?.unitId) return prev;
      if (!prev.length) return [emptyBaseUnitRow(defaultPieceUnitId)];
      return prev.map((row) => (row.isBaseUnit ? { ...row, unitId: defaultPieceUnitId } : row));
    });
  }, [activeItemId, defaultPieceUnitId]);

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

  useEffect(() => {
    if (activeItemId || !categoryIdFromUrl) return;
    setFormData((prev) => (prev.categoryId ? prev : { ...prev, categoryId: categoryIdFromUrl }));
  }, [activeItemId, categoryIdFromUrl]);

  useEffect(() => {
    if (!itemIdFromUrl) dismissedItemIdRef.current = null;
  }, [itemIdFromUrl]);

  const [localUnits, setLocalUnits] = useState<LocalUnitRow[]>([emptyBaseUnitRow()]);
  const [unitsHydratedFor, setUnitsHydratedFor] = useState<string | null>(null);
  const [unitBusyKey, setUnitBusyKey] = useState<string | null>(null);

  type ItemCardDraft = {
    formData: ItemCardForm;
    assemblyRows: AssemblyRow[];
    supplierRows: SupplierRow[];
    localUnits: LocalUnitRow[];
    itemType: string;
    activeTab: string | null;
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

  const persistBaseUnitLink = async (itemId: string, unitId: string, existingId?: string) => {
    if (existingId) {
      await apiClient.put(`/inventory/item-units/${existingId}`, { unitId });
      return;
    }
    await apiClient.post('/inventory/item-units', {
      itemId,
      unitId,
      conversionFactor: 1,
      isFactorFixed: true,
      isBaseUnit: true,
    });
  };

  const setLocalUnit = (key: string, next: Partial<LocalUnitRow>) => {
    setLocalUnits((prev) => prev.map((row) => (row.key === key ? { ...row, ...next } : row)));
  };

  const chooseUnit = async (row: LocalUnitRow, unitId: string) => {
    setLocalUnit(row.key, { unitId });
    if (row.isBaseUnit) patch({ baseUnitId: unitId });
    if (!unitId || !activeItemId) return;
    setUnitBusyKey(row.key);
    setError('');
    try {
      if (row.id) {
        await apiClient.put(`/inventory/item-units/${row.id}`, { unitId });
      } else if (row.isBaseUnit) {
        await persistBaseUnitLink(activeItemId, unitId);
      } else {
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
        purchasePrice: '',
        salePrice: '',
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

  const hydrateFromItem = (item: ItemDetail) => {
    setFormData(applyItemToForm(item));
    setAssemblyRows(parseAssemblyRows(item.assemblyComponents));
    setSupplierRows(parseSupplierRows(item.preferredSuppliers));
    const mapped = toLocalUnitRows(item.units ?? []).map((row) => {
      if (row.isBaseUnit) {
        return {
          ...row,
          purchasePrice: moneyToInput(item.lastPurchasePrice),
          salePrice: moneyToInput(item.priceRetail ?? item.retailPrice),
        };
      }
      const listed = (item.prices ?? []).find((p) => p.unitId === row.unitId);
      return {
        ...row,
        salePrice: listed ? moneyToInput(listed.price) : '',
      };
    });
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
      const serverBase = (itemDetail?.units ?? []).find((row) => row.isBaseUnit);
      const serverBaseUnitId = serverBase?.unitId || serverBase?.unit?.id || '';
      if (formData.baseUnitId && formData.baseUnitId !== serverBaseUnitId) {
        const localBase = localUnits.find((row) => row.isBaseUnit);
        await persistBaseUnitLink(activeItemId, formData.baseUnitId, localBase?.id || serverBase?.id);
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
    invalidateQuery(queryKeys.itemCategories({ limit: 200 }));
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
    const baseUnitId =
      formData.baseUnitId ||
      localUnits.find((row) => row.isBaseUnit)?.unitId ||
      findDefaultPieceUnitId(units) ||
      '';

    const retailTier = optionalMoney(formData.retailPrice) ?? optionalMoney(formData.priceRetail);

    const requestBody = {
      serial: formData.serial || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      categoryId: formData.categoryId || null,
      baseUnitId: baseUnitId || undefined,
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
      extraAssemblyCost: null,
      extraAssemblyCostPct: optionalMoney(formData.extraAssemblyCostPct) ?? null,
      assemblyComponents: compactAssemblyRows(assemblyRows),
      preferredSuppliers: compactSupplierRows(supplierRows),
      imageUrl: formData.imageUrl || null,
      defaultWarehouseId: formData.defaultWarehouseId || null,
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

  const handlePermanentDelete = async () => {
    if (!activeItemId) {
      setError('احفظ الصنف قبل الحذف');
      return;
    }
    if (!(await confirmAction('حذف الصنف نهائياً؟ لو عليه حركات الحذف هيتوقف.'))) return;
    setError('');
    try {
      await apiClient.delete(`/inventory/items/${activeItemId}`);
      setSuccess('تم حذف الصنف');
      invalidateQuery(['items']);
      startNewItem();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الصنف');
    }
  };

  const startNewItem = () => {
    const currentId = savedItemId ?? itemIdFromUrl;
    if (currentId) dismissedItemIdRef.current = currentId;
    clearDraft();
    hydratedIdRef.current = null;
    setSavedItemId(null);
    setError('');
    setSuccess('');
    const pieceUnitId = findDefaultPieceUnitId(units);
    setFormData({ ...EMPTY_ITEM_FORM, baseUnitId: pieceUnitId });
    setAssemblyRows(parseAssemblyRows(undefined));
    setSupplierRows(parseSupplierRows(undefined));
    setLocalUnits([emptyBaseUnitRow(pieceUnitId)]);
    setUnitsHydratedFor(null);
    setItemType('normal');
    setActiveTab(null);
    setMode('create');
    router.replace('/inventory/creations/item-card');
  };

  const currentStockQty = (itemDetail?.quantities ?? []).reduce((sum, row) => {
    const n = typeof row.quantity === 'string' ? parseFloat(row.quantity) : Number(row.quantity ?? 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const componentsTotal = assemblyRowsTotal(assemblyRows);
  const extraPct = optionalMoney(formData.extraAssemblyCostPct) ?? 0;
  const assemblyGrand = componentsTotal + (componentsTotal * extraPct) / 100;

  const toggleTab = (tabId: string) => {
    setActiveTab((prev) => {
      const next = prev === tabId ? null : tabId;
      if (next === 'assembly') unlockForEdit();
      return next;
    });
  };

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
                ? 'عرض'
                : 'تعديل'
              : 'جديد'
        }
        onSave={() => void handleSave()}
        savePending={loading}
        canSave={!isReadOnly && !loading}
        onNew={startNewItem}
        currentId={activeItemId}
        onBrowseList={() => setShowFinder(true)}
        moreMenuItems={[
          {
            id: 'edit',
            label: 'تعديل',
            onClick: () => {
              if (!activeItemId) return;
              unlockForEdit();
            },
            disabled: !activeItemId || !isReadOnly,
          },
          {
            id: 'delete',
            label: 'حذف',
            onClick: () => void handlePermanentDelete(),
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
        <CompactFormField label="المجموعة الرئيسية">
          <div className="flex gap-2">
            <ItemGroupSelect
              value={groupSelectValue}
              onChange={(id) => patch({ categoryId: id })}
              groups={selectableCategories}
              disabled={isReadOnly}
              emptyLabel="بدون مجموعة"
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
        <CompactFormField label="المخزن الافتراضي">
          <WarehouseSelect
            value={formData.defaultWarehouseId || ''}
            onChange={(defaultWarehouseId) => patch({ defaultWarehouseId })}
            emptyLabel="مخزن الفاتورة"
            disabled={isReadOnly}
          />
        </CompactFormField>
        <div>
          <p className={labelCls}>الرصيد الحالي</p>
          <p className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm font-semibold leading-9 text-[#094C6B]">
            {activeItemId ? currentStockQty.toLocaleString('ar-EG') : '— بعد الحفظ'}
          </p>
        </div>
      </FormSectionCard>
      </fieldset>

      {savedItemId && movingCost != null && !Number.isNaN(movingCost) ? (
        <p className="mb-4 rounded-lg border border-[#D6EAF3] bg-[#EAF6FB] px-4 py-2 text-sm text-[#094C6B]">
          متوسط التكلفة الحالي: {formatMoneyAr(movingCost)}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row" dir="rtl">
        <nav className="w-full shrink-0 lg:w-48" aria-label="تبويبات البطاقة">
          <div className="flex flex-col overflow-hidden rounded-xl border border-[#E6EEF4] bg-white">
            {TABS.map((tab, idx) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => toggleTab(tab.id)}
                  className={`w-full px-4 py-2.5 text-right text-sm transition ${
                    idx > 0 ? 'border-t border-[#EEF3F7]' : ''
                  } ${
                    selected
                      ? 'bg-[#F3FAFD] font-semibold text-[#0E78AA]'
                      : 'font-medium text-[#4B6472] hover:bg-[#F7FBFD] hover:text-[#0A3D5E]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="min-w-0 flex-1">
      <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
        {!activeTab ? (
          <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-[#D6EAF3] bg-white text-sm text-slate-400">
            اختَر تبويبًا من القائمة
          </div>
        ) : null}
      {activeTab === 'general' && (
        <TabPanel title="البيانات العامة" hint="المواصفات ونوع الصنف وخصائصه.">
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
        <TabPanel title="الوحدات والأسعار" hint="وحدات الصنف وأسعار الشراء والبيع لكل وحدة.">
          <div className={`${denseTableWrapClass} max-h-[28rem] overflow-auto`}>
            <table className={denseTableClass}>
              <thead className={denseTheadClass}>
                <tr>
                  <th className={denseThClass}>الوحدة</th>
                  <th className={denseThClass}>النوع</th>
                  <th className={denseThClass}>المعامل</th>
                  <th className={denseThClass}>ثابت</th>
                  <th className={denseThClass}>سعر الشراء</th>
                  <th className={denseThClass}>سعر البيع</th>
                  <th className={denseThClass} />
                </tr>
              </thead>
              <tbody>
                {localUnits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6">
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
                    const taken = localUnits
                      .filter((item) => item.key !== row.key)
                      .map((item) => item.unitId);
                    const purchaseValue = row.isBaseUnit ? formData.purchasePrice : row.purchasePrice;
                    const saleValue = row.isBaseUnit ? formData.priceRetail : row.salePrice;
                    return (
                      <tr key={row.key} className={denseTrClass}>
                        <td className={`${denseTdClass} min-w-[14rem]`}>
                          <UnitSelect
                            value={row.unitId}
                            units={units}
                            excludeIds={taken}
                            disabled={isReadOnly || unitBusyKey === row.key}
                            placeholder="قطعة (تلقائي)"
                            onChange={(unitId) => void chooseUnit(row, unitId)}
                          />
                        </td>
                        <td className={`${denseTdClass} text-[#0A3D5E]`}>
                          {row.isBaseUnit ? 'أساسية' : 'تحويل'}
                        </td>
                        <td className={denseTdClass}>
                          <input
                            className="h-9 w-24 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#0A3D5E]"
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
                            className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#0A3D5E]"
                            disabled={isReadOnly || unitBusyKey === row.key}
                            value={row.isFactorFixed ? 'fixed' : 'variable'}
                            onChange={(e) => void setUnitFactorFixed(row, e.target.value === 'fixed')}
                          >
                            <option value="fixed">ثابت</option>
                            <option value="variable">متغير</option>
                          </select>
                        </td>
                        <td className={denseTdClass}>
                          <input
                            className="h-9 w-28 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#0A3D5E]"
                            type="number"
                            min="0"
                            step="0.0001"
                            disabled={isReadOnly}
                            value={purchaseValue}
                            onChange={(e) => {
                              if (row.isBaseUnit) {
                                patch({ purchasePrice: e.target.value });
                                return;
                              }
                              setLocalUnit(row.key, { purchasePrice: e.target.value });
                            }}
                          />
                        </td>
                        <td className={denseTdClass}>
                          <input
                            className="h-9 w-28 rounded-lg border border-[#D6EAF3] bg-white px-2 text-sm text-[#0A3D5E]"
                            type="number"
                            min="0"
                            step="0.0001"
                            disabled={isReadOnly}
                            value={saleValue}
                            onChange={(e) => {
                              if (row.isBaseUnit) {
                                patch({ priceRetail: e.target.value, retailPrice: e.target.value });
                                return;
                              }
                              setLocalUnit(row.key, { salePrice: e.target.value });
                            }}
                          />
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
        <TabPanel title="خيارات الصنف" hint="الضريبة والقيود والصورة.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-wrap items-end gap-3">
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
              <div className="w-32">
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

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OPTION_FLAGS.map(([key, label]) => (
                <label key={key} className="flex h-9 items-center justify-between gap-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3">
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
        <TabPanel title="حدود المخزون والكميات" hint="الرصيد الحالي فوق. هنا حدود التنبيه فقط.">
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
              label="الحد الأدنى"
              type="number"
              value={formData.lowerLimit}
              onChange={(e) => patch({ lowerLimit: e.target.value })}
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
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CompactFormField
              label="تكلفة مضافة (نسبة من التكلفة)"
              type="number"
              suffix="%"
              value={formData.extraAssemblyCostPct}
              onChange={(e) => {
                unlockForEdit();
                patch({ extraAssemblyCostPct: e.target.value, extraAssemblyCost: '' });
              }}
            />
            <div>
              <p className={labelCls}>إجمالي التكلفة</p>
              <p className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-sm font-semibold leading-9">
                {formatMoneyAr(assemblyGrand)}
              </p>
            </div>
          </div>
          </>
          )}
        </TabPanel>
      )}

      <fieldset disabled={isReadOnly} className="min-w-0 border-0 p-0">
      {activeTab === 'order-plan' && (
        <TabPanel title="إدارة الطلبيات" hint="الموردون المفضلون والسعر ومدة التوريد.">
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
            إضافة سطر
          </Button>
        </TabPanel>
      )}
      </fieldset>

      {activeTab === 'units-prices' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={addUnitRow} disabled={isReadOnly}>
            + إضافة وحدة
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowUnitDefinition(true)}>
            تعريف الوحدات
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setShowPrint(true)}
            disabled={!activeItemId}
          >
            طباعة الباركود
          </Button>
        </div>
      ) : null}
        </div>
      </div>

      <UnitDefinitionDialog
        open={showUnitDefinition}
        onClose={() => setShowUnitDefinition(false)}
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
          key={showFinder ? 'open' : 'closed'}
          onSelectItem={(itemId) => {
            dismissedItemIdRef.current = null;
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
