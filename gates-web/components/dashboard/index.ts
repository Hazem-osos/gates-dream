export { ModuleDashboardLayout } from './ModuleDashboardLayout';
export { KpiMetricCard, KpiMetricGrid } from './KpiMetricCard';
export { DashboardPanel } from './DashboardPanel';
export { QuickActionBar } from './QuickActionBar';
export { AttentionQueueCard } from './AttentionQueueCard';
export { WorkflowPipelineTracker } from './WorkflowPipelineTracker';
export { CompactActivityTable } from './CompactActivityTable';
export { PeriodSegmentedControl } from './PeriodSegmentedControl';
export { DASHBOARD_PAGE_CLASS, DASHBOARD_CONTENT_CLASS, DASHBOARD_CARD_CLASS } from './chrome';
export { DASHBOARD_PERIODS, periodBounds, toFiniteNumber, inPeriod, relativeUpdatedLabel } from './period';
export type {
  DashboardPeriod,
  DashboardPeriodBounds,
  QuickActionItem,
  AttentionItem,
  PipelineStage,
  ActivityColumn,
} from './types';
