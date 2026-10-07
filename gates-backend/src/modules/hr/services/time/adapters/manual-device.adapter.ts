import type { TimeDeviceAdapter } from './time-device-adapter.types';

export const manualDeviceAdapter: TimeDeviceAdapter = {
  providerType: 'MANUAL',
  identifySource: () => 'MANUAL',
  normalizeExternalEvent(raw, context) {
    const row = raw as Record<string, unknown>;
    return {
      externalPunchId: row.externalPunchId as string | undefined,
      externalEmployeeCode: row.externalEmployeeCode as string | undefined,
      punchedAt: new Date(String(row.punchedAt)),
      timezone: (row.timezone as string) ?? context.timezone,
      punchType: (row.punchType as string) ?? null,
      rawPayload: raw,
    };
  },
  buildStableFingerprint: () => null,
  toIngestInput(normalized, meta) {
    return {
      source: meta.source,
      deviceId: meta.deviceId ?? null,
      importBatchId: meta.importBatchId,
      ...normalized,
    };
  },
};
