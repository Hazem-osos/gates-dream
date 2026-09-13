'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useEffect, useMemo, useState } from 'react';
import {
  PageHeader,
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  compactControlClass,
} from '@/components/ui';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Building2, CalendarRange, GitBranch, ShieldCheck } from 'lucide-react';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { downloadTenantBackup } from '@/lib/company/download-tenant-backup';
import { refreshTenantContextFromApi } from '@/lib/tenant/refresh-tenant-context';
import { notifyTenantContextReady, setTenantContext } from '@/lib/tenant/tenant-context-storage';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';

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

interface FiscalYearRow {
  id: string;
  arabicName?: string | null;
  status: string;
  startDate: string;
  endDate: string;
}

type BasicsSaveResult = CompanyCurrent & {
  branchId?: string;
  fiscalYearId?: string;
};

function isOwnerRole(roles: string[] | undefined) {
  return (roles ?? []).some((role) => {
    const n = role.trim().toLowerCase();
    return n === 'admin' || n === 'owner' || n === 'super_admin' || n === 'superadmin';
  });
}

function yearStartIso(year = new Date().getFullYear()) {
  return `${year}-01-01`;
}

function yearEndIso(year = new Date().getFullYear()) {
  return `${year}-12-31`;
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const dmy = value.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const companyOnlyQuery = { requireFullTenant: false as const };

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
  const [branchForm, setBranchForm] = useState({
    id: '',
    arabicName: 'الفرع الرئيسي',
    warehouseName: 'المخزن الرئيسي',
    safeName: 'الخزينة الرئيسية',
  });
  const [fiscalForm, setFiscalForm] = useState({
    id: '',
    name: `السنة المالية ${new Date().getFullYear()}`,
    startDate: yearStartIso(),
    endDate: yearEndIso(),
  });

  const { data: companyRes, isLoading } = useApiQuery<CompanyCurrent>(
    ['company-current'],
    '/company/current',
    undefined,
    companyOnlyQuery
  );
  const { data: branchesRes } = useApiQuery<BranchRow[]>(
    ['company-branches'],
    '/company/branches',
    { limit: 100 },
    companyOnlyQuery
  );
  const { data: fyRes } = useApiQuery<FiscalYearRow[]>(
    ['company-fiscal-years'],
    '/company/fiscal-years',
    { page: 1, limit: 50 },
    companyOnlyQuery
  );
  const { data: whRes } = useApiQuery<WarehouseRow[]>(
    ['warehouses-list'],
    '/inventory/warehouses',
    { limit: 200 },
    companyOnlyQuery
  );
  const { data: safesRes } = useApiQuery<SafeRow[]>(
    ['safes-list'],
    '/accounting/safes',
    { limit: 200 },
    companyOnlyQuery
  );

  const company = companyRes?.data;
  const branches = useMemo(() => branchesRes?.data ?? [], [branchesRes?.data]);
  const years = useMemo(() => fyRes?.data ?? [], [fyRes?.data]);
  const warehouses = whRes?.data ?? [];
  const safes = safesRes?.data ?? [];
  const mainBranch = branches[0];

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
    if (!mainBranch) return;
    setBranchForm((prev) => ({
      id: mainBranch.id,
      arabicName: mainBranch.arabicName || prev.arabicName,
      warehouseName:
        mainBranch.defaultWarehouse?.arabicName ||
        warehouses.find((w) => w.id === mainBranch.defaultWarehouseId)?.arabicName ||
        prev.warehouseName,
      safeName:
        mainBranch.defaultSafe?.arabicName ||
        safes.find((s) => s.id === mainBranch.defaultSafeId)?.arabicName ||
        prev.safeName,
    }));
  }, [mainBranch, warehouses, safes]);

  useEffect(() => {
    const year = years[0];
    if (!year) return;
    const start = toInputDate(year.startDate) || yearStartIso();
    setFiscalForm({
      id: year.id,
      name: year.arabicName?.trim() || `السنة المالية ${start.slice(0, 4)}`,
      startDate: start,
      endDate: toInputDate(year.endDate) || yearEndIso(),
    });
  }, [years]);

  const saveBasics = useApiMutation<BasicsSaveResult, Record<string, unknown>>(
    '/company/basics',
    'PUT',
    {
      successMessage: 'تم حفظ بيانات الشركة والفرع والسنة المالية',
      onSuccess: (res) => {
        const data = res.data;
        if (data?.branchId || data?.fiscalYearId) {
          setTenantContext({
            ...(data.branchId ? { branchId: data.branchId } : {}),
            ...(data.fiscalYearId ? { fiscalYearId: data.fiscalYearId } : {}),
          });
          notifyTenantContextReady();
        }
        clearConditionalGetCache();
        void refreshTenantContextFromApi().catch(() => undefined);
        setSuccess('تم حفظ بيانات الشركة والفرع والسنة المالية');
        invalidate(['company-current']);
        invalidate(['company-branches']);
        invalidate(['company-fiscal-years']);
        invalidate(['warehouses-list']);
        invalidate(['safes-list']);
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

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!String(form.nameAr ?? '').trim()) {
      setError('اسم الشركة مطلوب');
      return;
    }
    if (!branchForm.arabicName.trim()) {
      setError('اسم الفرع الرئيسي مطلوب');
      return;
    }
    if (!branchForm.warehouseName.trim() || !branchForm.safeName.trim()) {
      setError('عرّف المخزن الرئيسي والخزينة الرئيسية');
      return;
    }
    if (!fiscalForm.startDate || !fiscalForm.endDate) {
      setError('حدد بداية ونهاية السنة المالية');
      return;
    }
    if (fiscalForm.startDate >= fiscalForm.endDate) {
      setError('تاريخ بداية السنة المالية يجب أن يسبق تاريخ النهاية');
      return;
    }

    saveBasics.mutate({
      nameAr: form.nameAr?.trim(),
      nameEn: form.nameEn,
      taxRegistrationNumber: form.taxRegistrationNumber,
      commercialRegister: form.commercialRegister,
      currencyCode: form.currencyCode || 'EGP',
      logoUrl: form.logoUrl,
      phone: form.phone,
      email: form.email?.trim() || null,
      address: form.address,
      activityCode: eInv.activityCode,
      eInvoiceSettings: {
        clientId: eInv.clientId || null,
        ...(eInv.clientSecret ? { clientSecret: eInv.clientSecret } : {}),
        activityCode: eInv.activityCode || null,
      },
      branch: {
        ...(branchForm.id ? { id: branchForm.id } : {}),
        arabicName: branchForm.arabicName.trim(),
        warehouseName: branchForm.warehouseName.trim(),
        safeName: branchForm.safeName.trim(),
        defaultWarehouseId: mainBranch?.defaultWarehouseId || null,
        defaultSafeId: mainBranch?.defaultSafeId || null,
      },
      fiscalYear: {
        ...(fiscalForm.id ? { id: fiscalForm.id } : {}),
        name: fiscalForm.name.trim() || `السنة المالية ${fiscalForm.startDate.slice(0, 4)}`,
        startDate: fiscalForm.startDate,
        endDate: fiscalForm.endDate,
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl p-6" dir="rtl">
      <PageHeader
        title="إعدادات وبيانات الشركة"
        description="عرّف الشركة والفرع الرئيسي والسنة المالية من هنا — الحفظ من أعلى الصفحة"
        breadcrumbs={[{ label: 'الإعدادات' }, { label: 'بيانات الشركة' }]}
      />
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      {isLoading ? (
        <p className="text-gray-500">جاري التحميل…</p>
      ) : (
        <>
          <FormSectionCard title="البيانات الأساسية" subtitle="اسم الشركة والبيانات الرسمية" icon={Building2}>
            <CompactFormField
              label="الاسم (عربي)"
              required
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
              value={form.currencyCode ?? 'EGP'}
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

          <FormSectionCard
            title="السنة المالية"
            subtitle="هذه السنة هي اللي النظام يشتغل عليها — مش مجرد ملاحظة محفوظة"
            icon={CalendarRange}
          >
            <CompactFormField
              label="اسم السنة"
              required
              value={fiscalForm.name}
              onChange={(e) => setFiscalForm((f) => ({ ...f, name: e.target.value }))}
            />
            <DatePickerWithHijri
              label="من تاريخ"
              required
              value={fiscalForm.startDate}
              onChange={(value) => setFiscalForm((f) => ({ ...f, startDate: value }))}
            />
            <DatePickerWithHijri
              label="إلى تاريخ"
              required
              value={fiscalForm.endDate}
              onChange={(value) => setFiscalForm((f) => ({ ...f, endDate: value }))}
            />
          </FormSectionCard>

          <FormSectionCard
            title="الفرع الرئيسي — المخزن والخزينة"
            subtitle="فرع واحد يكفي للبداية. المخزن والخزينة يتسجلوا بالاسم هنا مش من قوائم فاضية"
            icon={GitBranch}
            bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            <CompactFormField
              label="اسم الفرع الرئيسي"
              required
              value={branchForm.arabicName}
              onChange={(e) => setBranchForm((f) => ({ ...f, arabicName: e.target.value }))}
            />
            <CompactFormField
              label="المخزن الرئيسي"
              required
              value={branchForm.warehouseName}
              onChange={(e) => setBranchForm((f) => ({ ...f, warehouseName: e.target.value }))}
            />
            <CompactFormField
              label="الخزينة الرئيسية"
              required
              value={branchForm.safeName}
              onChange={(e) => setBranchForm((f) => ({ ...f, safeName: e.target.value }))}
            />
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
                تنزيل أرشيف مشفّر لبيانات شركتك (عملاء، فواتير، قيود، أصناف). الملف لا يُفتح إلا بمفتاح
                التشفير الخاص بالخادم.
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
            onSave={handleSave}
            saveText="حفظ"
            saveLoading={saveBasics.isPending}
            saveDisabled={saveBasics.isPending}
            respectPermissions={false}
          />
        </>
      )}
    </div>
  );
}
