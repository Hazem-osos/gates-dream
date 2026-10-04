import { buildCostCenterBudgetRows } from '../../modules/accounting/services/cost-center-budget';

const tree = [
  { id: 'parent', parentId: null, arabicName: 'المشاريع' },
  { id: 'child', parentId: 'parent', arabicName: 'مشروع ألفا' },
];

describe('cost center budget rows', () => {
  it('compares each center budget with its period balance and keeps the parent path', () => {
    const rows = buildCostCenterBudgetRows(
      [
        {
          id: 'child',
          code: 'PRJ-01',
          arabicName: 'مشروع ألفا',
          parentId: 'parent',
          budget: 1000,
          openingDebit: 50,
          openingCredit: 0,
          periodDebit: 400,
          periodCredit: 100,
        },
      ],
      tree
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      accountPath: 'المشاريع › مشروع ألفا',
      code: 'PRJ-01',
      account: 'مشروع ألفا',
      budgetLevel: 2,
      budgetDebit: 1000,
      budgetCredit: 0,
      openingDebit: 50,
      actual: 300,
      remaining: 700,
      negativeVariance: 0,
      endingDebit: 350,
      endingCredit: 0,
    });
  });

  it('marks the excess over budget as a negative variance', () => {
    const rows = buildCostCenterBudgetRows(
      [
        {
          id: 'child',
          code: 'PRJ-01',
          arabicName: 'مشروع ألفا',
          parentId: 'parent',
          budget: 100,
          openingDebit: 0,
          openingCredit: 0,
          periodDebit: 250,
          periodCredit: 0,
        },
      ],
      tree
    );
    expect(rows[0]).toMatchObject({
      actual: 250,
      remaining: -150,
      negativeVariance: 150,
      variancePercent: 150,
    });
  });

  it('drops a center that has neither a budget nor a movement', () => {
    const rows = buildCostCenterBudgetRows(
      [
        {
          id: 'child',
          code: 'PRJ-01',
          arabicName: 'مشروع ألفا',
          parentId: 'parent',
          budget: 0,
          openingDebit: 0,
          openingCredit: 0,
          periodDebit: 0,
          periodCredit: 0,
        },
      ],
      tree
    );
    expect(rows).toEqual([]);
  });
});
