'use client';

import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Archive,
  Repeat,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const toneStyles: Record<
  StatusTone,
  { wrap: string; Icon: LucideIcon }
> = {
  success: {
    wrap: 'bg-[var(--success-soft)] text-success border-success/20',
    Icon: CheckCircle2,
  },
  warning: {
    wrap: 'bg-[var(--warning-soft)] text-warning border-warning/20',
    Icon: Clock,
  },
  danger: {
    wrap: 'bg-[var(--danger-soft)] text-danger border-danger/20',
    Icon: XCircle,
  },
  info: {
    wrap: 'bg-[var(--info-soft)] text-info border-info/20',
    Icon: AlertCircle,
  },
  purple: {
    wrap: 'bg-[var(--info-soft)] text-info border-info/20',
    Icon: Repeat,
  },
  neutral: {
    wrap: 'bg-surface-2 text-foreground-muted border-border',
    Icon: Archive,
  },
};

export type PostingStatus = 'posted' | 'draft' | 'pending' | 'void' | 'active' | 'inactive';

export function postingStatusToTone(status: PostingStatus): StatusTone {
  switch (status) {
    case 'posted':
    case 'active':
      return 'success';
    case 'draft':
    case 'pending':
      return 'warning';
    case 'void':
    case 'inactive':
      return 'danger';
    default:
      return 'neutral';
  }
}

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  /** Alias for `tone` (design-system docs). */
  variant?: StatusTone;
  icon?: LucideIcon;
  compact?: boolean;
  className?: string;
}

export function StatusBadge({
  label,
  tone = 'neutral',
  variant,
  icon,
  compact,
  className,
}: StatusBadgeProps) {
  const resolvedTone = variant ?? tone;
  const { wrap, Icon: DefaultIcon } = toneStyles[resolvedTone];
  const IconComp = icon ?? DefaultIcon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border font-medium rounded-lg',
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        wrap,
        className
      )}
    >
      <IconComp className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      {label}
    </span>
  );
}

/** Shorthand for granted/denied permission chips */
export function PermissionBadge({
  granted,
  label,
  className,
}: {
  granted: boolean;
  label: string;
  className?: string;
}) {
  return (
    <StatusBadge
      label={label}
      tone={granted ? 'success' : 'danger'}
      icon={granted ? Check : Ban}
      compact
      className={className}
    />
  );
}
