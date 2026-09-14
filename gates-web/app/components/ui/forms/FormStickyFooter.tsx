'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../button';
import { useResourcePermissions } from '@/lib/hooks/useResourcePermissions';
import { cn } from '@/lib/utils';
import { formActionButtonClass, formActionPairClass } from './formTokens';

export type FormStickyFooterProps = {
  onCancel?: () => void;
  onSave?: () => void;
  onSaveDraft?: () => void;
  cancelText?: string;
  saveText?: string;
  draftText?: string;
  saveDisabled?: boolean;
  cancelDisabled?: boolean;
  saveLoading?: boolean;
  draftLoading?: boolean;
  status?: ReactNode;
  extraActions?: ReactNode;
  respectPermissions?: boolean;
  saveTriggerId?: string;
  saveTourId?: string;
  className?: string;
};

function isInsideOverlay(node: HTMLElement | null) {
  return Boolean(
    node?.closest('[data-gates-keep-footer], [role="dialog"], [data-modal], .fixed.inset-0')
  );
}

export function FormStickyFooter({
  onCancel,
  onSave,
  onSaveDraft,
  cancelText = 'تراجع',
  saveText = 'حفظ',
  draftText = 'حفظ مسودة',
  saveDisabled,
  cancelDisabled,
  saveLoading,
  draftLoading,
  status,
  extraActions,
  respectPermissions = true,
  saveTriggerId,
  saveTourId,
  className,
}: FormStickyFooterProps) {
  const perms = useResourcePermissions();
  const blockedByFgac = respectPermissions && Boolean(perms.resource) && !perms.canEdit;
  const probeRef = useRef<HTMLDivElement>(null);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const [keepInPlace, setKeepInPlace] = useState(false);

  useLayoutEffect(() => {
    const overlay = isInsideOverlay(probeRef.current);
    setKeepInPlace(overlay);
    if (overlay) {
      setHeaderHost(null);
      return;
    }

    const findHost = () => document.querySelector<HTMLElement>('[data-gates-page-header-actions]');
    const sync = () => {
      const el = findHost();
      setHeaderHost((current) => {
        if (el?.isConnected) return el;
        if (current?.isConnected) return current;
        return null;
      });
    };

    sync();
    const id = window.setInterval(sync, 150);
    return () => window.clearInterval(id);
  }, []);

  const actions = (
    <div className={formActionPairClass}>
      {extraActions}
      {status ? (
        <span className="inline-flex max-w-full items-center rounded-full border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-1 text-xs font-semibold text-[#094C6B]">
          {status}
        </span>
      ) : null}
      {onCancel ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={formActionButtonClass}
          onClick={onCancel}
          disabled={cancelDisabled}
        >
          {cancelText}
        </Button>
      ) : null}
      {onSaveDraft ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={formActionButtonClass}
          onClick={onSaveDraft}
          isLoading={draftLoading}
        >
          {draftText}
        </Button>
      ) : null}
      {onSave ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={formActionButtonClass}
          onClick={onSave}
          disabled={saveDisabled || blockedByFgac}
          isLoading={saveLoading}
          data-academy-trigger-id={saveTriggerId}
          data-tour-id={saveTourId}
        >
          {saveText}
        </Button>
      ) : null}
    </div>
  );

  const hostReady = Boolean(headerHost?.isConnected);

  if (!keepInPlace && hostReady && headerHost) {
    return (
      <>
        <div ref={probeRef} className="hidden" aria-hidden />
        {createPortal(actions, headerHost)}
      </>
    );
  }

  return (
    <div
      ref={probeRef}
      className={cn(
        'sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#D6EAF3]/80 bg-white/85 p-3 px-5 backdrop-blur-md',
        className
      )}
      dir="rtl"
    >
      {actions}
    </div>
  );
}
