'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
} from '@/components/ui';
import { ErpDocumentLayout, MasterCardPageHeader } from '@/components/erp';
import { itemCardFormSchema } from '@/lib/validation/inventory.schema';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { useItemCostAsOf } from '@/lib/hooks/useItemCostAsOf';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { useCompanyGlDefaults } from '@/lib/hooks/useCompanyGlDefaults';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoneyAr } from '@/lib/formatMoney';
import { useItemCardTourPrepare } from '@/lib/onboarding/useItemCardTourPrepare';
import { queryKeys } from '@/lib/query/query-keys';
import { BarcodePrintModal } from '@/app/components/print/BarcodePrintModal';
import { ItemFinderModal } from '@/components/inventory/ItemFinderModal';
import { NumberingModeControl } from '@/components/accounting/NumberingModeControl';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { bumpTrailingCode, isCodeAfter, nextNumericSerial } from '@/lib/masters/nextNumericSerial';
import { entityLabel } from '@/lib/quick-create/catalog';
import { useQuickCreateHost } from '@/lib/quick-create/useQuickCreateTab';
import {
  applyItemToForm,
  assemblyRowsTotal,
  compactAssemblyRows,
  compactSupplierRows,
  EMPTY_ASSEMBLY_ROW,
  EMPTY_ITEM_FORM,
  EMPTY_SUPPLIER_ROW,
  optionalMoney,
  parseAssemblyRows,
  parseSupplierRows,
  type AssemblyRow,
  type ItemCardForm,
  type ItemDetail,
  type ItemUnitRow,
  type SupplierRow,
} from './itemCard.model';

type CategoryRow = { id: string; arabicName: string; code?: string | null };

const TABS = [
  { id: 'general', label: 'عام', hint: 'المخزن المستخدم، مصدر السعر، والمواصفات' },
  { id: 'units-prices', label: 'الوحدات والأسعار', hint: 'طريقة السعر وشرائح البيع' },
  { id: 'options', label: 'خيارات', hint: 'الضريبة، القيود، والصورة' },
  { id: 'quantities', label: 'الكميات', hint: 'حدود المخزون والرصيد الافتتاحي' },
  { id: 'assembly', label: 'تجميعي', hint: 'عادي أو تجميعي، ثم المكونات لو تجميعي' },
  { id: 'order-plan', label: 'نقطة إعادة الطلب', hint: 'الموردون ومدة التوريد' },
] as const;

const PRICE_MODES = [
  { value: 'last_purchase_pct', label: 'نسبة من آخر شراء' },
  { value: 'cost_pct', label: 'نسبة من التكلفة' },
  { value: 'value', label: 'قيمة ثابتة' },
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
}: {
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
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
          } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
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
    if (!file.type.startsWith('image/')) {
      onError('ارفع ملف صورة فقط');
      return;
    }
    if (file.size > 1_500_000) {
      onError('الصورة أكبر من 1.5 ميجا. صغّرها أو استخدم رابطاً.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange(reader.result);
    };
    reader.readAsDataURL(file);
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
            <p className="mt-1 text-xs text-slate-500">أو اضغط للاختيار · PNG / JPG</p>
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
        <p className="text-xs text-slate-500">المعاينة تظهر فوراً. الحد الأقصى للرفع 1.5 ميجا.</p>
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

export default function ItemCardPage() {
  const invalidateQuery = useInvalidateQuery();
  const router = useRouter();
  const quickCreate = useQuickCreateHost('item');
  const [activeTab, setActiveTab] = useState('general');
  useItemCardTourPrepare(setActiveTab);
  const [itemType, setItemType] = useState('normal');
  const [showPrint, setShowPrint] = useState(false);
  const [showFinder, setShowFinder] = useState(false);
  const [lookup, setLookup] = useState('');
  const hydratedIdRef = useRef<string | null>(null);

  const { data: settingsRes } = useAccountingSettingsQuery();
  const itemAuto = settingsRes?.data?.general?.itemAutoNumbering !== false;
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
  const categories = categoriesResponse?.data ?? [];

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

  const unitRows = itemDetail?.units ?? [];
  const [factorBusyId, setFactorBusyId] = useState<string | null>(null);

  const setUnitFactorFixed = async (row: ItemUnitRow, isFactorFixed: boolean) => {
    if (!row.id || !activeItemId) return;
    setFactorBusyId(row.id);
    setError('');
    try {
      await apiClient.put(`/inventory/item-units/${row.id}`, { isFactorFixed });
      invalidateQuery(['item', activeItemId]);
      setSuccess(isFactorFixed ? 'تم ضبط المعامل كثابت' : 'تم ضبط المعامل كمتغير لكل حركة');
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : 'تعذر تحديث معامل التحويل';
      setError(msg);
    } finally {
      setFactorBusyId(null);
    }
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
    if (item.itemType) setItemType(item.itemType);
  };

  useEffect(() => {
    if (!itemDetail?.id) return;
    if (hydratedIdRef.current === itemDetail.id) return;
    hydratedIdRef.current = itemDetail.id;
    setSavedItemId(itemDetail.id);
    hydrateFromItem(itemDetail);
  }, [itemDetail]);

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
      const res = await apiClient.put<ItemDetail>(`/inventory/items/${activeItemId}`, requestBody);
      const saved = res.data;
      if (saved) {
        hydrateFromItem(saved);
        hydratedIdRef.current = saved.id ?? activeItemId;
      }
      setSuccess('تم تحديث الصنف');
      invalidateQuery(['item', activeItemId]);
      invalidateQuery(['items']);
      return;
    }
    const res = await apiClient.post<ItemDetail>('/inventory/items', requestBody);
    const saved = res.data;
    const id = saved?.id;
    if (quickCreate.isQuickCreate) {
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
      hydratedIdRef.current = null;
      setSavedItemId(null);
      setFormData({
        ...EMPTY_ITEM_FORM,
        categoryId: keepCategory,
        serial: bumpTrailingCode(formData.serial || saved?.serial || ''),
      });
      setAssemblyRows(parseAssemblyRows(undefined));
      setSupplierRows(parseSupplierRows(undefined));
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

    const retailTier = optionalMoney(formData.retailPrice) ?? optionalMoney(formData.priceRetail);

    const requestBody = {
      serial: formData.serial || undefined,
      arabicName: formData.arabicName,
      englishName: formData.englishName || undefined,
      categoryId: formData.categoryId || null,
      barcode: formData.barcode || null,
      defaultTaxPercent: optionalMoney(formData.defaultTaxPercent) ?? null,
      mainAccountId: formData.mainAccountId || undefined,
      specifications: formData.specifications || undefined,
      itemType: (itemType || 'normal') as 'normal' | 'pack-sheet' | 'pack-kilo' | 'roll',
      defaultWarehouseId: formData.defaultWarehouseId || null,
      priceSource: formData.priceSource,
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
        formData.priceSource === 'item_card' ? optionalMoney(formData.purchasePrice) ?? 0 : undefined,
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
    hydratedIdRef.current = null;
    setSavedItemId(null);
    setError('');
    setSuccess('');
    setFormData({ ...EMPTY_ITEM_FORM });
    setAssemblyRows(parseAssemblyRows(undefined));
    setSupplierRows(parseSupplierRows(undefined));
    setItemType('normal');
    setActiveTab('general');
    setLookup('');
    router.replace('/inventory/creations/item-card');
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
        statusLabel={formData.inactiveItem ? 'مؤرشف' : activeItemId ? 'تعديل' : 'جديد'}
        onSave={() => void handleSave()}
        savePending={loading}
        canSave={!loading}
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

      <FormSectionCard
        title="هوية الصنف"
        subtitle="الاسم والكود هنا. باقي التفاصيل في التبويبات تحت حسب الحاجة."
        icon={Package}
      >
        <CompactFormField
          label="المسلسل"
          value={formData.serial}
          disabled={itemAuto}
          onChange={(e) => patch({ serial: e.target.value })}
          placeholder={itemAuto ? 'تلقائي' : 'أدخل رقم الصنف'}
        />
        <CompactFormField
          label="الاسم العربي"
          required
          value={formData.arabicName}
          onChange={(e) => patch({ arabicName: e.target.value })}
          placeholder="اسم يظهر في الفواتير"
        />
        <CompactFormField
          label="الاسم الإنجليزي"
          value={formData.englishName}
          onChange={(e) => patch({ englishName: e.target.value })}
        />
        <CompactFormField label="المجموعة">
          <select
            className={inputCls}
            value={formData.categoryId}
            onChange={(e) => patch({ categoryId: e.target.value })}
          >
            <option value="">— بدون مجموعة —</option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.arabicName}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField
          label="الباركود"
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
              onClick={() => setActiveTab(tab.id)}
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

      {activeTab === 'general' && (
        <TabPanel title="البيانات العامة" hint="المخزن المستخدم ومصدر السعر والوصف. نوع الصنف فوق مع الهوية.">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className={labelCls}>المخزن المستخدم</p>
                <WarehouseSelect
                  className={inputCls}
                  value={formData.defaultWarehouseId}
                  onChange={(id) => patch({ defaultWarehouseId: id })}
                  emptyLabel="اختر المخزن"
                />
              </div>
              <div className="space-y-3 rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] p-3">
                <p className={labelCls}>مصدر السعر</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={formData.priceSource === 'price_list'}
                    onChange={() => patch({ priceSource: 'price_list' })}
                  />
                  <span className="text-sm font-semibold text-[#0A3D5E]">قراءة من قوائم الأسعار</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxCls}
                    checked={formData.priceSource === 'item_card'}
                    onChange={() => patch({ priceSource: 'item_card' })}
                  />
                  <span className="text-sm font-semibold text-[#0A3D5E]">قراءة من بطاقة الصنف</span>
                </label>
                {formData.priceSource === 'item_card' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>
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
        <TabPanel title="الوحدات والأسعار" hint="حدد طريقة السعر والعملة، ثم املأ شرائح البيع. الوحدات تظهر بعد حفظ الصنف.">
          {formData.priceSource === 'item_card' ? (
            <p className="mb-4 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-sm text-[#094C6B]">
              السعر بيُقرأ من بطاقة الصنف (سعر الشراء وسعر البيع في تاب عام). هنا الوحدات والباركود فقط.
            </p>
          ) : (
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className={labelCls}>الأسعار تحسب كـ</p>
              <ChoicePills
                name="priceMode"
                value={formData.priceMode}
                options={PRICE_MODES}
                onChange={(priceMode) => patch({ priceMode })}
              />
            </div>
            <CompactFormField label="العملة">
              <select
                className={inputCls}
                value={formData.priceCurrency}
                onChange={(e) => patch({ priceCurrency: e.target.value })}
              >
                <option value="EGP">جنيه مصري</option>
                <option value="USD">دولار أمريكي</option>
                <option value="SAR">ريال سعودي</option>
              </select>
            </CompactFormField>
          </div>
          )}

          {formData.priceSource !== 'item_card' ? (
          <div className="mb-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {(
              [
                ['priceRetail', 'قطاعي'],
                ['priceSemiWholesale', 'نصف جملة'],
                ['priceWholesale', 'جملة'],
                ['priceProjects', 'مشاريع / شركة نقدي'],
                ['consumerPrice', 'شركة آجل'],
                ['representativePrice', 'تاجر نقدي'],
                ['exportPrice', 'تاجر آجل'],
              ] as const
            ).map(([key, label]) => (
              <CompactFormField
                key={key}
                label={label}
                type="number"
                min="0"
                step="0.0001"
                suffix={formData.priceCurrency === 'EGP' ? 'ج.م' : formData.priceCurrency}
                value={formData[key]}
                onChange={(e) =>
                  patch({
                    [key]: e.target.value,
                    ...(key === 'priceRetail' ? { retailPrice: e.target.value } : {}),
                  })
                }
              />
            ))}
          </div>
          ) : null}

          <div className="overflow-x-auto rounded-2xl">
            <table className="min-w-full border-separate border-spacing-0 text-center">
              <thead>
                <tr className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white shadow-md">
                  <th className="px-3 py-3 font-semibold">الوحدة</th>
                  <th className="px-3 py-3 font-semibold">الباركود</th>
                  <th className="px-3 py-3 font-semibold">المعامل</th>
                  <th className="px-3 py-3 font-semibold">ثابت</th>
                  <th className="px-3 py-3 font-semibold">سعر القائمة</th>
                </tr>
              </thead>
              <tbody>
                {!activeItemId ? (
                  <tr>
                    <td colSpan={5} className="py-6">
                      <EmptyState title="احفظ الصنف أولاً عشان تظهر وحداته." />
                    </td>
                  </tr>
                ) : unitRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6">
                      <EmptyState
                        title="لا توجد وحدات مسجلة"
                        description="عرّف وحدة واحدة على الأقل ثم اربطها بالصنف."
                        action={
                          <Link href="/inventory/creations/unit">
                            <Button type="button" variant="primary" size="sm">
                              تعريف الوحدات
                            </Button>
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  unitRows.map((row, idx) => {
                    const uid = row.unitId ?? row.unit?.id ?? '';
                    const listedPrice = uid ? priceByUnitId.get(uid) : undefined;
                    const factor =
                      typeof row.conversionFactor === 'string'
                        ? row.conversionFactor
                        : String(row.conversionFactor);
                    return (
                      <tr key={uid || idx} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                        <td className="border-x border-[#D6EAF3] px-3 py-3 text-[#0A3D5E]">
                          {row.unit?.arabicName ?? '—'}
                          {row.isBaseUnit ? ' (أساسية)' : ''}
                        </td>
                        <td className="border-x border-[#D6EAF3] px-3 py-3 text-[#0A3D5E]">
                          {row.isBaseUnit ? formData.barcode || '—' : '—'}
                        </td>
                        <td className="border-x border-[#D6EAF3] px-3 py-3">{factor}</td>
                        <td className="border-x border-[#D6EAF3] px-3 py-3">
                          <select
                            className="rounded-lg border border-[#D6EAF3] bg-white px-2 py-1 text-sm text-[#0A3D5E]"
                            disabled={!row.id || factorBusyId === row.id}
                            value={row.isFactorFixed === false ? 'variable' : 'fixed'}
                            onChange={(e) => void setUnitFactorFixed(row, e.target.value === 'fixed')}
                          >
                            <option value="fixed">ثابت</option>
                            <option value="variable">متغير</option>
                          </select>
                        </td>
                        <td className="border-x border-[#D6EAF3] px-3 py-3">
                          {listedPrice != null ? formatMoneyAr(listedPrice) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={() => setShowPrint(true)}>
              طباعة الباركود
            </Button>
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
                    onChange={(e) => patch({ isTaxExempt: e.target.checked })}
                  />
                  <span className="text-sm font-semibold text-[#0A3D5E]">معفي من الضريبة</span>
                </label>
                <CompactFormField
                  label="قيمة الضريبة"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  suffix="%"
                  value={formData.defaultTaxPercent}
                  onChange={(e) => patch({ defaultTaxPercent: e.target.value })}
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

      {activeTab === 'assembly' && (
        <TabPanel title="صنف تجميعي" hint="حدّد هنا هل الصنف عادي ولا تجميعي. لو تجميعي تظهر المكونات والتكلفة.">
          <div className="mb-5">
            <p className={labelCls}>نوع التركيب</p>
            <ChoicePills
              name="assemblyKind"
              value={formData.isAssembly ? 'assembly' : 'plain'}
              options={[
                { value: 'plain', label: 'عادي' },
                { value: 'assembly', label: 'تجميعي' },
              ]}
              onChange={(v) => patch({ isAssembly: v === 'assembly' })}
            />
          </div>
          {!formData.isAssembly ? (
            <EmptyState title="الصنف عادي. فعّل «تجميعي» عشان تضيف المكونات والتكلفة." />
          ) : null}
          {formData.isAssembly ? (
          <>
          <div className="overflow-x-auto rounded-2xl">
            <table className="min-w-full border-separate border-spacing-0 text-center">
              <thead>
                <tr className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white">
                  <th className="px-3 py-3 font-semibold">الصنف</th>
                  <th className="px-3 py-3 font-semibold">الكمية</th>
                  <th className="px-3 py-3 font-semibold">التكلفة</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {assemblyRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
                      <input
                        className={inputCls}
                        value={row.itemName}
                        onChange={(e) =>
                          setAssemblyRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, itemName: e.target.value } : r))
                          )
                        }
                        placeholder="اسم المكوّن"
                      />
                    </td>
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
                      <input
                        className={inputCls}
                        type="number"
                        min={0}
                        value={row.quantity}
                        onChange={(e) =>
                          setAssemblyRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                          )
                        }
                      />
                    </td>
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
                      <input
                        className={inputCls}
                        type="number"
                        min={0}
                        value={row.cost}
                        onChange={(e) =>
                          setAssemblyRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, cost: e.target.value } : r))
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() =>
                          setAssemblyRows((prev) =>
                            prev.length > 1 ? prev.filter((_, i) => i !== idx) : [{ ...EMPTY_ASSEMBLY_ROW }]
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
            onClick={() => setAssemblyRows((prev) => [...prev, { ...EMPTY_ASSEMBLY_ROW }])}
          >
            <Plus className="h-4 w-4" />
            سطر مكوّن
          </Button>
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
              onChange={(e) => patch({ extraAssemblyCost: e.target.value })}
            />
            <CompactFormField
              label="نسبة من التكلفة"
              type="number"
              suffix="%"
              value={formData.extraAssemblyCostPct}
              onChange={(e) => patch({ extraAssemblyCostPct: e.target.value })}
            />
          </div>
          </>
          ) : null}
        </TabPanel>
      )}

      {activeTab === 'order-plan' && (
        <TabPanel title="نقطة إعادة الطلب" hint="الموردون المفضلون والسعر ومدة التوريد. حد الطلب نفسه في تبويب الكميات.">
          <div className="overflow-x-auto rounded-2xl">
            <table className="min-w-full border-separate border-spacing-0 text-center">
              <thead>
                <tr className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white">
                  <th className="px-3 py-3 font-semibold">المورد</th>
                  <th className="px-3 py-3 font-semibold">السعر</th>
                  <th className="px-3 py-3 font-semibold">مدة التوريد</th>
                  <th className="w-12 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {supplierRows.map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
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
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
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
                    <td className="border-x border-[#D6EAF3] px-2 py-2">
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
                    <td className="px-2 py-2">
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

      <FormStickyFooter
        onCancel={() => {
          setError('');
          setSuccess('');
        }}
        onSave={() => void handleSave()}
        saveLoading={loading}
        saveDisabled={loading}
        status={savedItemId ? (formData.inactiveItem ? 'مؤرشف' : 'صنف محفوظ') : 'مسودة'}
      />

      {showPrint ? (
        <BarcodePrintModal
          open
          onClose={() => setShowPrint(false)}
          initialItemId={activeItemId ?? undefined}
        />
      ) : null}

      <ItemFinderModal
        open={showFinder}
        onClose={() => setShowFinder(false)}
        initialBarcode={lookup}
        onPick={(itemId) => {
          hydratedIdRef.current = null;
          setSavedItemId(itemId);
          router.replace(`/inventory/creations/item-card?id=${itemId}`);
          setSuccess('تم فتح الصنف');
        }}
      />
    </ErpDocumentLayout>
  );
}
