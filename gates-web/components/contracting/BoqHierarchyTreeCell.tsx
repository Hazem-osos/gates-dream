'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { boqHeaderRoleLabel } from '@/lib/contracting/boq-hierarchy';
import { cn } from '@/lib/utils';

type BoqHierarchyTreeCellProps = {
  code: ReactNode;
  depth: number;
  isParent: boolean;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand?: () => void;
  className?: string;
};

export function BoqHierarchyTreeCell({
  code,
  depth,
  isParent,
  hasChildren,
  expanded,
  onToggleExpand,
  className,
}: BoqHierarchyTreeCellProps) {
  const role = boqHeaderRoleLabel(isParent, depth);
  const pad = 8 + depth * 14;

  return (
    <div className={cn('flex min-w-0 items-center gap-1', className)} style={{ paddingInlineStart: pad }}>
      {hasChildren ? (
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-[#0E78AA] hover:bg-slate-100"
          aria-label={expanded ? 'طي' : 'توسيع'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand?.();
          }}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate font-mono">{code}</span>
      {role ? (
        <span className="mr-1 shrink-0 rounded bg-[#0E78AA]/10 px-1.5 py-0.5 text-[10px] font-normal text-[#0E78AA]">
          {role}
        </span>
      ) : null}
    </div>
  );
}
