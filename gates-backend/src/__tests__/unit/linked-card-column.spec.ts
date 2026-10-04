import { Prisma } from '@prisma/client';
import {
  allocateLinkedCardDeltas,
  linkedCardColumnDelta,
} from '../../modules/accounting/services/ledger-balance.service';

const d = (value: number) => new Prisma.Decimal(value);

describe('linked card columns', () => {
  it('moves customer, safe and bank with the debit, and supplier with the credit', () => {
    expect(linkedCardColumnDelta('CUSTOMER', 100, 40).toFixed(4)).toBe('60.0000');
    expect(linkedCardColumnDelta('SUPPLIER', 10, 80).toFixed(4)).toBe('70.0000');
    expect(linkedCardColumnDelta('SAFE', 0, 25).toFixed(4)).toBe('-25.0000');
    expect(linkedCardColumnDelta('BANK', 10, 0).toFixed(4)).toBe('10.0000');
  });

  it('applies one line once even when both party account fields match it', () => {
    const deltas = allocateLinkedCardDeltas(
      [{ accountId: 'ar-1', debitBase: d(150), creditBase: d(0) }],
      [
        { kind: 'CUSTOMER', entityId: 'cust-1', accountId: 'ar-1' },
        { kind: 'CUSTOMER', entityId: 'cust-1', accountId: 'ar-1' },
      ]
    );
    expect(deltas.get('CUSTOMER\0cust-1')?.delta.toFixed(4)).toBe('150.0000');
  });

  it('sums a card that owns two different accounts and skips a shared account', () => {
    const deltas = allocateLinkedCardDeltas(
      [
        { accountId: 'ar-1', debitBase: d(100), creditBase: d(0) },
        { accountId: 'ar-2', debitBase: d(0), creditBase: d(30) },
        { accountId: 'shared', debitBase: d(999), creditBase: d(0) },
        { accountId: 'safe-gl', debitBase: d(40), creditBase: d(15) },
      ],
      [
        { kind: 'CUSTOMER', entityId: 'cust-1', accountId: 'ar-1' },
        { kind: 'CUSTOMER', entityId: 'cust-1', accountId: 'ar-2' },
        { kind: 'CUSTOMER', entityId: 'cust-1', accountId: 'shared' },
        { kind: 'CUSTOMER', entityId: 'cust-2', accountId: 'shared' },
        { kind: 'SAFE', entityId: 'safe-1', accountId: 'safe-gl' },
      ]
    );
    expect(deltas.get('CUSTOMER\0cust-1')?.delta.toFixed(4)).toBe('70.0000');
    expect(deltas.has('CUSTOMER\0cust-2')).toBe(false);
    expect(deltas.get('SAFE\0safe-1')?.delta.toFixed(4)).toBe('25.0000');
  });
});
