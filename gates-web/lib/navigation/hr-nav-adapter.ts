import type { HrNavItem } from '@/app/components/hr/hr-sidebar.config';
import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';

export function hrNavToModuleNodes(items: HrNavItem[]): ModuleNavNode[] {
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    color: item.color,
    children: item.children?.length ? hrNavToModuleNodes(item.children) : undefined,
  }));
}
