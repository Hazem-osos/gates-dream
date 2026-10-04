'use client';

import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { AutomationTemplates } from './AutomationTemplates';

export function AutomationEmptyState() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-surface-1 px-6 py-14 text-center shadow-subtle">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Zap className="h-8 w-8" aria-hidden />
      </span>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-bold text-foreground">{t('automation.emptyTitle')}</h2>
        <p className="text-sm text-foreground-muted">{t('automation.emptyBody')}</p>
      </div>
      <Button size="lg" onClick={() => router.push('/automation/new')}>
        {t('automation.emptyCta')}
      </Button>

      <div className="mt-4 w-full border-t border-border pt-8">
        <p className="mb-4 text-sm font-semibold text-foreground-muted">{t('automation.startFromTemplate')}</p>
        <AutomationTemplates />
      </div>
    </div>
  );
}
