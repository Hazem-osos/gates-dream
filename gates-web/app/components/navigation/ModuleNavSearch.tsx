'use client';

import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModuleNavSearchProps = {
  value: string;
  onChange: (value: string) => void;
  inputId?: string;
};

export function ModuleNavSearch({ value, onChange, inputId = 'module-nav-search' }: ModuleNavSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ابحث داخل الموديول... (Ctrl + /)"
        className={cn(
          'w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-10 text-sm text-slate-800',
          'placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20',
          'dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder:text-slate-500'
        )}
        dir="rtl"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="مسح البحث"
          className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/80 dark:hover:bg-slate-700"
          onClick={() => onChange('')}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
