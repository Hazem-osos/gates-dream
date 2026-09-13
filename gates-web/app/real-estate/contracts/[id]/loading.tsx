import { PageSkeleton } from '@/components/ui/skeletons';

export default function Loading() {
  return <PageSkeleton variant="document" tiles={4} />;
}
