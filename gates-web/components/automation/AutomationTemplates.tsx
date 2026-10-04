'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { catalogText, categoryLabel } from '@/lib/automation/labels';
import { useAutomationTemplatesQuery } from '@/lib/hooks/useAutomationRules';
import { useI18n } from '@/lib/i18n';

export function AutomationTemplates() {
  const router = useRouter();
  const { t, dir } = useI18n();
  const { data, isLoading, isError } = useAutomationTemplatesQuery();
  const templates = data?.data ?? [];
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">{t('automation.templatesLoading')}</p>;
  }
  if (isError) {
    return <p className="text-sm text-danger">{t('automation.metadataError')}</p>;
  }
  if (templates.length === 0) {
    return <p className="text-sm text-foreground-muted">{t('automation.templatesEmpty')}</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => router.push(`/automation/new?template=${template.id}`)}
          className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-1 p-4 text-start shadow-subtle transition hover:border-primary hover:shadow-md"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm font-bold text-foreground">{catalogText(t, template.labelKey)}</p>
          <p className="text-xs text-foreground-muted">{catalogText(t, template.descriptionKey)}</p>
          <span className="text-[11px] font-semibold text-primary">{categoryLabel(t, template.category)}</span>
          {template.complete === false ? (
            <span className="text-[11px] font-medium text-foreground">{t('automation.templateNeedsInput')}</span>
          ) : null}
          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
            {t('automation.useTemplate')}
            <Arrow className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      ))}
    </div>
  );
}
