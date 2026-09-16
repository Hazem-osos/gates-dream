'use client';

import { useMemo, useState } from 'react';
import { CommandCenter } from '@/components/dashboard-primitives/CommandCenter';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import {
  DOCUMENT_BASE_TYPE_LABELS,
  DOCUMENT_PROFILE_COLUMN_OPTIONS,
  previewProfileNumber,
  slugifyProfileName,
  type DocumentBaseType,
  type DocumentProfile,
  type DocumentProfileColumnKey,
} from '@/lib/document-profiles/types';

type SafeRow = { id: string; code?: string | null; arabicName?: string };

type FormState = {
  id?: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  baseType: DocumentBaseType;
  prefix: string;
  defaultWarehouseId: string;
  lockWarehouse: boolean;
  defaultTreasuryId: string;
  lockTreasury: boolean;
  defaultCostCenterId: string;
  lockCostCenter: boolean;
  visibleColumns: DocumentProfileColumnKey[];
  showInSidebar: boolean;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  nameAr: '',
  nameEn: '',
  slug: '',
  baseType: 'SALES_INVOICE',
  prefix: '',
  defaultWarehouseId: '',
  lockWarehouse: false,
  defaultTreasuryId: '',
  lockTreasury: false,
  defaultCostCenterId: '',
  lockCostCenter: false,
  visibleColumns: [],
  showInSidebar: false,
  isActive: true,
});

function fromProfile(p: DocumentProfile): FormState {
  return {
    id: p.id,
    nameAr: p.nameAr,
    nameEn: p.nameEn ?? '',
    slug: p.slug,
    baseType: p.baseType,
    prefix: p.prefix ?? '',
    defaultWarehouseId: p.defaultWarehouseId ?? '',
    lockWarehouse: p.lockWarehouse,
    defaultTreasuryId: p.defaultTreasuryId ?? '',
    lockTreasury: p.lockTreasury,
    defaultCostCenterId: p.defaultCostCenterId ?? '',
    lockCostCenter: p.lockCostCenter,
    visibleColumns: (p.visibleColumns ?? []) as DocumentProfileColumnKey[],
    showInSidebar: p.showInSidebar,
    isActive: p.isActive,
  };
}

export default function DocumentProfilesSettingsPage() {
  const invalidate = useInvalidateQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [slugManual, setSlugManual] = useState(false);

  const { data, isLoading } = useApiQuery<DocumentProfile[]>(
    ['document-profiles', 'admin'],
    '/document-profiles',
    { includeInactive: true }
  );
  const { data: safesRes } = useApiQuery<SafeRow[]>(['safes'], '/accounting/safes', {
    limit: 200,
    isActive: true,
  });
  const profiles = data?.data ?? [];
  const safes = safesRes?.data ?? [];

  const createMutation = useApiMutation<DocumentProfile, Record<string, unknown>>(
    '/document-profiles',
    'POST',
    {
      onSuccess: () => {
        toast.success('تم إنشاء النمط');
        invalidate(['document-profiles']);
        setOpen(false);
      },
    }
  );
  const updateMutation = useApiMutation<DocumentProfile, Record<string, unknown>>(
    form.id ? `/document-profiles/${form.id}` : '/document-profiles',
    'PATCH',
    {
      onSuccess: () => {
        toast.success('تم تحديث النمط');
        invalidate(['document-profiles']);
        setOpen(false);
      },
    }
  );

  const patch = (next: Partial<FormState>) => setForm((prev) => ({ ...prev, ...next }));

  const payload = useMemo(
    () => ({
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      slug: form.slug.trim().toLowerCase(),
      baseType: form.baseType,
      prefix: form.prefix.trim() || null,
      defaultWarehouseId: form.defaultWarehouseId || null,
      lockWarehouse: form.lockWarehouse,
      defaultTreasuryId: form.defaultTreasuryId || null,
      lockTreasury: form.lockTreasury,
      defaultCostCenterId: form.defaultCostCenterId || null,
      lockCostCenter: form.lockCostCenter,
      visibleColumns: form.visibleColumns,
      showInSidebar: form.showInSidebar,
      isActive: form.isActive,
    }),
    [form]
  );

  const save = () => {
    if (!form.nameAr.trim() || !form.slug.trim()) {
      toast.error('الاسم ورمز النمط مطلوبان');
      return;
    }
    if (form.id) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  };

  return (
    <CommandCenter
      title="أنماط ووحدات الإدخال"
      module="الإعدادات"
      shortcuts={[
        {
          key: 'create-profile',
          label: '+ إنشاء نمط جديد',
          onClick: () => {
            setForm(emptyForm());
            setSlugManual(false);
            setOpen(true);
          },
        },
      ]}
    >
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-right text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">النمط</th>
              <th className="px-4 py-3 font-semibold">النوع</th>
              <th className="px-4 py-3 font-semibold">الترقيم</th>
              <th className="px-4 py-3 font-semibold">الحالة</th>
              <th className="px-4 py-3 font-semibold">القائمة</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  جاري التحميل…
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  لا توجد أنماط بعد. أنشئ نمطاً لمبيعات الصالة أو الجملة.
                </td>
              </tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#094C6B]">{p.nameAr}</div>
                    <div className="font-mono text-[11px] text-slate-400">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3">{DOCUMENT_BASE_TYPE_LABELS[p.baseType]}</td>
                  <td className="px-4 py-3 font-mono text-xs">{previewProfileNumber(p)}</td>
                  <td className="px-4 py-3">
                    <span className={p.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                      {p.isActive ? 'نشط' : 'موقوف'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.showInSidebar ? 'ظاهر' : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-[#0E79AA] hover:underline"
                      onClick={() => {
                        setForm(fromProfile(p));
                        setSlugManual(true);
                        setOpen(true);
                      }}
                    >
                      تعديل
                    </button>
                    {p.isActive ? (
                      <button
                        type="button"
                        className="ms-3 text-rose-600 hover:underline"
                        onClick={async () => {
                          if (!(await confirmAction('إيقاف هذا النمط؟'))) return;
                          try {
                            await apiClient.delete(`/document-profiles/${p.id}`);
                            toast.success('تم إيقاف النمط');
                            invalidate(['document-profiles']);
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : 'تعذر إيقاف النمط');
                          }
                        }}
                      >
                        إيقاف
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" dir="rtl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#094C6B]">
                {form.id ? 'تعديل النمط' : 'إنشاء نمط جديد'}
              </h2>
              <button type="button" className="text-slate-400" onClick={() => setOpen(false)}>
                إغلاق
              </button>
            </div>

            <section className="mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">البيانات الأساسية</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  الاسم
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={form.nameAr}
                    onChange={(e) => {
                      const nameAr = e.target.value;
                      patch({
                        nameAr,
                        slug: slugManual ? form.slug : slugifyProfileName(nameAr) || form.slug,
                      });
                    }}
                  />
                </label>
                <label className="text-sm">
                  النوع
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"
                    value={form.baseType}
                    onChange={(e) => patch({ baseType: e.target.value as DocumentBaseType })}
                  >
                    {Object.entries(DOCUMENT_BASE_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  الرمز (Slug)
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManual(true);
                      patch({ slug: e.target.value.toLowerCase() });
                    }}
                    placeholder="pos-showroom"
                  />
                </label>
                <label className="text-sm">
                  بادئة الترقيم
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-mono"
                    value={form.prefix}
                    onChange={(e) => patch({ prefix: e.target.value })}
                    placeholder="POS-"
                  />
                </label>
              </div>
            </section>

            <section className="mb-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">الثوابت والإقفال</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm">المخزن الافتراضي</p>
                  <WarehouseSelect
                    value={form.defaultWarehouseId}
                    onChange={(id) => patch({ defaultWarehouseId: id })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.lockWarehouse}
                      onChange={(e) => patch({ lockWarehouse: e.target.checked })}
                    />
                    قفل المخزن ومنع التغيير
                  </label>
                </div>
                <div>
                  <p className="mb-1 text-sm">الخزينة / الحساب الافتراضي</p>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    value={form.defaultTreasuryId}
                    onChange={(e) => patch({ defaultTreasuryId: e.target.value })}
                  >
                    <option value="">—</option>
                    {safes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.arabicName ?? s.code ?? s.id}
                      </option>
                    ))}
                  </select>
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.lockTreasury}
                      onChange={(e) => patch({ lockTreasury: e.target.checked })}
                    />
                    قفل الخزينة
                  </label>
                </div>
                <div>
                  <p className="mb-1 text-sm">مركز التكلفة الافتراضي</p>
                  <CostCenterSelect
                    value={form.defaultCostCenterId}
                    onChange={(id) => patch({ defaultCostCenterId: id })}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={form.lockCostCenter}
                      onChange={(e) => patch({ lockCostCenter: e.target.checked })}
                    />
                    قفل مركز التكلفة
                  </label>
                </div>
              </div>
            </section>

            <section className="mb-5 space-y-2">
              <h3 className="text-sm font-semibold text-slate-700">الأعمدة المتاحة</h3>
              {DOCUMENT_PROFILE_COLUMN_OPTIONS.map((col) => (
                <label key={col.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.visibleColumns.includes(col.id)}
                    onChange={() =>
                      patch({
                        visibleColumns: form.visibleColumns.includes(col.id)
                          ? form.visibleColumns.filter((id) => id !== col.id)
                          : [...form.visibleColumns, col.id],
                      })
                    }
                  />
                  {col.labelAr}
                </label>
              ))}
            </section>

            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-[#094C6B]">
              <input
                type="checkbox"
                checked={form.showInSidebar}
                onChange={(e) => patch({ showInSidebar: e.target.checked })}
              />
              إظهار كزر مستقل في القائمة الجانبية
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-lg px-4 py-2 text-sm" onClick={() => setOpen(false)}>
                إلغاء
              </button>
              <button
                type="button"
                className="rounded-lg bg-[#0E79AA] px-4 py-2 text-sm text-white"
                onClick={save}
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CommandCenter>
  );
}
