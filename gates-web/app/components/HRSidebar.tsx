'use client';

import { SubNavigationSidebar } from '@/app/components/navigation/SubNavigationSidebar';
import { hrModules } from '@/app/components/hr/hr-sidebar.config';
import { hrNavToModuleNodes } from '@/lib/navigation/hr-nav-adapter';

export default function HRSidebar({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <SubNavigationSidebar
      moduleKey="hr"
      modules={hrNavToModuleNodes(hrModules)}
      collapsed={collapsed}
    />
  );
}
