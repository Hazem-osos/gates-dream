import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { StatusTone } from '@/components/ui/StatusBadge';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'fy';

export type DashboardPeriodBounds = {
  startDate: string;
  endDate: string;
  label: string;
};

export type QuickActionItem = {
  href: string;
  label: string;
  hotkey?: string;
  icon?: LucideIcon;
};

export type AttentionItem = {
  id: string;
  title: string;
  detail?: string;
  href: string;
  tone?: StatusTone;
  count?: number;
};

export type PipelineStage = {
  id: string;
  label: string;
  count: number;
  pending?: boolean;
};

export type ActivityColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  numeric?: boolean;
};
