'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, CornerDownLeft, FileText, Folder, FolderOpen } from 'lucide-react';
import {
  collectExpandableIds,
  filterGuideTree,
  type GuideTreeNode,
} from '@/lib/accounting/buildGuideTree';
import { getSoftGuideTone, resolveGuideToneIndex } from '@/lib/accounting/guideTreeTheme';
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
  isLastSibling,
  toneIndex,
  searchQuery,
  childNoun,
  onToggle,
  onAddChild,
  canAddChild,
  onEdit,
  onDelete,
}: {
  node: GuideTreeNode;
  depth: number;
  expanded: boolean;
  isLastSibling?: boolean;
  toneIndex: number;
  searchQuery: string;
  childNoun: string;
  onToggle: () => void;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isFolder = hasChildren || Boolean(node.folder);
  const childCount = node.children?.length ?? 0;
  const q = searchQuery.trim();
  const tone = getSoftGuideTone(toneIndex);
  const isChild = depth > 0;

  return (
    <div
      dir="rtl"
      className={cn(
        'group relative flex w-full items-center gap-2 px-2 py-2.5 text-slate-900 transition-colors',
        isChild
          ? cn('rounded-lg ring-1 ring-inset ring-black/[0.03]', !isLastSibling && 'mb-0.5')
          : 'mb-1 rounded-lg',
        isChild
          ? depth === 1
            ? 'bg-white/80 hover:bg-slate-50/90'
            : 'bg-white hover:bg-slate-50/80'
          : tone.row
      )}
    >
      <div className="z-[1] flex min-w-0 flex-1 items-center gap-2.5">
        {isChild ? (
          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        ) : null}

        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-slate-600 hover:bg-slate-100"
          aria-label={expanded ? 'طي' : 'توسيع'}
          onClick={() => (hasChildren || isFolder) && onToggle()}
        >
          {hasChildren || (isFolder && node.synthetic) ? (
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
            <FolderOpen className={cn('h-4 w-4 shrink-0', isChild ? 'text-slate-500' : tone.icon)} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0', isChild ? 'text-slate-500' : tone.icon)} />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
        )}

        <span className="shrink-0 rounded border border-slate-200/80 bg-white/80 px-2 py-1 font-mono text-xs font-bold tabular-nums text-slate-800">
          {highlightText(node.code || '—', q)}
        </span>
        <span className={cn('min-w-0 truncate text-sm', isChild ? 'font-medium text-slate-800' : tone.text)}>
          {highlightText(node.name, q)}
        </span>
        {node.subtitle ? (
          <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{node.subtitle}</span>
        ) : null}
        {hasChildren ? (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', isChild ? 'border border-slate-200 bg-slate-50 text-slate-600' : tone.badge)}>
            {childCount} {childNoun}
          </span>
        ) : null}
      </div>

      <div className="z-[1] ms-auto flex shrink-0 items-center gap-1 pl-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onAddChild && (canAddChild?.(node) ?? true) ? (
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
  toneIndex,
  isLastSibling,
  onAddChild,
  canAddChild,
  onEdit,
  onDelete,
}: {
  node: GuideTreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleId: (id: string) => void;
  searchQuery: string;
  childNoun: string;
  toneIndex: number;
  isLastSibling?: boolean;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isFolder = hasChildren || Boolean(node.folder);
  const forceOpen = Boolean(searchQuery.trim());
  const expanded = forceOpen || expandedIds.has(node.id);
  const tone = getSoftGuideTone(toneIndex);

  return (
    <div
      className="relative"
      role="treeitem"
      aria-expanded={isFolder ? expanded : undefined}
    >
      <GuideTreeRow
        node={node}
        depth={depth}
        expanded={expanded}
        isLastSibling={isLastSibling}
        toneIndex={toneIndex}
        searchQuery={searchQuery}
        childNoun={childNoun}
        onToggle={() => toggleId(node.id)}
        onAddChild={onAddChild}
        canAddChild={canAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {expanded && (hasChildren || (isFolder && node.synthetic)) ? (
        <div
          role="group"
          aria-label={`عناصر تحت ${node.name}`}
          className={cn(
            'relative mb-2 mr-7 mt-1 space-y-0 rounded-bl-xl rounded-br-md border-r-[3px] pb-1 pr-3 pt-1',
            tone.border,
            tone.surface
          )}
        >
          {hasChildren ? (
            node.children!.map((child, idx) => (
              <div key={child.id} className="relative">
                <span
                  className={cn(
                    'pointer-events-none absolute -right-3 top-[1.35rem] h-0.5 w-5 rounded-full opacity-80',
                    tone.elbow
                  )}
                  aria-hidden
                />
                {idx < node.children!.length - 1 ? (
                  <span
                    className={cn(
                      'pointer-events-none absolute -right-[1px] top-[1.35rem] bottom-0 w-0.5 opacity-40',
                      tone.elbow
                    )}
                    aria-hidden
                  />
                ) : null}
                <Branch
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggleId={toggleId}
                  searchQuery={searchQuery}
                  childNoun={childNoun}
                  toneIndex={toneIndex}
                  isLastSibling={idx === node.children!.length - 1}
                  onAddChild={onAddChild}
                  canAddChild={canAddChild}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            ))
          ) : (
            <p className="py-2 pr-2 text-xs text-slate-400">لا يوجد عناصر تحت هذا التصنيف بعد</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function firstLevelIds(nodes: GuideTreeNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.children?.length || node.folder).map((node) => node.id));
}

export function MasterGuideTree({
  nodes,
  search,
  expandAllToken,
  collapseAllToken,
  childNoun = 'فرعي',
  onAddChild,
  canAddChild,
  onEdit,
  onDelete,
}: {
  nodes: GuideTreeNode[];
  search: string;
  expandAllToken?: number;
  collapseAllToken?: number;
  childNoun?: string;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
}) {
  const q = search.trim().toLowerCase();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [openedOnce, setOpenedOnce] = useState(false);
  const filtered = useMemo(() => filterGuideTree(nodes, q), [nodes, q]);

  useEffect(() => {
    if (openedOnce || nodes.length === 0) return;
    setExpandedIds(firstLevelIds(nodes));
    setOpenedOnce(true);
  }, [nodes, openedOnce]);

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
      {filtered.map((node, idx) => (
        <Branch
          key={node.id}
          node={node}
          depth={0}
          expandedIds={expandedIds}
          toggleId={toggleId}
          searchQuery={search.trim()}
          childNoun={childNoun}
          toneIndex={resolveGuideToneIndex(node.code, idx)}
          isLastSibling={idx === filtered.length - 1}
          onAddChild={onAddChild}
          canAddChild={canAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
