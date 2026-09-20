'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { AUTOMATION_ACTIONS, type AutomationActionDef } from '@/lib/automation/catalog';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (action: AutomationActionDef) => void;
  /** Action types already added — shown as unavailable to avoid accidental duplicates. */
  excludeTypes?: string[];
};

export function ActionPickerDialog({ open, onClose, onSelect, excludeTypes = [] }: Props) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = AUTOMATION_ACTIONS.filter((a) =>
      needle ? `${a.label} ${a.description}`.toLowerCase().includes(needle) : true
    );
    const byModule = new Map<string, { moduleLabel: string; items: AutomationActionDef[] }>();
    for (const action of filtered) {
      const bucket = byModule.get(action.moduleId) ?? { moduleLabel: action.moduleLabel, items: [] };
      bucket.items.push(action);
      byModule.set(action.moduleId, bucket);
    }
    return [...byModule.values()];
  }, [search]);

  return (
    <MasterEntitySideDrawer open={open} onClose={onClose} title="نفّذ هذا…" subtitle="اختر ما يجب أن تفعله GATES">
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث…"
          className="h-10 w-full rounded-lg border border-[#D6EAF3] bg-white pr-10 pl-3 text-sm text-[#094C6B] focus:border-[#0E78AA] focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">لا توجد نتائج مطابقة.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <div key={group.moduleLabel}>
              <p className="mb-2 text-xs font-bold text-slate-500">{group.moduleLabel}</p>
              <div className="flex flex-col gap-2">
                {group.items.map((action) => {
                  const Icon = action.icon;
                  const disabled = excludeTypes.includes(action.actionType);
                  return (
                    <button
                      key={action.actionType}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onSelect(action);
                        onClose();
                      }}
                      className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-right transition hover:border-[#0E78AA] hover:bg-[#F6FBFD] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200/80 disabled:hover:bg-white"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0E78AA0D] text-[#0E78AA]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">
                          {action.label}
                          {disabled ? <span className="mr-2 text-xs font-normal text-slate-400">(مضافة)</span> : null}
                        </span>
                        <span className="block text-xs text-slate-500">{action.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </MasterEntitySideDrawer>
  );
}
