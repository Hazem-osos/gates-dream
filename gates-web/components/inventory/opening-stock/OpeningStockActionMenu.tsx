'use client';

import {
  CheckCircle2,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Printer,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';

type Props = {
  hasDocument: boolean;
  canPost: boolean;
  isPosted: boolean;
  isReadOnly: boolean;
  onPost: () => void;
  onUnpost: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onExportExcel: () => void;
  onClearAll: () => void;
};

export function OpeningStockActionMenu({
  hasDocument,
  canPost,
  isPosted,
  isReadOnly,
  onPost,
  onUnpost,
  onEdit,
  onPrint,
  onExportExcel,
  onClearAll,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={`${formActionButtonClass} gap-1.5`}
        onClick={onPrint}
        data-tour="document-print"
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        طباعة كشف بضاعة أول المدة
      </Button>
      <SimpleDropdownMenu
        align="right"
        trigger={
          <Button type="button" variant="ghost" size="sm" aria-label="قائمة الإجراءات">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        }
        items={[
        isPosted
          ? {
              id: 'unpost',
              label: 'فك الترحيل (إلغاء الترحيل)',
              disabled: !hasDocument,
              onClick: onUnpost,
              icon: <Unlock className="ml-2 h-4 w-4 text-amber-600" />,
            }
          : {
              id: 'post',
              label: 'ترحيل بضاعة أول المدة',
              disabled: !canPost,
              onClick: onPost,
              icon: <CheckCircle2 className="ml-2 h-4 w-4 text-emerald-600" />,
            },
        ...(isReadOnly
          ? [
              {
                id: 'edit',
                label: 'تعديل الكشف',
                disabled: isPosted,
                onClick: onEdit,
                icon: <Pencil className="ml-2 h-4 w-4" />,
              },
            ]
          : []),
        {
          id: 'excel',
          label: 'تصدير إلى إكسيل',
          onClick: onExportExcel,
          icon: <FileSpreadsheet className="ml-2 h-4 w-4" />,
        },
        {
          id: 'clear',
          label: 'تفريغ محتويات الجدول',
          disabled: isReadOnly || isPosted,
          destructive: true,
          onClick: onClearAll,
          icon: <Trash2 className="ml-2 h-4 w-4" />,
        },
        ]}
      />
    </div>
  );
}
