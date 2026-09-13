import { AppError } from '../middleware/error-handler';

/** HTTP 409 body when a concurrent editor already saved the same document. */
export const OPTIMISTIC_LOCK_AR =
  'تعذر الحفظ: قام مستخدم آخر بتعديل هذا المستند منذ لحظات. يرجى تحديث الصفحة لمشاهدة التعديلات الأخيرة قبل الحفظ مجدداً.';

/** Spec alias — this codebase uses AppError, not NestJS ConflictException. */
export class ConflictException extends AppError {
  constructor(message = OPTIMISTIC_LOCK_AR) {
    super(409, message);
    Object.setPrototypeOf(this, ConflictException.prototype);
  }
}

export function assertExpectedVersion(current: number, expected?: number): void {
  if (expected !== undefined && expected !== current) {
    throw new ConflictException();
  }
}

export function throwStaleWrite(): never {
  throw new ConflictException();
}

export function assertUpdateCount(count: number): void {
  if (count === 0) {
    throwStaleWrite();
  }
}
