'use client';

import type { ReactNode } from 'react';
import { List, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';

export type CrudMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  hint?: string;
  icon?: ReactNode;
};

type Props = {
  onAdd?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPrevious?: () => void;
  previousLabel?: string;
  extraItems?: CrudMenuItem[];
  items?: CrudMenuItem[];
  className?: string;
};

function MenuLinesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M4 7h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 17h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function CrudButtons({
  onAdd,
  onEdit,
  onDelete,
  onPrevious,
  previousLabel = 'السابق',
  extraItems = [],
  items,
  className = '',
}: Props) {
  const newItem: CrudMenuItem = {
    id: 'add',
    label: 'جديد',
    onClick: () => onAdd?.(),
    disabled: !onAdd,
    icon: <Plus className="h-4 w-4" />,
    hint: onAdd ? 'تفريغ الصفحة والبدء من جديد' : 'أضف إجراء جديد لهذه الشاشة',
  };

  const defaultItems: CrudMenuItem[] = [
    newItem,
    {
      id: 'edit',
      label: 'تعديل',
      onClick: () => onEdit?.(),
      disabled: !onEdit,
      icon: <Pencil className="h-4 w-4" />,
    },
    {
      id: 'delete',
      label: 'حذف',
      onClick: () => onDelete?.(),
      disabled: !onDelete,
      destructive: true,
      icon: <Trash2 className="h-4 w-4" />,
    },
    ...extraItems,
  ];

  const customItems = items?.length ? items : [];
  const hasNew = customItems.some((item) => item.id === 'add' || item.label === 'جديد');
  const menuItems = items?.length
    ? [...(hasNew ? [] : [newItem]), ...customItems, ...extraItems]
    : defaultItems;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`} dir="rtl">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={onPrevious}
        disabled={!onPrevious}
        title={onPrevious ? previousLabel : 'استعرض السجلات السابقة'}
      >
        <List className="h-3.5 w-3.5" />
        {previousLabel}
      </Button>
      <SimpleDropdownMenu
        align="left"
        trigger={
          <button
            type="button"
            aria-label="قائمة الإجراءات"
            title="قائمة الإجراءات"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0E78AA] text-white shadow-[0_6px_16px_-8px_rgba(14,120,170,0.9)] ring-2 ring-[#0E78AA]/25 transition hover:bg-[#0A5F8A] hover:shadow-[0_8px_20px_-8px_rgba(14,120,170,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E78AA]/50"
          >
            <MenuLinesIcon />
          </button>
        }
        items={menuItems}
      />
    </div>
  );
}

export default CrudButtons;
