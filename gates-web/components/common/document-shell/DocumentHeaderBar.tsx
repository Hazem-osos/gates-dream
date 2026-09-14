'use client';

import type { ReactNode } from 'react';
import { ErpDocumentPageHeader, type ErpHeaderMenuItem } from '@/components/erp/ErpDocumentPageHeader';
import type { StatusTone } from '@/components/ui/StatusBadge';
import type { DocumentActionExtraItem, DocumentActionMenuProps } from './DocumentActionMenu';
import type { WhatsAppInvoicePayload } from '@/lib/whatsapp-share';
import type { DocumentNavEntity } from './DocumentPreviousBrowser';
import { useOptionalDocumentMode } from './DocumentModeContext';

type Props = {
  breadcrumbs: { href?: string; label: string }[];
  title: string;
  docNumber?: string;
  statusTone: StatusTone;
  statusLabel: string;
  onSaveDraft: () => void;
  saveLabel?: string;
  savePending?: boolean;
  canSave?: boolean;
  extraActions?: ReactNode;
  autoSaveIndicator?: ReactNode;
  favoriteHref?: string;
  favoriteLabel?: string;
  onBrowseList: () => void;
  browseListLabel?: string;
  navEntity?: DocumentNavEntity;
  currentId?: string | null;
  invoiceKind?: string;
  transactionKind?: string;
  fundType?: 'CASHBOX' | 'BANK_ACCOUNT';
  onNavigate?: (id: string) => void;
  standardActions?: Omit<DocumentActionMenuProps, 'extraItems'> & {
    extraItems?: DocumentActionExtraItem[];
  };
  whatsAppShare?: WhatsAppInvoicePayload | null;
  moreMenuItems?: ErpHeaderMenuItem[];
  printTrigger?: ReactNode;
  actionMenu?: ReactNode;
};

export function DocumentHeaderBar(props: Props) {
  const mode = useOptionalDocumentMode();
  const saveLabel =
    props.saveLabel ?? (mode?.isEditing ? 'حفظ التعديلات' : 'حفظ');

  return (
    <div data-tour="document-header">
    <ErpDocumentPageHeader
      breadcrumbs={props.breadcrumbs}
      title={props.title}
      docNumber={props.docNumber}
      statusTone={props.statusTone}
      statusLabel={props.statusLabel}
      onSaveDraft={props.onSaveDraft}
      saveLabel={saveLabel}
      savePending={props.savePending}
      canSave={props.canSave}
      extraActions={props.extraActions}
      autoSaveIndicator={props.autoSaveIndicator}
      favoriteHref={props.favoriteHref}
      favoriteLabel={props.favoriteLabel}
      onBrowseList={props.onBrowseList}
      browseListLabel={props.browseListLabel}
      navEntity={props.navEntity}
      currentId={props.currentId}
      invoiceKind={props.invoiceKind}
      transactionKind={props.transactionKind}
      fundType={props.fundType}
      onNavigate={props.onNavigate}
      standardActions={
        props.standardActions
          ? {
              ...props.standardActions,
              whatsAppShare: props.standardActions.whatsAppShare ?? props.whatsAppShare,
            }
          : undefined
      }
      moreMenuItems={props.moreMenuItems}
      printTrigger={props.printTrigger}
      actionMenu={props.actionMenu}
      hideStandalonePost
    />
    </div>
  );
}
