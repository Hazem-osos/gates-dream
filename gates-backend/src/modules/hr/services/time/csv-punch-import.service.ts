import { randomUUID } from 'crypto';
import { csvDeviceAdapter, parseCsvPunchRows } from './adapters/csv-device.adapter';
import { punchIngestionService } from './punch-ingestion.service';

export type CsvImportPreviewRow = {
  line: number;
  valid: boolean;
  errors: string[];
  row?: { employeeCode: string; timestamp: string; punchType?: string };
};

export class CsvPunchImportService {
  preview(csvText: string, _timezone: string): CsvImportPreviewRow[] {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    const parsed = parseCsvPunchRows(csvText);
    const out: CsvImportPreviewRow[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      const errors: string[] = [];
      if (!row.employeeCode) errors.push('employeeCode required');
      if (!row.timestamp || Number.isNaN(new Date(row.timestamp).getTime())) {
        errors.push('invalid timestamp');
      }
      out.push({
        line: i + 2,
        valid: errors.length === 0,
        errors,
        row: {
          employeeCode: row.employeeCode,
          timestamp: row.timestamp,
          punchType: row.punchType,
        },
      });
    }
    if (lines.length > 1 && parsed.length === 0) {
      out.push({ line: 2, valid: false, errors: ['no parseable rows'] });
    }
    return out;
  }

  async import(
    companyId: string,
    deviceId: string,
    csvText: string,
    timezone: string
  ) {
    const batchId = randomUUID();
    const preview = this.preview(csvText, timezone);
    const summary = {
      batchId,
      accepted: 0,
      duplicates: 0,
      invalid: 0,
      unmatched: 0,
      errors: [] as string[],
    };

    for (const p of preview) {
      if (!p.valid || !p.row) {
        summary.invalid++;
        summary.errors.push(`line ${p.line}: ${p.errors.join(', ')}`);
        continue;
      }
      const normalized = csvDeviceAdapter.normalizeExternalEvent(
        {
          employeeCode: p.row.employeeCode,
          timestamp: p.row.timestamp,
          punchType: p.row.punchType,
        },
        { timezone }
      );
      const input = csvDeviceAdapter.toIngestInput(normalized, {
        source: 'IMPORT',
        deviceId,
        importBatchId: batchId,
      });
      const result = await punchIngestionService.ingest(companyId, input);
      if (result.duplicate) summary.duplicates++;
      else if (result.unmatched) summary.unmatched++;
      else summary.accepted++;
    }

    return summary;
  }
}

export const csvPunchImportService = new CsvPunchImportService();
