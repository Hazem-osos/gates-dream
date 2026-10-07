import { normalizeBranchCandidate } from '../../modules/inventory/utils/store-document-branch.util';

describe('store document branch util', () => {
  it('rejects company id masquerading as branch', () => {
    expect(normalizeBranchCandidate('company-1', 'company-1')).toBeUndefined();
    expect(normalizeBranchCandidate('branch-9', 'company-1')).toBe('branch-9');
  });
});
