import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { ChatMessage, ChatRole, ChatToolCall } from '../interfaces/ai-provider';

export type ConversationActor = {
  userId: string;
  companyId: string;
  ipAddress?: string;
};

export type PersistedAssistant = {
  id: string;
  role: ChatRole;
  content: string;
  toolCalls: ChatToolCall[] | null;
  createdAt: Date;
};

const ALLOWED_ROLES = new Set<ChatRole>(['user', 'assistant', 'system', 'tool']);

export function conversationOwnerWhere(actor: ConversationActor) {
  return { companyId: actor.companyId, userId: actor.userId };
}

function asRole(role: string): ChatRole {
  return ALLOWED_ROLES.has(role as ChatRole) ? (role as ChatRole) : 'assistant';
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseToolCalls(value: Prisma.JsonValue | null): ChatToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const calls: ChatToolCall[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const fn = record.function;
    if (
      typeof record.id !== 'string' ||
      !fn ||
      typeof fn !== 'object' ||
      Array.isArray(fn) ||
      typeof (fn as { name?: unknown }).name !== 'string'
    ) {
      continue;
    }
    const args = (fn as { arguments?: unknown }).arguments;
    calls.push({
      id: record.id,
      type: 'function',
      function: {
        name: (fn as { name: string }).name,
        arguments: typeof args === 'string' ? args : '{}',
      },
    });
  }
  return calls.length ? calls : undefined;
}

export class AiConversationStore {
  async listConversations(actor: ConversationActor) {
    return prisma.aiConversation.findMany({
      where: conversationOwnerWhere(actor),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
  }

  async createConversation(actor: ConversationActor, title?: string) {
    const conversation = await prisma.aiConversation.create({
      data: {
        title: title?.trim() || 'New conversation',
        userId: actor.userId,
        companyId: actor.companyId,
      },
    });
    await this.audit(actor, 'conversation.create', { conversationId: conversation.id });
    return conversation;
  }

  async requireConversation(conversationId: string, actor: ConversationActor) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, ...conversationOwnerWhere(actor) },
    });
    if (!conversation) {
      throw new AppError(404, 'Conversation not found');
    }
    return conversation;
  }

  async getConversation(conversationId: string, actor: ConversationActor) {
    const conversation = await this.requireConversation(conversationId, actor);
    const [messages, pendingActions] = await Promise.all([
      prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.aiPendingAction.findMany({
        where: { conversationId: conversation.id, companyId: actor.companyId, userId: actor.userId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { ...conversation, messages, pendingActions };
  }

  async deleteConversation(conversationId: string, actor: ConversationActor) {
    await this.requireConversation(conversationId, actor);
    await prisma.aiConversation.delete({ where: { id: conversationId } });
    await this.audit(actor, 'conversation.delete', { conversationId });
  }

  async appendMessage(
    conversationId: string,
    role: ChatRole,
    content: string,
    toolCalls?: ChatToolCall[],
    toolCallId?: string
  ) {
    const [row] = await prisma.$transaction([
      prisma.aiMessage.create({
        data: {
          conversationId,
          role,
          content,
          toolCalls: toolCalls?.length
            ? toJson(toolCalls)
            : toolCallId
              ? toJson({ toolCallId })
              : undefined,
        },
      }),
      prisma.aiConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
    return row;
  }

  async loadProviderMessages(conversationId: string, actor: ConversationActor): Promise<ChatMessage[]> {
    await this.requireConversation(conversationId, actor);
    const rows = await prisma.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => {
      const extra =
        row.toolCalls && !Array.isArray(row.toolCalls) && typeof row.toolCalls === 'object'
          ? (row.toolCalls as { toolCallId?: string })
          : undefined;
      return {
        role: asRole(row.role),
        content: row.content,
        toolCalls: parseToolCalls(Array.isArray(row.toolCalls) ? row.toolCalls : null),
        toolCallId: extra?.toolCallId,
      };
    });
  }

  async persistAssistant(
    conversationId: string,
    content: string | null,
    toolCalls?: ChatToolCall[]
  ): Promise<PersistedAssistant> {
    const row = await this.appendMessage(conversationId, 'assistant', content ?? '', toolCalls);
    return {
      id: row.id,
      role: asRole(row.role),
      content: row.content,
      toolCalls: parseToolCalls(row.toolCalls) ?? null,
      createdAt: row.createdAt,
    };
  }

  async recordToolExecution(input: {
    conversationId: string;
    toolName: string;
    inputArgs: unknown;
    outputResult: unknown;
    status: 'pending' | 'success' | 'error';
    executionTimeMs: number;
  }) {
    return prisma.aiToolExecution.create({
      data: {
        conversationId: input.conversationId,
        toolName: input.toolName.slice(0, 80),
        inputArgs: toJson(input.inputArgs ?? {}),
        outputResult: toJson(input.outputResult ?? null),
        status: input.status,
        executionTimeMs: input.executionTimeMs,
      },
    });
  }

  async audit(actor: ConversationActor, action: string, metadata: Record<string, unknown>) {
    await prisma.aiAuditLog.create({
      data: {
        userId: actor.userId,
        companyId: actor.companyId,
        action,
        metadata: toJson(metadata),
        ipAddress: actor.ipAddress?.slice(0, 45),
      },
    });
  }
}

export const aiConversationStore = new AiConversationStore();
