import type { FlatModuleNavLink, ModuleNavNode } from '@/lib/navigation/module-nav-types';
import { buildCategorizedNavGroups } from '@/lib/navigation/categorize-module-nav';

export function flattenModuleNavLinks(modules: ModuleNavNode[]): FlatModuleNavLink[] {
  return buildCategorizedNavGroups(modules).flatMap((g) => [
    ...g.subgroups.flatMap((s) => s.items),
    ...g.items,
  ]);
}

export function filterModuleNavLinks(
  links: FlatModuleNavLink[],
  query: string
): FlatModuleNavLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return links;
  return links.filter((link) => {
    const hay = `${link.label} ${link.href} ${link.keywords.join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}
