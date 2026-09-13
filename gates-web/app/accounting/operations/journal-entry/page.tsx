'use client';

import dynamic from 'next/dynamic';
import { DynamicChunkSkeleton } from '@/components/ui/DynamicChunkSkeleton';

const CreateJournalEntryForm = dynamic(
  () => import('@/components/accounting/journal/CreateJournalEntryForm'),
  {
    ssr: false,
    loading: () => (
      <DynamicChunkSkeleton
        className="mt-6 min-h-[70vh] w-full max-w-none rounded-2xl border border-[#D6EAF3] bg-[#F6FBFD] p-6"
        label="جاري تحميل قيد اليومية…"
      />
    ),
  }
);

export default function JournalEntryPage() {
  return <CreateJournalEntryForm />;
}
