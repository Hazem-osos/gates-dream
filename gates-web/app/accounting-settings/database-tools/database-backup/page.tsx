'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useEffect, useState } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type BackupRow = { name?: string; path?: string; createdAt?: string };

export default function DatabaseBackupPage() {
  useBackendReachability();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [includeData, setIncludeData] = useState(true);
  const [includeSchema, setIncludeSchema] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const invalidate = useInvalidateQuery();

  const { data: backupsRes, isLoading: backupsLoading } = useApiQuery<BackupRow[]>(
    ['database-tools', 'backups'],
    '/database-tools/backups'
  );

  const backupMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/backup',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء النسخة الاحتياطية');
        setError('');
        invalidate(['database-tools']);
        setOpen(false);
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل النسخ الاحتياطي');
        setSuccess('');
      },
    }
  );

  useEffect(() => {
    setOpen(true);
  }, []);

  const runBackup = () => {
    setError('');
    setSuccess('');
    if (!name.trim()) {
      setError('أدخل اسماً للنسخة');
      return;
    }
    backupMutation.mutate({
      name: name.trim(),
      path: path.trim() || undefined,
      includeData,
      includeSchema,
    });
  };

  const backups = backupsRes?.data ?? [];

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">النسخ الإحتياطي لقاعدة البيانات</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-6 text-[#0A3D5E] space-y-3">
            <p>النسخ الاحتياطية المسجلة على الخادم ({backupsLoading ? '…' : backups.length})</p>
            <ul className="text-sm list-disc pr-5 max-h-40 overflow-y-auto">
              {backups.slice(0, 20).map((b, i) => (
                <li key={i}>{(b as BackupRow).name ?? JSON.stringify(b)}</li>
              ))}
              {backups.length === 0 && !backupsLoading ? <li className="list-none">لا توجد نسخ بعد</li> : null}
            </ul>
          </div>
        </InnerCard>
      </OuterCard>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl w-[720px] max-w-[95%] shadow-xl border border-[#D6EAF3]">
            <div className="px-6 py-4 border-b border-[#E6F0F7] text-center font-bold text-[#0A3D5E]">
              النسخ الإحتياطي لقاعدة البيانات
            </div>
            <div className="px-6 py-6">
              <div className="grid grid-cols-3 items-center gap-4 mb-4">
                <label className="text-[#0A3D5E] font-semibold">الإسم</label>
                <div className="col-span-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="إدخل الإسم"
                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 items-center gap-4">
                <label className="text-[#0A3D5E] font-semibold">المسار (اختياري)</label>
                <div className="col-span-2 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                      className="w-full p-2.5 pr-10 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0E78AA]">📁</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[#0A3D5E]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeData}
                    onChange={(e) => setIncludeData(e.target.checked)}
                    className="w-4 h-4"
                  />
                  تضمين البيانات
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeSchema}
                    onChange={(e) => setIncludeSchema(e.target.checked)}
                    className="w-4 h-4"
                  />
                  تضمين الهيكل
                </label>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-[#E6F0F7]">
              <button
                onClick={() => setOpen(false)}
                className="px-10 py-3 rounded-xl bg-[#2C6FE4] text-white hover:opacity-95 transition-all"
              >
                إغلاق
              </button>
              <button
                onClick={runBackup}
                disabled={backupMutation.isPending}
                className="px-10 py-3 rounded-xl bg-[#20B26B] text-white hover:opacity-95 transition-all disabled:opacity-60"
              >
                {backupMutation.isPending ? 'جاري النسخ…' : 'نسخ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
