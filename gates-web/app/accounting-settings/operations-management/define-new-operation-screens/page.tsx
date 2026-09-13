'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { EmptyState } from '@/components/ui/EmptyState';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';

/** Legacy base document-type codes (see MainProgram/untNewModule.pas). */
const BASE_TYPES: { code: string; label: string }[] = [
  { code: 'BP', label: 'سند دفع بنكي' },
  { code: 'BR', label: 'سند قبض بنكي' },
  { code: 'KP', label: 'سند دفع نقدي' },
  { code: 'KR', label: 'سند قبض نقدي' },
  { code: 'RC', label: 'شيك وارد' },
  { code: 'PC', label: 'شيك صادر' },
  { code: 'TP', label: 'أمر دفع' },
  { code: 'GL', label: 'قيد يومية' },
  { code: 'SI', label: 'فاتورة مبيعات' },
  { code: 'PI', label: 'فاتورة مشتريات' },
  { code: 'SR', label: 'مرتجع مبيعات' },
  { code: 'PR', label: 'مرتجع مشتريات' },
  { code: 'ST', label: 'تحويل مخزني' },
  { code: 'SA', label: 'تسوية مخزنية' },
  { code: 'SC', label: 'جرد مخزني' },
];

const STORE_LINK_TYPES = new Set(['SI', 'PI', 'SR', 'PR', 'ST', 'SA', 'SC']);

const MODULE_FLAGS: Array<{ base: string; label: string; defaultOn: boolean }> = [
  { base: 'AutoPost', label: 'ترحيل تلقائي عند الحفظ (AutoPost)', defaultOn: false },
  { base: 'SalesDariba', label: 'ضريبة مبيعات (SalesDariba)', defaultOn: false },
  { base: 'NotCreateGL', label: 'عدم إنشاء قيد محاسبي (NotCreateGL)', defaultOn: false },
  { base: 'PostTostore', label: 'تأثير على المخزون (PostTostore)', defaultOn: true },
  { base: 'CascadingDiscounts', label: 'خصومات متتالية على أساس الضريبة (CascadingDiscounts)', defaultOn: false },
];

interface PriceListOption {
  id: string;
  code?: string | null;
  arabicName: string;
}

interface WarehouseOption {
  id: string;
  code?: string | null;
  arabicName: string;
}

interface NewModuleRow {
  id: string;
  baseType: string;
  moduleCode: string;
  fullCode: string;
  nameAr: string;
  nameEn?: string | null;
  menuNameAr: string;
  menuNameEn?: string | null;
  isActive: boolean;
  priceList?: { id: string; arabicName: string } | null;
  stores: { warehouse: { id: string; arabicName: string } }[];
}

interface CatalogModuleKey {
  baseName: string;
  key: string;
  storedValue: string | null;
  currentValue: string | null;
}

function flagOn(base: string, value: string | null | undefined, defaultOn: boolean): boolean {
  if (value == null) return defaultOn;
  if (base === 'NotCreateGL') return value === 'T';
  if (base === 'PostTostore') return value !== 'F';
  return value === 'T';
}

export default function DefineNewOperationScreensPage() {
  useBackendReachability();

  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();

  const [baseType, setBaseType] = useState('SI');
  const [listFilter, setListFilter] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [menuNameAr, setMenuNameAr] = useState('');
  const [menuNameEn, setMenuNameEn] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [warehouseIds, setWarehouseIds] = useState<string[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(MODULE_FLAGS.map((f) => [f.base, f.defaultOn]))
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: modulesResponse, isLoading } = useApiQuery<NewModuleRow[]>(
    ['new-modules', listFilter],
    '/new-modules',
    listFilter ? { baseType: listFilter } : undefined
  );
  const modules = modulesResponse?.data ?? [];
  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;

  const { data: priceListsResponse } = useApiQuery<PriceListOption[]>(
    ['price-lists-for-new-module'],
    '/inventory/price-lists',
    { limit: 200, isActive: true }
  );
  const priceLists = priceListsResponse?.data ?? [];

  const { data: warehousesResponse } = useApiQuery<WarehouseOption[]>(
    ['warehouses-for-new-module'],
    '/inventory/warehouses',
    { limit: 200 }
  );
  const warehouses = warehousesResponse?.data ?? [];

  const { data: moduleCatalogRes } = useApiQuery<{ moduleKeys: CatalogModuleKey[] }>(
    ['company-settings-catalog', selectedModule?.fullCode ?? 'none'],
    '/company-settings/catalog',
    selectedModule?.fullCode ? { moduleCode: selectedModule.fullCode } : undefined,
    { enabled: Boolean(selectedModule?.fullCode) }
  );

  useEffect(() => {
    if (!selectedModule) return;
    const byBase = new Map(
      (moduleCatalogRes?.data?.moduleKeys ?? []).map((row) => [row.baseName, row.storedValue])
    );
    setFlags(
      Object.fromEntries(
        MODULE_FLAGS.map((f) => [f.base, flagOn(f.base, byBase.get(f.base), f.defaultOn)])
      )
    );
  }, [selectedModule?.fullCode, moduleCatalogRes?.data]);

  const resetForm = () => {
    setSelectedModuleId(null);
    setNameAr('');
    setNameEn('');
    setMenuNameAr('');
    setMenuNameEn('');
    setPriceListId('');
    setWarehouseIds([]);
    setFlags(Object.fromEntries(MODULE_FLAGS.map((f) => [f.base, f.defaultOn])));
  };

  const loadModule = (m: NewModuleRow) => {
    setSelectedModuleId(m.id);
    setBaseType(m.baseType);
    setNameAr(m.nameAr);
    setNameEn(m.nameEn ?? '');
    setMenuNameAr(m.menuNameAr);
    setMenuNameEn(m.menuNameEn ?? '');
    setPriceListId(m.priceList?.id ?? '');
    setWarehouseIds(m.stores.map((s) => s.warehouse.id));
  };

  const persistFlags = async (fullCode: string) => {
    await Promise.all(
      MODULE_FLAGS.map((f) =>
        apiClient.put(`/company-settings/${f.base}${fullCode}`, {
          value: flags[f.base] ? 'T' : 'F',
        })
      )
    );
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    if (!nameAr.trim() || !menuNameAr.trim()) {
      setError('أدخل اسم الشاشة واسم القائمة بالعربي');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim() || undefined,
        menuNameAr: menuNameAr.trim(),
        menuNameEn: menuNameEn.trim() || undefined,
        priceListId: priceListId || null,
        warehouseIds,
      };
      let fullCode = selectedModule?.fullCode;
      if (selectedModuleId) {
        const res = await apiClient.put<NewModuleRow>(`/new-modules/${selectedModuleId}`, payload);
        fullCode = res.data?.fullCode ?? fullCode;
        setSuccess(res.message || 'تم تحديث التعريف');
      } else {
        const res = await apiClient.post<NewModuleRow>('/new-modules', { ...payload, baseType });
        fullCode = res.data?.fullCode;
        setSuccess(res.message || 'تم حفظ التعريف');
        if (res.data) loadModule(res.data);
      }
      if (fullCode) await persistFlags(fullCode);
      invalidateQuery(['new-modules']);
      invalidateQuery(['company-settings-catalog']);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (e as ApiError)?.message;
      setError(msg || 'فشل الحفظ');
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedModuleId) return;
    setError('');
    try {
      await apiClient.delete(`/new-modules/${selectedModuleId}`);
      setSuccess('تم حذف الشاشة بنجاح');
      invalidateQuery(['new-modules']);
      resetForm();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل الحذف');
    }
  };

  const handleToggleActive = async () => {
    if (!selectedModule) return;
    try {
      await apiClient.put(`/new-modules/${selectedModule.id}`, { isActive: !selectedModule.isActive });
      invalidateQuery(['new-modules']);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'فشل التحديث');
    }
  };

  const handleBack = () => router.back();

  const toggleWarehouse = (id: string) => {
    setWarehouseIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  const showsStoreLink = STORE_LINK_TYPES.has(baseType);
  const editing = Boolean(selectedModuleId);

  const selectedLabel = useMemo(
    () => (selectedModule ? `${selectedModule.fullCode} — ${selectedModule.nameAr}` : 'تعريف جديد'),
    [selectedModule]
  );

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">تعريف شاشات عمليات جديدة</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[#0A3D5E]">
                الوضع: <b>{selectedLabel}</b>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg border border-[#D6EAF3] bg-white text-[#0A3D5E] text-sm hover:bg-[#F6FBFD]"
              >
                شاشة جديدة
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">نوع المستند الأساسي</span>
                  <select
                    value={baseType}
                    onChange={(e) => setBaseType(e.target.value)}
                    disabled={editing}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E] disabled:opacity-60"
                  >
                    {BASE_TYPES.map((bt) => (
                      <option key={bt.code} value={bt.code}>
                        {bt.code} — {bt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">اسم الشاشة بالعربي</span>
                  <input
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                    placeholder="مثال: فاتورة مبيعات فرع ٢"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">اسم الشاشة بالإنجليزي</span>
                  <input
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">اسم القائمة بالعربي</span>
                  <input
                    value={menuNameAr}
                    onChange={(e) => setMenuNameAr(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">اسم القائمة بالإنجليزي</span>
                  <input
                    value={menuNameEn}
                    onChange={(e) => setMenuNameEn(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-[#0A3D5E] font-semibold min-w-[140px]">قائمة الأسعار</span>
                  <select
                    value={priceListId}
                    onChange={(e) => setPriceListId(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-[#0A3D5E]"
                  >
                    <option value="">— بدون —</option>
                    {priceLists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.code ? `${pl.code} — ` : ''}
                        {pl.arabicName}
                      </option>
                    ))}
                  </select>
                </div>

                {showsStoreLink && (
                  <div>
                    <div className="text-[#0E78AA] font-bold mb-2">المخازن المسموح بها لهذه الشاشة</div>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] p-3">
                      {warehouses.length === 0 ? (
                        <span className="text-sm text-gray-500">لا توجد مخازن</span>
                      ) : (
                        warehouses.map((wh) => (
                          <label key={wh.id} className="flex items-center gap-2 text-sm text-[#0A3D5E]">
                            <input
                              type="checkbox"
                              checked={warehouseIds.includes(wh.id)}
                              onChange={() => toggleWarehouse(wh.id)}
                              className="w-4 h-4"
                            />
                            {wh.arabicName}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[#0E78AA] font-bold mb-2">أعلام السلوك الافتراضية</div>
                  <div className="space-y-2 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] p-3">
                    {MODULE_FLAGS.map((f) => (
                      <label key={f.base} className="flex items-center gap-2 text-sm text-[#0A3D5E]">
                        <input
                          type="checkbox"
                          checked={Boolean(flags[f.base])}
                          onChange={(e) => setFlags((prev) => ({ ...prev, [f.base]: e.target.checked }))}
                          className="w-4 h-4"
                        />
                        {f.label}
                      </label>
                    ))}
                    {!editing && (
                      <p className="text-xs text-gray-500">
                        تُحفظ الأعلام بعد إنشاء كود الشاشة (مثال: {baseType}01).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {editing
                  ? `كود الشاشة: ${selectedModule?.fullCode}`
                  : `يتم إنشاء كود الشاشة تلقائياً (مثال: ${baseType}01) ويُستخدم كمرجع لضبط سلوك المستند.`}
              </div>
              <ActionButtons
                onSave={() => void handleSave()}
                onCancel={handleBack}
                saveText={saving ? 'جاري الحفظ...' : editing ? 'تحديث' : 'حفظ'}
                saveDisabled={saving}
              />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      <div className="mt-6">
        <OuterCard>
          <InnerCard>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div className="text-[#0E78AA] font-bold">الشاشات المعرّفة</div>
                <div className="flex items-center gap-2">
                  <select
                    value={listFilter}
                    onChange={(e) => setListFilter(e.target.value)}
                    className="h-9 rounded-lg border border-[#D6EAF3] bg-white px-3 text-sm text-[#0A3D5E]"
                  >
                    <option value="">كل الأنواع</option>
                    {BASE_TYPES.map((bt) => (
                      <option key={bt.code} value={bt.code}>
                        {bt.code} — {bt.label}
                      </option>
                    ))}
                  </select>
                  {selectedModule && (
                    <>
                      <button
                        onClick={() => void handleToggleActive()}
                        className="px-3 py-1.5 rounded-lg border border-[#D6EAF3] bg-white text-[#0A3D5E] text-sm hover:bg-[#F6FBFD]"
                      >
                        {selectedModule.isActive ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        onClick={() => void handleDelete()}
                        className="px-3 py-1.5 rounded-lg text-white bg-red-500 hover:bg-red-600 text-sm"
                      >
                        حذف
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isLoading ? (
                <div className="py-6 text-center text-[#0A3D5E]">جاري التحميل…</div>
              ) : modules.length === 0 ? (
                <EmptyState title="لا توجد شاشات معرّفة بعد" />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3]">
                  <table className="min-w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">كود الشاشة</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">النوع الأساسي</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">الاسم بالعربي</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">اسم القائمة</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">قائمة الأسعار</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">المخازن</th>
                        <th className="bg-gradient-to-b from-[#0E78AA] to-[#0A5F8A] text-white py-3 px-3 font-bold">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modules.map((m, i) => (
                        <tr
                          key={m.id}
                          onClick={() => (m.id === selectedModuleId ? resetForm() : loadModule(m))}
                          className={`cursor-pointer ${
                            m.id === selectedModuleId
                              ? 'bg-[#E8F4FA]'
                              : i % 2 === 0
                              ? 'bg-[#F6FBFD]'
                              : 'bg-white'
                          }`}
                        >
                          <td className="py-2 px-3 border-x border-[#D6EAF3] font-mono">{m.fullCode}</td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">
                            {BASE_TYPES.find((bt) => bt.code === m.baseType)?.label ?? m.baseType}
                          </td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">{m.nameAr}</td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">{m.menuNameAr}</td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">{m.priceList?.arabicName ?? '—'}</td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">
                            {m.stores.length ? m.stores.length : '—'}
                          </td>
                          <td className="py-2 px-3 border-x border-[#D6EAF3]">
                            {m.isActive ? (
                              <span className="text-green-600 font-semibold">نشط</span>
                            ) : (
                              <span className="text-gray-400 font-semibold">معطل</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </InnerCard>
        </OuterCard>
      </div>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
