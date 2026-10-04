'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { EtaInvoiceSendPage } from '@/components/electronic-invoices/EtaInvoiceSendPage';

export default function SendElectronicInvoicePage() {
  useBackendReachability();
  return <EtaInvoiceSendPage title="إرسال الفواتير الإلكترونية" />;
}
