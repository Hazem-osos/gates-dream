export type MigrationProgressSnapshot = {
  jobId: string;
  status: string;
  currentStage: string | null;
  dryRun: boolean;
  overallPercent: number;
  engineImplementationPercent: number;
  milestones: {
    id: string;
    label: string;
    weight: number;
    implemented: boolean;
    tested: boolean;
    productionReady: boolean;
    evidence: string;
  }[];
  modules: {
    stage: string;
    label: string;
    processed: number;
    success: number;
    warnings: number;
    errors: number;
    status: string;
  }[];
  openBlockers: number;
  issueCounts: { blocker: number; warning: number; info: number };
  startedAt: string | null;
  completedAt: string | null;
  elapsedMs: number | null;
  etaMs: number | null;
  ui: Record<string, unknown> | null;
  updatedAt: string;
};

export type MigrationCapabilities = {
  engineEnabled: boolean;
  targetSafe: boolean;
  message?: string;
  legacyForensicConfigured?: boolean;
  /** REMOTE_SQL_SERVER wizard row status for this company (DRAFT until test passes). */
  legacyRemoteSqlStatus?: string | null;
  packagesDir?: string | null;
  bakRestoreAutoReady?: boolean;
  supportedSourceModes: string[];
  restoreSupportedExtensions?: string[];
  storageOnlyExtensions?: string[];
  supportedLegacyEngine: string;
  engineImplementationPercent: number;
  blockedModules: string[];
  milestones: MigrationProgressSnapshot['milestones'];
};

export type MigrationLifecycleState = {
  phase: string;
  reconciliationPass?: boolean;
  activatedAt?: string;
};

export type MigrationJobRow = {
  id: string;
  legacyCompanyCode: string;
  status: string;
  currentStage: string | null;
  dryRun: boolean;
  sourceType: string;
  createdAt: string;
};

export type MigrationPackageRow = {
  id: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
  expiresAt: string;
};
