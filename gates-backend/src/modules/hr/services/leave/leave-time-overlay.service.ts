import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';

export type DayLeaveOverlay = {
  excusedMinutes: number;
  paidLeaveMinutes: number;
  unpaidLeaveMinutes: number;
  sickLeaveMinutes: number;
  otherApprovedLeaveMinutes: number;
  fullDayLeave: boolean;
  attendanceClassification: string;
};

export class LeaveTimeOverlayService {
  async getApprovedOverlay(
    companyId: string,
    employmentId: string,
    logicalWorkDate: Date
  ): Promise<DayLeaveOverlay | null> {
    const day = toDateOnly(logicalWorkDate);
    const segments = await prisma.hcmLeaveRequestDay.findMany({
      where: {
        companyId,
        workDate: day,
        request: { companyId, employmentId, status: 'APPROVED' },
      },
      include: { request: { include: { leaveType: true } } },
    });
    if (segments.length === 0) return null;

    let excusedMinutes = 0;
    let paidLeaveMinutes = 0;
    let unpaidLeaveMinutes = 0;
    let sickLeaveMinutes = 0;
    let otherApprovedLeaveMinutes = 0;
    let fullDayLeave = false;
    let attendanceClassification = 'PAID_LEAVE';

    for (const seg of segments) {
      const lt = seg.request.leaveType;
      const mins = seg.chargeableMinutes || 0;
      excusedMinutes += mins;
      const cls = lt.attendanceClassification;
      attendanceClassification = cls;
      if (cls === 'UNPAID_LEAVE') unpaidLeaveMinutes += mins;
      else if (cls === 'SICK_LEAVE') sickLeaveMinutes += mins;
      else if (cls === 'PAID_LEAVE') paidLeaveMinutes += mins;
      else otherApprovedLeaveMinutes += mins;
      if (seg.segmentType === 'FULL' && seg.chargeableDays.gte(1)) fullDayLeave = true;
    }

    return {
      excusedMinutes,
      paidLeaveMinutes,
      unpaidLeaveMinutes,
      sickLeaveMinutes,
      otherApprovedLeaveMinutes,
      fullDayLeave,
      attendanceClassification,
    };
  }
}

export const leaveTimeOverlayService = new LeaveTimeOverlayService();
