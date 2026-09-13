import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { LegacyRow } from './types';

const LOG_PATH = path.resolve(
  process.cwd(),
  '..',
  'docs',
  'migration',
  'migration-errors.log'
);

export async function appendMigrationError(
  phase: string,
  table: string,
  row: LegacyRow,
  error: unknown
) {
  await mkdir(path.dirname(LOG_PATH), { recursive: true });
  const message = error instanceof Error ? error.message : String(error);
  const line = `[${new Date().toISOString()}] phase=${phase} table=${table} error=${message} row=${JSON.stringify(row)}\n`;
  await appendFile(LOG_PATH, line, 'utf8');
}

export function logBatchProgress(
  phase: string,
  table: string,
  batchIndex: number,
  batchTotal: number,
  migrated: number
) {
  console.log(
    `[Batch ${batchIndex}/${batchTotal}] Phase ${phase} ${table}: migrated ${migrated} rows`
  );
}
