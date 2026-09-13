"use client";
import React from 'react';
import { Button } from './button';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import { cn } from '@/lib/utils';
import { formActionButtonClass, formActionPairClass } from './forms/formTokens';

interface ActionButtonsProps {
  onCancel?: () => void;
  onSave?: () => void;
  cancelText?: string;
  saveText?: string;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLoading?: boolean;
  /** Gates Academy: data-academy-trigger-id attribute for the save button (additive, optional). */
  saveTriggerId?: string;
  /** Gates Academy: data-tour-id attribute for the save button (additive, optional). */
  saveTourId?: string;
  /**
   * When the current route maps to an FGAC resource, disable Save unless the
   * user has `edit`. Unmapped screens stay enabled. Set false to opt out.
   */
  respectPermissions?: boolean;
  className?: string;
}

export const ActionButtons = ({
  onCancel,
  onSave,
  cancelText = "تراجع",
  saveText = "حفظ",
  saveDisabled,
  cancelDisabled,
  saveLoading,
  saveTriggerId,
  saveTourId,
  respectPermissions = true,
  className,
}: ActionButtonsProps) => {
  const perms = useResourcePermissions();
  const blockedByFgac = respectPermissions && Boolean(perms.resource) && !perms.canEdit;

  return (
    <div className={cn(formActionPairClass, className)} dir="rtl">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onCancel}
        disabled={cancelDisabled}
        className={formActionButtonClass}
        aria-label={cancelText}
      >
        {cancelText}
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={onSave}
        disabled={saveDisabled || blockedByFgac}
        isLoading={saveLoading}
        className={formActionButtonClass}
        aria-label={saveText}
        data-academy-trigger-id={saveTriggerId}
        data-tour-id={saveTourId}
      >
        {saveText}
      </Button>
    </div>
  );
};
