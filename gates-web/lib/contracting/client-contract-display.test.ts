import { describe, expect, it } from 'vitest';
import { contractAdvanceAmountFromPercent, contractAdvancePercent } from './client-contract-display';

describe('contractAdvancePercent', () => {
  it('matches 12,000,000 / 57,090,000 ≈ 21.02%', () => {
    expect(contractAdvancePercent(12_000_000, 57_090_000)).toBe(21.02);
  });

  it('returns 0 when contract value is missing', () => {
    expect(contractAdvancePercent(12_000_000, 0)).toBe(0);
  });
});

describe('contractAdvanceAmountFromPercent', () => {
  it('rounds 21.02% of 57,090,000 to money', () => {
    expect(contractAdvanceAmountFromPercent(21.02, 57_090_000)).toBe(12_000_318);
  });

  it('returns 0 when contract value is missing', () => {
    expect(contractAdvanceAmountFromPercent(21.02, 0)).toBe(0);
  });
});
