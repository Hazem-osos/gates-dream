'use client';

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus } from 'lucide-react';
import { normalizeArabicForSearch } from '@/lib/search/arabicNormalize';
import { clientSearch, isClientSearchAvailable } from '@/lib/search/clientSearchBridge';
import type { SearchIndexEntity } from '@/workers/search.worker';
import { useClientMounted } from '@/lib/hooks/useClientMounted';
import { compactControlClass } from '@/components/ui/forms/formTokens';

export type ComboboxOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  loading?: boolean;
  error?: boolean;
  quickCreateLabel?: string;
  onQuickCreate?: (query: string) => void;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> &
    Record<`data-${string}`, string | undefined>;
  onInputKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  emptyMessage?: string;
  listClassName?: string;
  renderOption?: (option: ComboboxOption, state: { active: boolean; selected: boolean }) => React.ReactNode;
  /** When true, list renders in a portal (avoids overflow clipping in tables). */
  portaled?: boolean;
  /** Prefer opening above the field (good for line grids near page bottom). */
  menuPlacement?: 'bottom' | 'top' | 'auto';
  /** Shown when `value` is set but matching option is not in `options` yet (e.g. after quick-create). */
  valueLabel?: string;
  /** In-memory worker search (items / customers / suppliers). */
  clientSearchEntity?: SearchIndexEntity;
  /** Server-side search: parent fetches a page when the query changes. */
  onQueryChange?: (query: string) => void;
  /** Max options shown in the open list (selected value is always kept). */
  maxVisible?: number;
  /** Pixel cap for the open list height. */
  maxListHeight?: number;
};

const defaultInputCls = compactControlClass;

export function SearchableCombobox({
  value,
  onChange,
  options,
  disabled,
  className,
  placeholder = 'بحث…',
  loading,
  error,
  quickCreateLabel,
  onQuickCreate,
  inputProps,
  onInputKeyDown,
  emptyMessage = 'لا توجد نتائج',
  listClassName,
  renderOption,
  portaled = false,
  menuPlacement = 'bottom',
  valueLabel,
  clientSearchEntity,
  onQueryChange,
  maxVisible = 30,
  maxListHeight = 288,
}: SearchableComboboxProps) {
  const mounted = useClientMounted();
  const showLoading = mounted && Boolean(loading);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [listFixedStyle, setListFixedStyle] = useState<React.CSSProperties | null>(null);
  const [resolvedPlacement, setResolvedPlacement] = useState<'bottom' | 'top'>('bottom');
  const [workerRankedIds, setWorkerRankedIds] = useState<string[] | null>(null);
  const searchGenRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!clientSearchEntity || !q || !isClientSearchAvailable()) {
      setWorkerRankedIds(null);
      return;
    }
    const gen = ++searchGenRef.current;
    const handle = window.setTimeout(() => {
      void clientSearch(clientSearchEntity, q).then((ids) => {
        if (searchGenRef.current === gen) setWorkerRankedIds(ids);
      });
    }, 0);
    return () => window.clearTimeout(handle);
  }, [query, clientSearchEntity]);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) {
      if (selected && selected.value !== '') {
        setQuery(selected.label);
      } else if (value && valueLabel) {
        setQuery(valueLabel);
      } else if (!value) {
        setQuery('');
      }
    }
  }, [selected, value, open, valueLabel]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const nq = normalizeArabicForSearch(q);
    if (!nq) {
      const base = options.slice(0, maxVisible);
      if (!value) return base;
      const sel = options.find((o) => o.value === value);
      if (sel && !base.some((o) => o.value === value)) {
        return [sel, ...base.slice(0, maxVisible - 1)];
      }
      return base;
    }
    if (workerRankedIds && workerRankedIds.length > 0 && clientSearchEntity) {
      const byId = new Map(options.map((o) => [o.value, o]));
      const ranked = workerRankedIds
        .map((id) => byId.get(id))
        .filter((o): o is ComboboxOption => Boolean(o))
        .slice(0, maxVisible);
      if (ranked.length > 0) return ranked;
    }
    return options
      .filter((o) => {
        const blob = normalizeArabicForSearch(`${o.label} ${o.searchText ?? ''}`);
        return blob.includes(nq);
      })
      .slice(0, maxVisible);
  }, [options, query, value, workerRankedIds, clientSearchEntity, maxVisible]);

  const showQuickCreate = Boolean(onQuickCreate && quickCreateLabel);
  const quickCreateText = query.trim()
    ? `${quickCreateLabel}: "${query.trim()}"`
    : quickCreateLabel?.includes('"')
      ? quickCreateLabel
      : '+ إضافة جديد';

  const listCount = filtered.length + (showQuickCreate ? 1 : 0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const repositionList = useCallback(() => {
    const el = inputRef.current;
    if (!el || !open) return;

    const rect = el.getBoundingClientRect();
    const gap = 6;
    const maxList = maxListHeight;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;

    let place: 'bottom' | 'top' = menuPlacement === 'top' ? 'top' : 'bottom';
    if (menuPlacement === 'auto') {
      place = spaceBelow < 200 && spaceAbove > spaceBelow ? 'top' : 'bottom';
    }

    setResolvedPlacement(place);
    const width = Math.min(Math.max(rect.width, 280), 512);

    if (portaled) {
      if (place === 'top') {
        setListFixedStyle({
          position: 'fixed',
          left: rect.left,
          width,
          bottom: window.innerHeight - rect.top + gap,
          maxHeight: Math.min(maxList, Math.max(120, spaceAbove - 8)),
          zIndex: 10050,
        });
      } else {
        setListFixedStyle({
          position: 'fixed',
          left: rect.left,
          width,
          top: rect.bottom + gap,
          maxHeight: Math.min(maxList, Math.max(120, spaceBelow - 8)),
          zIndex: 10050,
        });
      }
    } else {
      setListFixedStyle(null);
    }
  }, [open, menuPlacement, portaled, maxListHeight]);

  useLayoutEffect(() => {
    if (!open) {
      setListFixedStyle(null);
      return;
    }
    repositionList();
    window.addEventListener('scroll', repositionList, true);
    window.addEventListener('resize', repositionList);
    return () => {
      window.removeEventListener('scroll', repositionList, true);
      window.removeEventListener('resize', repositionList);
    };
  }, [open, repositionList, filtered.length, query]);

  const pick = (next: string) => {
    onChange(next);
    const opt = options.find((o) => o.value === next);
    setQuery(next && opt?.value ? opt.label : '');
    setOpen(false);
  };

  const handleQuickCreate = () => {
    onQuickCreate?.(query.trim());
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={Boolean(disabled) || showLoading}
          placeholder={showLoading ? 'جاري التحميل…' : placeholder}
          className={`${className ?? defaultInputCls} ${onQuickCreate ? 'pe-16' : 'pe-9'} ${error ? 'border-red-400' : ''} ${
            open ? 'ring-2 ring-[#0E78AA]/20 border-[#0E78AA]' : ''
          }`}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            setActiveIndex(0);
            onQueryChange?.(next);
            if (!next.trim()) onChange('');
          }}
          onFocus={() => setOpen(true)}
          {...(() => {
            const { onKeyDown: inputKeyDown, ...restInputProps } = inputProps ?? {};
            return {
              ...restInputProps,
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Tab') {
                  setOpen(false);
                  onInputKeyDown?.(e);
                  inputKeyDown?.(e);
                  return;
                }

                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (open) {
                    if (showQuickCreate && activeIndex === filtered.length) {
                      handleQuickCreate();
                      return;
                    }
                    const opt = filtered[activeIndex];
                    if (opt) pick(opt.value);
                    else setOpen(true);
                  } else {
                    setOpen(true);
                  }
                  return;
                }

                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setOpen(true);
                  setActiveIndex((i) => Math.min(i + 1, listCount - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === 'Escape') {
                  setOpen(false);
                  return;
                }

                onInputKeyDown?.(e);
                if (e.defaultPrevented) return;
                inputKeyDown?.(e);
              },
            };
          })()}
        />
        {onQuickCreate && !disabled ? (
          <button
            type="button"
            tabIndex={-1}
            title="إضافة جديد"
            aria-label={quickCreateLabel || 'إضافة جديد'}
            className="absolute left-7 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#0E78AA] hover:bg-[#EEF7FB]"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => {
              handleQuickCreate();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <ChevronDown
          className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E78AA]/70"
          aria-hidden
        />
      </div>
      {open && !disabled ? (
        (() => {
          const listPositionClass = portaled
            ? ''
            : resolvedPlacement === 'top'
              ? 'bottom-full mb-1.5'
              : 'top-full mt-1.5';

          const listEl = (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              style={portaled ? listFixedStyle ?? undefined : undefined}
              className={`${portaled ? 'fixed' : 'absolute'} z-[10050] ${listPositionClass} max-h-[min(26rem,70vh)] min-w-[min(100%,28rem)] w-max max-w-[32rem] overflow-auto rounded-lg border border-[#D6EAF3] bg-white py-1 text-sm shadow-lg ${listClassName ?? ''}`}
            >
              {filtered.length === 0 && !showQuickCreate ? (
                <li className="px-3 py-2 text-gray-500">{emptyMessage}</li>
              ) : (
                filtered.map((opt, i) => (
                  <li key={opt.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      className={`w-full px-3 py-2 text-right hover:bg-[#EEF7FB] ${
                        activeIndex === i ? 'bg-[#DEEFF6] font-medium' : ''
                      } ${value === opt.value ? 'text-[#0E78AA]' : 'text-gray-800'}`}
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => pick(opt.value)}
                    >
                      {renderOption ? (
                        renderOption(opt, { active: activeIndex === i, selected: value === opt.value })
                      ) : (
                        opt.label
                      )}
                    </button>
                  </li>
                ))
              )}
              {showQuickCreate ? (
                <li>
                  <button
                    type="button"
                    className={`w-full border-t border-[#E6F0F7] px-3 py-2 text-right font-semibold text-[#0E78AA] hover:bg-[#EEF7FB] ${
                      activeIndex === filtered.length ? 'bg-[#DEEFF6]' : ''
                    }`}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={handleQuickCreate}
                  >
                    {quickCreateText}
                  </button>
                </li>
              ) : null}
            </ul>
          );

          return portaled && typeof document !== 'undefined'
            ? createPortal(listEl, document.body)
            : listEl;
        })()
      ) : null}
    </div>
  );
}
