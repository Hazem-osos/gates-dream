import { describe, expect, it } from 'vitest';
import { formatGridNumber, isZeroNumberDisplay, plainGridNumber, sanitizeMathInput } from './evaluateMathExpression';

describe('grid number editing', () => {
  it('keeps an in-progress amount free of grouping and padded zeros', () => {
    expect(plainGridNumber(10)).toBe('10');
    expect(plainGridNumber(1234.5)).toBe('1234.5');
    expect(plainGridNumber(1.1111)).toBe('1.1111');
    expect(plainGridNumber(-10.5)).toBe('-10.5');
    expect(sanitizeMathInput('10.50')).toBe('10.50');
    expect(sanitizeMathInput('12.')).toBe('12.');
  });

  it('treats a bare zero as empty and leaves real amounts', () => {
    expect(isZeroNumberDisplay('0')).toBe(true);
    expect(isZeroNumberDisplay('0.00')).toBe(true);
    expect(isZeroNumberDisplay('0,00')).toBe(true);
    expect(isZeroNumberDisplay('')).toBe(false);
    expect(isZeroNumberDisplay('10')).toBe(false);
    expect(isZeroNumberDisplay('0.5')).toBe(false);
  });

  it('groups thousands and shows decimals only when the number has them', () => {
    expect(formatGridNumber(1234.5)).toBe('1,234.5');
    expect(formatGridNumber(10)).toBe('10');
    expect(formatGridNumber(1.11116)).toBe('1.1112');
  });
});
