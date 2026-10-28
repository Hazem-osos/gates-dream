import type { ReactNode } from 'react';
import { AdminShell } from '@/components/platform-admin/AdminShell';

export default function PlatformAdminPanelLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
