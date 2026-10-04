import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/error-handler';

export function permanentDeleteBlockedMessage(entityLabelAr: string): string {
  return `لا يمكن حذف ${entityLabelAr} لأنه مرتبط ببيانات أخرى. أزل الارتباطات أولاً.`;
}

/** Hard delete; maps FK violations to a clear Arabic 409. */
export async function permanentDelete<T>(
  entityLabelAr: string,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2003' || error.code === 'P2014')
    ) {
      throw new AppError(409, permanentDeleteBlockedMessage(entityLabelAr));
    }
    throw error;
  }
}
