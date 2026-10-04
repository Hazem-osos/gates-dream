'use client';

import { useMemo, useState } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApiQuery } from '@/lib/hooks/useApi';
import { HrReportChrome } from '@/components/hr/HrReportChrome';
import { InlineReportResults } from '@/components/report/InlineReportResults';
import {
  ReportFilterCombobox,
  ReportFilterDate,
} from '@/components/report/reportFilterFields';
import {
  hrEmployeeApiReportFilterSchema,
  type HrEmployeeApiReportFilterInput,
} from '@/lib/validation/hr.schema';

interface Employee {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

function defaultFilter(): HrEmployeeApiReportFilterInput {
  const t = new Date().toISOString().split('T')[0];
  return { hijriDate1: '', hijriDate2: '', employeeId: '', fromDate: t, toDate: t };
}

export type HrEmployeePickerReportPageProps = {
  title: string;
  emptyStateAr: string;
  emptyStateEn: string;
  previewPath: string;
  catalogUrlPath: string;
};

export function HrEmployeePickerReportPage({
  title,
  emptyStateAr,
  emptyStateEn,
  catalogUrlPath,
}: HrEmployeePickerReportPageProps) {
  const initialDefaults = useMemo(() => defaultFilter(), []);
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);

  const { handleSubmit, reset, control } = useForm<HrEmployeeApiReportFilterInput>({
    resolver: zodResolver(hrEmployeeApiReportFilterSchema) as Resolver<HrEmployeeApiReportFilterInput>,
    defaultValues: initialDefaults,
    mode: 'onTouched',
  });

  const { data: employeesResponse, isLoading: employeesLoading } = useApiQuery<Employee[]>(
    ['employees'],
    '/hr/employees',
    { limit: 1000, isActive: true }
  );
  const employees = employeesResponse?.data || [];
  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'كل الموظفين' },
      ...employees.map((e) => ({
        value: e.id,
        label: e.code ? `${e.code} — ${e.arabicName}` : e.arabicName,
      })),
    ],
    [employees]
  );

  const onPreview: SubmitHandler<HrEmployeeApiReportFilterInput> = (values) => {
    const params = new URLSearchParams();
    params.append('fromDate', values.fromDate);
    params.append('toDate', values.toDate);
    if (values.hijriDate1) params.append('fromHijri', values.hijriDate1);
    if (values.hijriDate2) params.append('toHijri', values.hijriDate2);
    if (values.employeeId) params.append('employeeId', values.employeeId);
    setPreviewQuery(Object.fromEntries(params));
  };

  return (
    <HrReportChrome
      title={title}
      onPreview={handleSubmit(onPreview)}
      onReset={() => {
        reset(defaultFilter());
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? (
          <InlineReportResults urlPath={catalogUrlPath} query={previewQuery} />
        ) : null
      }
    >
      <Controller
        name="employeeId"
        control={control}
        render={({ field }) => (
          <ReportFilterCombobox
            label="الموظف"
            value={field.value}
            onChange={field.onChange}
            options={employeeOptions}
            placeholder="كل الموظفين"
            loading={employeesLoading}
          />
        )}
      />

      <Controller
        name="fromDate"
        control={control}
        render={({ field }) => (
          <ReportFilterDate label="من التاريخ" value={field.value} onChange={field.onChange} />
        )}
      />
      <Controller
        name="toDate"
        control={control}
        render={({ field }) => (
          <ReportFilterDate label="إلى التاريخ" value={field.value} onChange={field.onChange} />
        )}
      />

      <p className="col-span-full rounded-lg bg-slate-50 px-3 py-2 text-center text-[12px] text-slate-500">
        {emptyStateAr} — {emptyStateEn}
      </p>
    </HrReportChrome>
  );
}
