export type GuideTreeNode = {
  id: string;
  code: string;
  name: string;
  subtitle?: string;
  folder?: boolean;
  synthetic?: boolean;
  groupKey?: string;
  toneIndex?: number;
  children?: GuideTreeNode[];
};

export function buildParentTree<T extends { id: string; parentId?: string | null }>(
  items: T[],
  mapNode: (item: T, children: GuideTreeNode[]) => GuideTreeNode
): GuideTreeNode[] {
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    const key = item.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }

  const walk = (parentId: string | null): GuideTreeNode[] =>
    (byParent.get(parentId) ?? []).map((item) => {
      const children = walk(item.id);
      return mapNode(item, children);
    });

  const rooted = walk(null);
  const known = new Set(items.map((i) => i.id));
  const orphans = items.filter((i) => i.parentId && !known.has(i.parentId));
  if (orphans.length === 0) return rooted;
  return [
    ...rooted,
    ...orphans.map((item) => mapNode(item, walk(item.id))),
  ];
}

export function groupAsFolders(
  groups: {
    id: string;
    code: string;
    name: string;
    groupKey?: string;
    toneIndex?: number;
    children: GuideTreeNode[];
  }[],
  options?: { keepEmpty?: boolean }
): GuideTreeNode[] {
  return groups
    .filter((g) => options?.keepEmpty || g.children.length > 0)
    .map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      folder: true,
      synthetic: true,
      groupKey: g.groupKey,
      toneIndex: g.toneIndex,
      children: g.children,
    }));
}

export function filterGuideTree(nodes: GuideTreeNode[], q: string): GuideTreeNode[] {
  if (!q) return nodes;
  const needle = q.toLowerCase();
  const out: GuideTreeNode[] = [];
  for (const node of nodes) {
    const children = node.children?.length ? filterGuideTree(node.children, q) : [];
    const blob = `${node.code} ${node.name} ${node.subtitle ?? ''}`.toLowerCase();
    if (blob.includes(needle) || children.length > 0) {
      out.push({ ...node, children: children.length ? children : node.children });
    }
  }
  return out;
}

export function collectExpandableIds(nodes: GuideTreeNode[], out: Set<string>) {
  for (const n of nodes) {
    if (n.children?.length) {
      out.add(n.id);
      collectExpandableIds(n.children, out);
    }
  }
}
