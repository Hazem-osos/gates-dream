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

function serialRank(code: string): number | null {
  const raw = String(code ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function compareGuideNodes(a: GuideTreeNode, b: GuideTreeNode): number {
  const aRank = serialRank(a.code);
  const bRank = serialRank(b.code);
  if (aRank != null && bRank != null && aRank !== bRank) return aRank - bRank;
  if (aRank != null && bRank == null) return -1;
  if (aRank == null && bRank != null) return 1;
  return a.name.localeCompare(b.name, 'ar') || a.code.localeCompare(b.code, 'ar');
}

export function sortGuideNodes(nodes: GuideTreeNode[]): GuideTreeNode[] {
  return [...nodes]
    .map((node) => ({
      ...node,
      children: node.children?.length ? sortGuideNodes(node.children) : node.children,
    }))
    .sort(compareGuideNodes);
}

export function buildParentTree<T extends { id: string; parentId?: string | null }>(
  items: T[],
  mapNode: (item: T, children: GuideTreeNode[]) => GuideTreeNode
): GuideTreeNode[] {
  const byParent = new Map<string | null, T[]>();
  const known = new Set(items.map((i) => i.id));
  for (const item of items) {
    const raw = item.parentId ?? null;
    const key = !raw || raw === item.id || !known.has(raw) ? null : raw;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }

  const seen = new Set<string>();
  const walk = (parentId: string | null): GuideTreeNode[] =>
    (byParent.get(parentId) ?? []).flatMap((item) => {
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      return [mapNode(item, walk(item.id))];
    });

  const rooted = sortGuideNodes(walk(null));
  const leftovers = items.filter((item) => !seen.has(item.id));
  if (leftovers.length === 0) return rooted;
  return sortGuideNodes([
    ...rooted,
    ...leftovers.flatMap((item) => {
      if (seen.has(item.id)) return [];
      seen.add(item.id);
      return [mapNode(item, walk(item.id))];
    }),
  ]);
}

export function groupAsFolders(
  groups: {
    id: string;
    code: string;
    name: string;
    groupKey?: string;
    toneIndex?: number;
    children: GuideTreeNode[];
    synthetic?: boolean;
  }[],
  options?: { keepEmpty?: boolean; synthetic?: boolean }
): GuideTreeNode[] {
  return groups
    .filter((g) => options?.keepEmpty || g.children.length > 0)
    .map((g) => ({
      id: g.id,
      code: g.code,
      name: g.name,
      folder: true,
      synthetic: g.synthetic ?? options?.synthetic ?? true,
      groupKey: g.groupKey,
      toneIndex: g.toneIndex,
      children: sortGuideNodes(g.children),
    }));
}

export function filterGuideTree(
  nodes: GuideTreeNode[],
  q: string,
  seen = new Set<string>()
): GuideTreeNode[] {
  if (!q) return nodes;
  const needle = q.toLowerCase();
  const out: GuideTreeNode[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const children = node.children?.length ? filterGuideTree(node.children, q, seen) : [];
    const blob = `${node.code} ${node.name} ${node.subtitle ?? ''}`.toLowerCase();
    if (blob.includes(needle) || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}

export function collectExpandableIds(
  nodes: GuideTreeNode[],
  out: Set<string>,
  seen = new Set<string>()
) {
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    if (n.children?.length) {
      out.add(n.id);
      collectExpandableIds(n.children, out, seen);
    }
  }
}
