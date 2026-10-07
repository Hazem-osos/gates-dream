import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { assertPayrollTransition } from './payroll-workflow-state.domain';
import { payrollGlMappingService } from './payroll-gl-mapping.service';

const RECALC_STATUSES = new Set(['DRAFT', 'CALCULATED']);
const POSTABLE_STATUSES = new Set(['DRAFT', 'APPROVED', 'CALCULATED', 'REVIEWED']);

export class PayrollWorkflowService {
  assertCanApprove(status: string) {
    if (status === 'CALCULATING') throw new AppError(409, 'Payroll run calculation still in progress');
    if (!['REVIEWED', 'CALCULATED', 'DRAFT'].includes(status)) {
      throw new AppError(409, 'Payroll run cannot be approved in current status');
    }
  }

  assertCanPay(status: string) {
    if (status !== 'POSTED') throw new AppError(400, 'Payroll must be POSTED before payment');
  }

  assertCanReversePosted(status: string) {
    if (status !== 'POSTED') throw new AppError(400, 'Only a POSTED payroll run can be reversed');
  }

  assertCanRecalculate(status: string) {
    if (!RECALC_STATUSES.has(status)) {
      throw new AppError(409, 'Payroll run cannot be recalculated in current status');
    }
  }

  async reviewRun(companyId: string, runId: string, userId: string) {
    const run = await prisma.payrollRun.findFirst({ where: { id: runId, companyId } });
    if (!run) throw new AppError(404, 'Payroll run not found');
    if (!['CALCULATED', 'DRAFT'].includes(run.status)) {
      throw new AppError(400, 'Run must be calculated before review');
    }
    return prisma.payrollRun.update({
      where: { id: runId },
      data: { status: 'REVIEWED', reviewedById: userId, reviewedAt: new Date() },
    });
  }

  async approveRun(
    companyId: string,
    runId: string,
    userId: string,
    options?: { negativeNetOverrideReason?: string }
  ) {
    const run = await prisma.payrollRun.findFirst({
      where: { id: runId, companyId },
      include: { snapshot: true, items: true },
    });
    if (!run) throw new AppError(404, 'Payroll run not found');
    if (run.status === 'CALCULATING') {
      throw new AppError(409, 'Payroll run calculation still in progress');
    }
    if (!['REVIEWED', 'CALCULATED', 'DRAFT'].includes(run.status)) {
      throw new AppError(400, 'Run cannot be approved in current status');
    }
    try {
      assertPayrollTransition(run.status, 'APPROVED');
    } catch {
      throw new AppError(400, 'Run cannot be approved in current status');
    }

    const settings = await prisma.hrSettings.findUnique({ where: { companyId } });
    if (settings?.payrollCalculatorCannotApproveOwnRun && run.calculatedById === userId) {
      throw new AppError(403, 'Calculator cannot approve own payroll run');
    }

    const negativePolicy = settings?.payrollNegativeNetPolicy ?? run.negativeNetPolicy ?? 'BLOCK';
    const negativeItems = run.items.filter((i) => Number(i.netSalary) < 0);
    if (negativeItems.length > 0) {
      if (negativePolicy === 'BLOCK') {
        throw new AppError(422, 'NEGATIVE_NET_BLOCKED');
      }
      if (negativePolicy === 'ALLOW_WITH_APPROVAL' && !options?.negativeNetOverrideReason) {
        throw new AppError(422, 'NEGATIVE_NET_REQUIRES_OVERRIDE');
      }
    }

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM payroll_runs WHERE id = ${runId} AND companyId = ${companyId} FOR UPDATE`;
      const locked = await tx.payrollRun.findFirst({ where: { id: runId, companyId } });
      if (!locked || !['REVIEWED', 'CALCULATED', 'DRAFT'].includes(locked.status)) {
        throw new AppError(409, 'Payroll run cannot be approved in current status');
      }

      const glFingerprint = await payrollGlMappingService.fingerprintMappings(companyId);
      const approved = await tx.payrollRun.update({
        where: { id: runId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
          negativeNetOverrideReason:
            negativeItems.length > 0 ? options?.negativeNetOverrideReason ?? null : null,
          negativeNetOverrideById:
            negativeItems.length > 0 && options?.negativeNetOverrideReason ? userId : null,
          negativeNetOverrideAt:
            negativeItems.length > 0 && options?.negativeNetOverrideReason ? new Date() : null,
        },
      });

      if (run.snapshot) {
        const snap = run.snapshot.inputSnapshot as Record<string, unknown>;
        await tx.hcmPayrollRunSnapshot.update({
          where: { payrollRunId: runId },
          data: {
            inputSnapshot: {
              ...snap,
              glMappingFingerprintAtApproval: glFingerprint,
              approvedById: userId,
              approvedAt: new Date().toISOString(),
            },
          },
        });
      }

      const snapPayload = run.snapshot?.inputSnapshot as { oneTimeInputIds?: string[] } | null;
      const snapIds = snapPayload?.oneTimeInputIds ?? [];
      const pendingInputs =
        snapIds.length > 0
          ? await tx.hcmPayrollOneTimeInput.findMany({
              where: {
                companyId,
                id: { in: snapIds },
                status: 'APPROVED',
                consumedRunId: null,
              },
            })
          : await tx.hcmPayrollOneTimeInput.findMany({
              where: {
                companyId,
                periodYear: run.periodYear,
                periodMonth: run.periodMonth,
                status: 'APPROVED',
                consumedRunId: null,
              },
            });
      for (const input of pendingInputs) {
        await tx.$executeRaw`SELECT id FROM hcm_payroll_one_time_inputs WHERE id = ${input.id} FOR UPDATE`;
        const consumed = await tx.hcmPayrollOneTimeInput.updateMany({
          where: { id: input.id, status: 'APPROVED', consumedRunId: null },
          data: { consumedRunId: runId, status: 'CONSUMED' },
        });
        if (consumed.count !== 1) {
          throw new AppError(409, `ONE_TIME_INPUT_ALREADY_CONSUMED:${input.id}`);
        }
      }

      return approved;
    });
  }

  assertCanPost(status: string, requireApproval: boolean) {
    if (status === 'CALCULATING') {
      throw new AppError(409, 'Payroll run calculation still in progress');
    }
    if (requireApproval && status !== 'APPROVED') {
      throw new AppError(400, 'Payroll run must be APPROVED before posting');
    }
    if (!requireApproval && status === 'CALCULATED') {
      return;
    }
    if (!POSTABLE_STATUSES.has(status) && status !== 'APPROVED') {
      throw new AppError(400, 'Payroll run is not in a postable status');
    }
  }
}

export const payrollWorkflowService = new PayrollWorkflowService();
