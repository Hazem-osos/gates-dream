'use client';
import { AccountingSettingsPageHeader } from '@/components/accounting-settings';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useState } from 'react';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function ExportImportDataPage() {
  useBackendReachability();

  const [activeTab, setActiveTab] = useState<'customers' | 'vendors' | 'items'>('customers');
  const [filePath, setFilePath] = useState('');
  const [format, setFormat] = useState<'json' | 'csv' | 'sql'>('json');
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tableHint: Record<typeof activeTab, string[]> = {
    customers: ['customers', 'customer'],
    vendors: ['vendors', 'supplier'],
    items: ['items', 'inventory_items'],
  };

  const exportMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/export',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم التصدير');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل التصدير');
        setSuccess('');
      },
    }
  );

  const importMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/database-tools/import',
    'POST',
    {
      onSuccess: (res) => {
        setSuccess(res.message || 'تم الاستيراد');
        setError('');
      },
      onError: (e: { message?: string }) => {
        setError(e?.message || 'فشل الاستيراد');
        setSuccess('');
      },
    }
  );

  const runExport = () => {
    setError('');
    setSuccess('');
    exportMutation.mutate({
      tables: tableHint[activeTab],
      format,
      path: filePath.trim() || undefined,
    });
  };

  const runImport = () => {
    setError('');
    setSuccess('');
    if (!filePath.trim()) {
      setError('أدخل مسار الملف للاستيراد');
      return;
    }
    importMutation.mutate({
      file: filePath.trim(),
      format,
      tables: tableHint[activeTab],
      overwrite,
    });
  };

  const TabBtn = ({
    id,
    label,
  }: {
    id: 'customers' | 'vendors' | 'items';
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 rounded-t-xl border-b-2 ${
        activeTab === id ? 'text-[#0E78AA] border-[#0E78AA]' : 'text-[#0A3D5E]/70 border-transparent'
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <AccountingSettingsPageHeader title="تصدير و إستيراد البيانات" />
      <OuterCard>
        <InnerCard>
          <div className="p-4 space-y-5">
            <div className="flex items-center gap-8 border-b border-[#E6F0F7] pb-2">
              <TabBtn id="customers" label="بيانات العملاء" />
              <TabBtn id="vendors" label="بيانات الموردين" />
              <TabBtn id="items" label="بيانات الأصناف" />
            </div>

            <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-[#0A3D5E] font-semibold">التنسيق</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'json' | 'csv' | 'sql')}
                  className="h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-2"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-[#0A3D5E] font-semibold min-w-[100px]">مسار الملف</label>
                <input
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="اختياري للتصدير، مطلوب للاستيراد"
                  className="flex-1 min-w-[200px] h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
                />
              </div>
              <label className="flex items-center gap-2 text-[#0A3D5E]">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="w-4 h-4"
                />
                الكتابة فوق البيانات عند الاستيراد
              </label>
              <div className="flex flex-wrap justify-end gap-4">
                <button
                  type="button"
                  onClick={runExport}
                  disabled={exportMutation.isPending}
                  className="px-5 py-2.5 bg-white border border-[#D6EAF3] rounded-xl text-[#0E78AA] hover:bg-[#F6FBFD] disabled:opacity-60"
                >
                  {exportMutation.isPending ? 'جاري التصدير…' : 'تصدير ⎙'}
                </button>
                <button
                  type="button"
                  onClick={runImport}
                  disabled={importMutation.isPending}
                  className="px-5 py-2.5 bg-white border border-[#D6EAF3] rounded-xl text-[#0E78AA] hover:bg-[#F6FBFD] disabled:opacity-60"
                >
                  {importMutation.isPending ? 'جاري الاستيراد…' : 'استيراد ⏏'}
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600">
              يتم إرسال الطلب إلى واجهات <code className="text-xs">/database-tools/export</code> و{' '}
              <code className="text-xs">/database-tools/import</code> حسب الجداول المرتبطة بالتبويب الحالي.
            </p>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </>
  );
}
