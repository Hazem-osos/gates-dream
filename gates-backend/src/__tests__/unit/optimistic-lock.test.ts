import { AppError } from '../../shared/middleware/error-handler';
import {
  assertExpectedVersion,
  assertUpdateCount,
  ConflictException,
  OPTIMISTIC_LOCK_AR,
  throwStaleWrite,
} from '../../shared/concurrency/optimistic-lock';

describe('optimistic lock', () => {
  it('allows a matching expectedVersion', () => {
    expect(() => assertExpectedVersion(3, 3)).not.toThrow();
    expect(() => assertExpectedVersion(3, undefined)).not.toThrow();
  });

  it('rejects a stale expectedVersion with 409', () => {
    try {
      assertExpectedVersion(4, 3);
      throw new Error('expected throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(409);
    }
  });

  it('throwStaleWrite is 409 with the Arabic conflict copy', () => {
    try {
      throwStaleWrite();
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(409);
      expect((error as AppError).message).toBe(OPTIMISTIC_LOCK_AR);
    }
  });

  it('assertUpdateCount throws when no row was updated', () => {
    expect(() => assertUpdateCount(1)).not.toThrow();
    expect(() => assertUpdateCount(0)).toThrow(ConflictException);
  });
});
