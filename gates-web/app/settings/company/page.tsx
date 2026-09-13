'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useEffect, useMemo, useState } from 'react';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { Building2, GitBranch, ShieldCheck } from 'lucide-react';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { downloadTenantBackup } from '@/lib/company/download-tenant-backup';

interface CompanyCurrent {
  id: string;
  nameAr: string;
  nameEn: string | null;
  taxRegistrationNumber: string | null;
  commercialRegister: string | null;
  activityCode: string | null;
  currencyCode: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  eInvoiceSettings: {
    clientId: string | null;
    clientSecret: string | null;
    clientSecretConfigured?: boolean;
    activityCode: string | null;
    tokenPin: string | null;
    environment: string;
    issuerTaxId: string | null;
  } | null;
}

interface BranchRow {
  id: string;
  arabicName: string;
  defaultWarehouseId: string | null;
  defaultSafeId: string | null;
  defaultWarehouse?: { id: string; arabicName: string } | null;
  defaultSafe?: { id: string; arabicName: string } | null;
}

interface WarehouseRow {
  id: string;
  arabicName: string;
  branchId?: string | null;
}

interface SafeRow {
  id: string;
  arabicName: string;
}

function isOwnerRole(roles: string[] | undefined) {
  return (roles ?? []).some((role) => {
    const n = role.trim().toLowerCase();
    return n === 'admin' || n === 'owner' || n === 'super_admin' || n === 'superadmin';
  });
}

export default function CompanySettingsPage() {
  useBackendReachability();
  const { profile } = useCurrentUserProfile();
  const canBackup = isOwnerRole(profile?.roles);
  const [backupBusy, setBackupBusy] = useState(false);
  const invalidate = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<Partial<CompanyCurrent>>({});
  const [eInv, setEInv] = useState({
    clientId: '',
    clientSecret: '',
    activityCode: '',
  });
  const [branchDraft, setBranchDraft] = useState<Record<string, { wh: string; safe: string }>>({});

  const { data: companyRes, isLoading } = useApiQuery<CompanyCurrent>(
    ['company-current'],
    '/company/current'
  );
  const { data: branchesRes } = useApiQuery<BranchRow[]>(['company-branches'], '/company/branches', {
    limit: 100,
  });
  const { data: whRes } = useApiQuery<WarehouseRow[]>(
    ['warehouses-list'],
    '/inventory/warehouses',
    { limit: 200 }
  );
  const { data: safesRes } = useApiQuery<SafeRow[]>(
    ['safes-list'],
    '/accounting/safes',
    { limit: 200 }
  );

  const company = companyRes?.data;
  const branches = useMemo(() => branchesRes?.data ?? [], [branchesRes?.data]);
  const warehouses = whRes?.data ?? [];
  const safes = safesRes?.data ?? [];

  useEffect(() => {
    if (!company) return;
    setForm(company);
    setEInv({
      clientId: company.eInvoiceSettings?.clientId ?? '',
      clientSecret: '',
      activityCode: company.eInvoiceSettings?.activityCode ?? company.activityCode ?? '',
    });
  }, [company]);

  useEffect(() => {
    if (!branches.length) return;
    setBranchDraft((prev) => {
      const next = { ...prev };
      for (const b of branches) {
        next[b.id] = {
          wh: b.defaultWarehouseId ?? prev[b.id]?.wh ?? '',
          safe: b.defaultSafeId ?? prev[b.id]?.safe ?? '',
        };
      }
      return next;
    });
  }, [branches]);

  const saveCompany = useApiMutation<CompanyCurrent, Record<string, unknown>>(
    '/company/current',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم حفظ بيانات الشركة');
        invalidate(['company-current']);
      },
      onError: (e) => setError(e.message),
    }
  );

  const saveBranch = useApiMutation<BranchRow, Record<string, unknown>>(
    '/company/branches',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ إعدادات الفرع');
        invalidate(['company-branches']);
      },
      onError: (e) => setError(e.message),
    }
  );

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setForm((f) => ({ ...f, logoUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const eInvFilledCount = [eInv.clientId, eInv.clientSecret, eInv.activityCode].filter(
    (v) => String(v ?? '').trim().length > 0
  ).length;

  return (
    <div className="mx-auto max-w-5xl p-6" dir="rtl">
      <h1 className="mb-6 text-2xl font-bold text-[#0E79AA]">إعدادات وبيانات الشركة</h1>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      {isLoading ? (
        <p className="text-gray-500">جاري التحميل…</p>
      ) : (
        <>
          <FormSectionCard title="البيانات الأساسية" subtitle="اسم الشركة والبيانات الرسمية" icon={Building2}>
            <CompactFormField
              label="الاسم (عربي)"
              value={form.nameAr ?? ''}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
            />
            <CompactFormField
              label="الاسم (إنجليزي)"
              value={form.nameEn ?? ''}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
            <CompactFormField
              label="الرقم الضريبي"
              value={form.taxRegistrationNumber ?? ''}
              onChange={(e) => setForm({ ...form, taxRegistrationNumber: e.target.value })}
            />
            <CompactFormField
              label="السجل التجاري"
              value={form.commercialRegister ?? ''}
              onChange={(e) => setForm({ ...form, commercialRegister: e.target.value })}
            />
            <CompactFormField
              label="العملة الافتراضية"
              value={form.currencyCode ?? ''}
              onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
            />
            <CompactFormField
              label="الهاتف"
              placeholder="هاتف"
              value={form.phone ?? ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <CompactFormField
              label="البريد"
              placeholder="بريد"
              value={form.email ?? ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <CompactFormField
              label="العنوان"
              className="sm:col-span-2 lg:col-span-2"
              value={form.address ?? ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <CompactFormField label="شعار الشركة">
                <input
                  type="file"
                  accept="image/*"
                  className={compactControlClass}
                  onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
                />
              </CompactFormField>
              {form.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logoUrl} alt="logo" className="mt-2 h-16 object-contain" />
              )}
            </div>
          </FormSectionCard>

          <AdvancedFieldsSection title="الفوترة الإلكترونية (ETA)" badgeCount={eInvFilledCount}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CompactFormField
                label="Client ID"
                value={eInv.clientId}
                onChange={(e) => setEInv({ ...eInv, clientId: e.target.value })}
              />
              <CompactFormField
                label="Client Secret"
                type="password"
                placeholder={
                  company?.eInvoiceSettings?.clientSecretConfigured
                    ? '******** (اتركه فارغاً للإبقاء)'
                    : ''
                }
                value={eInv.clientSecret}
                onChange={(e) => setEInv({ ...eInv, clientSecret: e.target.value })}
              />
              <CompactFormField
                label="Issuer Activity Code"
                value={eInv.activityCode}
                onChange={(e) => setEInv({ ...eInv, activityCode: e.target.value })}
              />
            </div>
          </AdvancedFieldsSection>

          <FormSectionCard
            title="الفروع — المخزن والخزينة الافتراضية"
            icon={GitBranch}
            bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1"
          >
            <div className="space-y-3">
              {branches.map((b) => (
                <div key={b.id} className="rounded-xl border border-[#E6F0F7] bg-white p-4">
                  <div className="mb-3 text-sm font-semibold text-zinc-900">{b.arabicName}</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <CompactFormField label="المخزن الافتراضي">
                      <select
                        className={compactControlClass}
                        value={branchDraft[b.id]?.wh ?? ''}
                        onChange={(e) =>
                          setBranchDraft((d) => ({
                            ...d,
                            [b.id]: { ...d[b.id], wh: e.target.value },
                          }))
                        }
                      >
                        <option value="">—</option>
                        {warehouses
                          .filter((w) => !w.branchId || w.branchId === b.id)
                          .map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.arabicName}
                            </option>
                          ))}
                      </select>
                    </CompactFormField>
                    <CompactFormField label="الخزينة النقدية الافتراضية">
                      <select
                        className={compactControlClass}
                        value={branchDraft[b.id]?.safe ?? ''}
                        onChange={(e) =>
                          setBranchDraft((d) => ({
                            ...d,
                            [b.id]: { ...d[b.id], safe: e.target.value },
                          }))
                        }
                      >
                        <option value="">—</option>
                        {safes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.arabicName}
                          </option>
                        ))}
                      </select>
                    </CompactFormField>
                  </div>
                  <button
                    type="button"
                    className="mt-3 h-9 text-sm font-medium text-[#0E79AA]"
                    onClick={() =>
                      saveBranch.mutate({
                        id: b.id,
                        arabicName: b.arabicName,
                        defaultWarehouseId: branchDraft[b.id]?.wh || null,
                        defaultSafeId: branchDraft[b.id]?.safe || null,
                      })
                    }
                  >
                    حفظ هذا الفرع
                  </button>
                </div>
              ))}
            </div>
          </FormSectionCard>

          {canBackup ? (
            <FormSectionCard title="نسخة احتياطية مشفّرة">
              <p className="mb-3 text-sm text-slate-600">
                للنسخة الشاملة بصيغة JSON افتح{' '}
                <a href="/settings/backup" className="font-semibold text-[#0E79AA] hover:underline">
                  صفحة النسخ الاحتياطي
                </a>
                .
              </p>
              <p className="mb-3 text-sm text-slate-600">
                تنزيل أرشيف مشفّر لبيانات شركتك (عملاء، فواتير، قيود، أصناف). الملف لا يُفتح إلا بمفتاح التشفير الخاص بالخادم.
              </p>
              <button
                type="button"
                disabled={backupBusy}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0A3D5E] px-3 text-sm font-bold text-white disabled:opacity-50"
                onClick={() => {
                  void (async () => {
                    setBackupBusy(true);
                    setError('');
                    try {
                      await downloadTenantBackup();
                      setSuccess('تم تنزيل النسخة الاحتياطية المشفّرة');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'تعذر التنزيل');
                    } finally {
                      setBackupBusy(false);
                    }
                  })();
                }}
              >
                <ShieldCheck className="h-4 w-4" />
                {backupBusy ? 'جاري التجهيز…' : 'تنزيل النسخة الاحتياطية'}
              </button>
            </FormSectionCard>
          ) : null}

          <FormStickyFooter
            onSave={() =>
              saveCompany.mutate({
                nameAr: form.nameAr,
                nameEn: form.nameEn,
                taxRegistrationNumber: form.taxRegistrationNumber,
                commercialRegister: form.commercialRegister,
                currencyCode: form.currencyCode,
                logoUrl: form.logoUrl,
                phone: form.phone,
                email: form.email,
                address: form.address,
                activityCode: eInv.activityCode,
                eInvoiceSettings: {
                  clientId: eInv.clientId || null,
                  ...(eInv.clientSecret ? { clientSecret: eInv.clientSecret } : {}),
                  activityCode: eInv.activityCode || null,
                },
              })
            }
            saveText="حفظ بيانات الشركة"
            saveLoading={saveCompany.isPending}
            saveDisabled={saveCompany.isPending}
            respectPermissions={false}
          />
        </>
      )}
    </div>
  );
}
