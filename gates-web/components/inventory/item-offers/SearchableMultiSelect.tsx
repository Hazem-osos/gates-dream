'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type MultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SearchableMultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'ابحث واختر…',
  disabled,
}: Props) {
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => options.filter((option) => selectedValues.includes(option.value)),
    [options, selectedValues]
  );
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((option) => {
      if (selectedValues.includes(option.value)) return false;
      if (!q) return true;
      return option.label.toLowerCase().includes(q);
    });
  }, [options, query, selectedValues]);

  const add = (value: string) => {
    if (disabled || selectedValues.includes(value)) return;
    onChange([...selectedValues, value]);
    setQuery('');
  };

  const remove = (value: string) => {
    if (disabled) return;
    onChange(selectedValues.filter((id) => id !== value));
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px]"
            >
              {option.label}
              <button
                type="button"
                disabled={disabled}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => remove(option.value)}
                aria-label={`إزالة ${option.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <input
        type="search"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-border/70 bg-background">
        {available.length === 0 ? (
          <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">لا توجد نتائج إضافية</p>
        ) : (
          available.slice(0, 40).map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              className="block w-full px-3 py-1.5 text-right text-xs hover:bg-muted/50"
              onClick={() => add(option.value)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
