'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { List, MoreHorizontal, Star } from 'lucide-react';
import { ScreenHelpButton } from '@/components/ai/ScreenHelpButton';
import { Button } from '@/components/ui/button';
import { DisabledActionHint } from '@/components/ui/DisabledActionHint';
import { formActionButtonClass, formActionPairClass } from '@/components/ui/forms/formTokens';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';
import { inferDocumentStatus, publishAiScreenSession } from '@/lib/ai/screen-session';
import { usePageFavorites } from '@/lib/hooks/usePageFavorites';
import {
  DocumentActionMenu,
  DocumentPreviousBrowser,
  useOptionalDocumentMode,
  type DocumentActionMenuProps,
  type DocumentNavEntity,
} from '@/components/common/document-shell';
import { useRegisterScreenChrome } from '@/components/erp/AppScreenChromeContext';

function RegisterScreenChrome() {
  useRegisterScreenChrome();
  return null;
}

export type ErpHeaderMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

type Props = {
  breadcrumbs: { href?: string; label: string }[];
  title: string;
  docNumber?: string;
  statusTone: StatusTone;
  statusLabel: string;
  onCancel?: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  saveDisabledHint?: string;
  postLabel?: string;
  savePending?: boolean;
  postPending?: boolean;
  canPost?: boolean;
  canSave?: boolean;
  onSaveDraft?: () => void;
  onPost?: () => void;
  printTrigger?: ReactNode;
  printMenuItems?: ErpHeaderMenuItem[];
  moreMenuItems?: ErpHeaderMenuItem[];
  moreTrigger?: ReactNode;
  /** Replaces the default three-dots / standard action menu when provided. */
  actionMenu?: ReactNode;
  extraActions?: ReactNode;
  /** Opens the previous-documents list on this same page (not reports). */
  onBrowseList?: () => void;
  browseListLabel?: string;
  navEntity?: DocumentNavEntity;
  currentId?: string | null;
  invoiceKind?: string;
  transactionKind?: string;
  fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
  onNavigate?: (id: string) => void;
  standardActions?: DocumentActionMenuProps;
  hideStandalonePost?: boolean;
  autoSaveIndicator?: ReactNode;
  favoriteHref?: string;
  favoriteLabel?: string;
  /** Gates Academy: data-academy-trigger-id attribute for the save/post buttons (additive, optional). */
  saveTriggerId?: string;
  postTriggerId?: string;
  /** When false, hide the `[ رقم المستند ]` chip (list / settings pages). */
  showDocumentRef?: boolean;
  registerChrome?: boolean;
  /** Tighter header — same actions as the sales invoice, without extra chrome height. */
  compact?: boolean;
  /**
   * When false, never lock Save as if this were a posted voucher.
   * Master-data screens (periods, currencies) must pass false.
   */
  lockWhenPosted?: boolean;
};

function isPostedStatusLabel(label: string): boolean {
  const t = label.trim();
  if (!t || /غير\s*مرح/.test(t)) return false;
  if (/مسودة|جديد|تعديل|مفتوحة|مغلقة/.test(t)) return false;
  return /مرحّ?ل|posted/i.test(t);
}

export function ErpDocumentPageHeader({
  breadcrumbs,
  title,
  docNumber,
  statusTone,
  statusLabel,
  saveLabel = 'حفظ',
  saveDisabledHint,
  postLabel = 'ترحيل',
  savePending,
  postPending,
  canPost = true,
  canSave = true,
  onSaveDraft,
  onPost,
  onCancel,
  cancelLabel = 'إلغاء',
  printTrigger,
  printMenuItems,
  moreMenuItems,
  moreTrigger,
  actionMenu,
  extraActions,
  onBrowseList,
  browseListLabel = 'السابق',
  navEntity,
  currentId,
  invoiceKind,
  transactionKind,
  fundType,
  onNavigate,
  standardActions,
  hideStandalonePost,
  autoSaveIndicator,
  favoriteHref,
  favoriteLabel,
  saveTriggerId,
  postTriggerId,
  showDocumentRef = true,
  registerChrome = true,
  compact = false,
  lockWhenPosted = true,
}: Props) {
  const docTitle = docNumber?.trim() ? docNumber : 'مسودة جديدة';
  const { isFavorite, toggleFavorite } = usePageFavorites();
  const starred = favoriteHref ? isFavorite(favoriteHref) : false;
  const documentMode = useOptionalDocumentMode();
  const isReadOnly = documentMode?.isReadOnly === true;
  const looksPosted = lockWhenPosted && isPostedStatusLabel(statusLabel);
  const hidePost = hideStandalonePost || Boolean(standardActions);
  const saveHint = isReadOnly
    ? 'المستند في وضع العرض فقط. اضغط على (...) ثم (تعديل) للبدء في التغيير'
    : looksPosted
      ? 'المستند مرحل ومثبت محاسبياً. يجب إلغاء الترحيل أولاً من قائمة (...)'
      : !canSave
        ? saveDisabledHint || 'لا يمكن الحفظ الآن — أكمل البيانات المطلوبة أو انتظر انتهاء العملية'
        : undefined;
  const saveDisabled = Boolean(saveHint) || Boolean(savePending);

  useEffect(() => {
    publishAiScreenSession({
      documentId: currentId ?? undefined,
      documentStatus: inferDocumentStatus(statusTone, statusLabel),
      pageTitle: title,
    });
  }, [currentId, statusLabel, statusTone, title]);

  return (
    <header className={`sticky top-0 z-40 -mx-3 px-3 bg-white/95 backdrop-blur-md border-b border-[#E6F0F7] shadow-sm rounded-lg overflow-visible ${compact ? 'py-1.5 mb-1' : 'py-2.5 mb-2'}`} data-tour="document-header" data-tour-legacy="erp-page-header">
      {registerChrome ? <RegisterScreenChrome /> : null}
      <div className={`flex flex-wrap justify-between gap-2 ${compact ? 'items-center' : 'items-start'}`}>
        <div className={`min-w-0 ${compact ? '' : 'space-y-0.5'}`}>
          {compact ? null : (
          <nav className="text-[11px] text-[#64748B] flex flex-wrap items-center gap-1">
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span>/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-[#0E78AA]">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={i === breadcrumbs.length - 1 ? 'text-[#0A3D5E]' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-bold text-[#0A3D5E]">
              {title}
              {showDocumentRef ? (
                <>
                  {' '}
                  <span className="text-[#0E78AA] font-mono text-sm">[ {docTitle} ]</span>
                </>
              ) : null}
            </h1>
            {favoriteHref ? (
              <button
                type="button"
                title={starred ? 'إزالة من المفضلة' : 'إضافة للمفضلة (Cmd+K)'}
                onClick={() => toggleFavorite(favoriteHref, favoriteLabel ?? title)}
                className="rounded p-1 text-amber-500 hover:bg-amber-50"
              >
                <Star className={`h-4 w-4 ${starred ? 'fill-current' : ''}`} />
              </button>
            ) : null}
            {statusLabel ? <StatusBadge variant={statusTone} label={statusLabel} compact /> : null}
            <ScreenHelpButton screenTitle={title} />
            {autoSaveIndicator}
          </div>
        </div>

        <div className={`${formActionPairClass} shrink-0`}>
          <div data-gates-page-header-actions className="contents" />
          {onBrowseList ? (
            <DocumentPreviousBrowser
              onOpenList={onBrowseList}
              label={browseListLabel}
              entity={navEntity}
              currentId={currentId}
              invoiceKind={invoiceKind}
              transactionKind={transactionKind}
              fundType={fundType}
              onNavigate={onNavigate}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={`${formActionButtonClass} gap-1.5`}
              disabled
              title="استعرض السجلات السابقة"
            >
              <List className="h-3.5 w-3.5" />
              {browseListLabel}
            </Button>
          )}
          {extraActions}
          {onCancel ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={formActionButtonClass}
              onClick={onCancel}
            >
              {cancelLabel}
            </Button>
          ) : null}
          {onSaveDraft ? (
            <DisabledActionHint hint={saveHint} disabled={saveDisabled && !savePending}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className={formActionButtonClass}
                onClick={onSaveDraft}
                disabled={saveDisabled}
                isLoading={savePending}
                data-academy-trigger-id={saveTriggerId}
              >
                {documentMode?.isEditing ? 'حفظ التعديلات' : saveLabel}
              </Button>
            </DisabledActionHint>
          ) : null}
          {hidePost || !onPost ? null : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={formActionButtonClass}
              onClick={() => onPost?.()}
              disabled={!canPost || postPending}
              isLoading={postPending}
              data-academy-trigger-id={postTriggerId}
            >
              {postLabel}
            </Button>
          )}
          {printMenuItems?.length ? (
            <SimpleDropdownMenu align="right" trigger={printTrigger} items={printMenuItems} />
          ) : null}
          {actionMenu ? (
            actionMenu
          ) : standardActions ? (
            <DocumentActionMenu {...standardActions} />
          ) : (
            <SimpleDropdownMenu
              align="right"
              trigger={
                moreTrigger ?? (
                  <Button type="button" variant="ghost" size="sm" aria-label="المزيد">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                )
              }
              items={moreMenuItems?.length ? moreMenuItems : []}
            />
          )}
        </div>
      </div>
    </header>
  );
}
