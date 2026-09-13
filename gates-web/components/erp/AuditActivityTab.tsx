'use client';

import type { ReactNode } from 'react';
import {
  DocumentActivityLog,
  type DocumentEntityType,
} from '@/app/components/accounting/DocumentActivityLog';

type Props = {
  entityType: DocumentEntityType;
  entityId: string | null;
  children?: ReactNode;
};

export function AuditActivityTab({ entityType, entityId, children }: Props) {
  return (
    <div className="space-y-3 text-sm">
      {children}
      <DocumentActivityLog entityType={entityType} entityId={entityId} />
    </div>
  );
}
