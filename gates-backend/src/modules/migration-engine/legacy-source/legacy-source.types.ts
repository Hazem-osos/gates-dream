import type { LegacySourceMode } from '../types';

export const LEGACY_SOURCE_CONFIG_STATUSES = [
  'DRAFT',
  'TESTING',
  'READY',
  'DISABLED',
  'FAILED',
] as const;

export type LegacySourceConfigStatus = (typeof LEGACY_SOURCE_CONFIG_STATUSES)[number];

export type RemoteSqlServerConfigPayload = {
  kind: 'REMOTE_SQL_SERVER';
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  connectTimeoutMs?: number;
};

export type ConnectorConfigPayload = {
  kind: 'ON_PREMISE_CONNECTOR';
  deviceId: string;
};

export type BackupRestoreConfigPayload = {
  kind: 'BACKUP_RESTORE';
  restoreRunId: string;
  packageId: string;
  /** Populated after restore — connection to isolated SQL */
  remote?: Omit<RemoteSqlServerConfigPayload, 'kind'>;
};

export type LegacySourceConfigPayload =
  | RemoteSqlServerConfigPayload
  | ConnectorConfigPayload
  | BackupRestoreConfigPayload;

export type LegacySourceConfigPublic = {
  id: string;
  companyId: string;
  mode: LegacySourceMode;
  status: LegacySourceConfigStatus;
  fingerprint: string | null;
  databaseName: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  /** Non-secret connection hints for UI */
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  deviceId?: string;
  restoreRunId?: string;
  packageId?: string;
};

export function buildMssqlConnectionString(cfg: RemoteSqlServerConfigPayload): string {
  const parts = [
    `Server=${cfg.host},${cfg.port}`,
    `Database=${cfg.database}`,
    `User Id=${cfg.user}`,
    `Password=${cfg.password}`,
    `Encrypt=${cfg.encrypt ? 'true' : 'false'}`,
    `TrustServerCertificate=${cfg.trustServerCertificate ? 'true' : 'false'}`,
  ];
  if (cfg.connectTimeoutMs) {
    parts.push(`Connection Timeout=${Math.ceil(cfg.connectTimeoutMs / 1000)}`);
  }
  return parts.join(';');
}
