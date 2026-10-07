import prisma from '../../../../shared/database/prisma';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { pickAssignmentAtDate } from './employment-assignment.domain';
import { hcmEmploymentEpisodeService } from './hcm-employment-episode.service';

export type ManagerResolution = {
  managerPositionId: string | null;
  managerPositionLabel: string | null;
  occupantEmployees: Array<{ id: string; arabicName: string }>;
  vacant: boolean;
};

export class HcmManagerService {
  async resolveManagerForEmployee(
    companyId: string,
    employeeId: string,
    asOf: Date = toDateOnly(new Date())
  ): Promise<ManagerResolution | null> {
    const employment = await hcmEmploymentEpisodeService.getActiveEpisode(companyId, employeeId);
    if (!employment) return null;

    const assignments = await prisma.hcmEmploymentAssignment.findMany({
      where: { employmentId: employment.id, companyId },
    });
    const assignment = pickAssignmentAtDate(assignments, asOf);
    if (!assignment) return null;

    let managerPositionId =
      assignment.managerPositionId ?? null;

    if (!managerPositionId && assignment.positionId) {
      const pos = await prisma.hcmPosition.findFirst({
        where: { id: assignment.positionId, companyId },
        select: { reportsToPositionId: true, arabicName: true },
      });
      managerPositionId = pos?.reportsToPositionId ?? null;
    }

    if (!managerPositionId) {
      return {
        managerPositionId: null,
        managerPositionLabel: null,
        occupantEmployees: [],
        vacant: true,
      };
    }

    const mgrPos = await prisma.hcmPosition.findFirst({
      where: { id: managerPositionId, companyId },
      select: { arabicName: true, code: true },
    });

    const occupantAssignments = await prisma.hcmEmploymentAssignment.findMany({
      where: {
        companyId,
        positionId: managerPositionId,
        effectiveTo: null,
        employment: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
      },
      include: {
        employment: {
          include: { employee: { select: { id: true, arabicName: true } } },
        },
      },
    });

    const occupants = occupantAssignments
      .filter((a) => pickAssignmentAtDate([a], asOf)?.id === a.id)
      .map((a) => a.employment.employee);

    return {
      managerPositionId,
      managerPositionLabel: mgrPos ? `${mgrPos.code} — ${mgrPos.arabicName}` : null,
      occupantEmployees: occupants,
      vacant: occupants.length === 0,
    };
  }
}

export const hcmManagerService = new HcmManagerService();
