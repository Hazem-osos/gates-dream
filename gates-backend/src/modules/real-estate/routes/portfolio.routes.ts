import { Router } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { isAdminRequest } from '../../../shared/auth/roles.util';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validateBody, validateParams } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { journalEntryService } from '../../accounting/services/journal-entry.service';
import {
  cancellationSettlementSchema,
  generateScheduleSchema,
  idParamSchema,
  pdcBatchRegisterSchema,
  pdcBounceSchema,
  pdcClearSchema,
  pdcDepositSchema,
  pdcReplaceSchema,
  rentalPoolDistributionSchema,
  resaleClearanceSchema,
  resaleTransferRequestSchema,
  type GenerateScheduleInput,
} from '../schemas/real-estate.validation';
import { installmentScheduleService } from '../services/installment-schedule.service';
import { pdcPortfolioService } from '../services/pdc-portfolio.service';
import { realEstateAccountingService } from '../services/real-estate-accounting.service';
import { rentalPoolDistributionService } from '../services/rental-pool-distribution.service';
import { unitCancellationSettlementService } from '../services/unit-cancellation-settlement.service';
import { unitResaleTransferService } from '../services/unit-resale-transfer.service';
import { realEstateDashboardService } from '../services/real-estate-dashboard.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function requireCompanyId(req: AuthRequest): string {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return companyId;
}

function postingContext(req: AuthRequest) {
  return journalEntryService.buildPostingContext(
    requireCompanyId(req),
    req.branchId,
    req.user?.sub ?? 'system',
    req.fiscalYearId,
    isAdminRequest(req)
  );
}

router.get(
  '/dashboard/summary',
  authorize({ resource: 'invoice', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await realEstateDashboardService.getSummary(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/cheques',
  authorize({ resource: 'invoice', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await pdcPortfolioService.listPortfolio(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/resale',
  authorize({ resource: 'invoice', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await unitResaleTransferService.listTransfers(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

router.get(
  '/rental-pools',
  authorize({ resource: 'invoice', action: 'view' }),
  asyncHandler(async (req, res) => {
    const data = await rentalPoolDistributionService.listAgreements(requireCompanyId(req as AuthRequest));
    res.json({ status: 'success', data });
  })
);

function scheduleParams(body: GenerateScheduleInput) {
  const downpaymentRate = body.contractingDownpaymentRate ?? body.downpaymentRate;
  return {
    reservation: body.reservationRate ? { rateOfSellingPrice: body.reservationRate } : undefined,
    contractingDownpayment: downpaymentRate ? { rateOfSellingPrice: downpaymentRate } : undefined,
    delivery: body.deliveryRate
      ? { rateOfSellingPrice: body.deliveryRate, dueDate: body.deliveryDueDate }
      : undefined,
    regular: {
      frequency: body.frequency,
      count: body.installmentCount,
      startDate: body.regularStartDate,
    },
    annualBalloons: body.annualBalloons ?? body.balloons,
    maintenanceDueDate: body.maintenanceDueDate,
    dailyLateFeeRate: body.dailyLateFeeRate,
    replaceExisting: body.replaceExisting ?? true,
  };
}

router.post(
  '/contracts/:id/schedule',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(generateScheduleSchema),
  asyncHandler(async (req, res) => {
    const data = await installmentScheduleService.generateContractSchedule(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      scheduleParams(req.body)
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:id/cheques/batch',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(pdcBatchRegisterSchema),
  asyncHandler(async (req, res) => {
    const data = await pdcPortfolioService.registerCheques(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body.cheques
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.patch(
  '/cheques/:id/deposit',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(pdcDepositSchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const chequeIds = req.body.chequeIds?.length ? req.body.chequeIds : [req.params.id];
    const data = await pdcPortfolioService.depositChequesUnderCollection(
      companyId,
      chequeIds,
      req.body.bankAccountId
    );
    res.json({ status: 'success', data });
  })
);

router.patch(
  '/cheques/:id/clear',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(pdcClearSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const cleared = await pdcPortfolioService.clearCheque(
      ctx.companyId,
      req.params.id,
      req.body.clearanceDate ?? new Date()
    );
    const journalEntry = await realEstateAccountingService.postPdcClearance(ctx.companyId, req.params.id, ctx);
    res.json({ status: 'success', data: { ...cleared, journalEntry } });
  })
);

router.patch(
  '/cheques/:id/bounce',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(pdcBounceSchema),
  asyncHandler(async (req, res) => {
    const data = await pdcPortfolioService.bounceCheque(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body.bounceReason
    );
    res.json({ status: 'success', data });
  })
);

router.post(
  '/cheques/:id/replace',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(pdcReplaceSchema),
  asyncHandler(async (req, res) => {
    const data = await pdcPortfolioService.replaceCheque(
      requireCompanyId(req as AuthRequest),
      req.params.id,
      req.body.replacement
    );
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/contracts/:id/resale-request',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(resaleTransferRequestSchema),
  asyncHandler(async (req, res) => {
    const companyId = requireCompanyId(req as AuthRequest);
    const data = await unitResaleTransferService.processResaleTransfer(companyId, {
      unitContractId: req.params.id,
      newBuyerCustomerId: req.body.newBuyerCustomerId,
      currentUnitMarketValue: req.body.currentUnitMarketValue,
      assignmentFeeRate: req.body.assignmentFeeRate,
      paymentRef: req.body.paymentRef,
    });
    res.status(201).json({ status: 'success', data });
  })
);

router.post(
  '/resale/:id/clear',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(resaleClearanceSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await unitResaleTransferService.clearAndExecuteTransfer(
      ctx.companyId,
      req.params.id,
      req.body.paymentRef,
      req.body.approvedByUserId ?? ctx.userId
    );
    const journalEntry = await realEstateAccountingService.postResaleAssignmentFee(
      ctx.companyId,
      req.params.id,
      ctx
    );
    res.json({ status: 'success', data: { ...data, journalEntry } });
  })
);

router.post(
  '/contracts/:id/cancel',
  authorize({ resource: 'invoice', action: 'edit' }),
  validateParams(idParamSchema),
  validateBody(cancellationSettlementSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await unitCancellationSettlementService.processContractCancellation(ctx.companyId, req.params.id, {
      cancellationDate: req.body.cancellationDate,
      forfeiturePenaltyRate: req.body.forfeiturePenaltyRate,
      refundStatus: req.body.refundDisbursementTerms === 'IMMEDIATE_REFUND' ? 'FULLY_REFUNDED' : 'HELD_UNTIL_RESALE',
    });
    const journalEntry = await realEstateAccountingService.postCancellationForfeiture(
      ctx.companyId,
      data.settlement.id,
      ctx
    );
    res.status(201).json({
      status: 'success',
      data: { ...data, journalEntry, refundDisbursementTerms: req.body.refundDisbursementTerms ?? null },
    });
  })
);

router.post(
  '/rental-pools/:id/distribute',
  authorize({ resource: 'invoice', action: 'post' }),
  validateParams(idParamSchema),
  validateBody(rentalPoolDistributionSchema),
  asyncHandler(async (req, res) => {
    const ctx = postingContext(req as AuthRequest);
    const data = await rentalPoolDistributionService.calculateAndDistributeRent(ctx.companyId, req.params.id, {
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      grossRentCollected: req.body.grossRentCollected,
      operatingExpenses: req.body.operatingExpenses,
      maintenanceReserveDeduction: req.body.maintenanceReserveDeduction,
    });
    const journalEntry = await realEstateAccountingService.postRentalDistribution(
      ctx.companyId,
      data.distribution.id,
      ctx
    );
    res.status(201).json({ status: 'success', data: { ...data, journalEntry } });
  })
);

export default router;
