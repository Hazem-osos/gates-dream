import { Prisma } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { AppError } from '../../../../shared/middleware/error-handler';
import { toDateOnly } from '../../utils/hr-effective-date.util';
import { lockHcmEmploymentRow } from './hcm-employment-lock.util';
import type { AssignmentTransitionInput } from './hcm-transition.service';
import { hcmPayrollImpactService } from './hcm-payroll-impact.service';
import { hcmHeadcountService } from './hcm-headcount.service';
import { hcmCompatibilityService } from './hcm-compatibility.service';
import { transitionAssignmentInTx } from './hcm-assignment-timeline.service';
import { transitionCompensationInTx } from './hcm-compensation-timeline.service';
import { hcmEventConflictService } from './hcm-event-conflict.service';
import { hcmRehireService } from './hcm-rehire.service';
import { hcmContractLifecycleService } from './hcm-contract-lifecycle.service';
import { closeEmploymentTimelinesAt } from './hcm-termination-timeline.util';

export type EventPayload = Record<string, unknown>;

const ASSIGNMENT_EVENTS = new Set([
  'TRANSFER',
  'PROMOTION',
  'DEMOTION',
  'POSITION_CHANGE',
  'MANAGER_CHANGE',
  'BRANCH_CHANGE',
  'ORG_UNIT_CHANGE',
  'HIRE',
]);

const CONTRACT_EVENTS = new Set([
  'CONTRACT_CREATED',
  'CONTRACT_RENEWED',
  'CONTRACT_AMENDED',
  'CONTRACT_EXPIRED',
  'CONTRACT_TERMINATED',
]);

const COMPENSATION_EVENTS = new Set(['SALARY_CHANGE', 'COMPENSATION_CHANGE']);

export class HcmEmploymentEventService {
  async createDraft(
    companyId: string,
    input: {
      employmentId: string;
      eventType: string;
      effectiveDate: Date;
      payload?: EventPayload;
      reason?: string;
      notes?: string;
      requestedBy?: string;
    }
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: input.employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');

    return prisma.hcmEmploymentEvent.create({
      data: {
        companyId,
        employmentId: input.employmentId,
        eventType: input.eventType,
        effectiveDate: toDateOnly(input.effectiveDate),
        status: 'DRAFT',
        payload: input.payload ?? {},
        reason: input.reason,
        notes: input.notes,
        requestedBy: input.requestedBy,
        requestedAt: input.requestedBy ? new Date() : undefined,
      },
    });
  }

  async submit(companyId: string, eventId: string, userId: string) {
    const event = await this.getEvent(companyId, eventId);
    if (event.status !== 'DRAFT') throw new AppError(400, 'Only DRAFT events can be submitted');
    await this.validateEvent(companyId, event, eventId);
    return prisma.hcmEmploymentEvent.update({
      where: { id: eventId },
      data: { status: 'SUBMITTED', requestedBy: userId, requestedAt: new Date() },
    });
  }

  async approve(companyId: string, eventId: string, approverId: string) {
    const event = await this.getEvent(companyId, eventId);
    if (event.status !== 'SUBMITTED') throw new AppError(400, 'Only SUBMITTED events can be approved');
    await this.validateEvent(companyId, event, eventId);

    const impact = await hcmPayrollImpactService.detectImpactForEmployee(
      companyId,
      (await prisma.hcmEmployment.findFirst({ where: { id: event.employmentId } }))!.employeeId,
      event.effectiveDate
    );

    const approved = await prisma.hcmEmploymentEvent.update({
      where: { id: eventId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
        afterSnapshot: {
          payrollImpact: impact,
          requiresPayrollAdjustment: impact.requiresPayrollAdjustment,
        },
      },
    });

    const applied = await this.applyEvent(companyId, eventId);
    return { event: applied, payrollImpact: impact };
  }

  async reject(companyId: string, eventId: string, userId: string, reason: string) {
    const event = await this.getEvent(companyId, eventId);
    if (event.status !== 'SUBMITTED') throw new AppError(400, 'Only SUBMITTED events can be rejected');
    return prisma.hcmEmploymentEvent.update({
      where: { id: eventId },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }

  async applyEvent(companyId: string, eventId: string) {
    const event = await this.getEvent(companyId, eventId);
    if (event.status === 'APPLIED') return event;
    if (event.status !== 'APPROVED') throw new AppError(400, 'Event must be APPROVED before apply');

    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: event.employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');

    const payload = (event.payload ?? {}) as EventPayload;
    const effectiveFrom = toDateOnly(event.effectiveDate);
    const today = toDateOnly(new Date());

    if (event.eventType === 'REHIRE') {
      const before = await this.snapshotState(prisma, companyId, event.employmentId);
      const rehired = await hcmRehireService.rehireEmployee(companyId, {
        employeeId: employment.employeeId,
        effectiveDate: effectiveFrom,
        departmentId: payload.departmentId as string | undefined,
        branchId: payload.branchId as string | undefined,
        positionId: payload.positionId as string | undefined,
        jobTitleId: payload.jobTitleId as string | undefined,
        basicSalary: Number(payload.basicSalary),
        fixedAllowances: Number(payload.fixedAllowances ?? 0),
      });
      const after = await this.snapshotState(prisma, companyId, rehired.employment.id);
      const applied = await prisma.hcmEmploymentEvent.update({
        where: { id: eventId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          employmentId: rehired.employment.id,
          beforeSnapshot: before,
          afterSnapshot: after,
          contractId: rehired.contract?.id,
        },
      });
      await hcmCompatibilityService.syncEmployeeProjection(companyId, rehired.employment.id, today);
      return applied;
    }

    const result = await prisma.$transaction(
      async (tx) => {
      await lockHcmEmploymentRow(tx, event.employmentId);

      const before = await this.snapshotState(tx, companyId, event.employmentId);

      let assignmentId: string | undefined;
      let compensationId: string | undefined;
      let contractId: string | undefined;
      let appliedEmploymentId = event.employmentId;

      if (ASSIGNMENT_EVENTS.has(event.eventType)) {
        const input: AssignmentTransitionInput = {
          effectiveFrom,
          changeReason: event.eventType,
          departmentId: payload.departmentId as string | undefined,
          branchId: payload.branchId as string | undefined,
          positionId: payload.positionId as string | undefined,
          jobTitleId: payload.jobTitleId as string | undefined,
          jobCadreId: payload.jobCadreId as string | undefined,
          managerPositionId: payload.managerPositionId as string | undefined,
        };
        if (input.positionId) {
          await hcmHeadcountService.assertPositionCapacity(
            companyId,
            input.positionId,
            effectiveFrom,
            event.employmentId
          );
        }
        const row = await transitionAssignmentInTx(tx, companyId, appliedEmploymentId, input);
        assignmentId = row.id;
      }

      if (
        (COMPENSATION_EVENTS.has(event.eventType) || payload.basicSalary != null) &&
        event.eventType !== 'REHIRE'
      ) {
        const basic = Number(payload.basicSalary);
        if (!Number.isFinite(basic)) throw new AppError(422, 'basicSalary required');
        const row = await transitionCompensationInTx(tx, companyId, appliedEmploymentId, {
          effectiveFrom,
          basicSalary: basic,
          fixedAllowances: Number(payload.fixedAllowances ?? 0),
          changeReason: event.eventType,
        });
        compensationId = row.id;
      }

      if (CONTRACT_EVENTS.has(event.eventType)) {
        if (event.eventType === 'CONTRACT_CREATED') {
          const created = await hcmContractLifecycleService.createContract(
            companyId,
            appliedEmploymentId,
            {
              contractStartDate: effectiveFrom,
              contractEndDate: payload.contractEndDate
                ? toDateOnly(String(payload.contractEndDate))
                : null,
              basicSalary: payload.basicSalary ? Number(payload.basicSalary) : undefined,
              departmentId: payload.departmentId as string | undefined,
              jobTitleId: payload.jobTitleId as string | undefined,
            }
          );
          contractId = created.id;
        } else if (event.eventType === 'CONTRACT_RENEWED' && payload.priorContractId) {
          const renewed = await hcmContractLifecycleService.renewContract(
            companyId,
            String(payload.priorContractId),
            {
              contractStartDate: effectiveFrom,
              contractEndDate: payload.contractEndDate
                ? toDateOnly(String(payload.contractEndDate))
                : null,
              basicSalary: payload.basicSalary ? Number(payload.basicSalary) : undefined,
            }
          );
          contractId = renewed.id;
        } else if (event.eventType === 'CONTRACT_AMENDED' && payload.contractId) {
          await hcmContractLifecycleService.amendContract(companyId, String(payload.contractId), {
            basicSalary: payload.basicSalary ? Number(payload.basicSalary) : undefined,
          });
          contractId = String(payload.contractId);
        } else if (event.eventType === 'CONTRACT_EXPIRED' && payload.contractId) {
          await hcmContractLifecycleService.expireContract(
            companyId,
            String(payload.contractId),
            effectiveFrom
          );
          contractId = String(payload.contractId);
        } else if (event.eventType === 'CONTRACT_TERMINATED' && payload.contractId) {
          await hcmContractLifecycleService.terminateContract(
            companyId,
            String(payload.contractId),
            effectiveFrom
          );
          contractId = String(payload.contractId);
        }
      }

      if (event.eventType === 'SUSPENSION') {
        await tx.hcmEmployment.update({
          where: { id: event.employmentId },
          data: { status: 'SUSPENDED' },
        });
      }
      if (event.eventType === 'RETURN_FROM_SUSPENSION') {
        await tx.hcmEmployment.update({
          where: { id: event.employmentId },
          data: { status: 'ACTIVE' },
        });
      }
      if (event.eventType === 'RESIGNATION' || event.eventType === 'TERMINATION') {
        await closeEmploymentTimelinesAt(tx, companyId, event.employmentId, effectiveFrom);
        await tx.hcmEmployment.update({
          where: { id: event.employmentId },
          data: {
            status: 'TERMINATED',
            terminationDate: effectiveFrom,
            terminationReason: event.reason,
          },
        });
      }

      const after = await this.snapshotState(tx, companyId, appliedEmploymentId);

      return tx.hcmEmploymentEvent.update({
        where: { id: eventId },
        data: {
          status: 'APPLIED',
          appliedAt: new Date(),
          beforeSnapshot: before,
          afterSnapshot: { ...after, finalSettlementRequired: event.eventType.includes('TERMIN') || event.eventType === 'RESIGNATION' },
          assignmentId,
          compensationId,
          contractId,
          employmentId: appliedEmploymentId,
        },
      });
    },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 }
    );

    const appliedEmploymentId =
      result.employmentId && result.employmentId !== event.employmentId
        ? result.employmentId
        : event.employmentId;

    if (effectiveFrom.getTime() <= today.getTime()) {
      await hcmCompatibilityService.syncEmployeeProjection(companyId, appliedEmploymentId, today);
    }

    return result;
  }

  private async getEvent(companyId: string, eventId: string) {
    const event = await prisma.hcmEmploymentEvent.findFirst({
      where: { id: eventId, companyId },
    });
    if (!event) throw new AppError(404, 'Event not found');
    return event;
  }

  private async validateEvent(
    companyId: string,
    event: { employmentId: string; effectiveDate: Date; eventType: string; payload: unknown },
    excludeEventId?: string
  ) {
    const employment = await prisma.hcmEmployment.findFirst({
      where: { id: event.employmentId, companyId },
    });
    if (!employment) throw new AppError(404, 'Employment not found');
    if (employment.status === 'TERMINATED' && event.eventType !== 'REHIRE') {
      throw new AppError(422, 'Employment is terminated');
    }

    const relatedEvents = await prisma.hcmEmploymentEvent.findMany({
      where: {
        companyId,
        employmentId: event.employmentId,
        status: { in: ['SUBMITTED', 'APPROVED', 'APPLIED'] },
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      },
    });
    const conflict = hcmEventConflictService.evaluate(
      { eventType: event.eventType, effectiveDate: event.effectiveDate },
      { employmentStatus: employment.status, pendingAndApplied: relatedEvents }
    );
    hcmEventConflictService.assertAllowed(conflict);

    const pending = await prisma.hcmEmploymentEvent.count({
      where: {
        companyId,
        employmentId: event.employmentId,
        status: 'SUBMITTED',
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      },
    });
    if (pending > 0) throw new AppError(409, 'Another pending event exists for this employment');
  }

  private async snapshotState(
    tx: Prisma.TransactionClient | typeof prisma,
    companyId: string,
    employmentId: string
  ) {
    const employment = await tx.hcmEmployment.findFirst({ where: { id: employmentId, companyId } });
    const assignments = await tx.hcmEmploymentAssignment.findMany({ where: { employmentId, companyId } });
    const compensations = await tx.hcmCompensationAssignment.findMany({ where: { employmentId, companyId } });
    return { employment, assignments, compensations };
  }

  async listForEmployment(companyId: string, employmentId: string) {
    return prisma.hcmEmploymentEvent.findMany({
      where: { companyId, employmentId },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
    });
  }
}

export const hcmEmploymentEventService = new HcmEmploymentEventService();
