'use client';

import { useState } from 'react';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import { HrEmployeeSelect } from '@/components/hr/HrEmployeeSelect';
import { FormSectionCard } from '@/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { toast } from '@/lib/feedback/toast';
import { applyEmploymentEvent, type HcmEventType } from '@/lib/hr/employment-events';

type ProcedureRow = { id: string; date: string; serial?: string | null; description?: string | null; reason?: string | null };

export type ProcedureTextField = { key: string; label: string; required?: boolean };

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Dated HR record for one employee (مباشرة، إعادة مباشرة، انتداب، دورة…),
 * saved as an employee procedure so it shows in transaction tracking and the
 * employee's history. Optionally also applies an HCM employment event.
 */
export function HrEmployeeProcedureLogForm({
  title,
  procedureType,
  withToDate = false,
  fromLabel = 'التاريخ',
  toLabel = 'إلى تاريخ',
  textFields = [],
  optionalEvent,
}: {
  title: string;
  procedureType: string;
  withToDate?: boolean;
  fromLabel?: string;
  toLabel?: string;
  textFields?: ProcedureTextField[];
  optionalEvent?: { eventType: HcmEventType; label: string };
}) {
  const invalidate = useInvalidateQuery();
  const [employeeId, setEmployeeId] = useState('');
  const [serial, setSerial] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [applyEvent, setApplyEvent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const historyKey = ['hr-procedure-log', procedureType, employeeId];
  const history = useApiQuery<ProcedureRow[]>(
    historyKey,
    '/hr/employee-procedures',
    { employeeId, procedureType, limit: 50 },
    { enabled: Boolean(employeeId) }
  );

  const reset = () => {
    setSerial('');
    setFromDate(today());
    setToDate(today());
    setTexts({});
    setNotes('');
    setApplyEvent(false);
    setError('');
  };

  const save = async () => {
    setError('');
    if (!employeeId) return setError('اختر الموظف');
    if (!fromDate) return setError('أدخل التاريخ');
    if (withToDate && toDate && toDate < fromDate) return setError('تاريخ النهاية قبل تاريخ البداية');
    const missing = textFields.find((f) => f.required && !texts[f.key]?.trim());
    if (missing) return setError(`أدخل ${missing.label}`);

    const parts = [
      withToDate ? `من ${fromDate} إلى ${toDate}` : null,
      ...textFields.map((f) => (texts[f.key]?.trim() ? `${f.label}: ${texts[f.key].trim()}` : null)),
      notes.trim() || null,
    ].filter(Boolean);

    setSaving(true);
    try {
      if (optionalEvent && applyEvent) {
        await applyEmploymentEvent({
          employeeId,
          eventType: optionalEvent.eventType,
          effectiveDate: fromDate,
          notes: notes.trim() || undefined,
        });
      }
      await apiClient.post('/hr/employee-procedures', {
        employeeId,
        serial: serial.trim() || undefined,
        procedureType,
        date: fromDate,
        description: parts.join(' — ') || undefined,
      });
      toast.success('تم الحفظ');
      invalidate(historyKey);
      invalidate(['hr-employee-procedures']);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrPageChrome title={title.trim()} onSave={() => void save()} onNew={reset} savePending={saving}>
      <FormSectionCard title="بيانات الحركة">
        <div className="col-span-full grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">الموظف</span>
            <HrEmployeeSelect value={employeeId} onChange={(id) => setEmployeeId(id)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">المسلسل (اختياري)</span>
            <input className={compactControlClass} value={serial} onChange={(e) => setSerial(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-700">{fromLabel}</span>
            <input type="date" className={compactControlClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          {withToDate ? (
            <label className="space-y-1">
              <span className="text-sm text-slate-700">{toLabel}</span>
              <input type="date" className={compactControlClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </label>
          ) : null}
          {textFields.map((f) => (
            <label key={f.key} className="space-y-1">
              <span className="text-sm text-slate-700">{f.label}</span>
              <input
                className={compactControlClass}
                value={texts[f.key] ?? ''}
                onChange={(e) => setTexts((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </label>
          ))}
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-700">ملاحظات</span>
            <textarea rows={3} className={compactControlClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {optionalEvent ? (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={applyEvent} onChange={(e) => setApplyEvent(e.target.checked)} />
              {optionalEvent.label}
            </label>
          ) : null}
          {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
        </div>
      </FormSectionCard>

      {employeeId ? (
        <FormSectionCard title="السجل السابق للموظف">
          <div className="col-span-full">
            {(history.data?.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد حركات سابقة</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500">
                    <th className="p-2 text-right">التاريخ</th>
                    <th className="p-2 text-right">المسلسل</th>
                    <th className="p-2 text-right">البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {(history.data?.data ?? []).map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">{String(row.date).slice(0, 10)}</td>
                      <td className="p-2">{row.serial ?? '—'}</td>
                      <td className="p-2">{row.description ?? row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </FormSectionCard>
      ) : null}
    </HrPageChrome>
  );
}
