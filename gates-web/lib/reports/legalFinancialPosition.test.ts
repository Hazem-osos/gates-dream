import { describe, expect, it } from 'vitest';
import { buildLegalFinancialPosition, classifyPositionAccount } from './legalFinancialPosition';

describe('legal financial position', () => {
  it('classifies current and non-current captions from the account trail', () => {
    expect(classifyPositionAccount('الأصول غير المتداولة أصول ثابتة سيارات', 'asset')).toBe('ppe');
    expect(classifyPositionAccount('الأصول المتداولة النقدية بالخزينة والبنوك', 'asset')).toBe('cash');
    expect(classifyPositionAccount('الأصول المتداولة بضاعة آخر المدة', 'asset')).toBe('inventory');
    expect(classifyPositionAccount('الالتزامات المتداولة دائنون وأوراق دفع', 'credit')).toBe('payables');
    expect(classifyPositionAccount('حقوق المساهمين رأس المال', 'credit')).toBe('capital');
    expect(classifyPositionAccount('ضريبة مؤجلة', 'asset')).toBe('otherNonCurrentAsset');
  });

  it('puts only legal lines on the face and keeps accounts in the note', () => {
    const { lines, notes } = buildLegalFinancialPosition(
      [
        { code: '12', arabicName: 'أصول طويلة الأجل', amount: 100, depth: 0 },
        { code: '121', arabicName: 'أصول ثابتة', amount: 100, depth: 1 },
        { code: '11', arabicName: 'أصول متداولة', amount: 40, depth: 0 },
        { code: '111', arabicName: 'النقدية بالخزينة', amount: 40, depth: 1 },
      ],
      [{ code: '31', arabicName: 'رأس المال', amount: 140, depth: 0 }],
      () => 0
    );
    expect(lines.map((line) => line.name)).toEqual([
      'الأصول غير المتداولة',
      'أصول ثابتة',
      'إجمالي الأصول غير المتداولة',
      'الأصول المتداولة',
      'نقدية وما في حكمها',
      'إجمالي الأصول المتداولة',
      'إجمالي الأصول',
      'حقوق الملكية',
      'رأس المال',
      'إجمالي حقوق الملكية',
      'إجمالي الالتزامات وحقوق الملكية',
    ]);
    expect(notes.find((note) => note.title === 'أصول ثابتة')?.rows[0].name).toBe('121 أصول ثابتة');
    expect(lines.find((line) => line.name === 'إجمالي الأصول')?.current).toBe(140);
  });
});
