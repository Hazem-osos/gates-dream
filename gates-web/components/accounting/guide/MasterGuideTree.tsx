'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ClipboardList, CornerDownLeft, Eye, FileText, Folder, FolderOpen } from 'lucide-react';
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
  addChildLabel,
  selected,
  selectable,
  onToggle,
  onToggleSelect,
  onAddChild,
  canAddChild,
  onView,
  onStockReport,
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
  addChildLabel?: string;
  selected?: boolean;
  selectable?: boolean;
  onToggle: () => void;
  onToggleSelect?: (n: GuideTreeNode) => void;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onView?: (n: GuideTreeNode) => void;
  onStockReport?: (n: GuideTreeNode) => void;
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
        isChild ? cn(tone.row, 'bg-opacity-80') : tone.row,
        selected && 'ring-2 ring-[#0E79AA]/40'
      )}
    >
      <div className="z-[1] flex min-w-0 flex-1 items-center gap-2.5">
        {selectable && !node.synthetic ? (
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-[#D6EAF3] text-[#0E79AA] focus:ring-[#0E79AA]/30"
            checked={Boolean(selected)}
            aria-label={`اختيار ${node.name}`}
            onChange={() => onToggleSelect?.(node)}
            onClick={(event) => event.stopPropagation()}
          />
        ) : null}
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
            <FolderOpen className={cn('h-4 w-4 shrink-0', tone.icon)} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0', tone.icon)} />
          )
        ) : (
          <FileText className={cn('h-4 w-4 shrink-0', tone.icon)} />
        )}

        <span className="shrink-0 rounded border border-slate-200/80 bg-white/80 px-2 py-1 font-mono text-xs font-bold tabular-nums text-slate-800">
          {highlightText(node.code || '—', q)}
        </span>
        <span className={cn('min-w-0 truncate text-sm', isChild ? cn('font-medium', tone.text) : tone.text)}>
          {highlightText(node.name, q)}
        </span>
        {node.subtitle ? (
          <span className="hidden shrink-0 text-[11px] text-slate-500 sm:inline">{node.subtitle}</span>
        ) : null}
        {hasChildren ? (
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', tone.badge)}>
            {childCount} {childNoun}
          </span>
        ) : null}
      </div>

      <div className="z-[1] ms-auto flex shrink-0 items-center gap-1 pl-2">
        {onView && !node.synthetic ? (
          <button
            type="button"
            title="عرض البيانات"
            aria-label="عرض البيانات"
            className="rounded-md p-1.5 text-[#0E79AA] hover:bg-[#0E79AA]/10"
            onClick={() => onView(node)}
          >
            <Eye className="h-4 w-4" />
          </button>
        ) : null}
        {onAddChild && (canAddChild?.(node) ?? true) ? (
          <button
            type="button"
            title={`إضافة ${addChildLabel ?? childNoun}`}
            className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#0E79AA] shadow-sm hover:bg-[#0E79AA]/10"
            onClick={() => onAddChild(node)}
          >
            + {addChildLabel ?? 'فرعي'}
          </button>
        ) : null}
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onStockReport && !node.synthetic ? (
            <button
              type="button"
              title="جرد مخزن"
              aria-label="جرد مخزن"
              className="rounded-md p-1.5 text-teal-700 hover:bg-teal-50"
              onClick={() => onStockReport(node)}
            >
              <ClipboardList className="h-4 w-4" />
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
    </div>
  );
}

const EMPTY_TRAIL: ReadonlySet<string> = new Set();

function Branch({
  node,
  depth,
  expandedIds,
  toggleId,
  searchQuery,
  childNoun,
  addChildLabel,
  toneIndex,
  isLastSibling,
  selectable,
  selectedIds,
  onToggleSelect,
  onAddChild,
  canAddChild,
  onView,
  onStockReport,
  onEdit,
  onDelete,
  trail,
}: {
  node: GuideTreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleId: (id: string) => void;
  searchQuery: string;
  childNoun: string;
  addChildLabel?: string;
  toneIndex: number;
  isLastSibling?: boolean;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (n: GuideTreeNode) => void;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onView?: (n: GuideTreeNode) => void;
  onStockReport?: (n: GuideTreeNode) => void;
  onEdit?: (n: GuideTreeNode) => void;
  onDelete?: (n: GuideTreeNode) => void;
  trail: ReadonlySet<string>;
}) {
  if (trail.has(node.id)) return null;
  const nextTrail = new Set(trail);
  nextTrail.add(node.id);
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
        addChildLabel={addChildLabel}
        selected={selectedIds?.has(node.id)}
        selectable={selectable}
        onToggle={() => toggleId(node.id)}
        onToggleSelect={onToggleSelect}
        onAddChild={onAddChild}
        canAddChild={canAddChild}
        onView={onView}
        onStockReport={onStockReport}
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
                  addChildLabel={addChildLabel}
                  toneIndex={child.toneIndex ?? toneIndex}
                  isLastSibling={idx === node.children!.length - 1}
                  selectable={selectable}
                  selectedIds={selectedIds}
                  onToggleSelect={onToggleSelect}
                  onAddChild={onAddChild}
                  canAddChild={canAddChild}
                  onView={onView}
                  onStockReport={onStockReport}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  trail={nextTrail}
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
  addChildLabel,
  selectable,
  selectedIds,
  onToggleSelect,
  onAddChild,
  canAddChild,
  onView,
  onStockReport,
  onEdit,
  onDelete,
}: {
  nodes: GuideTreeNode[];
  search: string;
  expandAllToken?: number;
  collapseAllToken?: number;
  childNoun?: string;
  addChildLabel?: string;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (n: GuideTreeNode) => void;
  onAddChild?: (n: GuideTreeNode) => void;
  canAddChild?: (n: GuideTreeNode) => boolean;
  onView?: (n: GuideTreeNode) => void;
  onStockReport?: (n: GuideTreeNode) => void;
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
          addChildLabel={addChildLabel}
          toneIndex={node.toneIndex ?? resolveGuideToneIndex(node.code, idx)}
          isLastSibling={idx === filtered.length - 1}
          selectable={selectable}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
          onAddChild={onAddChild}
          canAddChild={canAddChild}
          onView={onView}
          onStockReport={onStockReport}
          onEdit={onEdit}
          onDelete={onDelete}
          trail={EMPTY_TRAIL}
        />
      ))}
    </div>
  );
}
