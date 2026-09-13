export type MigrationPhase = 'A' | 'B' | 'C' | 'D' | 'ALL';

export type LegacyRow = Record<string, unknown>;

export interface MigrationCliOptions {
  dryRun: boolean;
  phase: MigrationPhase;
  companyCode?: string;
  limit?: number;
  batchSize: number;
  dataPath: string;
  mssqlUrl?: string;
}

export interface MigrationStats {
  table: string;
  read: number;
  upserted: number;
  skipped: number;
  failed: number;
}

export interface MigrationContext {
  prisma: import('@prisma/client').PrismaClient;
  extractor: import('./LegacyDataExtractor.js').LegacyDataExtractor;
  cache: import('./legacy-id-cache.js').LegacyIdCache;
  options: MigrationCliOptions;
  logError: (phase: string, table: string, row: LegacyRow, error: unknown) => void;
  stats: MigrationStats[];
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'sample'
);

export function parseMigrationArgs(argv: string[]): MigrationCliOptions {
  let dryRun = false;
  let phase: MigrationPhase = 'ALL';
  let companyCode: string | undefined;
  let limit: number | undefined;
  let batchSize = 500;
  let dataPath = process.env.LEGACY_DATA_PATH ?? DEFAULT_DATA_PATH;

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--phase=')) {
      const v = arg.split('=')[1]?.toUpperCase() as MigrationPhase;
      if (['A', 'B', 'C', 'D', 'ALL'].includes(v)) phase = v;
    } else if (arg.startsWith('--company=')) companyCode = arg.split('=')[1]?.trim();
    else if (arg.startsWith('--limit=')) limit = parseInt(arg.split('=')[1] ?? '', 10);
    else if (arg.startsWith('--batch-size=')) {
      batchSize = parseInt(arg.split('=')[1] ?? '', 10) || 500;
    } else if (arg.startsWith('--data-path=')) {
      dataPath = arg.split('=')[1] ?? dataPath;
    }
  }

  const mssqlUrl = process.env.LEGACY_MSSQL_URL ?? process.env.LEGACY_MSSQL_CONNECTION_STRING;

  return {
    dryRun,
    phase,
    companyCode,
    limit,
    batchSize,
    dataPath,
    mssqlUrl,
  };
}
