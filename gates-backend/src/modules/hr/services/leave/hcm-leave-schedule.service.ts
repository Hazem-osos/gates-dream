import prisma from '../../../../shared/database/prisma';
import { enqueueLeaveAccrual } from './hcm-leave-job.service';

/** Idempotent monthly accrual enqueue for all active companies (scheduler entry point). */
export class HcmLeaveScheduleService {
  async enqueueDueMonthlyAccrual(asOf = new Date()) {
    const year = asOf.getUTCFullYear();
    const month = asOf.getUTCMonth() + 1;
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    const results = [];
    for (const c of companies) {
      const hasPolicy = await prisma.hcmLeavePolicy.findFirst({
        where: { companyId: c.id, isActive: true },
      });
      if (!hasPolicy) continue;
      results.push(await enqueueLeaveAccrual(c.id, year, month, 'scheduler'));
    }
    return { year, month, enqueued: results.filter((r) => r.enqueued).length, results };
  }
}

export const hcmLeaveScheduleService = new HcmLeaveScheduleService();
