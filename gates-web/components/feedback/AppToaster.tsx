'use client';

import { Toaster } from 'sonner';
import { useOptionalI18n } from '@/lib/i18n';

const toastSurfaceClass =
  'rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm';

export function AppToaster() {
  const i18n = useOptionalI18n();
  return (
    <Toaster
      position="top-center"
      dir={i18n?.dir ?? 'rtl'}
      richColors
      closeButton
      duration={3500}
      style={{ zIndex: 50000 }}
      className="!z-[50000]"
      toastOptions={{
        classNames: {
          toast: toastSurfaceClass,
          title: 'text-sm font-semibold text-slate-900 dark:text-slate-100',
          description: 'text-xs text-slate-600 dark:text-slate-400',
            actionButton:
            'bg-primary text-primary-foreground text-xs font-semibold rounded-lg px-2.5 py-1 hover:bg-primary-hover',
          cancelButton: 'text-xs text-slate-500',
          closeButton: 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
        },
      }}
    />
  );
}
