'use client';

import { Check } from 'lucide-react';
import { formatMoney } from './opening-stock-types';

type Props = {
  itemCount: number;
  totalQuantity: number;
  totalValue: number;
  lastSaved?: Date | null;
  savePending?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
};

function timeLabel(value: Date) {
  return value.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function OpeningStockStickyFooter({
  itemCount,
  totalQuantity,
  totalValue,
  lastSaved,
  savePending,
  canSave = true,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="rtl">
        <Check className="h-3.5 w-3.5 text-emerald-500" />
        <span>{lastSaved ? `تم الحفظ كمسودة محلياً ${timeLabel(lastSaved)}` : 'المسودة متزامنة'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-4" dir="rtl">
        <div className="text-xs">
          عدد الأصناف: <span className="font-mono font-bold">{itemCount}</span> صنف
        </div>
        <div className="text-xs">
          إجمالي الكميات: <span className="font-mono font-bold">{totalQuantity.toLocaleString('ar-EG')}</span> وحدة
        </div>
        <div className="text-sm">
          إجمالي قيمة بضاعة أول المدة:{' '}
          <span className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalValue)} ج.م
          </span>
        </div>
      </div>
    </div>
  );
}
