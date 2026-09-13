import {
  BoqLimitExceededError,
  InvoiceImmutableError,
  InvoiceStateError,
} from '../../src/modules/subcontracts/errors/subcontract-domain.errors';
import { subcontractInvoiceCalculationService } from '../../src/modules/subcontracts/services/subcontract-invoice-calculation.service';
import { materialReconciliationService } from '../../src/modules/subcontracts/services/material-reconciliation.service';
import { subcontractAccountingService } from '../../src/modules/subcontracts/services/subcontract-accounting.service';
import { subcontractInvoiceCommandService } from '../../src/modules/subcontracts/services/subcontract-invoice-command.service';
import { money, MONEY_SCALE } from '../../src/modules/subcontracts/utils/money-decimal';
import { UnbalancedJournalEntryError } from '../../src/shared/errors/unbalanced-journal-entry.error';
import {
  makeBoqItem,
  makeCalcDb,
  makePostedInvoice,
  makePriorInvoice,
  makeSubcontract,
  SUBCONTRACT_GL_ACCOUNTS,
  TEST_COMPANY_ID,
} from '../helpers/module-test-factory';

jest.mock('../../src/modules/automation/producers/domain-event.producer', () => ({
  enqueueSubcontractInvoiceWorkflowJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    subcontractInvoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import prisma from '../../src/shared/database/prisma';

type AccountingHarness = {
  buildInvoiceLines: (
    invoice: ReturnType<typeof makePostedInvoice>,
    accounts: typeof SUBCONTRACT_GL_ACCOUNTS
  ) => Array<{ accountId: string; debit: number; credit: number; description: string }>;
};

type CommandHarness = {
  assertMutable: (invoice: { id: string; status: string }) => void;
};

describe('Module A — Subcontracts & Mostakhlassat', () => {
  describe('BOQ limits', () => {
    it('allows a draft invoice whose cumulative qty stays within maxAllowedQuantity', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({
          boqItems: [makeBoqItem({ maxAllowedQuantity: money(110) })],
        }),
      });

      const result = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 100 }],
      });

      expect(result.lines[0].totalCumulativeQuantity.toFixed(4)).toBe('100.0000');
      expect(result.grossCurrentAmount.toFixed(4)).toBe('100000.0000');
      expect(result.netPayableAmount.lte(result.grossCurrentAmount)).toBe(true);
    });

    it('throws BoqLimitExceededError 422 with breach details when cumulative > maxAllowed', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({
          boqItems: [makeBoqItem({ maxAllowedQuantity: money(110) })],
        }),
        priorInvoices: [makePriorInvoice()],
      });

      try {
        await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
          companyId: TEST_COMPANY_ID,
          subcontractId: 'sc-1',
          items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 61 }],
        });
        fail('expected BoqLimitExceededError');
      } catch (error) {
        expect(error).toBeInstanceOf(BoqLimitExceededError);
        const err = error as BoqLimitExceededError;
        expect(err.statusCode).toBe(422);
        expect(err.code).toBe('BOQ_LIMIT_EXCEEDED');
        const breaches = (err.details as { breaches: Array<Record<string, string>> }).breaches;
        expect(breaches).toHaveLength(1);
        expect(breaches[0]).toMatchObject({
          subcontractBOQItemId: 'boq-1',
          itemCode: '1.1',
          previousQuantity: '50.0000',
          currentQuantity: '61.0000',
          totalCumulativeQuantity: '111.0000',
          maxAllowedQuantity: '110.0000',
        });
      }
    });
  });

  describe('deduction engine', () => {
    it('stops advance recovery once cumulative recovered equals advancePaymentTotal', async () => {
      const dbFirst = makeCalcDb({
        subcontract: makeSubcontract({ advancePaymentTotal: money(10_000), advancePaymentRecoveryRate: money('0.10') }),
      });
      const first = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(dbFirst as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 50 }],
      });
      expect(first.grossCurrentAmount.toFixed(4)).toBe('50000.0000');
      expect(first.deductions.advancePaymentDeduction.toFixed(4)).toBe('5000.0000');
      expect(first.deductions.remainingAdvanceBalanceAfter.toFixed(4)).toBe('5000.0000');

      const dbSecond = makeCalcDb({
        subcontract: makeSubcontract({ advancePaymentTotal: money(10_000), advancePaymentRecoveryRate: money('0.10') }),
        priorInvoices: [
          makePriorInvoice({
            advancePaymentDeduction: money(10_000),
            items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: money(50) }],
          }),
        ],
      });
      const second = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(dbSecond as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 40 }],
      });
      expect(second.deductions.advancePaymentDeduction.toFixed(4)).toBe('0.0000');
      expect(second.deductions.remainingAdvanceBalanceBefore.toFixed(4)).toBe('0.0000');
    });

    it('deducts retention at the contract rate on gross current (5%)', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({ retentionRate: money('0.05') }),
      });
      const result = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 80 }],
      });
      expect(result.grossCurrentAmount.toFixed(4)).toBe('80000.0000');
      expect(result.deductions.retentionDeduction.toFixed(4)).toBe('4000.0000');
    });

    it('computes material overuse: excess = actual - standard*(1+scrapTolerance); penalty = excess * price * (1+overhead)', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({
          standardScrapToleranceRate: money('0.05'),
          contractAdminOverheadRate: money('0.10'),
        }),
      });

      const result = await materialReconciliationService.calculateMaterialOverusePenaltyInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        materialId: 'item-1',
        standardEngineeredQty: 100,
        actualIssuedQty: 120,
        marketPricePerUnit: 50,
      });

      expect(result.allowedThreshold.toFixed(4)).toBe('105.0000');
      expect(result.scrapExcessQty.toFixed(4)).toBe('15.0000');
      expect(result.rawPenalty.toFixed(4)).toBe('750.0000');
      expect(result.overheadAmount.toFixed(4)).toBe('75.0000');
      expect(result.totalPenaltyAmount.toFixed(4)).toBe('825.0000');
    });

    it('applies early-payment discount only when the flag is true', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({ earlyPaymentDiscountRate: money('0.02') }),
      });

      const withFlag = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 100 }],
        applyEarlyPaymentDiscount: true,
      });
      const withoutFlag = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 100 }],
        applyEarlyPaymentDiscount: false,
      });

      expect(withFlag.deductions.earlyPaymentDiscountDeduction.toFixed(4)).toBe('2000.0000');
      expect(withoutFlag.deductions.earlyPaymentDiscountDeduction.toFixed(4)).toBe('0.0000');
      expect(withFlag.netPayableAmount.lt(withoutFlag.netPayableAmount)).toBe(true);
    });

    it('computes net payable at Decimal(18,4) and allows a negative payable', async () => {
      const db = makeCalcDb({
        subcontract: makeSubcontract({
          advancePaymentTotal: money(0),
          advancePaymentRecoveryRate: money(0),
          retentionRate: money('0.05'),
          taxWithholdingRate: money('0.01'),
          socialInsuranceRate: money(0),
        }),
        penalties: [{ id: 'pen-1', amount: money(90_000) }],
        materials: [{ id: 'mat-1', totalPenaltyAmount: money(20_000) }],
      });

      const result = await subcontractInvoiceCalculationService.calculateDraftInvoiceInTx(db as never, {
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        items: [{ subcontractBOQItemId: 'boq-1', currentQuantity: 100 }],
      });

      expect(result.grossCurrentAmount.decimalPlaces()).toBeLessThanOrEqual(MONEY_SCALE);
      expect(result.netPayableAmount.toFixed(4)).toBe('-16000.0000');
      expect(result.netPayableAmount.isNegative()).toBe(true);
    });
  });

  describe('workflow & immutability', () => {
    const command = subcontractInvoiceCommandService as unknown as CommandHarness;

    it('rejects FINANCE_POSTED mutation with InvoiceImmutableError', () => {
      expect(() => command.assertMutable({ id: 'inv-1', status: 'FINANCE_POSTED' })).toThrow(InvoiceImmutableError);
      try {
        command.assertMutable({ id: 'inv-1', status: 'FINANCE_POSTED' });
      } catch (error) {
        const err = error as InvoiceImmutableError;
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('INVOICE_IMMUTABLE');
      }
    });

    it('enforces the approval sequence DRAFT → SITE_SUBMITTED → CONSULTANT → TECH → POSTED', async () => {
      const row = {
        id: 'inv-seq',
        companyId: TEST_COMPANY_ID,
        subcontractId: 'sc-1',
        invoiceNumber: 'SC-1-001',
        netPayableAmount: money(1),
        status: 'DRAFT',
        items: [],
      };

      const tx = {
        subcontractInvoice: {
          findFirst: jest.fn().mockResolvedValue(row),
          update: jest.fn().mockImplementation(({ data }: { data: { status: string } }) => {
            row.status = data.status;
            return Promise.resolve({ ...row, items: [] });
          }),
        },
        materialReconciliationLog: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        sitePenaltyAndSnag: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        directExecutionCharge: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));

      await expect(subcontractInvoiceCommandService.approveByConsultant(TEST_COMPANY_ID, row.id)).rejects.toBeInstanceOf(
        InvoiceStateError
      );

      await subcontractInvoiceCommandService.submitToSiteEngineer(TEST_COMPANY_ID, row.id);
      expect(row.status).toBe('SITE_SUBMITTED');

      await expect(subcontractInvoiceCommandService.approveByTechOffice(TEST_COMPANY_ID, row.id)).rejects.toBeInstanceOf(
        InvoiceStateError
      );

      await subcontractInvoiceCommandService.approveByConsultant(TEST_COMPANY_ID, row.id);
      expect(row.status).toBe('CONSULTANT_APPROVED');

      await subcontractInvoiceCommandService.approveByTechOffice(TEST_COMPANY_ID, row.id);
      expect(row.status).toBe('TECH_OFFICE_APPROVED');

      await expect(subcontractInvoiceCommandService.submitToSiteEngineer(TEST_COMPANY_ID, row.id)).rejects.toBeInstanceOf(
        InvoiceStateError
      );
    });
  });

  describe('double-entry GL', () => {
    const accounting = subcontractAccountingService as unknown as AccountingHarness;

    it('posts Dr WIP = gross and credits that sum to the same total', () => {
      const invoice = makePostedInvoice();
      const lines = accounting.buildInvoiceLines(invoice, SUBCONTRACT_GL_ACCOUNTS);
      const debit = lines.reduce((sum, line) => sum + line.debit, 0);
      const credit = lines.reduce((sum, line) => sum + line.credit, 0);

      expect(debit).toBeCloseTo(credit, 4);
      expect(debit).toBeCloseTo(100_000, 4);

      const byAccount = Object.fromEntries(lines.map((line) => [line.accountId, line]));
      expect(byAccount['acc-wip'].debit).toBe(100_000);
      expect(byAccount['acc-advance'].credit).toBe(10_000);
      expect(byAccount['acc-retention'].credit).toBe(5_000);
      expect(byAccount['acc-wht'].credit).toBe(1_000);
      expect(byAccount['acc-penalty'].credit).toBe(1_500);
      expect(byAccount['acc-ap'].credit).toBe(76_500);
    });

    it('throws UnbalancedJournalEntryError when credits do not equal gross', () => {
      const invoice = makePostedInvoice({ netPayableAmount: money(1) });
      expect(() => accounting.buildInvoiceLines(invoice, SUBCONTRACT_GL_ACCOUNTS)).toThrow(UnbalancedJournalEntryError);
    });
  });
});
