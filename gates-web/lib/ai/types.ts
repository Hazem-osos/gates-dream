export type AiChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type AiConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
};

export type AiPersistedMessage = {
  id: string;
  conversationId?: string;
  role: AiChatRole;
  content: string;
  toolCalls?: unknown;
  createdAt: string;
};

export type AiConversationDetail = AiConversationSummary & {
  messages: AiPersistedMessage[];
};

export type AiChatResult = {
  conversationId: string;
  message: AiPersistedMessage;
  finishReason: string | null;
  model: string;
  toolTurns: number;
  hasFinancialAdvisory?: boolean;
};

export type AiUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
  hasFinancialAdvisory?: boolean;
};

export type AiToolStatus = {
  name: string;
  ok: boolean;
};

export type AiKpiItem = {
  label: string;
  value: string;
  hint?: string;
};

export type AiTableBlock = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type AiActionStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'EXPIRED';

export type AiActionLine = {
  itemId?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  rawItemName?: string;
  needsCreation?: boolean;
  matchConfidence?: number;
};

export type AiActionSummaryDisplay = {
  title: string;
  actionType: string;
  customerName?: string;
  partyName?: string;
  itemsCount?: number;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  netAmount?: number;
  currency?: string;
  lines?: AiActionLine[];
  notes?: string;
  paymentTerms?: string;
  warehouseName?: string;
  isCash?: boolean;
  phone?: string;
  taxNumber?: string;
  creditLimit?: number;
  stockWarnings?: string[];
  ocr?: {
    source?: string;
    invoiceNumber?: string;
    supplierConfidence?: number;
    supplierMatched?: boolean;
    unmatchedCount?: number;
  };
};

export type AiPendingAction = {
  id: string;
  conversationId: string;
  actionType: string;
  requiredPermission: string;
  summaryDisplay: AiActionSummaryDisplay;
  payload?: Record<string, unknown> | null;
  status: AiActionStatus;
  executionError?: string | null;
  resultingEntityId?: string | null;
  expiresAt: string;
  openUrl?: string | null;
  documentNumber?: string | null;
};

export type AiInlineActionCard = {
  actionId?: string;
  actionType: string;
  titleAr: string;
  summary?: {
    partyName?: string;
    warehouseName?: string;
    totalAmount?: number;
    itemsCount?: number;
    subtotal?: number;
    taxAmount?: number;
    netAmount?: number;
    invoiceNumber?: string;
    taxNumber?: string;
    supplierConfidence?: number;
    supplierMatched?: boolean;
  };
  draftPayload?: Record<string, unknown>;
  previewLines?: Array<{
    name: string;
    quantity?: number;
    unitPrice?: number;
    total: number;
    rawItemName?: string;
    needsCreation?: boolean;
    matchConfidence?: number;
  }>;
};

export type AiChartType = 'BAR' | 'LINE' | 'PIE' | 'METRIC_CARDS';

export type AiVisualizationDataKey = {
  key: string;
  nameAr: string;
  color: string;
};

export type AiVisualizationKpi = {
  label: string;
  value: string;
  changePercent?: number;
};

export type AiVisualizationPayload = {
  chartType: AiChartType;
  title: string;
  description?: string;
  data: Array<Record<string, string | number>>;
  dataKeys: AiVisualizationDataKey[];
  summaryKpis?: AiVisualizationKpi[];
};

export type AiContentBlock =
  | { type: 'markdown'; text: string }
  | { type: 'table'; table: AiTableBlock }
  | { type: 'kpis'; items: AiKpiItem[] }
  | { type: 'action'; actionId: string; card?: AiInlineActionCard }
  | { type: 'actionCard'; card: AiInlineActionCard }
  | { type: 'visualization'; payload: AiVisualizationPayload };

export type AiQuickPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export type AiInsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type AiInsightCategory =
  | 'CASH_FLOW_RISK'
  | 'OVERDUE_RECEIVABLES'
  | 'STOCK_RUNOUT'
  | 'PROJECT_MARGIN_DROP'
  | 'EXPENSE_ANOMALY';

export type AiInsight = {
  id: string;
  category: AiInsightCategory;
  severity: AiInsightSeverity;
  title: string;
  summary: string;
  actionLink: string | null;
  createdAt: string;
};
