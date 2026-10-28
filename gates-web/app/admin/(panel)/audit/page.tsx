'use client';

import { Card, PageHeader } from '@/components/platform-admin/ui';
import { AuditTable } from '@/components/platform-admin/AuditTable';

export default function PlatformAuditPage() {
  return (
    <>
      <PageHeader title="سجل العمليات" subtitle="كل ما تم من لوحة الإدارة: من فعل ماذا ومتى ومن أي جهاز" />
      <Card>
        <AuditTable />
      </Card>
    </>
  );
}
