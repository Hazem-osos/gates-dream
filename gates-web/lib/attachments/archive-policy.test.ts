import { describe, expect, it } from 'vitest';
import { archivePolicySatisfied } from './archive-policy';

describe('archivePolicySatisfied', () => {
  it('skips check when archive not required', () => {
    expect(
      archivePolicySatisfied({
        requireOnSave: false,
        mode: 'ANY',
        categories: [],
        attachmentCategories: ['GENERAL'],
      }).ok
    ).toBe(true);
  });

  it('requires at least one attachment when enabled', () => {
    expect(
      archivePolicySatisfied({
        requireOnSave: true,
        mode: 'ANY',
        categories: [],
        attachmentCategories: [],
      }).ok
    ).toBe(false);
  });
});
