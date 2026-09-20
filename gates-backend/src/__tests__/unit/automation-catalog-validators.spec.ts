import prisma from '../../shared/database/prisma';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    customer: { findMany: jest.fn() },
    supplier: { findMany: jest.fn() },
    item: { findMany: jest.fn() },
    warehouse: { findMany: jest.fn() },
    customerCategory: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

import { validateAutomationConditions } from '../../modules/automation/catalog/condition-validator';
import { validateAutomationActions } from '../../modules/automation/catalog/action-validator';

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const CUSTOMER_ID = '11111111-1111-1111-1111-111111111111';

const customerFindMany = prisma.customer.findMany as jest.Mock;
const userFindMany = prisma.user.findMany as jest.Mock;
const supplierFindMany = prisma.supplier.findMany as jest.Mock;
const SUPPLIER_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('validateAutomationConditions', () => {
  it('accepts a valid number condition', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'totalAmount', operator: 'gt', value: 250000 },
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects an unsupported/unknown eventType', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'made.up.event', [])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a plannedNotEmitting event (not yet wired)', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.posted', [])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a field that does not exist on the event', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'notARealField', operator: 'eq', value: 1 },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an operator not legal for the field type', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'totalAmount', operator: 'contains', value: 1 },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a wrong-typed value for a number field', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'totalAmount', operator: 'gt', value: 'not-a-number' },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an enum value outside the allowed set', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'customer.created', [
        { field: 'priceTier', operator: 'eq', value: 'NOT_A_TIER' },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('checks entity-field ownership against the current tenant', async () => {
    customerFindMany.mockResolvedValueOnce([{ id: CUSTOMER_ID }]);
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'customerId', operator: 'eq', value: CUSTOMER_ID },
      ])
    ).resolves.toBeUndefined();
    expect(customerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_A }) })
    );
  });

  it('rejects an entity-field value that does not belong to the tenant', async () => {
    customerFindMany.mockResolvedValueOnce([]); // not found for this company
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'customerId', operator: 'eq', value: CUSTOMER_ID },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('supports the "in" operator with an array of entity ids, validating every element', async () => {
    customerFindMany.mockResolvedValueOnce([{ id: CUSTOMER_ID }]);
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'customerId', operator: 'in', value: [CUSTOMER_ID] },
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects "in" with a non-array value', async () => {
    await expect(
      validateAutomationConditions(COMPANY_A, 'sales.invoice.created', [
        { field: 'customerId', operator: 'in', value: CUSTOMER_ID },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('validateAutomationActions', () => {
  it('accepts a valid gates.createNotification action with constants', async () => {
    await expect(
      validateAutomationActions(COMPANY_A, 'sales.invoice.created', [
        { type: 'gates.createNotification', config: { title: 'Hi', message: 'Body' } },
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects an unsupported action type', async () => {
    await expect(
      validateAutomationActions(COMPANY_A, 'sales.invoice.created', [{ type: 'made.up.action' }])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a missing required config field', async () => {
    await expect(
      validateAutomationActions(COMPANY_A, 'sales.invoice.created', [
        { type: 'gates.createNotification', config: { title: 'Hi' } }, // missing message
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects an unknown config key not in the action catalog', async () => {
    await expect(
      validateAutomationActions(COMPANY_A, 'sales.invoice.created', [
        { type: 'gates.createNotification', config: { title: 'Hi', message: 'Body', notAField: 1 } },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accepts a valid event-field binding on a bindable field', async () => {
    supplierFindMany.mockResolvedValueOnce([{ id: SUPPLIER_ID }]);
    await expect(
      validateAutomationActions(COMPANY_A, 'inventory.stock.belowMinimum', [
        {
          type: 'gates.createPurchaseRequest',
          config: {
            supplierId: SUPPLIER_ID,
            quantity: { source: 'event', field: 'shortageQuantity' },
          },
        },
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects a binding referencing a field that does not exist on the rule event', async () => {
    supplierFindMany.mockResolvedValueOnce([{ id: SUPPLIER_ID }]);
    await expect(
      validateAutomationActions(COMPANY_A, 'inventory.stock.belowMinimum', [
        {
          type: 'gates.createPurchaseRequest',
          config: {
            supplierId: SUPPLIER_ID,
            quantity: { source: 'event', field: 'doesNotExist' },
          },
        },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a binding on a field the catalog marks as non-bindable', async () => {
    await expect(
      validateAutomationActions(COMPANY_A, 'inventory.stock.belowMinimum', [
        {
          type: 'gates.createPurchaseRequest',
          config: {
            supplierId: { source: 'event', field: 'itemId' }, // supplierId is not bindable
          },
        },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('checks entity-config-field ownership against the current tenant', async () => {
    userFindMany.mockResolvedValueOnce([]);
    await expect(
      validateAutomationActions(COMPANY_A, 'customer.created', [
        {
          type: 'gates.createNotification',
          config: { title: 'Hi', message: 'Body', userId: '33333333-3333-3333-3333-333333333333' },
        },
      ])
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
