'use client';

import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import {
  InventoryInvoicesListSection,
  type InvoiceListRow,
} from '@/app/components/inventory/InventoryInvoicesListSection';

export function InvoiceDocumentListDrawer({
  open,
  onClose,
  title,
  invoiceKind,
  partyColumnHeader,
  getPartyName,
  selectedInvoiceId,
  onOpenForEdit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  invoiceKind: 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
  partyColumnHeader: string;
  getPartyName: (row: InvoiceListRow) => string;
  selectedInvoiceId: string | null;
  onOpenForEdit: (id: string) => void;
}) {
  return (
    <DocumentBrowseDrawer open={open} onClose={onClose} title={title}>
      <InventoryInvoicesListSection
        compact
        title={title}
        invoiceKind={invoiceKind}
        partyColumnHeader={partyColumnHeader}
        getPartyName={getPartyName}
        selectedInvoiceId={selectedInvoiceId}
        onSelectInvoice={(id) => {
          if (id) onOpenForEdit(id);
          onClose();
        }}
      />
    </DocumentBrowseDrawer>
  );
}
