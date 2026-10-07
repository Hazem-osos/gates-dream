import type { Prisma } from '@prisma/client';
import { toDateOnly } from '../../utils/hr-effective-date.util';

/** Close open assignment/compensation intervals at termination (inclusive end date). */
export async function closeEmploymentTimelinesAt(
  tx: Prisma.TransactionClient,
  companyId: string,
  employmentId: string,
  terminationDate: Date
) {
  const end = toDateOnly(terminationDate);
  const openAssignments = await tx.hcmEmploymentAssignment.findMany({
    where: { companyId, employmentId, effectiveTo: null },
  });
  for (const row of openAssignments) {
    if (toDateOnly(row.effectiveFrom).getTime() > end.getTime()) continue;
    await tx.hcmEmploymentAssignment.update({
      where: { id: row.id },
      data: { effectiveTo: end },
    });
  }
  const openComp = await tx.hcmCompensationAssignment.findMany({
    where: { companyId, employmentId, effectiveTo: null },
  });
  for (const row of openComp) {
    if (toDateOnly(row.effectiveFrom).getTime() > end.getTime()) continue;
    await tx.hcmCompensationAssignment.update({
      where: { id: row.id },
      data: { effectiveTo: end },
    });
  }
}
