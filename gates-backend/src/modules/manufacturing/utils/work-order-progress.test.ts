import {
  normalizeBomPlans,
  parseBomPlansFromMetadata,
} from './work-order-progress';

describe('work-order-progress plans', () => {
  it('merges duplicate bomIds in metadata plans', () => {
    const plans = parseBomPlansFromMetadata(
      {
        bomPlans: [
          { bomId: 'b1', modelCount: 40 },
          { bomId: 'b1', modelCount: 60 },
        ],
      },
      null,
      null
    );
    expect(plans).toEqual([{ bomId: 'b1', modelCount: 100 }]);
  });

  it('falls back to legacy header bom when no bomPlans', () => {
    expect(parseBomPlansFromMetadata(null, 'legacy-bom', 25)).toEqual([
      { bomId: 'legacy-bom', modelCount: 25 },
    ]);
  });

  it('normalizeBomPlans sums by bomId', () => {
    expect(
      normalizeBomPlans([
        { bomId: 'a', modelCount: 10 },
        { bomId: 'b', modelCount: 5 },
        { bomId: 'a', modelCount: 15 },
      ])
    ).toEqual([
      { bomId: 'a', modelCount: 25 },
      { bomId: 'b', modelCount: 5 },
    ]);
  });
});
