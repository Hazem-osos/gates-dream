'use client';

import { useMemo } from 'react';
import { LayoutGrid, List, Network } from 'lucide-react';
import { filterGuideTree, type GuideTreeNode } from '@/lib/accounting/buildGuideTree';

export type ItemsGuideShape = 'tree' | 'cards' | 'list';

const SHAPES: { id: ItemsGuideShape; label: string; icon: typeof Network }[] = [
  { id: 'tree', label: 'شجرة', icon: Network },
  { id: 'cards', label: 'بطاقات', icon: LayoutGrid },
  { id: 'list', label: 'قائمة', icon: List },
];

const ITEM_TYPE_LABELS: Record<string, string> = {
  normal: 'عادي',
  'pack-sheet': 'بالشيت',
  'pack-kilo': 'بالكيلو',
  roll: 'رول',
};

export type GuideItemDetail = {
  barcode?: string | null;
  itemType?: string | null;
};

export function ItemsGuideShapeSwitch({
  value,
  onChange,
}: {
  value: ItemsGuideShape;
  onChange: (next: ItemsGuideShape) => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="شكل الدليل">
      {SHAPES.map((shape) => {
        const active = value === shape.id;
        const Icon = shape.icon;
        return (
          <button
            key={shape.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(shape.id)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
              active ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {shape.label}
          </button>
        );
      })}
    </div>
  );
}

function countItems(node: GuideTreeNode): number {
  if (node.groupKey === 'item') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countItems(child), 0);
}

function typeLabel(detail?: GuideItemDetail) {
  const raw = detail?.itemType?.trim();
  if (!raw) return '';
  return ITEM_TYPE_LABELS[raw] ?? raw;
}

function isFolderNode(node: GuideTreeNode): boolean {
  return Boolean(node.folder || node.groupKey !== 'item');
}

function ItemCardButton({
  item,
  detail,
  onOpen,
}: {
  item: GuideTreeNode;
  detail?: GuideItemDetail;
  onOpen: (node: GuideTreeNode) => void;
}) {
  const barcode = detail?.barcode?.trim();
  const archived = item.subtitle?.includes('غير نشط') || item.subtitle?.includes('مؤرشف');
  const kind = typeLabel(detail);
  return (
    <button
      type="button"
      title={[item.code, item.name, barcode, kind].filter(Boolean).join(' — ')}
      onClick={() => onOpen(item)}
      className={`min-w-0 rounded-lg border px-2.5 py-2 text-right shadow-sm transition-colors hover:border-brand hover:shadow ${
        archived ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-[#D6EAF3] bg-white text-slate-900'
      }`}
    >
      <span className="block truncate text-[11px] font-semibold leading-4 text-brand">{item.code || '—'}</span>
      <span className="block truncate text-xs font-medium leading-4">{item.name}</span>
      {barcode ? <span className="mt-0.5 block truncate text-[10px] text-slate-500">{barcode}</span> : null}
    </button>
  );
}

function GuideGroupCard({
  folder,
  depth,
  details,
  onOpen,
}: {
  folder: GuideTreeNode;
  depth: number;
  details: Map<string, GuideItemDetail>;
  onOpen: (node: GuideTreeNode) => void;
}) {
  const children = folder.children ?? [];
  const childGroups = children.filter(isFolderNode);
  const directItems = children.filter((node) => node.groupKey === 'item');
  const total = countItems(folder);
  const isSub = depth > 0;

  return (
    <section
      className={`overflow-hidden rounded-xl border bg-white ${
        isSub ? 'border-slate-200 shadow-sm' : 'border-slate-200/90 shadow-sm'
      }`}
      style={{ marginInlineStart: isSub ? Math.min(depth * 14, 56) : 0 }}
    >
      <header
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 ${
          isSub ? 'border-slate-100 bg-slate-50/90' : 'border-brand/15 bg-gradient-to-l from-[#E8F4FA]/80 to-white'
        }`}
      >
        <div className="min-w-0 flex-1 text-right">
          {folder.synthetic ? (
            <h3 className="text-sm font-semibold text-slate-800">{folder.name}</h3>
          ) : (
            <button
              type="button"
              className="text-sm font-semibold text-slate-800 hover:text-brand"
              onClick={() => onOpen(folder)}
            >
              {folder.code ? (
                <span className="text-brand">{folder.code}</span>
              ) : null}
              {folder.code ? ' — ' : ''}
              {folder.name}
            </button>
          )}
          {folder.subtitle && !folder.synthetic ? (
            <p className="text-[11px] text-slate-500">{folder.subtitle}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
          {total} صنف
          {childGroups.length > 0 ? ` · ${childGroups.length} مجموعة` : ''}
        </span>
      </header>

      <div className="space-y-3 p-3">
        {childGroups.map((sub) => (
          <GuideGroupCard key={sub.id} folder={sub} depth={depth + 1} details={details} onOpen={onOpen} />
        ))}

        {directItems.length > 0 ? (
          <div>
            {childGroups.length > 0 ? (
              <p className="mb-1.5 text-[11px] font-medium text-slate-500">أصناف مباشرة تحت هذه المجموعة</p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {directItems.map((item) => (
                <ItemCardButton
                  key={item.id}
                  item={item}
                  detail={details.get(item.id)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          </div>
        ) : null}

        {childGroups.length === 0 && directItems.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">لا توجد أصناف في هذه المجموعة</p>
        ) : null}
      </div>
    </section>
  );
}

function GuideCards({
  nodes,
  details,
  onOpen,
}: {
  nodes: GuideTreeNode[];
  details: Map<string, GuideItemDetail>;
  onOpen: (node: GuideTreeNode) => void;
}) {
  const folders = nodes.filter(isFolderNode);
  const rootItems = nodes.filter((node) => node.groupKey === 'item');

  return (
    <div className="space-y-4">
      {folders.map((folder) => (
        <GuideGroupCard key={folder.id} folder={folder} depth={0} details={details} onOpen={onOpen} />
      ))}
      {rootItems.length > 0 ? (
        <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">أصناف بدون مجموعة</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rootItems.map((item) => (
              <ItemCardButton key={item.id} item={item} detail={details.get(item.id)} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GuideList({
  nodes,
  depth,
  details,
  onOpen,
}: {
  nodes: GuideTreeNode[];
  depth: number;
  details: Map<string, GuideItemDetail>;
  onOpen: (node: GuideTreeNode) => void;
}) {
  return (
    <div>
      {nodes.map((node) => {
        if (node.groupKey === 'item') {
          const detail = details.get(node.id);
          const barcode = detail?.barcode?.trim() || '—';
          const kind = typeLabel(detail) || '—';
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onOpen(node)}
              className="grid w-full grid-cols-[6.5rem_minmax(0,1fr)_8rem_5.5rem] items-center gap-2 border-b border-slate-100 px-3 py-2 text-right text-sm hover:bg-slate-50"
            >
              <span className="font-semibold text-brand">{node.code || '—'}</span>
              <span className="truncate text-slate-900" style={{ paddingInlineStart: depth * 16 }}>
                {node.name}
              </span>
              <span className="truncate text-xs text-slate-500">{barcode}</span>
              <span className="text-xs text-slate-500">{kind}</span>
            </button>
          );
        }
        const total = countItems(node);
        return (
          <div key={node.id}>
            <div
              className="flex items-center justify-between gap-3 border-b border-slate-100 bg-brand/5 px-3 py-2"
              style={{ paddingInlineStart: `${12 + depth * 16}px` }}
            >
              {node.synthetic ? (
                <span className="text-sm font-semibold text-slate-800">{node.name}</span>
              ) : (
                <button type="button" className="text-sm font-semibold text-slate-800 hover:text-brand" onClick={() => onOpen(node)}>
                  {node.code ? `${node.code} — ` : ''}
                  {node.name}
                </button>
              )}
              <span className="text-xs text-slate-500">{total} صنف</span>
            </div>
            <GuideList nodes={node.children ?? []} depth={depth + 1} details={details} onOpen={onOpen} />
          </div>
        );
      })}
    </div>
  );
}

export function ItemsGuideShapeView({
  shape,
  nodes,
  search,
  details,
  onOpen,
}: {
  shape: Exclude<ItemsGuideShape, 'tree'>;
  nodes: GuideTreeNode[];
  search: string;
  details: Map<string, GuideItemDetail>;
  onOpen: (node: GuideTreeNode) => void;
}) {
  const filtered = useMemo(() => filterGuideTree(nodes, search.trim().toLowerCase()), [nodes, search]);
  if (filtered.length === 0) {
    return <p className="text-sm text-slate-500">لا توجد نتائج مطابقة للبحث.</p>;
  }
  if (shape === 'list') {
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <div className="min-w-[36rem]">
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_8rem_5.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
          <span>الكود</span>
          <span>الاسم</span>
          <span>الباركود</span>
          <span>النوع</span>
        </div>
        <GuideList nodes={filtered} depth={0} details={details} onOpen={onOpen} />
        </div>
      </div>
    );
  }
  return <GuideCards nodes={filtered} details={details} onOpen={onOpen} />;
}
