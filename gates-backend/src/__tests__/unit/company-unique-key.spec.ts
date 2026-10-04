import {
  duplicateUniqueKeyMessage,
  normalizeUniqueValue,
  repeatedUniqueValue,
  UNIQUE_KINDS,
} from '../../shared/database/company-unique-key';

describe('company unique keys', () => {
  it('trims item names and cheque numbers and treats blank as empty', () => {
    expect(normalizeUniqueValue('  سكر  ')).toBe('سكر');
    expect(normalizeUniqueValue('  105  ')).toBe('105');
    expect(normalizeUniqueValue('   ')).toBeNull();
    expect(normalizeUniqueValue(null)).toBeNull();
  });

  it('names the duplicate in Arabic', () => {
    expect(duplicateUniqueKeyMessage(UNIQUE_KINDS.itemName, 'سكر')).toBe('اسم الصنف مستخدم لصنف آخر');
    expect(duplicateUniqueKeyMessage(UNIQUE_KINDS.chequeNumber, '105')).toBe('رقم الشيك 105 مستخدم من قبل');
  });

  it('finds a cheque number repeated in the same batch', () => {
    expect(repeatedUniqueValue(['101', ' 102 ', '101'])).toBe('101');
    expect(repeatedUniqueValue(['101', '102', ' 101 '])).toBe('101');
    expect(repeatedUniqueValue(['101', '102'])).toBeNull();
    expect(repeatedUniqueValue(['', '   ', null])).toBeNull();
  });
});
