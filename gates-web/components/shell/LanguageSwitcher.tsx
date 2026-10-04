'use client';

import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className={cn(
        'inline-flex items-center rounded-lg border border-white/25 bg-white/10 p-0.5 text-[11px] font-semibold',
        className
      )}
    >
      {(['ar', 'en'] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          className={cn(
            'rounded-md px-2 py-1 transition-colors',
            locale === code
              ? 'bg-white text-[var(--primary-hover)] shadow-sm'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          )}
          aria-pressed={locale === code}
        >
          {compact ? code.toUpperCase() : code === 'ar' ? 'العربية' : 'English'}
        </button>
      ))}
    </div>
  );
}
