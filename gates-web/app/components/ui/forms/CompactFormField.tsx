'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '../input';
import { HijriCaption } from '@/components/ui/DatePickerWithHijri';
import {
  compactControlClass,
  compactControlShellClass,
  compactFieldErrorClass,
  compactLabelClass,
} from './formTokens';

const HIJRI_ONLY_LABEL = /هجري|الهجري/;

export type CompactFormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'className' | 'children'>;

export const CompactFormField = React.forwardRef<HTMLInputElement, CompactFormFieldProps>(
  (
    {
      label,
      htmlFor,
      required,
      error,
      hint,
      prefix,
      suffix,
      className,
      children,
      id,
      ...inputProps
    },
    ref
  ) => {
    const fieldId = htmlFor ?? id;
    const describedBy = error ? `${fieldId ?? label}-error` : hint ? `${fieldId ?? label}-hint` : undefined;
    const isDateField = inputProps.type === 'date' && !HIJRI_ONLY_LABEL.test(label);
    const [dateIso, setDateIso] = React.useState(() =>
      String(inputProps.value ?? inputProps.defaultValue ?? '')
    );
    React.useEffect(() => {
      if (inputProps.value !== undefined) setDateIso(String(inputProps.value));
    }, [inputProps.value]);
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isDateField) setDateIso(event.target.value);
      inputProps.onChange?.(event);
    };

    return (
      <div
        className={cn('min-w-0 w-full', className)}
        dir="rtl"
        data-hijri-unified={isDateField ? '1' : undefined}
        data-erp-field={/شرح|البيان|بيان/.test(label) ? 'description' : undefined}
      >
        <label htmlFor={fieldId} className={compactLabelClass}>
          {label}
          {required ? <span className="text-red-500">*</span> : null}
        </label>
        {children ? (
          <div className={cn(prefix || suffix ? compactControlShellClass : undefined)}>
            {prefix ? (
              <span className="flex h-full shrink-0 items-center px-2 text-xs font-semibold text-slate-500">
                {prefix}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">{children}</div>
            {suffix ? (
              <span className="flex h-full shrink-0 items-center px-2 text-xs font-semibold text-slate-500">
                {suffix}
              </span>
            ) : null}
          </div>
        ) : prefix || suffix ? (
          <div className={compactControlShellClass}>
            {prefix ? (
              <span className="flex h-full shrink-0 items-center px-2 text-xs font-semibold text-slate-500">
                {prefix}
              </span>
            ) : null}
            <Input
              ref={ref}
              id={fieldId}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy}
              className="h-9 border-0 bg-transparent shadow-none focus:ring-0"
              {...inputProps}
              onChange={handleChange}
            />
            {suffix ? (
              <span className="flex h-full shrink-0 items-center px-2 text-xs font-semibold text-slate-500">
                {suffix}
              </span>
            ) : null}
          </div>
        ) : (
          <Input
            ref={ref}
            id={fieldId}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(compactControlClass, error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30')}
            {...inputProps}
            onChange={handleChange}
          />
        )}
        {isDateField ? <HijriCaption value={dateIso} /> : null}
        {error ? (
          <span id={describedBy} className={compactFieldErrorClass}>
            {error}
          </span>
        ) : hint ? (
          <span id={describedBy} className="mt-1 block text-right text-xs text-slate-500">
            {hint}
          </span>
        ) : null}
      </div>
    );
  }
);
CompactFormField.displayName = 'CompactFormField';
