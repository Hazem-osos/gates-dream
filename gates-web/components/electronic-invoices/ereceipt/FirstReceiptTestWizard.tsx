'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  open: boolean;
  onClose: () => void;
  onIssued?: () => void;
};

/** Legacy entry — manual PREPRODUCTION test lives at /electronic-invoices/receipts/test (no PosOrder). */
export function FirstReceiptTestWizard({ open, onClose }: Props) {
  const router = useRouter();
  useEffect(() => {
    if (!open) return;
    onClose();
    router.push('/electronic-invoices/receipts/test');
  }, [open, onClose, router]);
  return null;
}
