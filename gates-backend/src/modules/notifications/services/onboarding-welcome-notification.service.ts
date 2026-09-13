import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';

export const ONBOARDING_TOUR_NOTIFICATION_TYPE = 'ONBOARDING_TOUR';

/** Legacy welcome-tour notification. Gates Academy is now `/academy` — delete leftovers. */
export async function retireWelcomeTourNotification(companyId?: string) {
  const result = await prisma.systemNotification.deleteMany({
    where: {
      type: ONBOARDING_TOUR_NOTIFICATION_TYPE,
      ...(companyId ? { companyId } : {}),
    },
  });
  if (result.count > 0) {
    logger.info({ companyId, deleted: result.count }, 'Retired legacy ONBOARDING_TOUR notifications');
  }
  return result;
}

/** @deprecated Use retireWelcomeTourNotification — the old tour notification is gone. */
export async function ensureWelcomeTourNotification(companyId: string) {
  return retireWelcomeTourNotification(companyId);
}
