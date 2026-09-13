'use client';

import type { ReactNode } from 'react';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Side list of previous documents on the same operation page — not reports. */
export function DocumentBrowseDrawer({ open, onClose, title, children }: Props) {
  return (
    <MasterEntitySideDrawer
      open={open}
      title={title}
      subtitle="ابحث ثم اضغط الصف أو «فتح» — المستند يفتح هنا في نفس الصفحة"
      onClose={onClose}
    >
      {children}
    </MasterEntitySideDrawer>
  );
}
