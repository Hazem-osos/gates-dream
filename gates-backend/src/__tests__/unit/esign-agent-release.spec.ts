import {
  compareSemver,
  isProtocolCompatible,
  needsAgentUpdate,
} from '../../modules/electronic-invoices/utils/esign-agent-version';

describe('esign agent release metadata', () => {
  it('compares versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareSemver('0.9.0', '1.0.0')).toBeLessThan(0);
  });

  it('requires an exact protocol match', () => {
    expect(isProtocolCompatible(1, 1)).toBe(true);
    expect(isProtocolCompatible(1, 2)).toBe(false);
  });

  it('flags outdated agents', () => {
    expect(needsAgentUpdate('0.9.0', '1.0.0')).toBe(true);
    expect(needsAgentUpdate('1.0.0', '1.0.0')).toBe(false);
  });
});
