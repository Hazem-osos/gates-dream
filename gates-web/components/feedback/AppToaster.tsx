'use client';

import { Toaster } from 'sonner';

const toastSurfaceClass =
  'rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm';

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      dir="rtl"
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
            'bg-[#0E78AA] text-white text-xs font-semibold rounded-lg px-2.5 py-1 hover:bg-[#0A3D5E]',
          cancelButton: 'text-xs text-slate-500',
          closeButton: 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
        },
      }}
    />
  );
}
