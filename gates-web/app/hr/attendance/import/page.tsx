'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { FormSectionCard } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { toast } from '@/lib/feedback/toast';

export default function AttendanceImportPage() {
  const [csvText, setCsvText] = useState('employeeCode,timestamp,punchType\n');
  const [deviceId, setDeviceId] = useState('');
  const [summary, setSummary] = useState<string>('');

  const preview = () => {
    void apiClient
      .post('/hr/time/import/csv/preview', { csvText, timezone: 'UTC' })
      .then((r) => setSummary(JSON.stringify(r.data, null, 2)))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل المعاينة'));
  };

  const importCsv = () => {
    void apiClient
      .post('/hr/time/import/csv', { csvText, deviceId, timezone: 'UTC' })
      .then((r) => {
        setSummary(JSON.stringify(r.data, null, 2));
        toast.success('تم الاستيراد');
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'فشل الاستيراد'));
  };

  return (
    <HrPageChrome title="استيراد البصمات">
      <FormSectionCard title="CSV">
        <input
          className="border rounded w-full mb-2 px-2 py-1 text-sm"
          placeholder="معرّف الجهاز"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
        />
        <textarea className="border rounded w-full h-40 text-xs font-mono" value={csvText} onChange={(e) => setCsvText(e.target.value)} />
        <div className="flex gap-2 mt-2">
          <button type="button" className="px-3 py-1 border rounded text-sm" onClick={preview}>معاينة</button>
          <button type="button" className="px-3 py-1 border rounded text-sm" onClick={importCsv}>استيراد</button>
        </div>
        {summary ? <pre className="mt-3 text-xs bg-slate-50 p-2 rounded overflow-auto">{summary}</pre> : null}
      </FormSectionCard>
    </HrPageChrome>
  );
}
