import { classifyReceivableInvoice } from '../../modules/inventory/services/customer-receivables';

const asOf = new Date('2026-09-29T23:59:59');
const yearStart = new Date('2026-01-01T00:00:00');

describe('classifyReceivableInvoice', () => {
  it('puts amounts due before the period into prior arrears', () => {
    expect(classifyReceivableInvoice('2025-11-01', asOf, yearStart)).toBe('prior');
    expect(classifyReceivableInvoice('2025-08-01', asOf, yearStart)).toBe('prior');
  });

  it('keeps amounts due inside the period in the age buckets', () => {
    expect(classifyReceivableInvoice('2026-09-10', asOf, yearStart)).toBe('d30');
    expect(classifyReceivableInvoice('2026-08-15', asOf, yearStart)).toBe('d60');
    expect(classifyReceivableInvoice('2026-07-15', asOf, yearStart)).toBe('d90');
    expect(classifyReceivableInvoice('2026-04-01', asOf, yearStart)).toBe('older');
  });

  it('keeps invoices that are not yet due out of prior arrears', () => {
    expect(classifyReceivableInvoice('2026-12-01', asOf, yearStart)).toBe('current');
  });

  it('treats anything older than 90 days as prior when no start date is set', () => {
    expect(classifyReceivableInvoice('2026-04-01', asOf)).toBe('prior');
    expect(classifyReceivableInvoice('2026-09-10', asOf)).toBe('d30');
  });
});
