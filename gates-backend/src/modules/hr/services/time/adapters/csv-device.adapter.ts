import { createHash } from 'crypto';
import type { TimeDeviceAdapter } from './time-device-adapter.types';

export type CsvPunchRow = {
  employeeCode: string;
  timestamp: string;
  punchType?: string;
  deviceCode?: string;
};

export function parseCsvPunchRows(csvText: string): CsvPunchRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const rows: CsvPunchRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const employeeCode = cols[idx('employeecode')] ?? cols[idx('employee_code')] ?? cols[0];
    const timestamp = cols[idx('timestamp')] ?? cols[idx('punchedat')] ?? cols[1];
    if (!employeeCode || !timestamp) continue;
    rows.push({
      employeeCode,
      timestamp,
      punchType: cols[idx('punchtype')] ?? cols[idx('type')],
      deviceCode: cols[idx('devicecode')] ?? cols[idx('device')],
    });
  }
  return rows;
}

export const csvDeviceAdapter: TimeDeviceAdapter = {
  providerType: 'CSV',
  identifySource: () => 'IMPORT',
  normalizeExternalEvent(raw, context) {
    const row = raw as CsvPunchRow;
    return {
      externalEmployeeCode: row.employeeCode,
      punchedAt: new Date(row.timestamp),
      timezone: context.timezone,
      punchType: row.punchType ?? null,
      rawPayload: row,
      externalPunchId: createHash('sha256')
        .update(`${row.employeeCode}|${row.timestamp}|${row.punchType ?? ''}`)
        .digest('hex'),
    };
  },
  buildStableFingerprint({ companyId, deviceId, normalized }) {
    if (!normalized.externalPunchId || !deviceId) return null;
    return createHash('sha256')
      .update(`${companyId}|${deviceId}|${normalized.externalPunchId}`)
      .digest('hex');
  },
  toIngestInput(normalized, meta) {
    return {
      source: meta.source,
      deviceId: meta.deviceId ?? null,
      importBatchId: meta.importBatchId,
      externalEmployeeCode: normalized.externalEmployeeCode,
      externalPunchId: normalized.externalPunchId,
      punchedAt: normalized.punchedAt,
      timezone: normalized.timezone,
      punchType: normalized.punchType,
      rawPayload: normalized.rawPayload,
    };
  },
};
