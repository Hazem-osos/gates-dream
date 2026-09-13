import { AiActionStatus, Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { ConversationActor } from '../services/ai-conversation.store';
import { ACTION_TTL_MS, type AiActionSummaryDisplay, type AiActionType } from './action-types';

export type CreatePendingActionInput = {
  conversationId: string;
  companyId: string;
  userId: string;
  actionType: AiActionType;
  requiredPermission: string;
  payload: Record<string, unknown>;
  summaryDisplay: AiActionSummaryDisplay;
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class AiPendingActionStore {
  async create(input: CreatePendingActionInput) {
    return prisma.aiPendingAction.create({
      data: {
        conversationId: input.conversationId,
        companyId: input.companyId,
        userId: input.userId,
        actionType: input.actionType,
        requiredPermission: input.requiredPermission,
        payload: toJson(input.payload),
        summaryDisplay: toJson(input.summaryDisplay),
        status: AiActionStatus.PENDING,
        expiresAt: new Date(Date.now() + ACTION_TTL_MS),
      },
    });
  }

  async listForConversation(conversationId: string, actor: ConversationActor) {
    return prisma.aiPendingAction.findMany({
      where: {
        conversationId,
        companyId: actor.companyId,
        userId: actor.userId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requireOwned(actionId: string, actor: ConversationActor) {
    const row = await prisma.aiPendingAction.findFirst({
      where: { id: actionId, companyId: actor.companyId, userId: actor.userId },
    });
    if (!row) throw new AppError(404, 'Action not found');
    return row;
  }

  async markExpired(actionId: string) {
    return prisma.aiPendingAction.update({
      where: { id: actionId },
      data: { status: AiActionStatus.EXPIRED },
    });
  }

  async markRejected(actionId: string) {
    return prisma.aiPendingAction.update({
      where: { id: actionId },
      data: { status: AiActionStatus.REJECTED },
    });
  }

  async markFailed(actionId: string, error: string) {
    return prisma.aiPendingAction.update({
      where: { id: actionId },
      data: { status: AiActionStatus.FAILED, executionError: error.slice(0, 2000) },
    });
  }

  async updateDraft(
    actionId: string,
    input: { payload: Record<string, unknown>; summaryDisplay: AiActionSummaryDisplay }
  ) {
    return prisma.aiPendingAction.update({
      where: { id: actionId },
      data: {
        payload: toJson(input.payload),
        summaryDisplay: toJson(input.summaryDisplay),
      },
    });
  }

  async markExecuted(actionId: string, resultingEntityId: string) {
    return prisma.aiPendingAction.update({
      where: { id: actionId },
      data: {
        status: AiActionStatus.EXECUTED,
        resultingEntityId,
        executionError: null,
      },
    });
  }
}

export const aiPendingActionStore = new AiPendingActionStore();
