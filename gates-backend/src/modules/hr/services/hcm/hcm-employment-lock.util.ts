import type { Prisma } from '@prisma/client';

/** Row lock parent employment for the duration of the transaction. */
export async function lockHcmEmploymentRow(
  tx: Prisma.TransactionClient,
  employmentId: string
): Promise<void> {
  await tx.$executeRaw`SELECT id FROM hcm_employments WHERE id = ${employmentId} FOR UPDATE`;
}
