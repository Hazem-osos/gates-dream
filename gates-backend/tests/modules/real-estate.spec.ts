import { money, sumMoney } from '../../src/modules/subcontracts/utils/money-decimal';
import {
  InstallmentMismatchError,
  ResaleTransferBlockedError,
} from '../../src/modules/real-estate/errors/real-estate-domain.errors';
import { installmentScheduleService } from '../../src/modules/real-estate/services/installment-schedule.service';
import { lateFeeCalculationService } from '../../src/modules/real-estate/services/late-fee-calculation.service';
import { pdcPortfolioService } from '../../src/modules/real-estate/services/pdc-portfolio.service';
import { unitResaleTransferService } from '../../src/modules/real-estate/services/unit-resale-transfer.service';
import { unitCancellationSettlementService } from '../../src/modules/real-estate/services/unit-cancellation-settlement.service';
import { rentalPoolDistributionService } from '../../src/modules/real-estate/services/rental-pool-distribution.service';
import { realEstateAccountingService } from '../../src/modules/real-estate/services/real-estate-accounting.service';
import { DEFAULT_FORFEITURE_PENALTY_RATE } from '../../src/modules/real-estate/types/portfolio.types';
import { makeInstallment, TEST_COMPANY_ID, TEST_USER_ID } from '../helpers/module-test-factory';

jest.mock('../../src/modules/automation/producers/domain-event.producer', () => ({
  enqueueChequeBouncedJob: jest.fn().mockResolvedValue(undefined),
  enqueueUnitCancellationReleasedJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn((globalThis as { __reTx?: unknown }).__reTx)),
    postDatedCheque: { findFirst: jest.fn(), update: jest.fn() },
    unitInstallment: { findFirst: jest.fn(), update: jest.fn() },
    unitContract: { findFirst: jest.fn() },
    bankAccount: { findFirst: jest.fn().mockResolvedValue(null) },
  },
}));

jest.mock('../../src/modules/real-estate/services/real-estate-account-resolver.service', () => ({
  realEstateAccountResolverService: {
    resolveAccounts: jest.fn().mockResolvedValue({
      bankAccountId: 'acc-bank',
      pdcUnderCollectionAccountId: 'acc-pdc',
    }),
  },
}));

jest.mock('../../src/modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: {
    createAndPostInTx: jest.fn().mockResolvedValue({ id: 'je-pdc-1' }),
  },
}));

jest.mock('../../src/modules/platform/services/document-sequence.service', () => ({
  documentSequenceService: { nextGlNumber: jest.fn().mockResolvedValue('00000099') },
}));

jest.mock('../../src/modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn().mockResolvedValue('fy-1') },
}));

import prisma from '../../src/shared/database/prisma';

type LateFeeHarness = {
  settleInstallmentPaymentInTx: typeof lateFeeCalculationService.settleInstallmentPaymentInTx;
};

function installmentTx(row: ReturnType<typeof makeInstallment>) {
  return {
    unitInstallment: {
      findFirst: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
    },
  };
}

describe('Module B — Real Estate, PDCs & portfolio', () => {
  describe('installment schedule generation', () => {
    it('sums installments to totalSellingPrice + maintenanceDeposit', () => {
      const selling = money(1_000_000);
      const maintenance = money(50_000);
      const lines = installmentScheduleService.buildContractScheduleLines(
        selling,
        maintenance,
        new Date('2026-01-01T00:00:00Z'),
        new Date('2027-01-01T00:00:00Z'),
        {
          reservation: { amount: 100_000 },
          contractingDownpayment: { amount: 100_000 },
          delivery: { amount: 100_000 },
          regular: { frequency: 'MONTHLY', count: 10 },
        }
      );

      const total = sumMoney(lines.map((line) => line.originalAmount));
      expect(total.toFixed(4)).toBe(money(1_050_000).toFixed(4));
      expect(lines.some((line) => line.installmentType === 'MAINTENANCE_DEPOSIT')).toBe(true);
    });

    it('throws InstallmentMismatchError when allocated amounts differ by even 1 cent', () => {
      expect(() =>
        installmentScheduleService.buildContractScheduleLines(
          money('100.00'),
          money(0),
          new Date('2026-01-01T00:00:00Z'),
          null,
          {
            reservation: { amount: '100.01' },
            regular: { frequency: 'MONTHLY', count: 0 },
          }
        )
      ).toThrow(InstallmentMismatchError);
    });
  });

  describe('late fees & settlement allocation', () => {
    it('accrues late fee as balance * dailyLateFeeRate * daysOverdue', async () => {
      const row = makeInstallment({
        amount: money(10_000),
        balance: money(10_000),
        dailyLateFeeRate: money('0.0005'),
        dueDate: new Date('2026-01-01T00:00:00Z'),
        status: 'UNPAID',
      });
      const db = {
        unitInstallment: {
          findMany: jest.fn().mockResolvedValue([row]),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ ...row, ...data })
          ),
        },
      };

      const result = await lateFeeCalculationService.calculateAndApplyOverdueLateFeesInTx(
        db as never,
        TEST_COMPANY_ID,
        new Date('2026-01-11T00:00:00Z')
      );

      expect(result.processedCount).toBe(1);
      expect(result.installments[0].accumulatedLateFee.toFixed(4)).toBe('50.0000');
      expect(result.installments[0].status).toBe('OVERDUE');
    });

    it('LATE_FEES_FIRST clears accumulatedLateFee before reducing principal', async () => {
      const row = makeInstallment({
        amount: money(10_000),
        originalAmount: money(10_000),
        paidAmount: money(0),
        accumulatedLateFee: money(50),
        status: 'OVERDUE',
      });
      const db = installmentTx(row);
      const settled = await lateFeeCalculationService.settleInstallmentPaymentInTx(
        db as never,
        TEST_COMPANY_ID,
        row.id,
        150,
        { allocation: 'LATE_FEES_FIRST' }
      );

      expect(settled.allocatedToLateFees.toFixed(4)).toBe('50.0000');
      expect(settled.allocatedToPrincipal.toFixed(4)).toBe('100.0000');
      expect(settled.accumulatedLateFee.toFixed(4)).toBe('0.0000');
      expect(settled.balance.toFixed(4)).toBe('9900.0000');
    });

    it('PRINCIPAL_FIRST reduces balance before late fees', async () => {
      const row = makeInstallment({
        amount: money(10_000),
        originalAmount: money(10_000),
        paidAmount: money(0),
        accumulatedLateFee: money(50),
        status: 'OVERDUE',
      });
      const db = installmentTx(row);
      const settled = await (lateFeeCalculationService as unknown as LateFeeHarness).settleInstallmentPaymentInTx(
        db as never,
        TEST_COMPANY_ID,
        row.id,
        150,
        { allocation: 'PRINCIPAL_FIRST' }
      );

      expect(settled.allocatedToPrincipal.toFixed(4)).toBe('150.0000');
      expect(settled.allocatedToLateFees.toFixed(4)).toBe('0.0000');
      expect(settled.balance.toFixed(4)).toBe('9850.0000');
      expect(settled.accumulatedLateFee.toFixed(4)).toBe('50.0000');
    });
  });

  describe('PDC lifecycle', () => {
    it('CLEARED_COLLECTED settles the linked installment to PAID and returns Dr Bank / Cr PDC payload', async () => {
      const installment = makeInstallment({
        id: 'inst-pdc',
        amount: money(5_000),
        originalAmount: money(5_000),
        paidAmount: money(0),
        accumulatedLateFee: money(0),
        status: 'UNPAID',
      });
      const cheque = {
        id: 'pdc-1',
        companyId: TEST_COMPANY_ID,
        unitContractId: 'uc-1',
        unitInstallmentId: 'inst-pdc',
        chequeNumber: 'CHQ-9',
        amount: money(5_000),
        status: 'DEPOSITED_UNDER_COLLECTION',
        journalEntryId: null,
        collectionDate: null,
      };

      const tx = {
        postDatedCheque: {
          findFirst: jest.fn().mockResolvedValue(cheque),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(cheque, data);
            return Promise.resolve({ ...cheque });
          }),
        },
        unitInstallment: {
          findFirst: jest.fn().mockResolvedValue(installment),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(installment, data);
            return Promise.resolve({ ...installment });
          }),
        },
        unitContract: { findFirst: jest.fn() },
      };
      (globalThis as { __reTx?: typeof tx }).__reTx = tx;
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));

      const cleared = await pdcPortfolioService.clearCheque(TEST_COMPANY_ID, cheque.id, new Date('2026-02-01'));
      expect(cleared.cheque.status).toBe('CLEARED_COLLECTED');
      expect(cleared.settlement?.status).toBe('PAID');
      expect(cleared.journalEntry.sourceType).toBe('PDC_CLEARED');
      expect(cleared.journalEntry.amount.toFixed(4)).toBe('5000.0000');

      const accounting = realEstateAccountingService as unknown as {
        resolveBankGlAccountId: (companyId: string, fallback: string) => Promise<string>;
        post: (
          db: unknown,
          ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string },
          payload: { lines: Array<{ debit: number; credit: number; accountId: string }> }
        ) => Promise<{ id: string }>;
      };
      jest.spyOn(accounting, 'resolveBankGlAccountId').mockResolvedValue('acc-bank');
      const postSpy = jest.spyOn(accounting, 'post').mockResolvedValue({ id: 'je-pdc-1' });

      await realEstateAccountingService.postPdcClearanceInTx(tx as never, TEST_COMPANY_ID, cheque.id, {
        companyId: TEST_COMPANY_ID,
        branchId: 'br-1',
        fiscalYearId: 'fy-1',
        userId: TEST_USER_ID,
      });

      const postedLines = postSpy.mock.calls[0][2].lines;
      const debit = postedLines.reduce((sum, line) => sum + line.debit, 0);
      const credit = postedLines.reduce((sum, line) => sum + line.credit, 0);
      expect(debit).toBeCloseTo(credit, 4);
      expect(postedLines[0].accountId).toBe('acc-bank');
      expect(postedLines[0].debit).toBe(5_000);
      expect(postedLines[1].accountId).toBe('acc-pdc');
      expect(postedLines[1].credit).toBe(5_000);
    });

    it('BOUNCED_RETURNED re-flags the linked installment as OVERDUE', async () => {
      const installment = makeInstallment({
        id: 'inst-bounce',
        amount: money(5_000),
        originalAmount: money(5_000),
        dueDate: new Date('2026-01-01T00:00:00Z'),
        status: 'UNPAID',
      });
      const cheque = {
        id: 'pdc-bounce',
        companyId: TEST_COMPANY_ID,
        unitContractId: 'uc-1',
        unitInstallmentId: 'inst-bounce',
        amount: money(5_000),
        status: 'DEPOSITED_UNDER_COLLECTION',
      };

      const tx = {
        postDatedCheque: {
          findFirst: jest.fn().mockResolvedValue(cheque),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(cheque, data);
            return Promise.resolve({ ...cheque });
          }),
        },
        unitInstallment: {
          findFirst: jest.fn().mockResolvedValue(installment),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(installment, data);
            return Promise.resolve({ ...installment });
          }),
        },
        unitContract: { findFirst: jest.fn().mockResolvedValue({ customerId: 'cust-1' }) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));

      const bounced = await pdcPortfolioService.bounceCheque(TEST_COMPANY_ID, cheque.id, 'NSF');
      expect(bounced.cheque.status).toBe('BOUNCED_RETURNED');
      expect(bounced.installment?.status).toBe('OVERDUE');
    });
  });

  describe('resale transfer lock', () => {
    it('blocks clearance while overdue installments remain', async () => {
      const transfer = {
        id: 'rst-1',
        unitContractId: 'uc-1',
        clearanceStatus: 'PENDING_CLEARANCE',
        approvedByUserId: null,
      };
      const contract = {
        id: 'uc-1',
        companyId: TEST_COMPANY_ID,
        status: 'RESALE_IN_PROGRESS',
        resaleLock: true,
        installments: [
          makeInstallment({
            status: 'OVERDUE',
            balance: money(2_000),
            dueDate: new Date('2025-01-01T00:00:00Z'),
          }),
        ],
      };
      const db = {
        unitResaleTransfer: { findFirst: jest.fn().mockResolvedValue(transfer) },
        unitContract: { findFirst: jest.fn().mockResolvedValue(contract) },
      };

      await expect(
        unitResaleTransferService.clearAndExecuteTransferInTx(db as never, TEST_COMPANY_ID, transfer.id, 'PAY-1')
      ).rejects.toBeInstanceOf(ResaleTransferBlockedError);
    });

    it('collects assignment fee, unlocks resaleLock, marks TRANSFERRED and clones a successor', async () => {
      const remaining = makeInstallment({
        id: 'inst-open',
        installmentNumber: 3,
        amount: money(200_000),
        originalAmount: money(200_000),
        balance: money(200_000),
        status: 'UNPAID',
        dueDate: new Date('2027-01-01T00:00:00Z'),
      });
      const contract = {
        id: 'uc-1',
        companyId: TEST_COMPANY_ID,
        unitId: 'unit-1',
        propertyUnitId: 'pu-1',
        customerId: 'seller-1',
        contractNumber: 'RE-100',
        status: 'RESALE_IN_PROGRESS',
        resaleLock: true,
        deliveryDate: new Date('2027-06-01T00:00:00Z'),
        maintenanceAmount: money(10_000),
        maintenanceDeposit: money(10_000),
        paymentPlanType: 'EQUAL_INSTALLMENTS',
        installments: [remaining],
      };
      const transfer = {
        id: 'rst-2',
        unitContractId: 'uc-1',
        newBuyerCustomerId: 'buyer-2',
        clearanceStatus: 'PENDING_CLEARANCE',
        approvedByUserId: null,
        assignmentFeeAmount: money(25_000),
        currentUnitMarketValue: money(500_000),
      };
      const created: Record<string, unknown>[] = [];
      const db = {
        unitResaleTransfer: {
          findFirst: jest.fn().mockResolvedValue(transfer),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(transfer, data);
            return Promise.resolve({ ...transfer });
          }),
        },
        unitContract: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(contract)
            .mockResolvedValue({ id: 'uc-successor', installments: created, customerId: 'buyer-2' }),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(contract, data);
            return Promise.resolve({ ...contract });
          }),
          create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            return Promise.resolve({ id: 'uc-successor', ...data });
          }),
          count: jest.fn().mockResolvedValue(0),
        },
        unitInstallment: {
          create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            created.push(data);
            return Promise.resolve(data);
          }),
        },
      };

      const result = await unitResaleTransferService.clearAndExecuteTransferInTx(
        db as never,
        TEST_COMPANY_ID,
        transfer.id,
        'FEE-REF-1',
        TEST_USER_ID
      );

      expect(result.transfer.isAssignmentFeePaid).toBe(true);
      expect(result.transfer.clearanceStatus).toBe('FINANCIALLY_CLEARED');
      expect(contract.status).toBe('TRANSFERRED');
      expect(contract.resaleLock).toBe(false);
      expect(result.successorContract).toBeTruthy();
      expect(db.unitContract.create).toHaveBeenCalled();
    });
  });

  describe('cancellation & forfeiture', () => {
    it('computes forfeiture = sellingPrice * rate and netRefundable = max(0, paid - penalty)', async () => {
      const contract = {
        id: 'uc-cancel',
        companyId: TEST_COMPANY_ID,
        unitId: 'unit-1',
        propertyUnitId: 'pu-1',
        status: 'ACTIVE',
        totalSellingPrice: money(1_000_000),
        totalContractAmount: money(1_000_000),
        installments: [
          makeInstallment({ paidAmount: money(80_000), balance: money(20_000), status: 'PARTIALLY_PAID' }),
        ],
        postDatedCheques: [
          { id: 'pdc-future', status: 'UNDER_SAFE_CUSTODY', amount: money(50_000), unitInstallmentId: 'inst-2' },
        ],
      };
      const updates: Record<string, unknown>[] = [];
      const db = {
        unitContract: {
          findFirst: jest.fn().mockResolvedValue(contract),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            Object.assign(contract, data);
            return Promise.resolve({ ...contract });
          }),
        },
        unitCancellationSettlement: {
          create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: 'set-1', cancellationDate: new Date(), ...data })
          ),
        },
        unitInstallment: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        postDatedCheque: {
          updateMany: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
            updates.push(args.data);
            return Promise.resolve({ count: 1 });
          }),
        },
        propertyUnit: {
          update: jest.fn().mockResolvedValue({ id: 'pu-1', status: 'AVAILABLE' }),
        },
        realEstateUnit: {
          update: jest.fn().mockResolvedValue({ id: 'unit-1', status: 'AVAILABLE' }),
        },
      };

      const lowPaid = await unitCancellationSettlementService.processContractCancellationInTx(
        db as never,
        TEST_COMPANY_ID,
        contract.id,
        { forfeiturePenaltyRate: DEFAULT_FORFEITURE_PENALTY_RATE }
      );
      expect(lowPaid.forfeiturePenaltyAmount.toFixed(4)).toBe('100000.0000');
      expect(lowPaid.netRefundableToClient.toFixed(4)).toBe('0.0000');
      expect(contract.status).toBe('TERMINATED_FORFEITED');
      expect(db.postDatedCheque.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REPLACED_CANCELLED' }),
        })
      );
      expect(db.propertyUnit.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'AVAILABLE' } })
      );

      contract.status = 'ACTIVE';
      contract.installments = [
        makeInstallment({ paidAmount: money(150_000), balance: money(0), status: 'PAID' }),
      ];
      const highPaid = await unitCancellationSettlementService.processContractCancellationInTx(
        db as never,
        TEST_COMPANY_ID,
        contract.id,
        { forfeiturePenaltyRate: '0.10' }
      );
      expect(highPaid.netRefundableToClient.toFixed(4)).toBe('50000.0000');
    });
  });

  describe('rental pool distribution', () => {
    it('splits net operational profit into developer fee and owner payable', async () => {
      const db = {
        rentalPoolAgreement: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'rpa-1',
            companyId: TEST_COMPANY_ID,
            isActive: true,
            managementFeeRate: money('0.10'),
            ownerCustomerId: 'owner-1',
          }),
        },
        rentalDistribution: {
          create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
            Promise.resolve({ id: 'rd-1', ...data })
          ),
        },
      };

      const result = await rentalPoolDistributionService.calculateAndDistributeRentInTx(db as never, TEST_COMPANY_ID, 'rpa-1', {
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
        grossRentCollected: 100_000,
        operatingExpenses: 20_000,
        maintenanceReserveDeduction: 5_000,
      });

      expect(result.netOperationalProfit.toFixed(4)).toBe('75000.0000');
      expect(result.developerManagementFee.toFixed(4)).toBe('7500.0000');
      expect(result.distributableToOwner.toFixed(4)).toBe('67500.0000');
    });
  });
});
