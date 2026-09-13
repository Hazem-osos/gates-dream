'use client';

import { JournalEntryBadge } from '@/components/inventory/commercial/JournalEntryBadge';

type Props = {
  componentCount: number;
  totalComponentsCost: number;
  assemblyQuantity: number;
  journalEntryId?: string | null;
  isPosted?: boolean;
  savePending?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function AssemblyStickyFooter({
  componentCount,
  totalComponentsCost,
  assemblyQuantity,
  journalEntryId,
  isPosted,
  savePending,
  canSave = true,
  onSave,
  onCancel,
}: Props) {
  const unitCost = totalComponentsCost / (assemblyQuantity || 1);
  const money = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
      <div className="flex flex-col gap-1">
        {isPosted ? <JournalEntryBadge journalEntryId={journalEntryId} /> : null}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>تكلفة الوحدة التامة المنتجة:</span>
          <span className="font-mono font-bold text-foreground">{money(unitCost)} ج.م</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span>
          عدد المكونات: <b>{componentCount}</b> بند
        </span>
        <span className="text-sm">
          إجمالي تكلفة المكونات:{' '}
          <b className="font-mono text-base font-bold text-primary">{money(totalComponentsCost)} ج.م</b>
        </span>
      </div>
    </div>
  );
}
