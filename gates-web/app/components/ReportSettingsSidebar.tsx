'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export type ReportSettingsSection = {
  title: string;
  options: string[];
};

const DEFAULT_SECTIONS: ReportSettingsSection[] = [
  {
    title: 'مصادر التقرير',
    options: [
      'فواتير مبيعات',
      'فواتير مشتريات',
      'مرتجعات مبيعات',
      'إذن إضافة مخزن',
      'إذن صرف مخزن',
      'نقاط البيع',
    ],
  },
  {
    title: 'إظهار الحقول',
    options: [
      'رقم المستند',
      'التاريخ',
      'العميل / المورد',
      'المخزن',
      'إجمالي المبلغ',
      'الضريبة',
      'حالة الترحيل',
      'البيان',
    ],
  },
  {
    title: 'خيارات التقرير',
    options: [
      'إظهار غير المرحّل',
      'إظهار الملغى',
      'تجميع حسب العميل',
      'صف إجماليات',
      'طباعة الشعار',
    ],
  },
];

function emptySelection(sections: ReportSettingsSection[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const section of sections) {
    for (const opt of section.options) {
      map[`${section.title}::${opt}`] = false;
    }
  }
  return map;
}

interface ReportSettingsSidebarProps {
  open: boolean;
  onClose: () => void;
  customSections?: ReportSettingsSection[];
  showHeaderCheckbox?: boolean;
}

export default function ReportSettingsSidebar({
  open,
  onClose,
  customSections,
  showHeaderCheckbox,
}: ReportSettingsSidebarProps) {
  const sections = customSections ?? DEFAULT_SECTIONS;
  const [mounted, setMounted] = useState(false);

  const [expanded, setExpanded] = useState<boolean[]>(() => sections.map((_, i) => i === 0));
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    emptySelection(sections)
  );
  const [allPatterns, setAllPatterns] = useState(showHeaderCheckbox ?? false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setExpanded(sections.map((_, i) => i === 0));
    setChecked(emptySelection(sections));
  }, [sections]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const toggleSection = useCallback((idx: number) => {
    setExpanded((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }, []);

  const setSectionAll = useCallback((section: ReportSettingsSection, value: boolean) => {
    setChecked((prev) => {
      const next = { ...prev };
      for (const opt of section.options) {
        next[`${section.title}::${opt}`] = value;
      }
      return next;
    });
  }, []);

  const sectionKeys = useMemo(
    () =>
      sections.map((s) => ({
        section: s,
        keys: s.options.map((opt) => `${s.title}::${opt}`),
      })),
    [sections]
  );

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="presentation">
      <button
        type="button"
        aria-label="إغلاق إعدادات التقرير"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        dir="rtl"
        className="absolute top-0 bottom-0 left-0 flex w-[min(360px,calc(100vw-1rem))] max-w-full flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={{ maxHeight: '100dvh' }}
        aria-labelledby="report-settings-title"
        aria-modal="true"
        role="dialog"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 id="report-settings-title" className="text-base font-bold text-slate-900 dark:text-white">
            إعدادات التقرير
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="إغلاق"
          >
            ×
          </button>
        </header>

        {showHeaderCheckbox ? (
          <div className="shrink-0 border-b border-slate-100 px-4 py-2 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={allPatterns}
                onChange={(e) => setAllPatterns(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              كل الأنماط
            </label>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
          {sections.map((section, idx) => {
            const { keys } = sectionKeys[idx];
            const allOn = keys.length > 0 && keys.every((k) => checked[k]);

            return (
              <section key={section.title} className="mb-2 last:mb-0">
                <div className="mb-1 flex items-center gap-2 rounded-md bg-sky-600 px-2.5 py-2 text-white dark:bg-sky-700">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-right text-sm font-bold"
                    onClick={() => toggleSection(idx)}
                  >
                    <span className="truncate">{section.title}</span>
                    <span
                      className={`shrink-0 text-[10px] opacity-90 transition-transform ${expanded[idx] ? '' : '-rotate-180'}`}
                      aria-hidden
                    >
                      ▲
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSectionAll(section, !allOn)}
                    className="shrink-0 rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold hover:bg-white/25"
                  >
                    {allOn ? 'إلغاء' : 'الكل'}
                  </button>
                </div>

                {expanded[idx] ? (
                  <ul className="mt-1 grid grid-cols-1 gap-px rounded-md border border-slate-100 bg-slate-100 p-px dark:border-slate-800 dark:bg-slate-800">
                    {section.options.map((option) => {
                      const key = `${section.title}::${option}`;
                      return (
                        <li key={key} className="bg-white dark:bg-slate-900">
                          <label className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm text-slate-700 hover:bg-sky-50/80 dark:text-slate-300 dark:hover:bg-slate-800/80">
                            <input
                              type="checkbox"
                              checked={Boolean(checked[key])}
                              onChange={(e) =>
                                setChecked((prev) => ({ ...prev, [key]: e.target.checked }))
                              }
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            <span className="min-w-0 flex-1 leading-snug">{option}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            تم
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
