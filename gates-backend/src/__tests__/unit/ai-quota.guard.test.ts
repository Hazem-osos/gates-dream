import { QuotaExceededException } from '../../modules/ai/security/ai-quota.guard';

describe('QuotaExceededException', () => {
  it('returns HTTP 429 with an Arabic renewal message', () => {
    const renewsAt = new Date('2026-10-09T00:00:00.000Z');
    const err = new QuotaExceededException(250000, renewsAt);
    expect(err.statusCode).toBe(429);
    expect(err.message).toContain('250000');
    expect(err.message).toContain('تم استهلاك رصيد باقة الذكاء الاصطناعي');
  });
});
