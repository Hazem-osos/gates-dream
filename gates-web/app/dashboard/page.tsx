'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import LiveExecutiveDashboard from '../components/LiveExecutiveDashboard';

/** Authenticated ERP landing. Public homepage is the marketing site at `/`. */
export default function DashboardPage() {
  useBackendReachability();
  return <LiveExecutiveDashboard />;
}
