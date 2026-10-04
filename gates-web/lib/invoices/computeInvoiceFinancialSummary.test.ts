import { computeInvoiceFinancialSummary } from './computeInvoiceFinancialSummary';

test('purchase line withholding shows in the summary and reduces the net', () => {
  const summary = computeInvoiceFinancialSummary(
    [
      {
        quantity: 10,
        unitPrice: 100,
        taxRate: 14,
        withholdingTaxRate: 1,
      },
    ],
    { applyTax: true }
  );
  expect(summary.subtotalWithoutTax).toBe(1000);
  expect(summary.taxAmount).toBe(140);
  expect(summary.withholdingTaxAmount).toBe(10);
  expect(summary.netAmount).toBe(1130);
});

test('a typed withholding amount is kept when the rate would compute something else', () => {
  const summary = computeInvoiceFinancialSummary(
    [
      {
        quantity: 10,
        unitPrice: 100,
        taxRate: 0,
        withholdingTaxRate: 1,
        withholdingTaxAmount: 25,
        withholdingAmountManual: true,
      },
    ],
    { applyTax: true }
  );
  expect(summary.withholdingTaxAmount).toBe(25);
  expect(summary.netAmount).toBe(975);
});
