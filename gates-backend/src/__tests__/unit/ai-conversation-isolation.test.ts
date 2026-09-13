import { AppError } from '../../shared/middleware/error-handler';
import {
  AiConversationStore,
  conversationOwnerWhere,
} from '../../modules/ai/services/ai-conversation.store';
import { buildCfoSystemPrompt, CFO_SYSTEM_PROMPT } from '../../modules/ai/prompts/cfo-system-prompt';
import prisma from '../../shared/database/prisma';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    aiConversation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    aiMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    aiToolExecution: { create: jest.fn() },
    aiPendingAction: { findMany: jest.fn().mockResolvedValue([]) },
    aiAuditLog: { create: jest.fn() },
    $transaction: jest.fn(async (ops: Array<Promise<unknown>>) => Promise.all(ops)),
  },
}));

const OWNER = { userId: 'user-owner', companyId: 'company-a' };
const INTRUDER = { userId: 'user-intruder', companyId: 'company-a' };
const OTHER_TENANT = { userId: 'user-owner', companyId: 'company-b' };
const CONV_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const prismaMock = prisma as unknown as {
  aiConversation: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  aiMessage: { findMany: jest.Mock; create: jest.Mock };
  aiAuditLog: { create: jest.Mock };
};

describe('Gates AI conversation isolation', () => {
  const store = new AiConversationStore();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes every owner query by companyId and userId', () => {
    expect(conversationOwnerWhere(OWNER)).toEqual({
      companyId: OWNER.companyId,
      userId: OWNER.userId,
    });
  });

  it('lists only conversations belonging to the authenticated user in that company', async () => {
    prismaMock.aiConversation.findMany.mockResolvedValue([{ id: CONV_ID, title: 'Mine' }]);

    const rows = await store.listConversations(OWNER);

    expect(rows).toHaveLength(1);
    expect(prismaMock.aiConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: OWNER.companyId, userId: OWNER.userId },
      })
    );
  });

  it('returns 404 when another user in the same company reads a conversation', async () => {
    prismaMock.aiConversation.findFirst.mockResolvedValue(null);

    await expect(store.getConversation(CONV_ID, INTRUDER)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Conversation not found',
    } satisfies Partial<AppError>);

    expect(prismaMock.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: CONV_ID, companyId: INTRUDER.companyId, userId: INTRUDER.userId },
    });
    expect(prismaMock.aiMessage.findMany).not.toHaveBeenCalled();
  });

  it('returns 404 when the same userId is used from another company', async () => {
    prismaMock.aiConversation.findFirst.mockResolvedValue(null);

    await expect(store.requireConversation(CONV_ID, OTHER_TENANT)).rejects.toBeInstanceOf(AppError);
    expect(prismaMock.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: CONV_ID, companyId: OTHER_TENANT.companyId, userId: OTHER_TENANT.userId },
    });
  });

  it('persists user and assistant messages on an owned conversation', async () => {
    const conversation = {
      id: CONV_ID,
      title: 'AR aging',
      userId: OWNER.userId,
      companyId: OWNER.companyId,
    };
    prismaMock.aiConversation.findFirst.mockResolvedValue(conversation);
    prismaMock.aiMessage.create
      .mockResolvedValueOnce({
        id: 'msg-user',
        conversationId: CONV_ID,
        role: 'user',
        content: 'كم المبيعات؟',
        toolCalls: null,
        createdAt: new Date('2026-09-07T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'msg-assistant',
        conversationId: CONV_ID,
        role: 'assistant',
        content: '1,250,000.00 EGP (getSalesSummary, 2026-09-01–2026-09-07)',
        toolCalls: null,
        createdAt: new Date('2026-09-07T10:00:01.000Z'),
      });
    prismaMock.aiConversation.update.mockResolvedValue(conversation);
    prismaMock.aiMessage.findMany.mockResolvedValue([
      { id: 'msg-user', role: 'user', content: 'كم المبيعات؟', toolCalls: null },
      {
        id: 'msg-assistant',
        role: 'assistant',
        content: '1,250,000.00 EGP (getSalesSummary, 2026-09-01–2026-09-07)',
        toolCalls: null,
      },
    ]);

    await store.appendMessage(CONV_ID, 'user', 'كم المبيعات؟');
    await store.persistAssistant(
      CONV_ID,
      '1,250,000.00 EGP (getSalesSummary, 2026-09-01–2026-09-07)'
    );
    const loaded = await store.getConversation(CONV_ID, OWNER);

    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages.map((row) => row.role)).toEqual(['user', 'assistant']);
    expect(prismaMock.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: CONV_ID, companyId: OWNER.companyId, userId: OWNER.userId },
    });
  });
});

describe('CFO system prompt', () => {
  it('defines the Gates AI persona and hard accounting rules', () => {
    expect(CFO_SYSTEM_PROMPT).toContain('Gates Intelligence — CFO & Enterprise Business Assistant');
    expect(CFO_SYSTEM_PROMPT).toMatch(/Never invent/i);
    expect(CFO_SYSTEM_PROMPT).toMatch(/tool outputs/i);
    expect(CFO_SYSTEM_PROMPT).toMatch(/date range/i);
    expect(CFO_SYSTEM_PROMPT).toMatch(/Egyptian Arabic/);
    expect(CFO_SYSTEM_PROMPT).toMatch(/analytical recommendations|توصية تحليلية/);
    expect(CFO_SYSTEM_PROMPT).toContain('EGP / SAR / AED');
    expect(buildCfoSystemPrompt({ companyName: 'شركة حازم' })).toContain('شركة حازم');
  });
});
