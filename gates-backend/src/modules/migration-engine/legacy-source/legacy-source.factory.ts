import type { PrismaClient } from '@prisma/client';
import type { MigrationJob } from '@prisma/client';
import { LegacyGatesSqlServerAdapter } from '../adapters/legacy-gates-sqlserver.adapter';
import { ConnectorProxyLegacyAdapter } from '../adapters/connector-proxy.adapter';
import type { LegacySourceAdapter, LegacySourceMode } from '../types';
import { normalizeLegacySourceMode } from '../types';
import { LegacySourceConfigService } from './legacy-source-config.service';

function readJobSourceMode(job: MigrationJob): LegacySourceMode {
  if (job.sourceMode) return normalizeLegacySourceMode(job.sourceMode);
  const progress =
    job.progress && typeof job.progress === 'object' && !Array.isArray(job.progress)
      ? (job.progress as Record<string, unknown>)
      : {};
  const ui = (progress.ui as Record<string, unknown> | undefined) ?? {};
  return normalizeLegacySourceMode(ui.sourceMode as string | undefined);
}

/**
 * Resolves the legacy source adapter for a migration job (API + workers).
 * Tenant configs take precedence; env fallback is opt-in and job-scoped.
 */
export async function resolveLegacySourceAdapterForJob(
  prisma: PrismaClient,
  job: MigrationJob
): Promise<LegacySourceAdapter> {
  const mode = readJobSourceMode(job);
  const configSvc = new LegacySourceConfigService(prisma);

  if (mode === 'ON_PREMISE_CONNECTOR') {
    const deviceId = await configSvc.getConnectorDeviceId(job.targetCompanyId);
    if (!deviceId) {
      throw new Error('On-premise connector is not paired for this company.');
    }
    return new ConnectorProxyLegacyAdapter(prisma, job.targetCompanyId, job.id, deviceId);
  }

  const configMode: LegacySourceMode =
    mode === 'BACKUP_RESTORE' ? 'BACKUP_RESTORE' : 'REMOTE_SQL_SERVER';
  const connectionString = await configSvc.resolveConnectionString(job.targetCompanyId, configMode);
  if (connectionString) {
    return new LegacyGatesSqlServerAdapter(connectionString, configMode);
  }

  if (mode === 'BACKUP_RESTORE') {
    throw new Error(
      'Isolated SQL Server host not configured. Automated .bak restore is disabled on this server.'
    );
  }

  if (job.legacySourceConfigId) {
    throw new Error(`Legacy source config ${job.legacySourceConfigId} is not READY.`);
  }

  const allowEnv =
    job.legacyConnectionRef === 'LEGACY_FORENSIC_URL' &&
    (process.env.MIGRATION_LEGACY_ENV_FALLBACK === 'true' ||
      process.env.NODE_ENV !== 'production');
  if (allowEnv) {
    const url =
      process.env.LEGACY_FORENSIC_URL ??
      process.env.LEGACY_MSSQL_URL ??
      process.env.LEGACY_MSSQL_CONNECTION_STRING;
    if (url?.trim()) {
      return new LegacyGatesSqlServerAdapter(url.trim(), 'REMOTE_SQL_SERVER');
    }
  }

  throw new Error(
    'No legacy SQL source configured for this company. Configure remote SQL, connector, or complete backup restore.'
  );
}
