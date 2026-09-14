'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Folder, FolderOpen, FileText } from 'lucide-react';
import {
  collectExpandableIds,
  filterGuideTree,
  type GuideTreeNode,
} from '@/lib/accounting/buildGuideTree';
import { depthLevelLabel, getNodeStyling, getRootIconClass } from '@/lib/accounting/coaTreeTheme';
import { cn } from '@/lib/utils';

function highlightText(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/80 px-0.5 text-slate-900">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function GuideTreeRow({
  node,
  depth,
  expanded,
  searchQuery,
  childNoun,
  onToggle,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: GuideTreeNode;
  depth: number;
  expanded: boolean;
  searchQuery: string;
  childNoun: string;
  onToggle: () => void;
  onAddChild?: (n: GuideTreeNode) => void;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isFolder = hasChildren || Boolean(node.folder);
  const childCount = node.children?.length ?? 0;
  const q = searchQuery.trim();
  const styling = getNodeStyling(node.code || '0', depth);
  const iconClass = getRootIconClass(node.code || '0', depth);
  const levelLabel = depthLevelLabel(depth);

  return (
    <div
      dir="rtl"
      className={cn(
        'group relative flex w-full items-center gap-2 px-2 py-2.5 text-slate-900 transition-colors',
        depth > 0 ? 'rounded-lg pr-4' : 'mb-1 rounded-lg',
        styling.row
      )}
    >
      <div className="z-[1] flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-600 hover:bg-slate-100"
          aria-label={expanded ? 'طي' : 'توسيع'}
          onClick={() => hasChildren && onToggle()}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )
          ) : (
            <span className="inline-block w-4" aria-hidden />
          )}
        </button>

        {isFolder ? (
          expanded && hasChildren ? (
            <FolderOpen className={cn('h-4 w-4 shrink-0', iconClass)} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0', iconClass)} />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
        )}

        {levelLabel ? (
          <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
            {levelLabel}
          </span>
        ) : null}

        <span className="shrink-0 rounded border border-slate-200/80 bg-slate-100 px-2 py-1 font-mono text-xs font-bold tabular-nums text-slate-800">
          {highlightText(node.code || '—', q)}
        </span>
        <span className={cn('min-w-0 truncate text-sm', styling.text)}>{highlightText(node.name, q)}</span>
        {node.subtitle ? <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{node.subtitle}</span> : null}
        {hasChildren ? (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', styling.badge)}>
            {childCount} {childNoun}
          </span>
        ) : null}
      </div>

      <div className="z-[1] ms-auto flex shrink-0 items-center gap-1 pl-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onAddChild ? (
          <button
            type="button"
            title={`إضافة ${childNoun}`}
            className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[#0E79AA] shadow-sm hover:bg-[#0E79AA]/10"
            onClick={() => onAddChild(node)}
          >
            + فرعي
          </button>
        ) : null}
        {onEdit && !node.synthetic ? (
          <button type="button" title="تعديل" className="rounded-md p-1.5 hover:bg-slate-100" onClick={() => onEdit(node)}>
            ✏️
          </button>
        ) : null}
        {onDelete && !node.synthetic ? (
          <button type="button" title="حذف" className="rounded-md p-1.5 hover:bg-red-50" onClick={() => onDelete(node)}>
            🗑️
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Branch({
  node,
  depth,
  expandedIds,
  toggleId,
  searchQuery,
  childNoun,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: GuideTreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleId: (id: string) => void;
  searchQuery: string;
  childNoun: string;
  onAddChild?: (n: GuideTreeNode) => void;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const forceOpen = Boolean(searchQuery.trim());
  const expanded = forceOpen || expandedIds.has(node.id);

  return (
    <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <GuideTreeRow
        node={node}
        depth={depth}
        expanded={expanded}
        searchQuery={searchQuery}
        childNoun={childNoun}
        onToggle={() => toggleId(node.id)}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {hasChildren && expanded ? (
        <div role="group" className="mb-2 mr-7 space-y-0 rounded-bl-xl border-r-[3px] border-slate-200 bg-slate-50/40 pr-3 pt-1">
          {node.children!.map((child) => (
            <Branch
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleId={toggleId}
              searchQuery={searchQuery}
              childNoun={childNoun}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MasterGuideTree({
  nodes,
  search,
  expandAllToken,
  collapseAllToken,
  childNoun = 'فرعي',
  onAddChild,
  onEdit,
  onDelete,
}: {
  nodes: GuideTreeNode[];
  search: string;
  expandAllToken?: number;
  collapseAllToken?: number;
  childNoun?: string;
  onAddChild?: (n: GuideTreeNode) => void;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const q = search.trim().toLowerCase();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const filtered = useMemo(() => filterGuideTree(nodes, q), [nodes, q]);

  useEffect(() => {
    if (!q) return;
    const ids = new Set<string>();
    collectExpandableIds(filtered, ids);
    setExpandedIds(ids);
  }, [q, filtered]);

  useEffect(() => {
    if (!expandAllToken) return;
    const ids = new Set<string>();
    collectExpandableIds(filtered, ids);
    setExpandedIds(ids);
  }, [expandAllToken, filtered]);

  useEffect(() => {
    if (!collapseAllToken) return;
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

  if (filtered.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة</p>;
  }

  return (
    <div className="max-h-[65vh] space-y-1 overflow-y-auto rounded-xl bg-white text-slate-900" role="tree">
      {filtered.map((node) => (
        <Branch
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleId={toggleId}
          searchQuery={search.trim()}
          childNoun={childNoun}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
