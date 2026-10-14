import { describe, expect, it } from 'vitest';
import { analysisElementCost, CATALOG_KIND_AR } from '@/components/contracting/tender/tender-labels';

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
    expect(CATALOG_KIND_AR.SEASON).toBe('موسم');
    expect(CATALOG_KIND_AR.EXECUTABLE).toBe('بند تنفيذي');
  });
});
