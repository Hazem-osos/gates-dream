'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FormSectionCard } from '@/components/ui';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { downloadTenantJsonBackup } from '@/lib/company/download-tenant-backup';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

function isOwnerRole(roles: string[] | undefined) {
  return (roles ?? []).some((role) => {
    const n = role.trim().toLowerCase();
    return n === 'admin' || n === 'owner' || n === 'super_admin' || n === 'superadmin';
  });
}

export default function OwnerBackupPage() {
  const { profile } = useCurrentUserProfile();
  const canBackup = isOwnerRole(profile?.roles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6" dir="rtl">
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/settings/company" className="text-[#0E79AA] hover:underline">
          إعدادات الشركة
        </Link>
        <span className="mx-1">/</span>
        <span>النسخ الاحتياطي</span>
      </div>

      <FormSectionCard title="النسخ الاحتياطي وتصدير البيانات الشامل (Full Data Backup)">
        <p className="mb-4 text-sm leading-7 text-slate-600">
          يمكنك في أي وقت تنزيل نسخة احتياطية كاملة ومستقلة لجميع فواتيرك، حساباتك، وحركات المخازن
          للاحتفاظ بها على جهازك الشخصي.
        </p>
        {!canBackup ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            تنزيل النسخة الاحتياطية متاح لمالك المنظومة فقط.
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0A3D5E] px-4 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError('');
                setSuccess('');
                try {
                  await downloadTenantJsonBackup();
                  setSuccess('تم تنزيل النسخة الاحتياطية');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'تعذر التنزيل');
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <span aria-hidden>📦</span>
            )}
            {busy ? 'جاري التجهيز…' : '📦 تنزيل نسخة احتياطية كاملة (JSON/ZIP)'}
          </button>
        )}
      </FormSectionCard>

      <ErrorToast message={error} onClose={() => setError('')} />
      <SuccessToast message={success} onClose={() => setSuccess('')} />
    </div>
  );
}
