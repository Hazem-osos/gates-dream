import { resolveCreateCostCenterKind } from '../../modules/accounting/utils/cost-center-kind';

describe('cost center kind', () => {
  it('forces root centers to HEADER', () => {
    expect(resolveCreateCostCenterKind({ parentId: null, costCenterKind: 'POSTING' })).toBe(
      'HEADER'
    );
    expect(resolveCreateCostCenterKind({ costCenterKind: 'POSTING' })).toBe('HEADER');
  });

  it('lets a child be HEADER or POSTING', () => {
    expect(resolveCreateCostCenterKind({ parentId: 'p1', costCenterKind: 'HEADER' })).toBe(
      'HEADER'
    );
    expect(resolveCreateCostCenterKind({ parentId: 'p1', costCenterKind: 'POSTING' })).toBe(
      'POSTING'
    );
    expect(resolveCreateCostCenterKind({ parentId: 'p1' })).toBe('POSTING');
  });
});
