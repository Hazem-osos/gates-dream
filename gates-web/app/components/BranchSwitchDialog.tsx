'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { getTenantContext, setTenantContext } from '@/lib/tenant/tenant-context-storage';

type BranchRow = { id: string; arabicName: string; isActive?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
};

export function BranchSwitchDialog({ open, onClose }: Props) {
  const ctx = getTenantContext();
  const { data } = useApiQuery<BranchRow[]>(
    ['company-branches-hub'],
    '/company/branches',
    { limit: 100 },
    { enabled: open }
  );
  const branches = data?.data ?? [];

  if (!open) return null;

  const selectBranch = (id: string) => {
    setTenantContext({ branchId: id });
    onClose();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="branch-switch-title"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 id="branch-switch-title" className="text-sm font-bold text-slate-900 dark:text-white">
            تبديل الفرع
          </h2>
        </div>
        <ul className="max-h-64 overflow-y-auto p-2">
          {branches.length === 0 ? (
            <li className="px-3 py-4 text-center text-xs text-slate-500">لا توجد فروع</li>
          ) : (
            branches.map((b) => {
              const active = b.id === ctx.branchId;
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-sky-50 font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                    onClick={() => selectBranch(b.id)}
                  >
                    <span>{b.arabicName}</span>
                    {active ? <span className="text-[10px] text-sky-600">الحالي</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <button
            type="button"
            className="w-full rounded-xl py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
