'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  collectAncestorIds,
  type CoaHierarchyAccount,
} from '@/lib/accounting/mapCoaToTreeNodes';
import { flattenVisibleCoaRows } from '@/lib/accounting/flattenCoaVisibleRows';
import { getTreeGuideClasses } from '@/lib/accounting/coaTreeTheme';
import { cn } from '@/lib/utils';
import { AccountTreeNode } from './AccountTreeNode';

const EMPTY_TRAIL: ReadonlySet<string> = new Set();

function displayName(a: CoaHierarchyAccount) {
  return a.nameAr ?? a.arabicName;
}

function nodeMatches(node: CoaHierarchyAccount, q: string): boolean {
  const blob = `${node.code} ${displayName(node)} ${node.englishName ?? ''}`.toLowerCase();
  return blob.includes(q);
}

function filterTree(
  nodes: CoaHierarchyAccount[],
  q: string,
  seen = new Set<string>()
): CoaHierarchyAccount[] {
  if (!q) return nodes;
  const out: CoaHierarchyAccount[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const children = node.children?.length ? filterTree(node.children, q, seen) : [];
    if (nodeMatches(node, q) || children.length > 0) {
      out.push({ ...node, children: children.length ? children : node.children });
    }
  }
  return out;
}

function filterByRootNature(
  nodes: CoaHierarchyAccount[],
  rootCode: string | null,
  seen = new Set<string>()
): CoaHierarchyAccount[] {
  if (!rootCode) return nodes;
  const out: CoaHierarchyAccount[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (node.code === rootCode || node.code.startsWith(rootCode)) {
      out.push(node);
      continue;
    }
    if (node.children?.length) {
      out.push(...filterByRootNature(node.children, rootCode, seen));
    }
  }
  return out;
}

function collectExpandableIds(
  nodes: CoaHierarchyAccount[],
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

function rootDigitForNode(node: CoaHierarchyAccount, inherited: string): string {
  if (inherited) return inherited;
  return node.code.trim().charAt(0) || '0';
}

function TreeBranch({
  node,
  depth,
  expandedIds,
  toggleId,
  searchQuery,
  isLastSibling,
  rootDigit,
  onAddChild,
  onEdit,
  onDelete,
  onLedger,
  trail,
}: {
  node: CoaHierarchyAccount;
  depth: number;
  expandedIds: Set<string>;
  toggleId: (id: string) => void;
  searchQuery: string;
  isLastSibling?: boolean;
  rootDigit: string;
  onAddChild: (n: CoaHierarchyAccount) => void;
  onEdit: (n: CoaHierarchyAccount) => void;
  onDelete: (n: CoaHierarchyAccount) => void;
  onLedger: (n: CoaHierarchyAccount) => void;
  trail: ReadonlySet<string>;
}) {
  if (trail.has(node.id)) return null;
  const nextTrail = new Set(trail);
  nextTrail.add(node.id);
  const hasChildren = Boolean(node.children?.length);
  const forceOpen = Boolean(searchQuery.trim());
  const expanded = forceOpen || expandedIds.has(node.id);
  const branchRoot = rootDigitForNode(node, rootDigit);
  const guide = getTreeGuideClasses(branchRoot);

  return (
    <div
      className="relative"
      role="treeitem"
      aria-selected={false}
      aria-expanded={hasChildren ? expanded : undefined}
    >
      <AccountTreeNode
        node={node}
        depth={depth}
        expanded={expanded}
        isLastSibling={isLastSibling}
        rootDigit={branchRoot}
        onToggle={() => toggleId(node.id)}
        searchQuery={searchQuery}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
        onLedger={onLedger}
      />
      {hasChildren && expanded ? (
        <div
          role="group"
          aria-label={`حسابات فرعية تحت ${displayName(node)}`}
          className={cn(
            'relative mr-7 mt-1 mb-2 pr-3 pt-1 pb-1 rounded-bl-xl rounded-br-md border-r-[3px] space-y-0',
            guide.border,
            guide.surface
          )}
        >
          {node.children!.map((child, idx) => (
            <div key={child.id} className="relative">
              <span
                className={cn(
                  'pointer-events-none absolute -right-3 top-[1.35rem] h-0.5 w-5 rounded-full opacity-80',
                  guide.elbow
                )}
                aria-hidden
              />
              {idx < node.children!.length - 1 ? (
                <span
                  className={cn(
                    'pointer-events-none absolute -right-[1px] top-[1.35rem] bottom-0 w-0.5 opacity-35',
                    guide.elbow
                  )}
                  aria-hidden
                />
              ) : null}
              <TreeBranch
                node={child}
                depth={depth + 1}
                expandedIds={expandedIds}
                toggleId={toggleId}
                searchQuery={searchQuery}
                isLastSibling={idx === node.children!.length - 1}
                rootDigit={branchRoot}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onLedger={onLedger}
                trail={nextTrail}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type CoaNatureFilter = 'all' | 'asset' | 'liability' | 'revenue' | 'expense';

const NATURE_ROOT: Record<Exclude<CoaNatureFilter, 'all'>, string> = {
  asset: '1',
  liability: '2',
  revenue: '4',
  expense: '5',
};

export function AccountTree({
  nodes,
  search,
  natureFilter = 'all',
  expandAllToken,
  collapseAllToken,
  revealAccountId,
  onAddChild,
  onEdit,
  onDelete,
  onLedger,
}: {
  nodes: CoaHierarchyAccount[];
  search: string;
  natureFilter?: CoaNatureFilter;
  expandAllToken?: number;
  collapseAllToken?: number;
  revealAccountId?: string | null;
  onAddChild: (n: CoaHierarchyAccount) => void;
  onEdit: (n: CoaHierarchyAccount) => void;
  onDelete: (n: CoaHierarchyAccount) => void;
  onLedger: (n: CoaHierarchyAccount) => void;
}) {
  const q = search.trim().toLowerCase();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const lastExpandToken = useRef(0);
  const lastCollapseToken = useRef(0);
  const lastRevealId = useRef<string | null>(null);
  const prevSearch = useRef(q);
  const filteredRef = useRef<CoaHierarchyAccount[]>([]);

  useEffect(() => {
    if (!revealAccountId || revealAccountId === lastRevealId.current) return;
    lastRevealId.current = revealAccountId;
    const ancestors = collectAncestorIds(nodes, revealAccountId);
    if (!ancestors.length) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      for (const id of ancestors) next.add(id);
      return next;
    });
  }, [nodes, revealAccountId]);

  const filtered = useMemo(() => {
    let tree = filterTree(nodes, q);
    if (natureFilter !== 'all') {
      tree = filterByRootNature(tree, NATURE_ROOT[natureFilter]);
    }
    return tree;
  }, [nodes, q, natureFilter]);
  filteredRef.current = filtered;

  useEffect(() => {
    if (q) {
      const ids = new Set<string>();
      collectExpandableIds(filteredRef.current, ids);
      setExpandedIds(ids);
    } else if (prevSearch.current) {
      setExpandedIds(new Set());
    }
    prevSearch.current = q;
  }, [q, nodes]);

  useEffect(() => {
    if (expandAllToken == null || expandAllToken === 0) return;
    if (expandAllToken === lastExpandToken.current) return;
    lastExpandToken.current = expandAllToken;
    const ids = new Set<string>();
    collectExpandableIds(filteredRef.current, ids);
    setExpandedIds(ids);
  }, [expandAllToken]);

  useEffect(() => {
    if (collapseAllToken == null || collapseAllToken === 0) return;
    if (collapseAllToken === lastCollapseToken.current) return;
    lastCollapseToken.current = collapseAllToken;
    setExpandedIds(new Set());
  }, [collapseAllToken]);

  const toggleId = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const searchTrim = search.trim();
  const flatRows = useMemo(
    () => flattenVisibleCoaRows(filtered, expandedIds, searchTrim),
    [filtered, expandedIds, searchTrim]
  );
  const useVirtual = flatRows.length > 30;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 46,
    overscan: 12,
    enabled: useVirtual,
  });

  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">لا توجد حسابات مطابقة</p>;
  }

  if (useVirtual) {
    return (
      <div
        ref={scrollRef}
        className="max-h-[65vh] overflow-y-auto space-y-1 bg-white rounded-xl text-slate-900"
        role="tree"
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const row = flatRows[vRow.index];
            const hasChildren = Boolean(row.node.children?.length);
            const forceOpen = Boolean(searchTrim);
            const expanded = forceOpen || expandedIds.has(row.node.id);
            return (
              <div
                key={row.node.id}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${vRow.start}px)` }}
                role="treeitem"
                aria-selected={false}
                aria-expanded={hasChildren ? expanded : undefined}
              >
                <AccountTreeNode
                  node={row.node}
                  depth={row.depth}
                  expanded={expanded}
                  isLastSibling={row.isLastSibling}
                  rootDigit={row.rootDigit}
                  onToggle={() => toggleId(row.node.id)}
                  searchQuery={searchTrim}
                  onAddChild={onAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onLedger={onLedger}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-h-[65vh] overflow-y-auto space-y-1 bg-white rounded-xl text-slate-900" role="tree">
      {filtered.map((node, idx) => (
        <TreeBranch
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleId={toggleId}
          searchQuery={search.trim()}
          isLastSibling={idx === filtered.length - 1}
          rootDigit=""
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          onLedger={onLedger}
          trail={EMPTY_TRAIL}
        />
      ))}
    </div>
  );
}
