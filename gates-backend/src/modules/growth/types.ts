export type GrowthCategory =
  | 'REVENUE'
  | 'CASH_RECOVERY'
  | 'INVENTORY'
  | 'SAVINGS'
  | 'PRICING'
  | 'CUSTOMERS'
  | 'COSTS';

export type GrowthPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type RecommendedAction = {
  key: string;
  label: string;
  href?: string;
  kind: 'navigate' | 'record' | 'ai';
};

export type DetectedOpportunity = {
  fingerprint: string;
  type: string;
  category: GrowthCategory;
  title: string;
  description: string;
  whyDetected: string;
  priority: GrowthPriority;
  estimatedValue: number;
  currencyCode: string;
  module?: string;
  entityType?: string;
  entityId?: string;
  confidence: number;
  evidence: Record<string, unknown>;
  recommendedActions: RecommendedAction[];
  metadata?: Record<string, unknown>;
};

export type OpportunityDetectorContext = {
  companyId: string;
  asOf: Date;
};

export interface OpportunityDetector {
  key: string;
  detect(context: OpportunityDetectorContext): Promise<DetectedOpportunity[]>;
}
