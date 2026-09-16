'use client';

import { ChevronDown, ChevronLeft, Folder, FolderOpen, FileText, CornerDownLeft } from 'lucide-react';
import { isSystemCashPostingAccount, type CoaHierarchyAccount } from '@/lib/accounting/mapCoaToTreeNodes';
import { depthPaddingClass, getNodeStyling, getRootIconClass } from '@/lib/accounting/coaTreeTheme';
import { cn } from '@/lib/utils';

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
  onEdit: (n: CoaHierarchyAccount) => void;
  onDelete: (n: CoaHierarchyAccount) => void;
  onLedger: (n: CoaHierarchyAccount) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isFolder = node.accountKind === 'HEADER' || node.type === 'HEADER' || node.isParent || hasChildren;
  const isPosting = !isFolder;
  const lockBranching = isPosting || isSystemCashPostingAccount(node);
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

        {isFolder ? (
          expanded && hasChildren ? (
            <FolderOpen className={cn('h-4 w-4 shrink-0', iconClass)} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0', iconClass)} />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
        )}

        <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 tabular-nums shrink-0 border border-slate-200/80">
          {highlightText(code, q)}
        </span>

        <span className={cn('text-sm truncate min-w-0', styling.text)}>{highlightText(nameAr, q)}</span>

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

        {isFolder ? (
          <span className="text-[11px] text-slate-500 font-medium shrink-0 hidden sm:inline">
            {depth === 0 ? 'رئيسي' : 'رئيسي فرعي'}
          </span>
        ) : (
          <span className="text-[11px] text-slate-500 font-medium shrink-0 hidden sm:inline">حساب حركة</span>
        )}
      </div>

      <span className="text-xs tabular-nums text-slate-700 shrink-0 hidden lg:inline z-[1]">
        {formatBalance(node.currentBalance)}
      </span>

      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 ms-auto pl-2 shrink-0 z-[1]">
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
  );
}
