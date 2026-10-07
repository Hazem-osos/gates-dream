import type { IngestPunchInput } from '../punch-ingestion.service';

export type NormalizedDevicePunch = {
  externalPunchId?: string;
  externalEmployeeCode?: string;
  punchedAt: Date;
  timezone: string;
  punchType?: string | null;
  rawPayload?: unknown;
};

export type TimeDeviceAdapter = {
  readonly providerType: string;
  identifySource(): string;
  normalizeExternalEvent(raw: unknown, context: { timezone: string }): NormalizedDevicePunch;
  buildStableFingerprint(parts: {
    companyId: string;
    deviceId?: string | null;
    normalized: NormalizedDevicePunch;
  }): string | null;
  toIngestInput(
    normalized: NormalizedDevicePunch,
    meta: { source: string; deviceId?: string | null; importBatchId?: string }
  ): IngestPunchInput;
};
