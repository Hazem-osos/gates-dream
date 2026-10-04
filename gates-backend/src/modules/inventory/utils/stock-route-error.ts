import { Prisma } from '@prisma/client';
import { AppError } from '../../../shared/middleware/error-handler';

export function stockMutationStatus(error: unknown): number {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return 409;
    if (error.code === 'P2003') return 422;
    return 400;
  }
  if (!(error instanceof Error)) return 500;
  const message = error.message;
  if (
    message.includes('not found') ||
    message.includes('غير موجود') ||
    message.includes('Cannot') ||
    message.includes('لا يمكن') ||
    message.includes('already') ||
    message.includes('مرحّل') ||
    message.includes('do not belong') ||
    message.includes('Insufficient') ||
    message.includes('لا تكفي') ||
    message.includes('بالسالب')
  ) {
    return 400;
  }
  return 500;
}

export function stockMutationMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2003') {
      return 'تعذّر الحفظ لأن الفرع أو الصنف أو المخزن غير مرتبط بشكل صحيح.';
    }
    if (error.code === 'P2002') {
      const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '');
      if (target.includes('activeSourceKey')) {
        return 'يوجد قيد محاسبي مرتبط بنفس مستند المخزون. فك ترحيل المستند السابق أو راجع مسلسل الإضافة.';
      }
      return 'يوجد مستند بنفس البيانات مسبقاً. غيّر المسلسل أو حدّث الصفحة ثم أعد المحاولة.';
    }
    return 'تعذّر حفظ البيانات. الحل: راجع الحقول وأعد المحاولة.';
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message) return fallback;
    if (/prisma|invalid `|invocation|unknown (argument|column)|constraint/i.test(message)) {
      return 'تعذّر حفظ البيانات. الحل: راجع الحقول وأعد المحاولة.';
    }
    if (/account not found for code/i.test(message)) {
      return 'حساب في تعريف الحسابات غير موجود في الدليل. راجع إعدادات المخزون ثم أعد الترحيل.';
    }
    if (/journal line/i.test(message)) {
      return 'تعذّر إنشاء قيد المخزون. راجع حسابات المخزون والمبالغ ثم أعد الترحيل.';
    }
    return message;
  }
  return fallback;
}
