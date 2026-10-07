import { createHash } from 'crypto';
import prisma from '../../../../shared/database/prisma';
import { hcmEmploymentEpisodeService } from '../hcm/hcm-employment-episode.service';
import { Prisma } from '@prisma/client';
import { attendanceCalculationService } from './attendance-calculation.service';
import { resolveLogicalWorkDateForPunch } from './logical-work-date.service';
import { localDateKey } from './time-zone.util';

export type IngestPunchInput = {
  source: string;
  punchedAt: Date;
  timezone: string;
  punchType?: string | null;
  deviceId?: string | null;
  externalEmployeeCode?: string | null;
  employeeId?: string | null;
  externalPunchId?: string | null;
  importBatchId?: string | null;
  rawPayload?: unknown;
};

export class PunchIngestionService {
  buildDedupeFingerprint(companyId: string, input: IngestPunchInput): string {
    if (input.externalPunchId && input.deviceId) {
      return createHash('sha256')
        .update(`${companyId}|${input.deviceId}|${input.externalPunchId}`)
        .digest('hex');
    }
    const base = JSON.stringify({
      companyId,
      source: input.source,
      at: input.punchedAt.toISOString(),
      code: input.externalEmployeeCode,
      type: input.punchType,
    });
    return createHash('sha256').update(base).digest('hex');
  }

  async ingest(companyId: string, input: IngestPunchInput) {
    const dedupeFingerprint = this.buildDedupeFingerprint(companyId, input);
    const existing = await prisma.hcmTimePunch.findFirst({
      where: { companyId, dedupeFingerprint },
    });
    if (existing) return { punch: existing, duplicate: true };

    let employeeId = input.employeeId ?? null;
    let employmentId: string | null = null;

    if (!employeeId && input.deviceId && input.externalEmployeeCode) {
      const map = await prisma.hcmDeviceEmployeeMapping.findFirst({
        where: {
          companyId,
          deviceId: input.deviceId,
          externalEmployeeCode: input.externalEmployeeCode,
          isActive: true,
        },
      });
      if (map) {
        employeeId = map.employeeId;
        employmentId = map.employmentId;
      }
    }

    if (employeeId && !employmentId) {
      const ep = await hcmEmploymentEpisodeService.getActiveEpisode(companyId, employeeId);
      employmentId = ep?.id ?? null;
    }

    let punch;
    try {
      punch = await prisma.hcmTimePunch.create({
        data: {
          companyId,
          employeeId,
          employmentId,
          externalEmployeeCode: input.externalEmployeeCode,
          deviceId: input.deviceId,
          source: input.source,
          punchType: input.punchType,
          punchedAt: input.punchedAt,
          timezone: input.timezone,
          rawPayload: input.rawPayload as object,
          externalPunchId: input.externalPunchId,
          importBatchId: input.importBatchId,
          dedupeFingerprint,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const dup = await prisma.hcmTimePunch.findFirst({
          where: { companyId, dedupeFingerprint },
        });
        if (dup) return { punch: dup, duplicate: true };
      }
      throw e;
    }

    if (!employeeId || !employmentId) {
      await prisma.hcmTimeException.create({
        data: {
          companyId,
          exceptionType: 'UNMATCHED_PUNCH',
          severity: 'ERROR',
          status: 'OPEN',
          logicalWorkDate: new Date(localDateKey(input.punchedAt, input.timezone)),
          details: { punchId: punch.id },
        },
      });
      return { punch, duplicate: false, unmatched: true };
    }

    const logical = await resolveLogicalWorkDateForPunch(
      companyId,
      employmentId,
      input.punchedAt,
      input.timezone
    );
    await attendanceCalculationService.recalculateDay(
      companyId,
      employmentId,
      logical,
      input.timezone
    );

    return { punch, duplicate: false };
  }
}

export const punchIngestionService = new PunchIngestionService();
