'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { eventIcon } from '@/lib/automation/presentation';
import { categoryLabel, catalogText } from '@/lib/automation/labels';
import { creatableEvents, type AutomationEventDef } from '@/lib/automation/metadata';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (event: AutomationEventDef) => void;
};

export function TriggerPickerDialog({ open, onClose, onSelect }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useAutomationMetadataQuery();
  const metadata = data?.data;

  const grouped = useMemo(() => {
    const events = creatableEvents(metadata);
    const needle = search.trim().toLowerCase();
    const filtered = events.filter((event) => {
      if (!needle) return true;
      const label = catalogText(t, event.labelKey);
      const description = catalogText(t, event.descriptionKey);
      return `${label} ${description} ${event.eventType}`.toLowerCase().includes(needle);
    });
    const byCategory = new Map<string, { label: string; items: AutomationEventDef[] }>();
    for (const event of filtered) {
      const label = categoryLabel(t, event.category);
      const bucket = byCategory.get(event.category) ?? { label, items: [] };
      bucket.items.push(event);
      byCategory.set(event.category, bucket);
    }
    return [...byCategory.values()];
  }, [metadata, search, t]);

  return (
    <MasterEntitySideDrawer open={open} onClose={onClose} title={t('automation.pickTriggerTitle')} subtitle={t('automation.pickTrigger')}>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('automation.search')}
          className="h-10 w-full rounded-lg border border-border bg-surface-1 ps-10 pe-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {isLoading ? <p className="py-10 text-center text-sm text-foreground-muted">{t('automation.loading')}</p> : null}
      {isError ? <p className="py-10 text-center text-sm text-danger">{t('automation.metadataError')}</p> : null}

      {!isLoading && !isError && grouped.length === 0 ? (
        <p className="py-10 text-center text-sm text-foreground-muted">{t('automation.noResults')}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-bold text-foreground-muted">{group.label}</p>
              <div className="flex flex-col gap-2">
                {group.items.map((event) => {
                  const Icon = eventIcon(event.eventType);
                  return (
                    <button
                      key={event.eventType}
                      type="button"
                      onClick={() => {
                        onSelect(event);
                        onClose();
                      }}
                      className="flex items-start gap-3 rounded-2xl border border-border bg-surface-1 p-3 text-start transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{catalogText(t, event.labelKey)}</span>
                        <span className="block text-xs text-foreground-muted">{catalogText(t, event.descriptionKey)}</span>
                        {event.emission === 'scheduled' ? (
                          <span className="mt-1 block text-[11px] font-medium text-primary">{t('automation.scheduledHint')}</span>
                        ) : null}
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
