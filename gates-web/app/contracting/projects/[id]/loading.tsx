import { PageSkeleton } from '@/components/ui/skeletons';

export default function Loading() {
  return <PageSkeleton variant="workspace" tiles={5} />;
}
