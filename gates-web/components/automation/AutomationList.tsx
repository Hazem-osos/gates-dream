'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button, FilterToolbar, Skeleton } from '@/components/ui';
import { BrowseStatusFilter } from '@/components/erp/BrowseListFilters';
import { confirmAction } from '@/lib/feedback/confirm';
import {
  useAutomationRulesQuery,
  useDeleteAutomationRule,
  useDuplicateAutomationRule,
  useSetAutomationRuleEnabled,
} from '@/lib/hooks/useAutomationRules';
import type { AutomationRule, AutomationRun } from '@/lib/automation/types';
import { useI18n } from '@/lib/i18n';
import { AutomationCard } from './AutomationCard';
import { AutomationEmptyState } from './AutomationEmptyState';

type EnabledFilter = 'all' | 'enabled' | 'disabled';

type Props = {
  runsByRuleId: Map<string, AutomationRun>;
};

export function AutomationList({ runsByRuleId }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EnabledFilter>('all');

  const { data, isLoading, isError } = useAutomationRulesQuery({ limit: 100 });
  const rules = data?.data ?? [];

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label={t('automation.loading')}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-1 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="rounded-xl border border-danger/20 px-4 py-6 text-center text-sm text-danger">{t('automation.loadError')}</p>;
  }

  if (rules.length === 0) {
    return <AutomationEmptyState />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-foreground">{t('automation.yourAutomations')}</h2>
        <Button size="sm" iconStart={<Plus className="h-4 w-4" />} onClick={() => router.push('/automation/new')}>
          {t('automation.create')}
        </Button>
      </div>

      <FilterToolbar searchPlaceholder={t('automation.searchPlaceholder')} searchValue={search} onSearchChange={setSearch}>
        <BrowseStatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          aria-label={t('automation.status')}
          options={[
            { value: 'all', label: t('automation.allStatuses') },
            { value: 'enabled', label: t('automation.enabled') },
            { value: 'disabled', label: t('automation.disabled') },
          ]}
        />
      </FilterToolbar>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-foreground-muted">
          {t('automation.noSearchResults')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rule) => (
            <AutomationRuleCard key={rule.id} rule={rule} lastRun={runsByRuleId.get(rule.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationRuleCard({ rule, lastRun }: { rule: AutomationRule; lastRun?: AutomationRun }) {
  const { t } = useI18n();
  const setEnabled = useSetAutomationRuleEnabled(rule.id);
  const deleteRule = useDeleteAutomationRule(rule.id);
  const duplicateRule = useDuplicateAutomationRule(rule.id);

  return (
    <AutomationCard
      rule={rule}
      lastRun={lastRun}
      onToggle={(enabled) => setEnabled.mutate({ enabled })}
      togglePending={setEnabled.isPending}
      onDuplicate={() => duplicateRule.mutate({})}
      onDelete={async () => {
        const ok = await confirmAction(t('automation.confirmDelete', { name: rule.name }));
        if (!ok) return;
        await deleteRule.mutateAsync();
      }}
    />
  );
}
