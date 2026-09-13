'use client';

import type { PromotionTargetType } from './PromotionScopeCard';

type Props = {
  targetType: PromotionTargetType;
  applyToAllParties: boolean;
  targetPartyIds: string[];
  applyToAllPatterns: boolean;
  targetPatternIds: string[];
  isSubmitting?: boolean;
  canSave?: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function PromotionStickyFooter({
  targetType,
  applyToAllParties,
  targetPartyIds,
  applyToAllPatterns,
  targetPatternIds,
  isSubmitting,
  canSave = true,
  onSave,
  onCancel,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
      <div className="text-xs text-muted-foreground">
        <span>نطاق العرض: </span>
        <span className="font-semibold text-foreground">
          {targetType === 'SALES' ? 'مبيعات' : 'مشتريات'} |{' '}
          {applyToAllParties ? 'كافة الأطراف' : `${targetPartyIds.length} محددين`} |{' '}
          {applyToAllPatterns ? 'كافة أنماط الإدخال' : `${targetPatternIds.length} نمط`}
        </span>
      </div>
    </div>
  );
}
