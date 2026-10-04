import { attachPartyDisplayNames, firstNonEmpty, paperPartyLabel } from '../../modules/accounting/utils/paper-party-label';

describe('paperPartyLabel', () => {
  it('ignores empty payeeName and uses supplier', () => {
    expect(
      paperPartyLabel({
        payeeName: '   ',
        supplier: { arabicName: 'مورد النور' },
      })
    ).toBe('مورد النور');
  });

  it('prefers stored payeeName', () => {
    expect(
      paperPartyLabel({
        payeeName: 'أحمد',
        supplier: { arabicName: 'مورد النور' },
      })
    ).toBe('أحمد');
  });
});

describe('attachPartyDisplayNames', () => {
  it('fills account label when no party card exists', async () => {
    const rows = await attachPartyDisplayNames(
      [{ payeeName: '', partyAccountId: 'acc-1', supplier: null, customer: null }],
      async () => [{ id: 'acc-1', code: '1201', arabicName: 'مورد نقدي' }]
    );
    expect(rows[0].partyDisplayName).toBe('[1201] مورد نقدي');
  });
});

describe('firstNonEmpty', () => {
  it('skips blanks', () => {
    expect(firstNonEmpty('', '  ', 'نادر')).toBe('نادر');
  });
});
