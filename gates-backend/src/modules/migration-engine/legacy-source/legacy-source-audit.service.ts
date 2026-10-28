import type { PrismaClient } from '@prisma/client';
import type { LegacySourceMode } from '../types';

export class LegacySourceAuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(params: {
    companyId: string;
    action: string;
    mode?: LegacySourceMode;
    actorId?: string;
    detail?: string;
  }) {
    await this.prisma.migrationLegacySourceAudit.create({
      data: {
        companyId: params.companyId,
        action: params.action,
        mode: params.mode ?? null,
        actorId: params.actorId ?? null,
        detail: params.detail?.slice(0, 512) ?? null,
      },
    });
  }
}
