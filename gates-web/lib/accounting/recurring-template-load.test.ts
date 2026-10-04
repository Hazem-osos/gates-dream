import { fieldsForRecurringTemplateLoad, recurringTemplateLabel } from './recurring-template-load';

describe('recurring template load', () => {
  it('keeps the stored number when opening the original voucher', () => {
    expect(
      fieldsForRecurringTemplateLoad({
        asTemplate: false,
        voucherNumber: '00012',
        date: '2026-01-05',
        hijriDate: 'هـ',
        today: '2026-09-29',
        toHijri: () => 'اليوم',
      })
    ).toEqual({
      voucherNumber: '00012',
      date: '2026-01-05',
      hijriDate: 'هـ',
    });
  });

  it('drops the stored number so a new load takes the next serial', () => {
    expect(
      fieldsForRecurringTemplateLoad({
        asTemplate: true,
        voucherNumber: '00012',
        date: '2026-01-05',
        hijriDate: 'هـ',
        today: '2026-09-29',
        toHijri: () => '٢٩-٩',
      })
    ).toEqual({
      voucherNumber: '',
      date: '2026-09-29',
      hijriDate: '٢٩-٩',
    });
  });

  it('lists a recurring voucher by description, not by its old code', () => {
    expect(
      recurringTemplateLabel({ description: 'إيجار المخزن', voucherNumber: '00012', amount: 5000 })
    ).toBe('إيجار المخزن');
  });
});
