import { expectedDrawerCash } from '../../modules/pos/services/pos-drawer';

describe('POS expected drawer cash', () => {
  it('uses net cash sales, refunds, and drawer movements', () => {
    expect(
      expectedDrawerCash({
        openingCash: 100,
        cashSales: 250,
        cashRefunds: 40,
        cashIn: 20,
        cashOut: 10,
      })
    ).toBe(320);
  });
});
