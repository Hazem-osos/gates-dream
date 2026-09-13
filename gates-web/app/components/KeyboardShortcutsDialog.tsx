'use client';

type Props = {
  open: boolean;
  onClose: () => void;
};

const ROWS = [
  { keys: '⌘ + K', action: 'البحث السريع في النظام' },
  { keys: '⌘ + Shift + H', action: 'وضع خصوصية المدير (إخفاء الأرقام)' },
  { keys: 'Esc', action: 'إغلاق النوافذ والقوائم الجانبية' },
  { keys: 'Ctrl + S', action: 'حفظ النموذج (حيث يدعم المتصفح)' },
  { keys: 'Ctrl + P', action: 'طباعة / معاينة' },
];

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id="shortcuts-title" className="text-base font-bold text-slate-900 dark:text-white">
            ⌨️ اختصارات الكيبورد
          </h2>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
        <ul className="space-y-2">
          {ROWS.map((row) => (
            <li
              key={row.keys}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
            >
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.action}</span>
              <kbd className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-300">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
