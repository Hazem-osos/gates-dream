export type VisualizationChartType = 'BAR' | 'LINE' | 'PIE' | 'METRIC_CARDS';

export type VisualizationDataKey = {
  key: string;
  nameAr: string;
  color: string;
};

export type VisualizationKpi = {
  label: string;
  value: string;
  changePercent?: number;
};

export type VisualizationPayload = {
  chartType: VisualizationChartType;
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  dataKeys: VisualizationDataKey[];
  summaryKpis?: VisualizationKpi[];
};

export const VISUALIZATION_CHART_TYPES = ['BAR', 'LINE', 'PIE', 'METRIC_CARDS'] as const;
