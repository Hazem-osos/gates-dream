'use client';

import { useRef, type ReactNode } from 'react';
import { clearConditionalGetCache } from '@/lib/api/conditional-get-cache';
import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import { masterCatalogGeneration } from '@/lib/query/master-catalog-sync';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Side list of previous documents on the same operation page — not reports. */
export function DocumentBrowseDrawer({ open, onClose, title, children }: Props) {
  const session = useRef(0);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    session.current += 1;
    clearConditionalGetCache();
  }
  wasOpen.current = open;

  return (
    <MasterEntitySideDrawer
      open={open}
      title={title}
      subtitle="ابحث ثم اضغط الصف أو «فتح» — المستند يفتح هنا في نفس الصفحة"
      onClose={onClose}
    >
      <div key={`${session.current}-${masterCatalogGeneration()}`}>{children}</div>
    </MasterEntitySideDrawer>
  );
}
