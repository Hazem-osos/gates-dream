import { CREATE_PURCHASE_REQUEST_ACTION } from '../schemas/automation-purchase-request.schema';
import type { CreateAutomationPurchaseRequestInput } from '../schemas/automation-purchase-request.schema';
import { AutomationActionRunService } from './automation-action-run.service';
import {
  automationIdempotencyKey,
  recoverySerialsForRun,
  mapAutomationPayloadToPurchaseOrder,
  toAutomationPurchaseOrderView,
} from './automation-purchase-request.mapper';
import {
  AUTOMATION_ERROR_CODES,
  AutomationPurchaseRequestError,
  RESULT_ENTITY_PURCHASE_ORDER,
  isUniqueConstraintError,
  toPurchaseOrderResultMetadata,
  type AutomationActionRunDb,
  type AutomationActionRunRecord,
  type PurchaseOrderDomain,
  type PurchaseOrderView,
  type RecoveredActionResult,
} from './automation-action-run.types';

export type CreatePurchaseRequestResult = {
  success: true;
  duplicate: boolean;
  inProgress?: boolean;
  purchaseOrder: PurchaseOrderView;
};

export class AutomationPurchaseRequestService {
  constructor(
    private readonly db: AutomationActionRunDb,
    private readonly purchaseOrders: PurchaseOrderDomain,
    private readonly runs: AutomationActionRunService
  ) {}

  async createDraftPurchaseOrder(
    input: CreateAutomationPurchaseRequestInput
  ): Promise<CreatePurchaseRequestResult> {
    await this.assertCompany(input.companyId);

    const eventType = await this.resolveEventType(input);
    let claim;
    try {
      claim = await this.runs.claim(
        {
          companyId: input.companyId,
          eventId: input.eventId,
          ruleId: input.ruleId,
          actionType: CREATE_PURCHASE_REQUEST_ACTION,
          correlationId: input.correlationId,
          eventType,
        },
        (run) => this.recoverExistingPurchaseOrder(input, run)
      );
    } catch (error) {
      if (error instanceof Error && /conflict/i.test(error.message)) {
        throw new AutomationPurchaseRequestError(409, error.message);
      }
      throw error;
    }

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

  private async resolveEventType(
    input: CreateAutomationPurchaseRequestInput
  ): Promise<string | null> {
    if (input.eventType) return input.eventType;
    if (!this.db.automationRule) return null;
    const rule = await this.db.automationRule.findFirst({
      where: { id: input.ruleId, companyId: input.companyId },
      select: { eventType: true },
    });
    return rule?.eventType ?? null;
  }

  private async executeCreate(
    input: CreateAutomationPurchaseRequestInput,
    run: AutomationActionRunRecord
  ): Promise<CreatePurchaseRequestResult> {
    const recovered = await this.recoverExistingPurchaseOrder(input, run);
    if (recovered) {
      const succeeded = await this.runs.markSucceeded(run.companyId, run.id, recovered);
      return this.replaySucceeded(input.companyId, succeeded);
    }

    const mapped = mapAutomationPayloadToPurchaseOrder(input, {
      serial: recoverySerialsForRun(run)[0],
    });
    let created: PurchaseOrderView;
    try {
      created = await this.purchaseOrders.createPurchaseOrder(input.companyId, mapped);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const recoveredAfterConflict = await this.recoverExistingPurchaseOrder(input, run);
        if (recoveredAfterConflict) {
          const succeeded = await this.runs.markSucceeded(run.companyId, run.id, recoveredAfterConflict);
          return this.replaySucceeded(input.companyId, succeeded);
        }
      }
      const message = error instanceof Error ? error.message : 'Failed to create purchase order';
      const ownership = /not found|do not belong/i.test(message);
      await this.runs.markFailed(run.companyId, run.id, {
        errorMessage: message,
        lastErrorCode: ownership
          ? AUTOMATION_ERROR_CODES.OWNERSHIP
          : AUTOMATION_ERROR_CODES.DOMAIN_ERROR,
      });
      if (ownership) {
        throw new AutomationPurchaseRequestError(400, message);
      }
      throw error;
    }

    if (created.isPosted || created.isApproved) {
      await this.runs.markFailed(run.companyId, run.id, {
        errorMessage:
          'Purchase order service returned a posted or approved document; automation must create drafts only',
        lastErrorCode: AUTOMATION_ERROR_CODES.DRAFT_POLICY,
        resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
        resultEntityId: created.id,
        resultMetadata: toPurchaseOrderResultMetadata(created),
      });
      throw new AutomationPurchaseRequestError(
        500,
        'Purchase order service returned a posted or approved document; automation must create drafts only'
      );
    }

    await this.runs.markSucceeded(run.companyId, run.id, {
      resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
      resultEntityId: created.id,
      resultMetadata: toPurchaseOrderResultMetadata(created),
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

  /**
   * Recover by the DB-unique automation key first, then resultEntityId,
   * then first-claim / incoming serials. The unique key is the guarantee
   * under concurrent stale reclaim.
   */
  private async recoverExistingPurchaseOrder(
    input: CreateAutomationPurchaseRequestInput,
    run: AutomationActionRunRecord
  ): Promise<RecoveredActionResult | null> {
    const byKey = await this.db.purchaseOrder.findFirst({
      where: {
        companyId: input.companyId,
        automationIdempotencyKey: automationIdempotencyKey({
          eventId: input.eventId,
          ruleId: input.ruleId,
        }),
      },
    });
    if (byKey) {
      return {
        resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
        resultEntityId: byKey.id,
        resultMetadata: toPurchaseOrderResultMetadata(byKey),
      };
    }

    if (run.resultEntityId) {
      const order = await this.db.purchaseOrder.findFirst({
        where: { id: run.resultEntityId, companyId: input.companyId },
      });
      if (order) {
        return {
          resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
          resultEntityId: order.id,
          resultMetadata: toPurchaseOrderResultMetadata(order),
        };
      }
    }

    for (const serial of recoverySerialsForRun(run, input.correlationId)) {
      const bySerial = await this.db.purchaseOrder.findFirst({
        where: { companyId: input.companyId, serial },
      });
      if (bySerial) {
        return {
          resultEntityType: RESULT_ENTITY_PURCHASE_ORDER,
          resultEntityId: bySerial.id,
          resultMetadata: toPurchaseOrderResultMetadata(bySerial),
        };
      }
    }

    return null;
  }

  private async loadPurchaseOrder(companyId: string, id: string): Promise<PurchaseOrderView> {
    const fromDb = await this.db.purchaseOrder.findFirst({
      where: { id, companyId },
    });
    if (fromDb) return fromDb;
    return this.purchaseOrders.getPurchaseOrderById(companyId, id);
  }
}
