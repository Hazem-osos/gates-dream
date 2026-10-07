'use client';

import { MasterEntitySideDrawer } from '@/components/masters/MasterEntitySideDrawer';
import {
  ItemReservationDocumentPanel,
  type ApplyReservationPayload,
} from '@/components/inventory/reservations/ItemReservationDocumentPanel';

type Props = {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  warehouseId?: string;
  disabled?: boolean;
  onApply: (payload: ApplyReservationPayload) => void;
};

export function CustomerItemReservationDrawer({
  open,
  onClose,
  customerId,
  warehouseId,
  disabled,
  onApply,
}: Props) {
  return (
    <MasterEntitySideDrawer
      open={open}
      onClose={onClose}
      title="حجوزات العميل"
      subtitle="اختر حجزاً لتحميل الكمية المحجوزة على الفاتورة"
    >
      <ItemReservationDocumentPanel
        customerId={customerId}
        warehouseId={warehouseId}
        disabled={disabled}
        onApply={(payload) => {
          onApply(payload);
          onClose();
        }}
      />
    </MasterEntitySideDrawer>
  );
}
