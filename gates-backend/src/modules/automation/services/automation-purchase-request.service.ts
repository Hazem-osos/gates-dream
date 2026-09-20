import { CREATE_PURCHASE_REQUEST_ACTION } from '../schemas/automation-purchase-request.schema';
import type { CreateAutomationPurchaseRequestInput } from '../schemas/automation-purchase-request.schema';
import {
  automationPurchaseOrderSerial,
  mapAutomationPayloadToPurchaseOrder,
  toAutomationPurchaseOrderView,
} from './automation-purchase-request.mapper';
import {
  AutomationPurchaseRequestError,
  isUniqueConstraintError,
  RESULT_ENTITY_PURCHASE_ORDER,
  type AutomationActionRunDb,
  type AutomationActionRunRecord,
  type PurchaseOrderDomain,
  type PurchaseOrderView,
} from './automation-action-run.types';

const STALE_PENDING_MS = 30_000;

export type CreatePurchaseRequestResult = {
  success: true;
  duplicate: boolean;
  inProgress?: boolean;
  purchaseOrder: PurchaseOrderView;
};

function uniqueWhere(input: CreateAutomationPurchaseRequestInput) {
  return {
    companyId_eventId_ruleId_actionType: {
      companyId: input.companyId,
      eventId: input.eventId,
      ruleId: input.ruleId,
      actionType: CREATE_PURCHASE_REQUEST_ACTION,
    },
  };
}

export class AutomationPurchaseRequestService {
  constructor(
    private readonly db: AutomationActionRunDb,
    private readonly purchaseOrders: PurchaseOrderDomain,
    private readonly now: () => Date = () => new Date()
  ) {}

  async createDraftPurchaseOrder(
    input: CreateAutomationPurchaseRequestInput
  ): Promise<CreatePurchaseRequestResult> {
    await this.assertCompany(input.companyId);

    const claim = await this.claimRun(input);
    if (claim.kind === 'existing') {
      return this.replaySucceeded(input.companyId, claim.run);
    }
    if (claim.kind === 'in_progress') {
      throw new AutomationPurchaseRequestError(
        409,
        'Automation action is already in progress. Retry shortly.'
      );
    }

    return this.executeCreate(input, claim.run);
  }

  private async assertCompany(companyId: string) {
    const company = await this.db.company.findUnique({
      where: { id: companyId },
      select: { id: true, isActive: true, deletedAt: true },
    });
    if (!company || company.deletedAt) {
      throw new AutomationPurchaseRequestError(404, 'Company not found');
    }
    if (!company.isActive) {
      throw new AutomationPurchaseRequestError(403, 'Company account is inactive');
    }
  }

  private async claimRun(
    input: CreateAutomationPurchaseRequestInput
  ): Promise<
    | { kind: 'claimed'; run: AutomationActionRunRecord }
    | { kind: 'existing'; run: AutomationActionRunRecord }
    | { kind: 'in_progress'; run: AutomationActionRunRecord }
  > {
    try {
      const run = await this.db.automationActionRun.create({
        data: {
          companyId: input.companyId,
          eventId: input.eventId,
          ruleId: input.ruleId,
          actionType: CREATE_PURCHASE_REQUEST_ACTION,
          correlationId: input.correlationId,
          status: 'PENDING',
        },
      });
      return { kind: 'claimed', run };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.findRun(input);
    if (!existing) {
      throw new AutomationPurchaseRequestError(409, 'Automation action conflict. Retry shortly.');
    }

    if (existing.status === 'SUCCEEDED' && existing.resultEntityId) {
      return { kind: 'existing', run: existing };
    }

    if (existing.status === 'FAILED') {
      const taken = await this.db.automationActionRun.updateMany({
        where: {
          id: existing.id,
          status: 'FAILED',
        },
        data: {
          status: 'PENDING',
          errorMessage: null,
          correlationId: input.correlationId,
        },
      });
      if (taken.count === 1) {
        return { kind: 'claimed', run: { ...existing, status: 'PENDING' } };
      }
      const after = await this.findRun(input);
      if (after?.status === 'SUCCEEDED' && after.resultEntityId) {
        return { kind: 'existing', run: after };
      }
      throw new AutomationPurchaseRequestError(409, 'Automation action is already in progress. Retry shortly.');
    }

    const recovered = await this.recoverExistingPurchaseOrder(input, existing);
    if (recovered) {
      return { kind: 'existing', run: recovered };
    }

    if (this.isStalePending(existing)) {
      const taken = await this.db.automationActionRun.updateMany({
        where: {
          id: existing.id,
          status: 'PENDING',
          updatedAt: existing.updatedAt,
        },
        data: { status: 'PENDING', correlationId: input.correlationId },
      });
      if (taken.count === 1) {
        return { kind: 'claimed', run: existing };
      }
    }

    return { kind: 'in_progress', run: existing };
  }

  private async executeCreate(
    input: CreateAutomationPurchaseRequestInput,
    run: AutomationActionRunRecord
  ): Promise<CreatePurchaseRequestResult> {
    const recovered = await this.recoverExistingPurchaseOrder(input, run);
    if (recovered) {
      return this.replaySucceeded(input.companyId, recovered);
    }

    const mapped = mapAutomationPayloadToPurchaseOrder(input);
    let created: PurchaseOrderView;
    try {
      created = await this.purchaseOrders.createPurchaseOrder(input.companyId, mapped);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create purchase order';
      await this.db.automationActionRun.updateMany({
        where: { id: run.id, status: 'PENDING', resultEntityId: null },
        data: { status: 'FAILED', errorMessage: message.slice(0, 2000) },
      });
      if (/not found|do not belong/i.test(message)) {
        throw new AutomationPurchaseRequestError(400, message);
      }
      throw error;
    }

    if (created.isPosted || created.isApproved) {
      throw new AutomationPurchaseRequestError(
        500,
        'Purchase order service returned a posted or approved document; automation must create drafts only'
      );
    }

    await this.db.automationActionRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
        resultEntityId: created.id,
        errorMessage: null,
      },
    });

    return {
      success: true,
      duplicate: false,
      purchaseOrder: toAutomationPurchaseOrderView(created),
    };
  }

  private async replaySucceeded(
    companyId: string,
    run: AutomationActionRunRecord
  ): Promise<CreatePurchaseRequestResult> {
    if (!run.resultEntityId) {
      throw new AutomationPurchaseRequestError(409, 'Automation action is already in progress. Retry shortly.');
    }
    const order = await this.loadPurchaseOrder(companyId, run.resultEntityId);
    return {
      success: true,
      duplicate: true,
      purchaseOrder: toAutomationPurchaseOrderView(order),
    };
  }

  private async recoverExistingPurchaseOrder(
    input: CreateAutomationPurchaseRequestInput,
    run: AutomationActionRunRecord
  ): Promise<AutomationActionRunRecord | null> {
    if (run.resultEntityId) {
      const order = await this.db.purchaseOrder.findFirst({
        where: { id: run.resultEntityId, companyId: input.companyId },
      });
      if (order) {
        return this.markSucceeded(run.id, order.id);
      }
    }

    const bySerial = await this.db.purchaseOrder.findFirst({
      where: {
        companyId: input.companyId,
        serial: automationPurchaseOrderSerial(input.correlationId),
      },
    });
    if (!bySerial) return null;
    return this.markSucceeded(run.id, bySerial.id);
  }

  private async markSucceeded(runId: string, purchaseOrderId: string) {
    return this.db.automationActionRun.update({
      where: { id: runId },
      data: {
        status: 'SUCCEEDED',
        resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
        resultEntityId: purchaseOrderId,
        errorMessage: null,
      },
    });
  }

  private async loadPurchaseOrder(companyId: string, id: string): Promise<PurchaseOrderView> {
    const fromDb = await this.db.purchaseOrder.findFirst({
      where: { id, companyId },
    });
    if (fromDb) return fromDb;
    return this.purchaseOrders.getPurchaseOrderById(companyId, id);
  }

  private findRun(input: CreateAutomationPurchaseRequestInput) {
    return this.db.automationActionRun.findUnique({
      where: uniqueWhere(input),
    });
  }

  private isStalePending(run: AutomationActionRunRecord): boolean {
    if (run.status !== 'PENDING') return false;
    return this.now().getTime() - run.updatedAt.getTime() >= STALE_PENDING_MS;
  }
}
