import { describe, expect, it } from 'vitest';
import {
  analysisElementCost,
  CATALOG_KIND_AR,
  isQuotationHeaderItem,
  isTenderHeaderKind,
  quotationLineKindLabel,
} from '@/components/contracting/tender/tender-labels';

describe('tender notebook display math', () => {
  it('matches handwritten 0.15 × 13500 = 2025 with zero waste', () => {
    expect(analysisElementCost(0.15, 0, 13500)).toBe(2025);
  });

  it('matches 22.5 × 13500 = 303750 with zero waste', () => {
    expect(analysisElementCost(22.5, 0, 13500)).toBe(303750);
  });

  it('applies waste as quota × (1 + waste) × unitCost', () => {
    expect(analysisElementCost(1, 0.1, 100)).toBeCloseTo(110, 8);
  });

  it('labels catalog kinds in Arabic', () => {
    expect(CATALOG_KIND_AR.SEASON).toBe('رئيسي');
    expect(CATALOG_KIND_AR.CHAPTER).toBe('رئيسي فرعي');
    expect(CATALOG_KIND_AR.OFFICIAL).toBe('رئيسي فرعي');
    expect(CATALOG_KIND_AR.EXECUTABLE).toBe('تنفيذي');
  });

  it('marks season/chapter/official as headers', () => {
    expect(isTenderHeaderKind('SEASON')).toBe(true);
    expect(isTenderHeaderKind('EXECUTABLE')).toBe(false);
  });

  it('shows executable quote lines as أساسي', () => {
    expect(quotationLineKindLabel('EXECUTABLE', true)).toBe('أساسي');
    expect(quotationLineKindLabel(null, true)).toBe('أساسي');
    expect(quotationLineKindLabel('CHAPTER', false)).toBe('رئيسي فرعي');
  });

  it('keeps only header items on the quotation grid', () => {
    expect(isQuotationHeaderItem('OFFICIAL', false)).toBe(true);
    expect(isQuotationHeaderItem('SEASON', false)).toBe(true);
    expect(isQuotationHeaderItem('CHAPTER', false)).toBe(true);
    expect(isQuotationHeaderItem('EXECUTABLE', false)).toBe(false);
    expect(isQuotationHeaderItem('EXECUTABLE', true)).toBe(false);
    expect(isQuotationHeaderItem(null, true)).toBe(false);
  });
});
