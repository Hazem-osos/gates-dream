'use client';

import { JournalEntryBadge } from '@/components/inventory/commercial/JournalEntryBadge';

type Props = {
  componentCount: number;
  recoveredComponentsValue: number;
  parentItemDisassemblyTotalCost: number;
  journalEntryId?: string | null;
  isPosted?: boolean;
  savePending?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function DisassemblyStickyFooter({
  componentCount,
  recoveredComponentsValue,
  parentItemDisassemblyTotalCost,
  journalEntryId,
  isPosted,
  savePending,
  canSave = true,
  onSave,
  onCancel,
}: Props) {
  const money = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md" dir="ltr">
      <div className="flex flex-col gap-1">
        <JournalEntryBadge journalEntryId={isPosted ? journalEntryId : null} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>إجمالي قيمة الأصناف المفككة:</span>
          <span className="font-mono font-bold text-foreground">
            {money(parentItemDisassemblyTotalCost)} ج.م
          </span>
        </div>
        {Math.abs(parentItemDisassemblyTotalCost - recoveredComponentsValue) > 0.01 ? (
          <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
            فرق التقييم: {money(parentItemDisassemblyTotalCost - recoveredComponentsValue)} ج.م
          </div>
        ) : parentItemDisassemblyTotalCost > 0 ? (
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            التقييم متوازن مع قيمة المكونات المستلمة
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs" dir="rtl">
        <span>
          عدد المكونات الناتجة: <b>{componentCount}</b> بند
        </span>
        <span className="text-sm">
          إجمالي قيمة المكونات المستلمة:{' '}
          <b className="font-mono text-base font-bold text-primary">
            {money(recoveredComponentsValue)} ج.م
          </b>
        </span>
      </div>
    </div>
  );
}
