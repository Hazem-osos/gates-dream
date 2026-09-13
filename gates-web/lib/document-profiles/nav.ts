import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';
import { profileEntryHref, type DocumentBaseType, type DocumentProfile } from './types';

function cloneModules(modules: ModuleNavNode[]): ModuleNavNode[] {
  return modules.map((m) => ({
    ...m,
    children: m.children ? cloneModules(m.children) : undefined,
  }));
}

export function injectDocumentProfiles(
  modules: ModuleNavNode[],
  profiles: DocumentProfile[],
  parentKey: string,
  baseTypes: DocumentBaseType[]
): ModuleNavNode[] {
  const extras = profiles.filter((p) => p.isActive && p.showInSidebar && baseTypes.includes(p.baseType));
  if (!extras.length) return modules;
  const next = cloneModules(modules);
  const parent = findNode(next, parentKey);
  if (!parent) return next;
  parent.children = [
    ...(parent.children ?? []),
    ...extras.map((p) => ({
      key: `profile-${p.slug}`,
      icon: '',
      label: p.nameAr,
      color: '#0E79AA',
      href: profileEntryHref(p),
    })),
  ];
  return next;
}

function findNode(nodes: ModuleNavNode[], key: string): ModuleNavNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const hit = findNode(node.children, key);
      if (hit) return hit;
    }
  }
  return undefined;
}
