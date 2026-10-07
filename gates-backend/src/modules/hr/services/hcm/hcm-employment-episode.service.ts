import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { lockHcmEmploymentRow } from './hcm-employment-lock.util';
export const OPEN_EMPLOYMENT_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;

export class HcmEmploymentEpisodeService {
  async getActiveEpisode(companyId: string, employeeId: string) {
    return prisma.hcmEmployment.findFirst({
      where: {
        companyId,
        employeeId,
        status: { in: [...OPEN_EMPLOYMENT_STATUSES] },
      },
      orderBy: [{ hireDate: 'desc' }, { episodeNumber: 'desc' }],
    });
  }

  async listEpisodes(companyId: string, employeeId: string) {
    return prisma.hcmEmployment.findMany({
      where: { companyId, employeeId },
      orderBy: [{ hireDate: 'asc' }, { episodeNumber: 'asc' }],
      include: {
        assignments: { orderBy: { effectiveFrom: 'asc' } },
        compensations: { orderBy: { effectiveFrom: 'asc' } },
        contracts: { orderBy: { contractStartDate: 'asc' } },
        events: { orderBy: [{ effectiveDate: 'desc' }], take: 30 },
      },
    });
  }

  async assertNoOpenEpisode(companyId: string, employeeId: string) {
    const open = await this.getActiveEpisode(companyId, employeeId);
    if (open) {
      throw new AppError(422, 'Employee already has an active employment episode; use lifecycle events');
    }
  }

  async assertLatestEpisodeTerminated(companyId: string, employeeId: string) {
    const latest = await prisma.hcmEmployment.findFirst({
      where: { companyId, employeeId },
      orderBy: [{ hireDate: 'desc' }, { episodeNumber: 'desc' }],
    });
    if (!latest) {
      throw new AppError(422, 'No prior employment episode; use HIRE instead of REHIRE');
    }
    if (latest.status !== 'TERMINATED') {
      throw new AppError(422, 'Latest employment episode is not terminated');
    }
    return latest;
  }

  async nextEpisodeNumber(companyId: string, employeeId: string): Promise<number> {
    const agg = await prisma.hcmEmployment.aggregate({
      where: { companyId, employeeId },
      _max: { episodeNumber: true },
    });
    return (agg._max.episodeNumber ?? 0) + 1;
  }

  /** Lock all employment rows for employee to prevent concurrent rehire/active episode races. */
  async lockEmployeeEpisodes(tx: Prisma.TransactionClient, companyId: string, employeeId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM hcm_employments
      WHERE companyId = ${companyId} AND employeeId = ${employeeId}
      FOR UPDATE
    `;
    for (const row of rows) {
      await lockHcmEmploymentRow(tx, row.id);
    }
    return rows.length;
  }

  async assertSingleOpenEpisodeTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string
  ) {
    const open = await tx.hcmEmployment.count({
      where: { companyId, employeeId, status: { in: [...OPEN_EMPLOYMENT_STATUSES] } },
    });
    if (open > 1) {
      throw new AppError(409, 'Multiple active employment episodes detected');
    }
  }
}

export const hcmEmploymentEpisodeService = new HcmEmploymentEpisodeService();
