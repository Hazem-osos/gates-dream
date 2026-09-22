'use client';

import { ArrowLeftRight, ChevronDown, ChevronLeft, CornerDownLeft, Eye, FolderTree, Landmark } from 'lucide-react';
import {
  isSystemCashPostingAccount,
  resolveCoaTreeRole,
  type CoaHierarchyAccount,
  type CoaTreeRole,
} from '@/lib/accounting/mapCoaToTreeNodes';
import { depthPaddingClass, getNodeStyling, getRootIconClass } from '@/lib/accounting/coaTreeTheme';
import { cn } from '@/lib/utils';

const ROLE_META: Record<
  CoaTreeRole,
  { label: string; chip: string; mark: string }
> = {
  ROOT: {
    label: 'رئيسي',
    chip: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300',
    mark: 'bg-white/90 ring-1 ring-black/10',
  },
  SUBHEADER: {
    label: 'رئيسي فرعي',
    chip: 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300',
    mark: 'bg-indigo-50 ring-1 ring-indigo-200',
  },
  POSTING: {
    label: 'حركة',
    chip: 'bg-teal-100 text-teal-900 ring-1 ring-teal-300',
    mark: 'bg-teal-50 ring-1 ring-teal-200',
  },
};

function CoaKindMark({ role, iconClass }: { role: CoaTreeRole; iconClass: string }) {
  const meta = ROLE_META[role];
  return (
    <span
      className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0', meta.mark)}
      title={meta.label}
      aria-label={meta.label}
    >
      {role === 'ROOT' ? (
        <Landmark className={cn('h-4 w-4', iconClass)} />
      ) : role === 'SUBHEADER' ? (
        <FolderTree className="h-4 w-4 text-indigo-600" />
      ) : (
        <ArrowLeftRight className="h-4 w-4 text-teal-700" />
      )}
    </span>
  );
}

export function CoaKindLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-[11px] text-slate-600', className)} aria-label="مفتاح أنواع الحساب">
      <span className="inline-flex items-center gap-1.5">
        <CoaKindMark role="ROOT" iconClass="text-sky-700" />
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', ROLE_META.ROOT.chip)}>رئيسي</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CoaKindMark role="SUBHEADER" iconClass="text-indigo-600" />
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', ROLE_META.SUBHEADER.chip)}>رئيسي فرعي</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CoaKindMark role="POSTING" iconClass="text-teal-700" />
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', ROLE_META.POSTING.chip)}>حساب حركة</span>
      </span>
    </div>
  );
}

function displayName(a: CoaHierarchyAccount) {
  return a.nameAr ?? a.arabicName;
}

function formatBalance(value: number | undefined) {
  const n = value ?? 0;
  return (
    new Intl.NumberFormat('ar-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + ' ج.م'
  );
}

function highlightText(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-200/80 text-slate-900 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function AccountTreeNode({
  node,
  depth,
  expanded,
  isLastSibling,
  rootDigit: _rootDigit,
  onToggle,
  searchQuery,
  onAddChild,
  onView,
  onEdit,
  onDelete,
  onLedger,
}: {
  node: CoaHierarchyAccount;
  depth: number;
  expanded: boolean;
  isLastSibling?: boolean;
  rootDigit: string;
  onToggle: () => void;
  searchQuery: string;
  onAddChild: (n: CoaHierarchyAccount) => void;
  onView?: (n: CoaHierarchyAccount) => void;
  onEdit: (n: CoaHierarchyAccount) => void;
  onDelete: (n: CoaHierarchyAccount) => void;
  onLedger: (n: CoaHierarchyAccount) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const role = resolveCoaTreeRole(node, depth);
  const isFolder = role !== 'POSTING';
  const isPosting = role === 'POSTING';
  const lockBranching = isPosting || isSystemCashPostingAccount(node) || node.isActive === false;
  const roleMeta = ROLE_META[role];
  const childCount = node.children?.length ?? 0;
  const q = searchQuery.trim();
  const code = node.code;
  const nameAr = displayName(node);
  const iconClass = getRootIconClass(code, depth);
  const styling = getNodeStyling(code, depth);
  const isChildRow = depth > 0;

  return (
    <div
      dir="rtl"
      className={cn(
        'relative flex w-full items-center gap-2 py-2.5 px-2 transition-colors group text-slate-900',
        depthPaddingClass(),
        isChildRow ? 'rounded-lg' : 'rounded-lg mb-1',
        isChildRow ? cn('ring-1 ring-inset ring-black/[0.04]', !isLastSibling && 'mb-0.5') : null,
        styling.row
      )}
    >
      <div className="flex flex-1 min-w-0 items-center gap-3 z-[1]">
        {depth > 0 ? (
          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-80" aria-hidden />
        ) : null}

        <button
          type="button"
          className="shrink-0 p-0.5 text-slate-600 rounded hover:bg-slate-100"
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

        <CoaKindMark role={role} iconClass={iconClass} />

        <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 tabular-nums shrink-0 border border-slate-200/80">
          {highlightText(code, q)}
        </span>

        <span className={cn('text-sm truncate min-w-0', styling.text, node.isActive === false && 'line-through opacity-70')}>
          {highlightText(nameAr, q)}
        </span>

        {node.isActive === false ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-rose-100 text-rose-800">
            ملغي
          </span>
        ) : null}

        {hasChildren ? (
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', styling.badge)}>
            {childCount} حسابات فرعية
          </span>
        ) : null}

        {!isFolder && node.nature ? (
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
              node.nature === 'DEBIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-800'
            )}
          >
            {node.nature === 'DEBIT' ? 'مدين' : 'دائن'}
          </span>
        ) : null}

        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', roleMeta.chip)}>
          {roleMeta.label}
        </span>
      </div>

      <span className="text-xs tabular-nums text-slate-700 shrink-0 hidden lg:inline z-[1]">
        {formatBalance(node.currentBalance)}
      </span>

      <div className="flex items-center gap-1 ms-auto pl-2 shrink-0 z-[1]">
        {onView ? (
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
        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1">
        {lockBranching ? null : (
          <button
            type="button"
            title="إضافة حساب فرعي"
            className="text-[11px] px-2 py-1 rounded-md bg-white border border-slate-200 text-[#0E79AA] hover:bg-[#0E79AA]/10 whitespace-nowrap shadow-sm"
            onClick={() => onAddChild(node)}
          >
            + فرعي
          </button>
        )}
        <button type="button" title="تعديل" className="p-1.5 rounded-md hover:bg-slate-100" onClick={() => onEdit(node)}>
          ✏️
        </button>
        <button type="button" title="كشف حساب" className="p-1.5 rounded-md hover:bg-slate-100" onClick={() => onLedger(node)}>
          📊
        </button>
        <button type="button" title="حذف" className="p-1.5 rounded-md hover:bg-red-50" onClick={() => onDelete(node)}>
          🗑️
        </button>
        </div>
      </div>
    </div>
  );
}
