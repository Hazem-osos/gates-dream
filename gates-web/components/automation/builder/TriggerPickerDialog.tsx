'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { AUTOMATION_TRIGGERS, type AutomationTriggerDef } from '@/lib/automation/catalog';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (trigger: AutomationTriggerDef) => void;
};

export function TriggerPickerDialog({ open, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = AUTOMATION_TRIGGERS.filter((t) =>
      needle ? `${t.label} ${t.description}`.toLowerCase().includes(needle) : true
    );
    const byModule = new Map<string, { moduleLabel: string; items: AutomationTriggerDef[] }>();
    for (const trigger of filtered) {
      const bucket = byModule.get(trigger.moduleId) ?? { moduleLabel: trigger.moduleLabel, items: [] };
      bucket.items.push(trigger);
      byModule.set(trigger.moduleId, bucket);
    }
    return [...byModule.values()];
  }, [search]);

  return (
    <MasterEntitySideDrawer
      open={open}
      onClose={onClose}
      title="عندما يحدث هذا…"
      subtitle="اختر ما يبدأ هذه الأتمتة"
    >
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
                {group.items.map((trigger) => {
                  const Icon = trigger.icon;
                  return (
                    <button
                      key={trigger.eventType}
                      type="button"
                      onClick={() => {
                        onSelect(trigger);
                        onClose();
                      }}
                      className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3 text-right transition hover:border-[#0E78AA] hover:bg-[#F6FBFD]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0E78AA0D] text-[#0E78AA]">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{trigger.label}</span>
                        <span className="block text-xs text-slate-500">{trigger.description}</span>
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
