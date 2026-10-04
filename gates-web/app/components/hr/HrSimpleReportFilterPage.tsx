'use client';

import { reportDefaultDateRange } from '@/lib/reports/reportDefaultDates';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { HrReportChrome } from '@/components/hr/HrReportChrome';
import { InlineReportResults } from '@/components/report/InlineReportResults';
import {
  ReportFilterDate,
  ReportFilterField,
  reportFilterInputClass,
} from '@/components/report/reportFilterFields';
import { hrSimpleReportFilterSchema, type HrSimpleReportFilterInput } from '@/lib/validation/hr.schema';

const defaults: HrSimpleReportFilterInput = {
  hijriDate1: '',
  hijriDate2: '',
  employee: '',
  ...reportDefaultDateRange(),
};

const errCls = 'text-red-600 text-xs mt-1 block text-right';

export type HrSimpleReportFilterPageProps = {
  title: string;
  emptyStateAr: string;
  emptyStateEn: string;
  logTag: string;
  catalogUrlPath: string;
};

export function HrSimpleReportFilterPage({
  title,
  emptyStateAr,
  emptyStateEn,
  catalogUrlPath,
}: HrSimpleReportFilterPageProps) {
  useBackendReachability();
  const [previewQuery, setPreviewQuery] = useState<Record<string, string> | null>(null);

  const {
    register,
    reset,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<HrSimpleReportFilterInput>({
    resolver: zodResolver(hrSimpleReportFilterSchema) as Resolver<HrSimpleReportFilterInput>,
    defaultValues: defaults,
    mode: 'onTouched',
  });

  const onPreview: SubmitHandler<HrSimpleReportFilterInput> = (values) => {
    const params: Record<string, string> = {
      fromDate: values.fromDate,
      toDate: values.toDate,
    };
    if (values.employee.trim()) params.employee = values.employee.trim();
    setPreviewQuery(params);
  };

  return (
    <HrReportChrome
      title={title}
      onPreview={handleSubmit(onPreview)}
      onReset={() => {
        reset(defaults);
        setPreviewQuery(null);
      }}
      below={
        previewQuery ? (
          <InlineReportResults urlPath={catalogUrlPath} query={previewQuery} />
        ) : null
      }
    >
      <ReportFilterField label="الموظف" className="sm:col-span-2">
        <input
          type="text"
          className={`${reportFilterInputClass} ${errors.employee ? 'border-red-400' : ''}`}
          placeholder="الموظف"
          {...register('employee')}
        />
        {errors.employee?.message ? <span className={errCls}>{String(errors.employee.message)}</span> : null}
      </ReportFilterField>

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

      <p className="col-span-full text-center text-[12px] text-slate-500">
        {emptyStateAr}
        <span className="sr-only">{emptyStateEn}</span>
      </p>
    </HrReportChrome>
  );
}
