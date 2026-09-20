'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, FilterToolbar, Skeleton } from '@/components/ui';
import { BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  useAutomationRulesQuery,
  useCreateAutomationRule,
  useDeleteAutomationRule,
  useSetAutomationRuleEnabled,
} from '@/lib/hooks/useAutomationRules';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';
import { AutomationCard } from './AutomationCard';
import { AutomationEmptyState } from './AutomationEmptyState';

type EnabledFilter = 'all' | 'enabled' | 'disabled';

type Props = {
  runsByRuleId: Map<string, AutomationRun>;
};

export function AutomationList({ runsByRuleId }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnabledFilter>('all');

  const { data, isLoading } = useAutomationRulesQuery({ limit: 100 });
  const rules = data?.data ?? [];
  const createRule = useCreateAutomationRule();

  const filtered = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter === 'enabled' && !rule.enabled) return false;
      if (statusFilter === 'disabled' && rule.enabled) return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const haystack = `${rule.name} ${rule.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rules, search, statusFilter]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="جاري تحميل الأتمتة">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return <AutomationEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">الأتمتة الخاصة بك</h2>
        <Button size="sm" iconStart={<Plus className="h-4 w-4" />} onClick={() => router.push('/automation/new')}>
          أتمتة جديدة
        </Button>
      </div>

      <FilterToolbar searchPlaceholder="بحث عن أتمتة…" searchValue={search} onSearchChange={setSearch}>
        <BrowseStatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label="الحالة"
          options={[
            { value: 'all', label: 'كل الحالات' },
            { value: 'enabled', label: 'مفعّلة' },
            { value: 'disabled', label: 'متوقفة' },
          ]}
        />
      </FilterToolbar>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          لا توجد نتائج مطابقة لبحثك.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rule) => (
            <AutomationRuleCard
              key={rule.id}
              rule={rule}
              lastRun={runsByRuleId.get(rule.id)}
              onDuplicate={() =>
                createRule.mutate({
                  name: `${rule.name} (نسخة)`,
                  description: rule.description ?? undefined,
                  eventType: rule.eventType,
                  enabled: false,
                  conditions: rule.conditions,
                  actions: rule.actions,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationRuleCard({
  rule,
  lastRun,
  onDuplicate,
}: {
  rule: AutomationRule;
  lastRun?: AutomationRun;
  onDuplicate: () => void;
}) {
  const router = useRouter();
  const setEnabled = useSetAutomationRuleEnabled(rule.id);
  const deleteRule = useDeleteAutomationRule(rule.id);

  return (
    <AutomationCard
      rule={rule}
      lastRun={lastRun}
      onToggle={(enabled) => setEnabled.mutate({ enabled })}
      togglePending={setEnabled.isPending}
      onDuplicate={onDuplicate}
      onDelete={async () => {
        const ok = await confirmAction(`هل تريد حذف أتمتة «${rule.name}»؟ لا يمكن التراجع عن هذا الإجراء.`);
        if (!ok) return;
        await deleteRule.mutateAsync();
        router.refresh();
      }}
    />
  );
}
