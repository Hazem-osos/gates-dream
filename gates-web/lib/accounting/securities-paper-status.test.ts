import { describe, expect, it } from 'vitest';
import {
  securitiesPaperStatus,
  unpostBlockedByPaperCase,
} from '@/components/accounting/securities/securities-paper-status';

describe('securitiesPaperStatus', () => {
  it('shows ملغي for a cancelled issued paper', () => {
    const status = securitiesPaperStatus({
      id: 'p1',
      paperCase: 'ISSUED',
      isCancelled: true,
      isPosted: false,
    });
    expect(status.label).toBe('ملغي');
    expect(status.tone).toBe('danger');
  });

  it('keeps مرتدة for a bounced paper even when isCancelled is set', () => {
    const status = securitiesPaperStatus({
      id: 'p1',
      paperCase: 'BOUNCED',
      isCancelled: true,
      isPosted: false,
    });
    expect(status.label).toBe('مرتدة');
  });

  it('keeps فك الترحيل locked until a later paper event is undone', () => {
    expect(unpostBlockedByPaperCase('ISSUED')).toBeNull();
    expect(unpostBlockedByPaperCase('COLLECTED')).toContain('فك التحصيل');
    expect(unpostBlockedByPaperCase('ENDORSED')).toContain('فك التظهير');
  });
});
