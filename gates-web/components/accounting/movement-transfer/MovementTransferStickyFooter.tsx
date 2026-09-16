'use client';

import { Button } from '@/components/ui';

type Props = {
  summary: string;
  onExecute: () => void;
  onCancel: () => void;
  canExecute?: boolean;
  pending?: boolean;
};

export function MovementTransferStickyFooter({
  summary,
  onExecute,
  onCancel,
  canExecute = true,
  pending,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-4 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" dir="rtl">
        <p className="max-w-xl text-sm text-muted-foreground">{summary}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            تفريغ
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            isLoading={pending}
            disabled={!canExecute || pending}
            onClick={onExecute}
          >
            تنفيذ نقل الحركات
          </Button>
        </div>
      </div>
    </div>
  );
}
