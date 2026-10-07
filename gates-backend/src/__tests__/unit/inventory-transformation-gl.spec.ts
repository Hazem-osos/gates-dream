import { buildInventoryTransformationJournalLines } from '../../modules/inventory/services/stock-movement-gl.service';

describe('buildInventoryTransformationJournalLines', () => {
  it('posts separate debit and credit lines when both map to the same inventory account', () => {
    const inv = 'company-inventory';
    const lines = buildInventoryTransformationJournalLines(
      [{ accountId: inv, amount: 140, description: 'finished received' }],
      [{ accountId: inv, amount: 140, description: 'components relieved' }]
    );
    expect(lines).toHaveLength(2);
    const debit = lines.reduce((s, l) => s + l.debit, 0);
    const credit = lines.reduce((s, l) => s + l.credit, 0);
    expect(debit).toBe(140);
    expect(credit).toBe(140);
    expect(lines.every((l) => l.accountId === inv)).toBe(true);
  });

  it('splits value across distinct control accounts', () => {
    const lines = buildInventoryTransformationJournalLines(
      [{ accountId: 'finished-goods', amount: 140, description: 'fg' }],
      [{ accountId: 'raw-inventory', amount: 140, description: 'raw' }]
    );
    expect(lines).toHaveLength(2);
    expect(lines.find((l) => l.accountId === 'finished-goods')?.debit).toBe(140);
    expect(lines.find((l) => l.accountId === 'raw-inventory')?.credit).toBe(140);
  });
});
