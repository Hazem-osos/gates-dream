import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export class TimePeriodReviewService {
  async assessPeriod(companyId: string, periodStart: Date, periodEnd: Date) {
    const start = toDateOnly(periodStart);
    const end = toDateOnly(periodEnd);

    const openExceptions = await prisma.hcmTimeException.count({
      where: { companyId, status: 'OPEN', logicalWorkDate: { gte: start, lte: end } },
    });
    const pendingCorrections = await prisma.hcmTimeCorrection.count({
      where: { companyId, status: 'REQUESTED', logicalWorkDate: { gte: start, lte: end } },
    });
    const unapprovedOtRows = await prisma.hcmAttendanceDay.findMany({
      where: {
        companyId,
        logicalWorkDate: { gte: start, lte: end },
        detectedOvertimeMinutes: { gt: 0 },
      },
      select: { detectedOvertimeMinutes: true, approvedOvertimeMinutes: true },
    });
    const otGap = unapprovedOtRows.filter((r) => r.approvedOvertimeMinutes < r.detectedOvertimeMinutes).length;
    const unmatched = await prisma.hcmTimeException.count({
      where: {
        companyId,
        status: 'OPEN',
        exceptionType: 'UNMATCHED_PUNCH',
        createdAt: { gte: start, lte: end },
      },
    });

    const reasons: string[] = [];
    if (openExceptions > 0) reasons.push(`${openExceptions} open exceptions`);
    if (pendingCorrections > 0) reasons.push(`${pendingCorrections} pending corrections`);
    if (unmatched > 0) reasons.push(`${unmatched} unmatched punches`);
    if (otGap > 0) reasons.push(`${otGap} days with unapproved overtime`);

    const readiness = reasons.length === 0 ? 'READY' : 'NOT_READY';

    return prisma.hcmAttendancePeriodReview.upsert({
      where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } },
      create: {
        companyId,
        periodStart: start,
        periodEnd: end,
        readiness,
        readinessReasons: reasons,
      },
      update: { readiness, readinessReasons: reasons },
    });
  }

  async unlockPeriod(
    companyId: string,
    periodStart: Date,
    periodEnd: Date,
    userId: string,
    reason: string
  ) {
    const start = toDateOnly(periodStart);
    const end = toDateOnly(periodEnd);
    await prisma.hcmAttendanceDay.updateMany({
      where: {
        companyId,
        logicalWorkDate: { gte: start, lte: end },
        status: 'LOCKED',
      },
      data: { status: 'CALCULATED', lockedAt: null, lockedBy: null },
    });
    return prisma.hcmAttendancePeriodReview.upsert({
      where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } },
      create: {
        companyId,
        periodStart: start,
        periodEnd: end,
        readiness: 'NOT_READY',
        readinessReasons: [`UNLOCK by ${userId}: ${reason}`],
      },
      update: {
        lockedAt: null,
        lockedBy: null,
        readinessReasons: [`UNLOCK by ${userId}: ${reason}`],
      },
    });
  }

  async lockPeriod(companyId: string, periodStart: Date, periodEnd: Date, userId: string) {
    const start = toDateOnly(periodStart);
    const end = toDateOnly(periodEnd);
    const review = await this.assessPeriod(companyId, start, end);
    if (review.readiness === 'NOT_READY') {
      return review;
    }
    await prisma.hcmAttendanceDay.updateMany({
      where: {
        companyId,
        logicalWorkDate: { gte: start, lte: end },
        status: { not: 'LOCKED' },
      },
      data: { status: 'LOCKED', lockedAt: new Date(), lockedBy: userId },
    });
    return prisma.hcmAttendancePeriodReview.upsert({
      where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } },
      create: {
        companyId,
        periodStart: start,
        periodEnd: end,
        readiness: 'READY',
        lockedAt: new Date(),
        lockedBy: userId,
      },
      update: { lockedAt: new Date(), lockedBy: userId },
    });
  }
}

export const timePeriodReviewService = new TimePeriodReviewService();
