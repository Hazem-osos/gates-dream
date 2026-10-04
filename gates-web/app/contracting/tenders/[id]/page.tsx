'use client';

import { useParams } from 'next/navigation';
import { TenderWorkspace } from '@/components/contracting/tender/TenderWorkspace';

export default function TenderWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return <TenderWorkspace tenderId={id} />;
}
