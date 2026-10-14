import {
  isTenderHeaderKind,
  sellingFromStackedStudy,
} from '../../modules/contracting/tender/contract-tender-pricing.util';

describe('tender stacked selling study', () => {
  const notebookRates = {
    generalOverheadRate: 0.08,
    siteOverheadRate: 0.05,
    contingencyRiskRate: 0.03,
    profitMarginRate: 0.12,
    contractTaxesRate: 0,
  };

  it('applies direct × (1+0.08+0.05+0.03) × (1+0.12) × (1+0)', () => {
    expect(sellingFromStackedStudy(100, notebookRates)).toBe(129.92);
  });

  it('keeps tax at 0 unless set', () => {
    expect(sellingFromStackedStudy(2025, notebookRates)).toBe(2630.88);
  });

  it('treats season/chapter/official as headers', () => {
    expect(isTenderHeaderKind('SEASON')).toBe(true);
    expect(isTenderHeaderKind('CHAPTER')).toBe(true);
    expect(isTenderHeaderKind('OFFICIAL')).toBe(true);
    expect(isTenderHeaderKind('EXECUTABLE')).toBe(false);
  });
});
