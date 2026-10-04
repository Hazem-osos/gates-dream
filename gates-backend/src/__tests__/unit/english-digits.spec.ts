import '../../shared/format/english-digits';

describe('english digits', () => {
  it('prints western digits, a thousands comma, and decimals only when present', () => {
    expect((1.1111).toLocaleString('ar-EG')).toBe('1.1111');
    expect((1.11116).toLocaleString('ar-EG')).toBe('1.1112');
    expect((1234.5).toLocaleString('ar-EG')).toBe('1,234.5');
    expect((10).toLocaleString('ar-EG')).toBe('10');
    expect((100000000).toLocaleString('ar-EG')).toBe('100,000,000');
    expect((1.5).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1.5');
    expect((1.234567).toLocaleString('ar-EG', { maximumFractionDigits: 6 })).toBe('1.2346');
    expect(new Intl.NumberFormat('ar-EG').format(1.1111)).toBe('1.1111');
  });

  it('keeps arabic date wording but uses western digits', () => {
    const label = new Date(2026, 8, 27).toLocaleDateString('ar-EG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    expect(label).not.toMatch(/[٠-٩]/);
    expect(label).toContain('2026');
    expect(label).toContain('27');
  });
});
