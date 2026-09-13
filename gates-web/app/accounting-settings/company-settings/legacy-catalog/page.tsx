'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type ValueKind = 'flag' | 'string';

interface CatalogCompanyKey {
  key: string;
  valueKind: ValueKind;
  defaultValue: string;
  currentValue: string;
  storedValue: string | null;
  isOverride: boolean;
  isBranchOverride: boolean;
  branchScoped: boolean;
}

interface CatalogModuleKey {
  pattern: string;
  baseName: string;
  key: string;
  valueKind: ValueKind;
  storedValue: string | null;
  currentValue: string | null;
  isOverride: boolean;
}

interface CatalogPayload {
  companyKeys: CatalogCompanyKey[];
  moduleSuffixedKeyPatterns: string[];
  branchScopedKeys: string[];
  moduleKeys: CatalogModuleKey[];
  moduleCode: string | null;
  branchId: string | null;
}

interface BranchRow {
  id: string;
  arabicName?: string;
  englishName?: string | null;
}

interface NewModuleRow {
  id: string;
  fullCode: string;
  nameAr: string;
  baseType: string;
}

function isLegacyTrue(value: string | null | undefined): boolean {
  if (value == null) return false;
  const v = value.trim().toLowerCase();
  return v === 't' || v === 'true' || v === '1' || v === 'yes';
}

export default function LegacySettingsCatalogPage() {
  useBackendReachability();

  const { companyId } = useFirstCompany();
  const invalidate = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'flag' | 'string'>('all');
  const [branchId, setBranchId] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: branchesRes } = useApiQuery<BranchRow[]>(
    ['company-branches', companyId ?? 'none'],
    '/company/branches',
    undefined,
    { enabled: Boolean(companyId) }
  );
  const branches = branchesRes?.data ?? [];

  const { data: modulesRes } = useApiQuery<NewModuleRow[]>(
    ['new-modules', 'catalog-admin'],
    '/new-modules',
    undefined,
    { enabled: Boolean(companyId) }
  );
  const modules = modulesRes?.data ?? [];

  const { data: catalogRes, isLoading } = useApiQuery<CatalogPayload>(
    ['company-settings-catalog', companyId ?? 'none', branchId || 'company', moduleCode || 'none'],
    '/company-settings/catalog',
    {
      ...(branchId ? { branchId } : {}),
      ...(moduleCode ? { moduleCode } : {}),
    },
    { enabled: Boolean(companyId) }
  );
  const catalog = catalogRes?.data;

  const companyKeys = useMemo(() => {
    const rows = catalog?.companyKeys ?? [];
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (kindFilter !== 'all' && row.valueKind !== kindFilter) return false;
      if (!q) return true;
      return (
        row.key.toLowerCase().includes(q) ||
        (row.currentValue ?? '').toLowerCase().includes(q)
      );
    });
  }, [catalog?.companyKeys, search, kindFilter]);

  const displayValue = (key: string, fallback: string | null) =>
    drafts[key] !== undefined ? drafts[key] : (fallback ?? '');

  const saveKey = async (name: string, value: string, scoped: boolean) => {
    setError('');
    setSavingKey(name);
    try {
      await apiClient.put(`/company-settings/${name}`, {
        value,
        branchId: scoped && branchId ? branchId : null,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      invalidate(['company-settings-catalog']);
      invalidate(['company-settings-entries']);
      setSuccess(`تم حفظ ${name}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `فشل حفظ ${name}`);
    } finally {
      setSavingKey(null);
    }
  };

  const resetKey = async (name: string, scoped: boolean) => {
    setError('');
    setSavingKey(name);
    try {
      await apiClient.delete(`/company-settings/${name}`, scoped && branchId ? { branchId } : undefined);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      invalidate(['company-settings-catalog']);
      setSuccess(`تمت إعادة ${name} للقيمة الافتراضية`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `فشل حذف ${name}`);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-2">كتالوج إعدادات الشركة</h1>
          <p className="text-sm text-[#094C6B] mb-3">
            {catalog?.companyKeys.length ?? 81} مفتاحاً على مستوى الشركة، و{' '}
            {catalog?.moduleSuffixedKeyPatterns.length ?? 73} نمطاً ملحقاً بكود الشاشة، مع تجاوز على مستوى الفرع للمفاتيح المدعومة.
          </p>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-[#094C6B]">
                بحث
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-56 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
                  placeholder="اسم المفتاح أو القيمة"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#094C6B]">
                النوع
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
                  className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
                >
                  <option value="all">الكل</option>
                  <option value="flag">أعلام T/F</option>
                  <option value="string">نصوص</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-[#094C6B]">
                فرع التجاوز
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
                >
                  <option value="">الشركة كلها</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.arabicName || b.englishName || b.id}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                href="/accounting-settings/company-settings/accounting-settings"
                className="text-sm text-[#0E78AA] underline"
              >
                الإعدادات المحاسبية المبوّبة
              </Link>
              <Link
                href="/accounting-settings/company-settings/gl-account-defaults"
                className="text-sm text-[#0E78AA] underline"
              >
                الحسابات الافتراضية
              </Link>
            </div>

            {branchId && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                التجاوز على مستوى الفرع يُحفظ حالياً لمفاتيح: {(catalog?.branchScopedKeys ?? ['CustomersAccount']).join(', ')}.
                باقي المفاتيح تُحفظ على مستوى الشركة.
              </p>
            )}

            {isLoading ? (
              <div className="py-8 text-center text-[#094C6B]">جاري تحميل الكتالوج…</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3]">
                <table className="min-w-full text-right border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">المفتاح</th>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">النوع</th>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">الافتراضي</th>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">القيمة</th>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">الحالة</th>
                      <th className="bg-[#0E78AA] text-white py-2 px-3">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyKeys.map((row, i) => {
                      const value = displayValue(row.key, row.currentValue);
                      const scoped = row.branchScoped;
                      return (
                        <tr key={row.key} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                          <td className="py-2 px-3 font-mono text-[#094C6B]">
                            {row.key}
                            {row.branchScoped && (
                              <span className="mr-2 text-[10px] text-[#0E78AA]">فرع</span>
                            )}
                          </td>
                          <td className="py-2 px-3">{row.valueKind === 'flag' ? 'علم' : 'نص'}</td>
                          <td className="py-2 px-3 font-mono text-gray-500">{row.defaultValue || '—'}</td>
                          <td className="py-2 px-3">
                            {row.valueKind === 'flag' ? (
                              <label className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isLegacyTrue(value)}
                                  onChange={(e) =>
                                    setDrafts((prev) => ({ ...prev, [row.key]: e.target.checked ? 'T' : 'F' }))
                                  }
                                />
                                {isLegacyTrue(value) ? 'T' : 'F'}
                              </label>
                            ) : (
                              <input
                                value={value}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))}
                                className="h-8 w-full min-w-[160px] rounded border border-[#D6EAF3] bg-white px-2"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {row.isBranchOverride ? (
                              <span className="text-amber-700">تجاوز فرع</span>
                            ) : row.isOverride ? (
                              <span className="text-green-700">مخزّن</span>
                            ) : (
                              <span className="text-gray-400">افتراضي</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={savingKey === row.key}
                                onClick={() => void saveKey(row.key, value, scoped)}
                                className="px-2 py-1 rounded bg-[#0E78AA] text-white text-xs disabled:opacity-50"
                              >
                                حفظ
                              </button>
                              {row.isOverride && (
                                <button
                                  type="button"
                                  disabled={savingKey === row.key}
                                  onClick={() => void resetKey(row.key, scoped)}
                                  className="px-2 py-1 rounded border border-[#D6EAF3] text-xs text-[#094C6B]"
                                >
                                  افتراضي
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </InnerCard>
      </OuterCard>

      <div className="mt-6">
        <OuterCard>
          <InnerCard>
            <div className="p-4 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[#0E78AA] font-bold">إعدادات ملحقة بكود الشاشة</div>
                  <p className="text-xs text-gray-500 mt-1">
                    مثل AutoPostSI02 و CascadingDiscountsPI01 و AllowMinusQty على مستوى الشركة أعلاه.
                  </p>
                </div>
                <label className="flex flex-col gap-1 text-sm text-[#094C6B]">
                  الشاشة (NewModule)
                  <select
                    value={moduleCode}
                    onChange={(e) => setModuleCode(e.target.value)}
                    className="h-9 min-w-[240px] rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3"
                  >
                    <option value="">— اختر شاشة —</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.fullCode}>
                        {m.fullCode} — {m.nameAr}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {!moduleCode ? (
                <div className="text-sm text-gray-500 py-4">اختر شاشة لعرض الأنماط الـ {catalog?.moduleSuffixedKeyPatterns.length ?? 73}.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#D6EAF3] max-h-[480px]">
                  <table className="min-w-full text-right border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="bg-[#0E78AA] text-white py-2 px-3">المفتاح</th>
                        <th className="bg-[#0E78AA] text-white py-2 px-3">الأساس</th>
                        <th className="bg-[#0E78AA] text-white py-2 px-3">القيمة</th>
                        <th className="bg-[#0E78AA] text-white py-2 px-3">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(catalog?.moduleKeys ?? []).map((row, i) => {
                        const value = displayValue(row.key, row.currentValue);
                        return (
                          <tr key={row.key} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                            <td className="py-2 px-3 font-mono">{row.key}</td>
                            <td className="py-2 px-3">{row.baseName}</td>
                            <td className="py-2 px-3">
                              {row.valueKind === 'flag' ? (
                                <label className="inline-flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isLegacyTrue(value)}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({ ...prev, [row.key]: e.target.checked ? 'T' : 'F' }))
                                    }
                                  />
                                  {isLegacyTrue(value) ? 'T' : 'F'}
                                </label>
                              ) : (
                                <input
                                  value={value}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))}
                                  className="h-8 w-full min-w-[160px] rounded border border-[#D6EAF3] bg-white px-2"
                                />
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={savingKey === row.key}
                                  onClick={() => void saveKey(row.key, value, false)}
                                  className="px-2 py-1 rounded bg-[#0E78AA] text-white text-xs disabled:opacity-50"
                                >
                                  حفظ
                                </button>
                                {row.isOverride && (
                                  <button
                                    type="button"
                                    disabled={savingKey === row.key}
                                    onClick={() => void resetKey(row.key, false)}
                                    className="px-2 py-1 rounded border border-[#D6EAF3] text-xs text-[#094C6B]"
                                  >
                                    حذف
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
