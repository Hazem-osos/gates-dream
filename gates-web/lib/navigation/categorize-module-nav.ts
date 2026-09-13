import type {
  CategorizedNavGroup,
  FlatModuleNavLink,
  ModuleNavNode,
  NavCategoryId,
  NavSubgroup,
} from '@/lib/navigation/module-nav-types';
import { NAV_CATEGORY_META } from '@/lib/navigation/module-nav-types';

function inferCategoryFromContext(
  href: string,
  label: string,
  ancestorKeys: string[]
): NavCategoryId {
  const path = href.toLowerCase();
  const keys = ancestorKeys.join(' ').toLowerCase();

  if (
    path.includes('/reports') ||
    path.includes('/report') ||
    keys.includes('reports') ||
    label.includes('تقرير') ||
    label.includes('كشف') ||
    label.includes('ميزان') ||
    label.includes('أستاذ')
  ) {
    return 'reports';
  }

  if (
    path.includes('/accounting-settings') ||
    path.includes('/settings') ||
    path.includes('extract-contractor-settings') ||
    path.includes('company-settings') ||
    keys.includes('settings') ||
    label.includes('إعداد') ||
    label.includes('تهيئة')
  ) {
    return 'settings';
  }

  if (
    path.includes('/operations') ||
    path.includes('/operations/') ||
    keys === 'operations' ||
    keys.includes('operations') ||
    label.includes('فاتورة') ||
    label.includes('سند') ||
    label.includes('مستخلص') ||
    label.includes('قيد') ||
    label.includes('صرف') ||
    label.includes('إضافة') ||
    label.includes('تحويل') ||
    label.includes('سداد')
  ) {
    return 'operations';
  }

  if (
    path.includes('/creations') ||
    path.includes('/create/') ||
    path.includes('/cards/') ||
    path.includes('/guide') ||
    path.includes('/chart-of-accounts') ||
    keys.includes('creations') ||
    keys.includes('create') ||
    keys.includes('guide') ||
    keys.includes('cards') ||
    label.includes('بطاقة') ||
    label.includes('تعريف') ||
    label.includes('دليل') ||
    label.includes('شجرة')
  ) {
    return 'master';
  }

  if (keys.includes('reports')) return 'reports';
  if (keys.includes('operations')) return 'operations';
  if (keys.includes('creations') || keys.includes('create') || keys.includes('guide')) {
    return 'master';
  }

  return 'operations';
}

function toLink(
  node: ModuleNavNode,
  href: string,
  ancestorKeys: string[],
  category: NavCategoryId
): FlatModuleNavLink {
  return {
    key: node.key,
    label: node.label,
    href,
    category,
    keywords: [node.label, ...(node.keywords ?? []), ...href.split('/').filter(Boolean)],
    badge: node.badge,
  };
}

function collectLeafLinks(
  nodes: ModuleNavNode[],
  ancestorKeys: string[],
  category: NavCategoryId,
  seen: Set<string>
): FlatModuleNavLink[] {
  const out: FlatModuleNavLink[] = [];
  for (const node of nodes) {
    const nextAncestors = [...ancestorKeys, node.key];
    if (node.href && !seen.has(node.href)) {
      seen.add(node.href);
      out.push(toLink(node, node.href, ancestorKeys, category));
    }
    if (node.children?.length) {
      out.push(...collectLeafLinks(node.children, nextAncestors, category, seen));
    }
  }
  return out;
}

function categoryFromTopLevelGroupKey(groupKey: string): NavCategoryId | null {
  const k = groupKey.toLowerCase();
  if (k === 'operations') return 'operations';
  if (k === 'reports') return 'reports';
  if (k === 'creations' || k === 'create' || k === 'guide' || k === 'cards') return 'master';
  if (k === 'settings' || k.includes('settings')) return 'settings';
  return null;
}

function pushSubgroup(target: NavSubgroup[], subgroup: NavSubgroup) {
  if (!subgroup.items.length) return;
  const existing = target.find((s) => s.id === subgroup.id);
  if (existing) {
    existing.items.push(...subgroup.items);
    return;
  }
  target.push(subgroup);
}

export function buildCategorizedNavGroups(modules: ModuleNavNode[]): CategorizedNavGroup[] {
  const buckets: Record<NavCategoryId, { leftovers: FlatModuleNavLink[]; subgroups: NavSubgroup[] }> = {
    operations: { leftovers: [], subgroups: [] },
    master: { leftovers: [], subgroups: [] },
    reports: { leftovers: [], subgroups: [] },
    settings: { leftovers: [], subgroups: [] },
  };
  const seen = new Set<string>();

  for (const group of modules) {
    const forced = categoryFromTopLevelGroupKey(group.key);
    const children = group.children ?? [];

    if (group.href && !children.length) {
      const href = group.href;
      if (seen.has(href)) continue;
      seen.add(href);
      const category = forced ?? inferCategoryFromContext(href, group.label, []);
      buckets[category].leftovers.push(toLink(group, href, [], category));
      continue;
    }

    if (!children.length) continue;

    const nested = children.filter((c) => (c.children?.length ?? 0) > 0);
    const leaves = children.filter((c) => !(c.children?.length ?? 0) && c.href);

    const categoryForGroup =
      forced ??
      (leaves[0]
        ? inferCategoryFromContext(leaves[0].href as string, leaves[0].label, [group.key])
        : nested[0]?.children?.[0]?.href
          ? inferCategoryFromContext(nested[0].children[0].href as string, nested[0].label, [group.key])
          : 'operations');

    for (const child of nested) {
      const childCategory =
        categoryFromTopLevelGroupKey(child.key) ??
        categoryForGroup;
      const items = collectLeafLinks(child.children ?? [], [group.key, child.key], childCategory, seen);
      pushSubgroup(buckets[childCategory].subgroups, {
        id: `${childCategory}:${child.key}`,
        title: child.label,
        items,
      });
    }

    if (leaves.length) {
      const leafLinks = leaves
        .filter((leaf) => leaf.href && !seen.has(leaf.href))
        .map((leaf) => {
          const href = leaf.href as string;
          seen.add(href);
          const leafCategory = forced ?? inferCategoryFromContext(href, leaf.label, [group.key]);
          return { leaf, leafCategory, link: toLink(leaf, href, [group.key], leafCategory) };
        });

      const byCategory = new Map<NavCategoryId, FlatModuleNavLink[]>();
      for (const row of leafLinks) {
        const list = byCategory.get(row.leafCategory) ?? [];
        list.push(row.link);
        byCategory.set(row.leafCategory, list);
      }
      for (const [leafCategory, items] of byCategory) {
        const title =
          nested.length > 0 && leafCategory === categoryForGroup ? 'أخرى' : group.label;
        pushSubgroup(buckets[leafCategory].subgroups, {
          id: `${leafCategory}:${group.key}:leaves`,
          title,
          items,
        });
      }
    }
  }

  return (Object.keys(NAV_CATEGORY_META) as NavCategoryId[])
    .sort((a, b) => NAV_CATEGORY_META[a].order - NAV_CATEGORY_META[b].order)
    .map((id) => ({
      id,
      title: NAV_CATEGORY_META[id].title,
      items: buckets[id].leftovers,
      subgroups: buckets[id].subgroups.filter((s) => s.items.length > 0),
    }))
    .filter((g) => g.items.length > 0 || g.subgroups.length > 0);
}
