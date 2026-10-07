import {
  materialRequirementsFromProcessMetadata,
} from '../../modules/manufacturing/utils/production-order-material-requirements';

describe('materialRequirementsFromProcessMetadata', () => {
  it('returns null when snapshot missing or empty', () => {
    expect(materialRequirementsFromProcessMetadata(null)).toBeNull();
    expect(materialRequirementsFromProcessMetadata({})).toBeNull();
    expect(materialRequirementsFromProcessMetadata({ rawLinesSnapshot: [] })).toBeNull();
  });

  it('aggregates duplicate raw items', () => {
    const lines = materialRequirementsFromProcessMetadata({
      rawLinesSnapshot: [
        { rawItemId: 'a', quantity: 2 },
        { rawItemId: 'a', quantity: 3 },
        { rawItemId: 'b', quantity: 1 },
      ],
    });
    expect(lines).toEqual([
      { rawItemId: 'a', quantity: 5 },
      { rawItemId: 'b', quantity: 1 },
    ]);
  });

  it('ignores invalid lines', () => {
    const lines = materialRequirementsFromProcessMetadata({
      rawLinesSnapshot: [
        { rawItemId: '', quantity: 5 },
        { rawItemId: 'x', quantity: 0 },
        { rawItemId: 'y', quantity: '4' },
      ],
    });
    expect(lines).toEqual([{ rawItemId: 'y', quantity: 4 }]);
  });
});
