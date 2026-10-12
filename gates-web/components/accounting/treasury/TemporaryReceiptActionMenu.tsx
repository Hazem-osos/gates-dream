'use client';

import { Copy, MoreHorizontal, Pencil, Printer, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';

type Props = {
  hasDocument: boolean;
  isReadOnly: boolean;
  isCancelled?: boolean;
  onEdit: () => void;
  onPrint: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
};

export function TemporaryReceiptActionMenu({
  hasDocument,
  isReadOnly,
  isCancelled,
  onEdit,
  onPrint,
  onDuplicate,
  onCancel,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={`${formActionButtonClass} gap-1.5`}
        disabled={!hasDocument}
        onClick={onPrint}
        data-tour="document-print"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        طباعة الإيصال
      </Button>
      <SimpleDropdownMenu
        align="right"
        trigger={
          <Button type="button" variant="ghost" size="sm" aria-label="قائمة الإجراءات">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        }
        items={[
        ...(isReadOnly
          ? [
              {
                id: 'edit',
                label: 'تعديل الإيصال',
                disabled: !hasDocument || Boolean(isCancelled),
                onClick: onEdit,
                icon: <Pencil className="ml-2 h-4 w-4" />,
              },
            ]
          : []),
        {
          id: 'duplicate',
          label: 'تكرار',
          disabled: !hasDocument,
          onClick: onDuplicate,
          icon: <Copy className="ml-2 h-4 w-4" />,
        },
        {
          id: 'void',
          label: 'إلغاء الإيصال',
          disabled: !hasDocument || Boolean(isCancelled),
          destructive: true,
          onClick: onCancel,
          icon: <XCircle className="ml-2 h-4 w-4" />,
        },
        ]}
      />
    </div>
  );
}
