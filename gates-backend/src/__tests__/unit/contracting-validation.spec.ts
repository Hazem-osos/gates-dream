import {
  COST_ELEMENT_TYPES,
  createOwnerBoqItemSchema,
} from '../../modules/contracting/schemas/contracting.validation';
import { HISTORICAL_CLIENT_INVOICE_STATUSES } from '../../modules/contracting/client-billing/types/client-invoice.types';

describe('owner BOQ create contract', () => {
  const base = {
    itemCode: '1.1',
    descriptionAr: 'خرسانة',
    unit: 'M3' as const,
    contractQuantity: 22.5,
  };

  it('persists parentId and notes on the existing ProjectBOQItem payload', () => {
    const parsed = createOwnerBoqItemSchema.parse({
      ...base,
      parentId: 'parent-1',
      notes: 'ملاحظة بند',
    });
    expect(parsed.parentId).toBe('parent-1');
    expect(parsed.notes).toBe('ملاحظة بند');
  });

  it('does not add a SERVICE cost element — handwritten خدمات maps to SUBCONTRACTOR', () => {
    expect(COST_ELEMENT_TYPES).toEqual([
      'MATERIAL',
      'LABOR',
      'EQUIPMENT',
      'SUBCONTRACTOR',
      'SITE_EXPENSE',
    ]);
    expect(COST_ELEMENT_TYPES).not.toContain('SERVICE');
  });
});

describe('enterprise client invoice previous-quantity statuses', () => {
  it('counts only approved/posted/paid invoices — not draft, submitted, rejected, or reversed', () => {
    expect([...HISTORICAL_CLIENT_INVOICE_STATUSES]).toEqual([
      'CLIENT_APPROVED',
      'FINANCE_POSTED',
      'PAID',
    ]);
    for (const status of ['DRAFT', 'SUBMITTED_TO_CLIENT', 'REJECTED', 'REVERSED']) {
      expect(HISTORICAL_CLIENT_INVOICE_STATUSES).not.toContain(status);
    }
  });
});
