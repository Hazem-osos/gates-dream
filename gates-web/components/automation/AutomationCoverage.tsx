'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { eventIcon } from '@/lib/automation/presentation';
import { catalogText, categoryLabel } from '@/lib/automation/labels';
import { creatableEvents } from '@/lib/automation/metadata';
import { useAutomationMetadataQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

export function AutomationCoverage() {
  const { t } = useI18n();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { data, isLoading, isError } = useAutomationMetadataQuery();

  const grouped = useMemo(() => {
    const events = creatableEvents(data?.data);
    const byCategory = new Map<string, typeof events>();
    for (const event of events) {
      const bucket = byCategory.get(event.category) ?? [];
      bucket.push(event);
      byCategory.set(event.category, bucket);
    }
    return [...byCategory.entries()];
  }, [data]);

  const count = grouped.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('automation.coverageTitle')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-foreground-muted">{t('automation.coverageBody')}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {t('automation.coverageCount', { count })}
        </span>
      </div>

      {isLoading ? <p className="text-sm text-foreground-muted">{t('automation.loading')}</p> : null}
      {isError ? <p className="text-sm text-danger">{t('automation.metadataError')}</p> : null}

      <div className="flex flex-col gap-5">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground-muted">
              {categoryLabel(t, category)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((event, index) => {
                const Icon = eventIcon(event.eventType);
                return (
                  <motion.button
                    key={event.eventType}
                    type="button"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reduce ? 0 : Math.min(index * 0.04, 0.28), duration: 0.28 }}
                    whileHover={reduce ? undefined : { y: -3 }}
                    onClick={() => {
                      const params = new URLSearchParams({
                        event: event.eventType,
                        name: catalogText(t, event.labelKey),
                      });
                      router.push(`/automation/new?${params.toString()}`);
                    }}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-surface-1 p-4 text-start shadow-subtle transition hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition group-hover:scale-105">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">{catalogText(t, event.labelKey)}</span>
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          {event.emission === 'scheduled' ? t('automation.dailyPoint') : t('automation.livePoint')}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-foreground-muted">{catalogText(t, event.descriptionKey)}</span>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
