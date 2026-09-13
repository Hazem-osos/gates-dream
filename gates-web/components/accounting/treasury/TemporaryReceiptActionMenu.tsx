'use client';

import { Copy, MoreHorizontal, Pencil, Printer, XCircle } from 'lucide-react';
import { Button } from '@/components/ui';
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
          id: 'print',
          label: 'طباعة الإيصال',
          disabled: !hasDocument,
          onClick: onPrint,
          icon: <Printer className="ml-2 h-4 w-4" />,
        },
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
  );
}
