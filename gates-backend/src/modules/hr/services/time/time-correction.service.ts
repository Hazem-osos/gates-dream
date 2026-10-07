import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { attendanceCalculationService } from './attendance-calculation.service';

export class TimeCorrectionService {
  async request(
    companyId: string,
    input: {
      employmentId: string;
      logicalWorkDate: Date;
      correctionType: string;
      payload: Record<string, unknown>;
      reason?: string;
      requestedBy?: string;
    }
  ) {
    return prisma.hcmTimeCorrection.create({
      data: {
        companyId,
        employmentId: input.employmentId,
        logicalWorkDate: toDateOnly(input.logicalWorkDate),
        correctionType: input.correctionType,
        payload: input.payload,
        reason: input.reason,
        requestedBy: input.requestedBy,
        status: 'REQUESTED',
      },
    });
  }

  async approve(companyId: string, correctionId: string, approverId: string, timezone = 'UTC') {
    const row = await prisma.hcmTimeCorrection.findFirst({ where: { id: correctionId, companyId } });
    if (!row) throw new AppError(404, 'Correction not found');
    if (row.status === 'APPLIED') return row;
    if (row.status !== 'REQUESTED') throw new AppError(400, 'Invalid status');
    await prisma.hcmTimeCorrection.update({
      where: { id: correctionId },
      data: { status: 'APPROVED', approvedBy: approverId },
    });
    const day = await attendanceCalculationService.recalculateDay(
      companyId,
      row.employmentId,
      row.logicalWorkDate,
      timezone
    );
    return prisma.hcmTimeCorrection.update({
      where: { id: correctionId },
      data: { status: 'APPLIED', appliedAt: new Date(), attendanceDayId: day.id },
    });
  }

  async reject(companyId: string, correctionId: string, userId: string) {
    const row = await prisma.hcmTimeCorrection.findFirst({ where: { id: correctionId, companyId } });
    if (!row) throw new AppError(404, 'Not found');
    return prisma.hcmTimeCorrection.update({
      where: { id: correctionId },
      data: { status: 'REJECTED', rejectedBy: userId },
    });
  }

  async apply(companyId: string, correctionId: string) {
    const row = await prisma.hcmTimeCorrection.findFirst({ where: { id: correctionId, companyId } });
    if (!row) throw new AppError(404, 'Not found');
    if (row.status === 'APPLIED') return row;
    if (row.status !== 'APPROVED' && row.status !== 'REQUESTED') {
      throw new AppError(400, 'Cannot apply');
    }
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: row.employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');

    const day = await attendanceCalculationService.recalculateDay(
      companyId,
      row.employmentId,
      row.logicalWorkDate,
      'UTC'
    );
    return prisma.hcmTimeCorrection.update({
      where: { id: correctionId },
      data: {
        status: 'APPLIED',
        appliedAt: new Date(),
        attendanceDayId: day.id,
      },
    });
  }
}

export const timeCorrectionService = new TimeCorrectionService();
