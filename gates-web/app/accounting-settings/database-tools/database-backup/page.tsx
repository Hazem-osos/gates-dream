'use client';
import { AccountingSettingsPageHeader } from '@/components/accounting-settings';

import Link from 'next/link';
import { useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
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

export default function DatabaseBackupPage() {
  useBackendReachability();
  const { profile } = useCurrentUserProfile();
  const canBackup = isOwnerRole(profile?.roles);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const runBackup = async () => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await downloadTenantJsonBackup();
      setSuccess('تم تنزيل النسخة الاحتياطية على جهازك');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنزيل النسخة الاحتياطية');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AccountingSettingsPageHeader title="النسخ الإحتياطي لقاعدة البيانات" />
<OuterCard>
        <InnerCard>
          <div className="p-6 text-[#0A3D5E] space-y-4 text-sm leading-7">
            <p>
              تنزّل نسخة احتياطية <strong>لبيانات شركتك الحالية</strong> (فواتير، حسابات، مخزون، وغيرها) كملف
              JSON على جهازك. هذا آمن ولا يؤثر على بيانات شركات أخرى على المنصة.
            </p>
            <p className="text-slate-600">
              نسخ ملفات <code className="text-xs">.sql</code> لقاعدة البيانات بالكامل على الخادم يتم من قِبل مسؤول
              النظام فقط (بنية تحتية)، وليس من هذه الشاشة.
            </p>
            {!canBackup ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                تنزيل النسخة الاحتياطية متاح لمالك المنظومة فقط.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void runBackup()}
                  disabled={busy}
                  className="px-8 py-3 rounded-xl bg-[#20B26B] text-white font-semibold hover:opacity-95 transition-all disabled:opacity-60"
                >
                  {busy ? 'جاري التجهيز…' : 'تنزيل نسخة احتياطية'}
                </button>
                <Link
                  href="/settings/backup"
                  className="text-[#0E78AA] underline text-sm"
                >
                  نفس الخيار من الإعدادات → النسخ الاحتياطي
                </Link>
              </div>
            )}
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </>
  );
}
