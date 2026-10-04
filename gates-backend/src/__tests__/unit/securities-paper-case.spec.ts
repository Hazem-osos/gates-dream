import { resolveSecuritiesPaperCase } from '../../modules/accounting/utils/securities-paper-case';

describe('resolveSecuritiesPaperCase', () => {
  it('does not treat posting the issue journal as collection', () => {
    expect(
      resolveSecuritiesPaperCase({
        paperCase: 'ISSUED',
        isPosted: true,
        isCancelled: false,
      })
    ).toBe('ISSUED');
  });

  it('keeps collected / bounced / endorsed from the stored case', () => {
    expect(resolveSecuritiesPaperCase({ paperCase: 'COLLECTED', isPosted: false })).toBe('COLLECTED');
    expect(resolveSecuritiesPaperCase({ paperCase: 'BOUNCED', isPosted: true })).toBe('BOUNCED');
    expect(resolveSecuritiesPaperCase({ paperCase: 'ENDORSED', isPosted: true })).toBe('ENDORSED');
  });
});
