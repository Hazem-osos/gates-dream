import { PrepareCreateQuotationTool } from '../../modules/ai/tools/prepare-create-quotation.tool';
import { PrepareCreateCustomerTool } from '../../modules/ai/tools/prepare-create-customer.tool';
import { ProposeTransactionDraftTool } from '../../modules/ai/tools/draft-action.tools';
import type { WriteCatalogPort } from '../../modules/ai/actions/write-catalog.port';
import type { SecurityContext } from '../../modules/ai/tools/types';

const COMPANY_A = '11111111-1111-4111-8111-111111111111';
const COMPANY_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';
const CONV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function context(overrides: Partial<SecurityContext> = {}): SecurityContext {
  return {
    userId: 'user-a',
    companyId: COMPANY_A,
    conversationId: CONV_ID,
    permissions: ['invoice:edit', 'customer:edit'],
    ...overrides,
  };
}

function catalog(overrides: Partial<WriteCatalogPort> = {}): WriteCatalogPort {
  return {
    findCustomer: jest.fn().mockResolvedValue({
      id: CUSTOMER_ID,
      arabicName: 'عميل أ',
      currencyCode: 'EGP',
      priceTier: 'RETAIL',
      phone1: '0100',
      mobile: '0100',
    }),
    findItems: jest.fn().mockResolvedValue([
      {
        id: ITEM_ID,
        arabicName: 'صنف',
        isService: false,
        isTaxExempt: true,
        defaultTaxPercent: 0,
        priceRetail: 100,
        priceSemiWholesale: 90,
        priceWholesale: 80,
        priceProjects: 70,
        retailPrice: 100,
        consumerPrice: 100,
        unitId: '55555555-5555-4555-8555-555555555555',
        unitName: 'قطعة',
        conversionFactor: 1,
      },
    ]),
    findWarehouse: jest.fn().mockResolvedValue({ id: 'wh', arabicName: 'رئيسي' }),
    findCustomerByName: jest.fn().mockResolvedValue({
      id: CUSTOMER_ID,
      arabicName: 'عميل أ',
      currencyCode: 'EGP',
      priceTier: 'RETAIL',
      phone1: '0100',
      mobile: '0100',
    }),
    findSupplier: jest.fn().mockResolvedValue({ id: CUSTOMER_ID, arabicName: 'مورد أ', currencyCode: 'EGP' }),
    findSupplierByName: jest.fn().mockResolvedValue({
      id: CUSTOMER_ID,
      arabicName: 'مورد أ',
      currencyCode: 'EGP',
    }),
    findItemByName: jest.fn().mockResolvedValue({
      id: ITEM_ID,
      arabicName: 'صنف',
      isService: false,
      isTaxExempt: true,
      defaultTaxPercent: 0,
      priceRetail: 100,
      priceSemiWholesale: 90,
      priceWholesale: 80,
      priceProjects: 70,
      retailPrice: 100,
      consumerPrice: 100,
      unitId: '55555555-5555-4555-8555-555555555555',
      unitName: 'قطعة',
      conversionFactor: 1,
    }),
    findWarehouseByName: jest.fn().mockResolvedValue({ id: 'wh', arabicName: 'رئيسي' }),
    findDefaultSafe: jest.fn().mockResolvedValue({ id: 'safe', arabicName: 'خزينة' }),
    getWarehouseQty: jest.fn().mockResolvedValue(50),
    findDuplicateCustomer: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('Gates AI pending write actions', () => {
  it('prepareCreateQuotation never executes a write and ignores LLM companyId', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'action-1',
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const tool = new PrepareCreateQuotationTool(catalog(), { create } as never);

    const result = await tool.execute(
      {
        customerId: CUSTOMER_ID,
        items: [{ itemId: ITEM_ID, quantity: 2 }],
        companyId: COMPANY_B,
      },
      context()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.actionId).toBe('action-1');
      expect(result.data.confirmationRequired).toBe(true);
      expect(result.data.totals?.total).toBe(200);
    }
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY_A,
        conversationId: CONV_ID,
        actionType: 'CREATE_QUOTATION',
        requiredPermission: 'invoice:edit',
      })
    );
    expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(COMPANY_B);
  });

  it('prepareCreateCustomer blocks without permission and checks duplicates', async () => {
    const create = jest.fn();
    const port = catalog({
      findDuplicateCustomer: jest.fn().mockResolvedValue({
        id: 'dup',
        arabicName: 'عميل سابق',
        field: 'phone',
      }),
    });
    const tool = new PrepareCreateCustomerTool(port, { create } as never);

    const denied = await tool.execute({ nameAr: 'جديد', phone: '0100' }, context({ permissions: [] }));
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe('PERMISSION_DENIED');
    expect(create).not.toHaveBeenCalled();

    const duplicate = await tool.execute({ nameAr: 'جديد', phone: '0100' }, context());
    expect(duplicate.ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('propose_transaction_draft resolves names and never writes the invoice', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'action-draft-1',
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    const tool = new ProposeTransactionDraftTool(catalog(), { create } as never);

    const result = await tool.execute(
      {
        actionType: 'DRAFT_SALES_INVOICE',
        titleAr: 'مسودة فاتورة مبيعات - شركة المقاولون العرب',
        summary: { partyName: 'المقاولون العرب', warehouseName: 'العاصمة', totalAmount: 420000 },
        previewLines: [{ name: 'حديد تسليح 12 مم', quantity: 10, unitPrice: 42000, total: 420000 }],
      },
      context()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isActionCard).toBe(true);
      expect(result.data.actionCard?.summary.totalAmount).toBe(420000);
      expect(result.data.actionCard?.draftPayload.customerId).toBe(CUSTOMER_ID);
    }
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'DRAFT_SALES_INVOICE',
        companyId: COMPANY_A,
      })
    );
  });
});
