'use client';

import { useRouter } from 'next/navigation';
import { Plus, Zap } from 'lucide-react';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { GatesDataNetwork } from '@/components/visual/GatesDataNetwork';

export function AutomationHero() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary px-6 py-8 text-primary-foreground shadow-subtle sm:px-8">
      <GatesDataNetwork className="absolute inset-0 h-full w-full" opacity={0.28} />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            {t('automation.title')}
          </span>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('automation.heroTitle')}</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">{t('automation.heroBody')}</p>
        </div>
        <Button
          size="lg"
          onClick={() => router.push('/automation/new')}
          className="shrink-0 bg-white text-[var(--primary-hover)] hover:bg-white/90"
          iconStart={<Plus className="h-4 w-4" aria-hidden />}
        >
          {t('automation.create')}
        </Button>
      </div>
    </section>
  );
}
