import { buildExpiryReport, daysUntilExpiry, type ExpirySourceLot } from '../../modules/inventory/services/expiry-date-report';

function lot(partial: Partial<ExpirySourceLot> & Pick<ExpirySourceLot, 'expiryDate' | 'side' | 'quantity'>): ExpirySourceLot {
  return {
    itemId: 'item-1',
    itemName: 'لبن',
    warehouseId: 'wh-1',
    warehouseName: 'المخزن الرئيسي',
    batchNumber: 'B1',
    sourceLabel: 'فاتورة مشتريات',
    sourceNumber: '10',
    partyName: 'مورد',
    unitName: 'علبة',
    itemGroupName: 'ألبان',
    ...partial,
  };
}

const today = new Date('2026-09-27T12:00:00.000Z');

describe('expiry date report', () => {
  it('counts calendar days until expiry in UTC', () => {
    expect(daysUntilExpiry(new Date('2026-09-27T00:00:00.000Z'), today)).toBe(0);
    expect(daysUntilExpiry(new Date('2026-10-27T00:00:00.000Z'), today)).toBe(30);
    expect(daysUntilExpiry(new Date('2026-09-01T00:00:00.000Z'), today)).toBe(-26);
  });

  it('nets a sale out of the purchased batch and marks what is left', () => {
    const built = buildExpiryReport(
      [
        lot({
          expiryDate: new Date('2026-10-10T00:00:00.000Z'),
          side: 'in',
          quantity: 20,
        }),
        lot({
          expiryDate: new Date('2026-10-10T00:00:00.000Z'),
          side: 'out',
          quantity: 5,
          sourceLabel: 'فاتورة مبيعات',
          sourceNumber: '11',
        }),
      ],
      { today }
    );

    expect(built.rows).toHaveLength(1);
    expect(built.rows[0].quantity).toBe(15);
    expect(built.rows[0].status).toBe('خلال 30 يوم');
    expect(built.rows[0].itemName).toBe('لبن');
    expect(built.rows[0].warehouseName).toBe('المخزن الرئيسي');
    expect(built.summary.soonLots).toBe(1);
    expect(built.summary.onHandLots).toBe(1);
  });

  it('keeps an expired batch and a fully sold batch instead of returning a blank report', () => {
    const built = buildExpiryReport(
      [
        lot({
          expiryDate: new Date('2026-01-01T00:00:00.000Z'),
          side: 'in',
          quantity: 4,
          batchNumber: 'OLD',
        }),
        lot({
          expiryDate: new Date('2027-06-01T00:00:00.000Z'),
          side: 'in',
          quantity: 8,
          batchNumber: 'SOLD',
        }),
        lot({
          expiryDate: new Date('2027-06-01T00:00:00.000Z'),
          side: 'out',
          quantity: 8,
          batchNumber: 'SOLD',
          sourceLabel: 'فاتورة مبيعات',
        }),
      ],
      {
        today,
        fromDate: new Date('2021-01-01T00:00:00.000Z'),
        toDate: new Date('2028-12-31T23:59:59.000Z'),
      }
    );

    expect(built.rows.map((row) => row.status)).toEqual(['منتهي', 'صُرف']);
    expect(built.rows[0].quantity).toBe(4);
    expect(built.rows[1].quantity).toBe(0);
    expect(built.summary.expiredLots).toBe(1);
    expect(built.summary.consumedLots).toBe(1);
  });

  it('drops batches whose expiry is outside the selected window', () => {
    const built = buildExpiryReport(
      [
        lot({ expiryDate: new Date('2020-01-01T00:00:00.000Z'), side: 'in', quantity: 1 }),
        lot({ expiryDate: new Date('2026-11-01T00:00:00.000Z'), side: 'in', quantity: 2, batchNumber: 'NOW' }),
      ],
      {
        today,
        fromDate: new Date('2026-01-01T00:00:00.000Z'),
        toDate: new Date('2026-12-31T23:59:59.000Z'),
      }
    );
    expect(built.rows.map((row) => row.batchNumber)).toEqual(['NOW']);
  });
});
