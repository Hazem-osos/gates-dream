'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { FormSectionCard, compactControlClass } from '@/components/ui';
import { ErpDocumentLayout, ErpDocumentPageHeader, erpFormGridClass } from '@/components/erp';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApiMutation } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

export default function ImportEntryPage() {
  useBackendReachability();

  const router = useRouter();
  const [file, setFile] = useState('');
  const [format, setFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [entryType, setEntryType] = useState<
    'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment'
  >('journal-entry');
  const [validateBeforeImport, setValidateBeforeImport] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const importMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/operations-management/import-entry',
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

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!file.trim()) {
      setError('أدخل مسار الملف');
      return;
    }
    importMutation.mutate({
      file: file.trim(),
      format,
      entryType,
      validateBeforeImport,
    });
  };

  const rowIndexes = Array.from({ length: 8 }, (_, i) => i + 1);
  const previewCols = ['م', 'رقم الحساب', 'إسم الحساب', 'الشرح', 'مدين', 'دائن'];

  return (
    <ErpDocumentLayout>
      <ErpDocumentPageHeader
        compact
        lockWhenPosted={false}
        breadcrumbs={[
          { label: 'الإعدادات المحاسبية', href: '/accounting-settings' },
          { label: 'إدارة العمليات' },
          { label: 'استيراد قيد' },
        ]}
        title="استيراد قيد"
        showDocumentRef={false}
        statusTone="info"
        statusLabel="استيراد"
        hideStandalonePost
        hideBrowseList
        onSaveDraft={handleSave}
        savePending={importMutation.isPending}
        onCancel={() => router.back()}
      />

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="ملف الاستيراد" subtitle="المسار والتنسيق ونوع القيد">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">مسار الملف</label>
          <input
            value={file}
            onChange={(e) => setFile(e.target.value)}
            className={compactControlClass}
            placeholder="/path/to/file.csv"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">التنسيق</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as 'csv' | 'excel' | 'json')}
            className={compactControlClass}
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">نوع القيد</label>
          <select
            value={entryType}
            onChange={(e) =>
              setEntryType(
                e.target.value as 'journal-entry' | 'invoice' | 'treasury-receipt' | 'treasury-payment'
              )
            }
            className={compactControlClass}
          >
            <option value="journal-entry">قيد يومية</option>
            <option value="invoice">فاتورة</option>
            <option value="treasury-receipt">قبض</option>
            <option value="treasury-payment">صرف</option>
          </select>
        </div>
        <label className="flex h-8 items-end gap-2 pb-1 text-sm text-[#0A3D5E]">
          <input
            type="checkbox"
            checked={validateBeforeImport}
            onChange={(e) => setValidateBeforeImport(e.target.checked)}
            className="h-4 w-4"
          />
          التحقق قبل الاستيراد
        </label>
      </FormSectionCard>

      <FormSectionCard title="أرقام الأعمدة" subtitle="تعيين أعمدة الملف">
        {[
          'رقم الحساب',
          'إسم الحساب',
          'الشرح',
          'رقم العملة',
          'إسم العملة',
          'مدين',
          'دائن',
          'رقم مركز التكلفة',
          'إسم مركز التكلفة',
        ].map((label) => (
          <div key={label}>
            <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">{label}</label>
            <input className={compactControlClass} placeholder={label} />
          </div>
        ))}
      </FormSectionCard>

      <FormSectionCard title="بيانات القيد" subtitle="التاريخ والشرح">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">التاريخ</label>
          <input type="date" className={compactControlClass} defaultValue="2025-11-26" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">الهجري</label>
          <input className={compactControlClass} defaultValue="26-11-2025" />
        </div>
        <div data-erp-field="description">
          <label className="mb-1 block text-xs font-semibold text-[#0A3D5E]">شرح القيد</label>
          <input name="description" className={compactControlClass} placeholder="إدخل الشرح" />
        </div>
        <label className="flex h-8 items-end gap-2 pb-1 text-sm text-[#0A3D5E]">
          <input type="checkbox" defaultChecked className="h-4 w-4" />
          السطر الأول عناوين
        </label>
      </FormSectionCard>

      <FormSectionCard title="معاينة الأسطر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
        <div className="erp-scroll-x rounded-xl border border-[#D6EAF3]">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr>
                {previewCols.map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap bg-[#0E78AA] px-3 py-2 text-center text-xs font-semibold text-white"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowIndexes.map((r) => (
                <tr key={r} className="odd:bg-[#F6FBFD]">
                  {previewCols.map((col) => (
                    <td key={col} className="whitespace-nowrap border-b border-[#E6F0F7] px-3 py-2 text-center">
                      {col === 'م' ? r : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSectionCard>

      <div className={`${erpFormGridClass} justify-items-start`}>
        <ActionButtons onCancel={() => router.back()} onSave={handleSave} />
      </div>
    </ErpDocumentLayout>
  );
}
