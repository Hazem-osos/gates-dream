import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';

export async function notifyJobComplete(input: {
  companyId: string;
  userId?: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  category?: string;
}): Promise<void> {
  try {
    await prisma.systemNotification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId || null,
        title: input.title.slice(0, 191),
        message: input.message,
        type: 'INFO',
        category: (input.category ?? 'JOB').slice(0, 40),
        linkUrl: input.linkUrl ?? null,
        isRead: false,
      },
    });
  } catch (error) {
    logger.warn({ error, companyId: input.companyId }, 'Failed to write job-complete notification');
  }
}
