'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import LiveExecutiveDashboard from './components/LiveExecutiveDashboard';

export default function Dashboard() {
  useBackendReachability();
  return <LiveExecutiveDashboard />;
}
